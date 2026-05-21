import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/tenants/[tenantId]
//  GET    → détail d'un tenant + ses users
//  DELETE → supprime tenant + users + tout (cascade)
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
//  GET — détail tenant + ses users
// ============================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  try {
    const { tenantId } = await params;

    // 1) Tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenant_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (tenantErr) {
      return NextResponse.json({ error: tenantErr.message }, { status: 500 });
    }
    if (!tenant) {
      return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
    }

    // 2) Users de ce tenant
    const { data: users } = await supabase
      .from("user_profiles")
      .select("user_id, email, display_name, role, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    // 3) Stats projets
    const { count: totalProjects } = await supabase
      .from("studio_projects")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    return NextResponse.json({
      tenant,
      users: users || [],
      stats: {
        total_projects: totalProjects || 0,
      },
    });
  } catch (err: any) {
    console.error("[tenant GET] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
//  DELETE — supprime tenant + tous les users (cascade)
//  ⚠ Action destructive, à manier avec précaution
// ============================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  try {
    const { tenantId } = await params;

    // 1) Récupérer tous les users de ce tenant
    const { data: users } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("tenant_id", tenantId);

    // 2) Supprimer chaque user (Auth + profile cascade)
    if (users && users.length > 0) {
      for (const u of users) {
        await supabase.auth.admin.deleteUser(u.user_id);
        // Le delete cascade ou trigger devrait nettoyer user_profiles automatiquement
        // Mais on force au cas où :
        await supabase.from("user_profiles").delete().eq("user_id", u.user_id);
      }
    }

    // 3) Supprimer le tenant_config
    const { error: deleteErr } = await supabase
      .from("tenant_configs")
      .delete()
      .eq("tenant_id", tenantId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Tenant ${tenantId} et ${users?.length || 0} utilisateur(s) supprimés`,
    });
  } catch (err: any) {
    console.error("[tenant DELETE] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
