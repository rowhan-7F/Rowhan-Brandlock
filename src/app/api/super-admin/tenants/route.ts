import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/tenants
//  GET  → liste tous les tenants avec compteurs d'utilisateurs
//  POST → crée un tenant + N utilisateurs (atomique)
// ============================================================

const VALID_TIERS = ["enterprise_b2g", "pro_b2b", "starter"];
const VALID_ROLES = ["tenant_admin", "graphist"];

// ------------------------------------------------------------
//  Helper : auth super_admin uniquement
// ------------------------------------------------------------
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
//  GET — liste tous les tenants
// ============================================================
export async function GET(req: NextRequest) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  try {
    // 1) Lire tous les tenants
    const { data: tenants, error: tenantsErr } = await supabase
      .from("tenant_configs")
      .select("tenant_id, tenant_name, tier, config_version, is_active, created_at, updated_at, notes")
      .order("created_at", { ascending: false });

    if (tenantsErr) {
      return NextResponse.json({ error: tenantsErr.message }, { status: 500 });
    }

    // 2) Compter les users par tenant
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("tenant_id, role")
      .neq("scope", "platform");

    const counts: Record<string, { admins: number; graphists: number }> = {};
    (profiles || []).forEach((p) => {
      if (!p.tenant_id) return;
      if (!counts[p.tenant_id]) counts[p.tenant_id] = { admins: 0, graphists: 0 };
      if (p.role === "tenant_admin") counts[p.tenant_id].admins += 1;
      if (p.role === "graphist") counts[p.tenant_id].graphists += 1;
    });

    // 3) Joindre
    const tenantsWithCounts = (tenants || []).map((t) => ({
      ...t,
      admins_count: counts[t.tenant_id]?.admins || 0,
      graphists_count: counts[t.tenant_id]?.graphists || 0,
    }));

    return NextResponse.json({ tenants: tenantsWithCounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
//  POST — crée un tenant + N users (atomique)
// ============================================================
export async function POST(req: NextRequest) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase } = auth;

  try {
    const body = await req.json();
    const { tenant_id, tenant_name, tier, config_json, notes, users } = body;

    // ============================================================
    //  Validations
    // ============================================================
    if (!tenant_id || typeof tenant_id !== "string") {
      return NextResponse.json({ error: "tenant_id manquant" }, { status: 400 });
    }
    if (!/^[a-z0-9_-]+$/.test(tenant_id)) {
      return NextResponse.json(
        { error: "tenant_id doit être en minuscules, chiffres, _ ou - uniquement" },
        { status: 400 }
      );
    }
    if (!tenant_name || typeof tenant_name !== "string") {
      return NextResponse.json({ error: "tenant_name manquant" }, { status: 400 });
    }
    if (!VALID_TIERS.includes(tier)) {
      return NextResponse.json(
        { error: `tier invalide. Valeurs autorisées : ${VALID_TIERS.join(", ")}` },
        { status: 400 }
      );
    }
    if (!config_json || typeof config_json !== "object") {
      return NextResponse.json({ error: "config_json doit être un objet JSON valide" }, { status: 400 });
    }
    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: "Au moins 1 utilisateur requis" }, { status: 400 });
    }

    // Vérif : au moins 1 admin
    const hasAdmin = users.some((u: any) => u.role === "tenant_admin");
    if (!hasAdmin) {
      return NextResponse.json({ error: "Au moins 1 tenant_admin requis" }, { status: 400 });
    }

    // Vérif chaque user
    for (const u of users) {
      if (!u.email || !u.password || !u.role) {
        return NextResponse.json(
          { error: "Chaque user doit avoir email, password et role" },
          { status: 400 }
        );
      }
      if (!VALID_ROLES.includes(u.role)) {
        return NextResponse.json(
          { error: `Rôle invalide : ${u.role}. Valeurs : ${VALID_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
      if (u.password.length < 6) {
        return NextResponse.json(
          { error: `Mot de passe trop court pour ${u.email} (min 6 caractères)` },
          { status: 400 }
        );
      }
    }

    // ============================================================
    //  Vérifier que le tenant_id n'existe pas déjà
    // ============================================================
    const { data: existing } = await supabase
      .from("tenant_configs")
      .select("tenant_id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Le tenant '${tenant_id}' existe déjà` },
        { status: 400 }
      );
    }

    // ============================================================
    //  ÉTAPE 1 — Créer le tenant_config
    // ============================================================
    const { error: insertTenantErr } = await supabase
      .from("tenant_configs")
      .insert({
        tenant_id,
        tenant_name,
        tier,
        config_json,
        config_version: "1.0.0",
        is_active: true,
        notes: notes || null,
        created_by: user.id,
      });

    if (insertTenantErr) {
      return NextResponse.json({ error: `Erreur création tenant: ${insertTenantErr.message}` }, { status: 500 });
    }

    // ============================================================
    //  ÉTAPE 2 — Créer les utilisateurs (Auth + Profile)
    //  Si une création échoue, on rollback tout
    // ============================================================
    const createdUsers: { user_id: string; email: string; role: string }[] = [];
    const errors: string[] = [];

    for (const u of users) {
      // 1) Créer dans Supabase Auth
      const { data: created, error: createAuthErr } = await supabase.auth.admin.createUser({
        email: u.email.trim().toLowerCase(),
        password: u.password,
        email_confirm: true, // auto-confirme l'email
      });

      if (createAuthErr || !created.user) {
        errors.push(`${u.email}: ${createAuthErr?.message || "Erreur inconnue"}`);
        continue;
      }

      // 2) Créer dans user_profiles
      const { error: profileErr } = await supabase.from("user_profiles").insert({
        user_id: created.user.id,
        email: u.email.trim().toLowerCase(),
        display_name: u.display_name || null,
        scope: "tenant",
        role: u.role,
        tenant_id,
      });

      if (profileErr) {
        // Rollback : supprimer le user auth qu'on vient de créer
        await supabase.auth.admin.deleteUser(created.user.id);
        errors.push(`${u.email}: ${profileErr.message}`);
        continue;
      }

      createdUsers.push({
        user_id: created.user.id,
        email: u.email.trim().toLowerCase(),
        role: u.role,
      });
    }

    // ============================================================
    //  ROLLBACK GLOBAL si erreurs critiques
    //  Si AUCUN user n'a été créé → on supprime le tenant
    // ============================================================
    if (createdUsers.length === 0) {
      await supabase.from("tenant_configs").delete().eq("tenant_id", tenant_id);
      return NextResponse.json(
        { error: `Aucun utilisateur créé. Erreurs : ${errors.join(" | ")}` },
        { status: 500 }
      );
    }

    // ============================================================
    //  Succès (avec ou sans warnings)
    // ============================================================
    return NextResponse.json({
      success: true,
      tenant: { tenant_id, tenant_name, tier },
      users_created: createdUsers,
      warnings: errors.length > 0 ? errors : null,
    });
  } catch (err: any) {
    console.error("[super-admin/tenants POST] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
