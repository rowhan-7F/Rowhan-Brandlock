import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/prospects/[id]/convert
//  POST → Crée un tenant + un tenant_admin user depuis un prospect
//  Marque le prospect comme "client"
// ============================================================

async function authenticateSuperAdmin(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Non authentifié", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const tempClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user } } = await tempClient.auth.getUser(token);
  if (!user) return { error: "Token invalide", status: 401 };

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("scope, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.scope !== "platform" || profile.role !== "super_admin") {
    return { error: "Accès super-admin uniquement", status: 403 };
  }

  return { user, supabase };
}

// ============================================================
//  POST — Convertir un prospect en client
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;
  const { id: prospectId } = await params;

  try {
    const body = await req.json();
    const {
      tenantId,        // Slug technique (ex: "canton_geneve")
      tenantName,      // Nom affiché (ex: "Canton de Genève")
      tier,            // enterprise_b2g | pro_b2b | starter
      adminEmail,      // Email du futur tenant_admin
      adminPassword,   // Mot de passe initial
      adminDisplayName,
      brandColor,      // Couleur primaire de la marque
    } = body;

    // ============================================================
    //  Validation
    // ============================================================
    if (!tenantId || !tenantName || !adminEmail || !adminPassword) {
      return NextResponse.json({
        error: "Champs manquants : tenantId, tenantName, adminEmail, adminPassword requis"
      }, { status: 400 });
    }

    if (!/^[a-z0-9_]{3,40}$/.test(tenantId)) {
      return NextResponse.json({
        error: "tenantId invalide. Utilise uniquement minuscules, chiffres et underscore."
      }, { status: 400 });
    }

    const validTiers = ["enterprise_b2g", "pro_b2b", "starter"];
    if (!validTiers.includes(tier)) {
      return NextResponse.json({
        error: `tier invalide. Valeurs : ${validTiers.join(", ")}`
      }, { status: 400 });
    }

    // ============================================================
    //  Vérifier que le prospect existe
    // ============================================================
    const { data: prospect, error: prospectError } = await supabase
      .from("prospect_messages")
      .select("*")
      .eq("id", prospectId)
      .maybeSingle();

    if (prospectError || !prospect) {
      return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
    }

    if (prospect.status === "client") {
      return NextResponse.json({
        error: "Ce prospect est déjà converti en client"
      }, { status: 400 });
    }

    // ============================================================
    //  Vérifier que tenant_id n'existe pas déjà
    // ============================================================
    const { data: existingTenant } = await supabase
      .from("tenant_configs")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existingTenant) {
      return NextResponse.json({
        error: `Le tenant "${tenantId}" existe déjà. Choisis un autre identifiant.`
      }, { status: 400 });
    }

    // ============================================================
    //  Vérifier que l'email n'est pas déjà utilisé
    // ============================================================
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      u => u.email?.toLowerCase() === adminEmail.toLowerCase()
    );
    if (emailExists) {
      return NextResponse.json({
        error: `L'email ${adminEmail} est déjà utilisé sur la plateforme.`
      }, { status: 400 });
    }

    // ============================================================
    //  ÉTAPE 1 : Créer le tenant_config
    // ============================================================
    const configJson = {
      tenant: {
        id: tenantId,
        name: tenantName,
      },
      brandIdentity: {
        colors: {
          brandPrimary: brandColor || "#B11E2F",
          textPrimary: "#181614",
          backgroundPrimary: "#FFFFFF",
        },
      },
      exportTemplates: {
        carrousel_instagram: {
          width: 1080,
          height: 1350,
          slideVariants: {
            intro: {
              label: "Intro",
              description: "Première slide d'accroche",
              subVariants: {
                default: {
                  label: "Standard",
                  inputs: [
                    { key: "title", type: "text", label: "Titre", required: true, maxLength: 80 },
                    { key: "subtitle", type: "textarea", label: "Sous-titre", maxLength: 200 },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const { error: tenantError } = await supabase
      .from("tenant_configs")
      .insert({
        tenant_id: tenantId,
        config_json: configJson,
        tier: tier,
        onboarding_status: "pending",
        created_from_prospect_id: prospectId,
      });

    if (tenantError) {
      console.error("[convert] tenant_configs insert error:", tenantError);
      return NextResponse.json({
        error: `Erreur création tenant : ${tenantError.message}`
      }, { status: 500 });
    }

    // ============================================================
    //  ÉTAPE 2 : Créer le user Supabase Auth
    // ============================================================
    const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Pas besoin de confirmer l'email
      user_metadata: {
        display_name: adminDisplayName || adminEmail.split("@")[0],
        created_from_prospect: prospectId,
      },
    });

    if (authError || !newAuthUser.user) {
      // Rollback : supprimer le tenant
      await supabase.from("tenant_configs").delete().eq("tenant_id", tenantId);
      console.error("[convert] auth.createUser error:", authError);
      return NextResponse.json({
        error: `Erreur création utilisateur : ${authError?.message}`
      }, { status: 500 });
    }

    // ============================================================
    //  ÉTAPE 3 : Créer le user_profile
    // ============================================================
    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert({
        user_id: newAuthUser.user.id,
        email: adminEmail,
        display_name: adminDisplayName || adminEmail.split("@")[0],
        scope: "tenant",
        tenant_id: tenantId,
        role: "tenant_admin",
      });

    if (profileError) {
      // Rollback : supprimer le user auth + tenant
      await supabase.auth.admin.deleteUser(newAuthUser.user.id);
      await supabase.from("tenant_configs").delete().eq("tenant_id", tenantId);
      console.error("[convert] user_profile insert error:", profileError);
      return NextResponse.json({
        error: `Erreur création profil : ${profileError.message}`
      }, { status: 500 });
    }

    // ============================================================
    //  ÉTAPE 4 : Mettre à jour le prospect en "client"
    // ============================================================
    await supabase
      .from("prospect_messages")
      .update({
        status: "client",
        updated_at: new Date().toISOString(),
      })
      .eq("id", prospectId);

    // ============================================================
    //  Réponse
    // ============================================================
    return NextResponse.json({
      success: true,
      tenant: {
        id: tenantId,
        name: tenantName,
        tier,
        onboardingStatus: "pending",
      },
      admin: {
        userId: newAuthUser.user.id,
        email: adminEmail,
        password: adminPassword, // Renvoyé une seule fois ici pour que le super-admin puisse le transmettre
        displayName: adminDisplayName,
      },
      credentials: {
        loginUrl: process.env.NEXT_PUBLIC_APP_URL || "/",
        email: adminEmail,
        password: adminPassword,
      },
    });
  } catch (err: any) {
    console.error("[convert prospect] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
