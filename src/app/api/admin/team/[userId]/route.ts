import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/admin/team/[userId]
//  DELETE : supprime un studio user d'un tenant
// ============================================================

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const token = authHeader.substring("Bearer ".length);
  const admin = getAdminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return { error: "Invalid token", status: 401 };
  }
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, role, scope, tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!profile) {
    return { error: "Profile not found", status: 403 };
  }
  return { profile, admin };
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = await authenticate(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { profile, admin } = auth;

  const { userId } = await context.params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requis" }, { status: 400 });
  }

  if (profile.role !== "super_admin" && profile.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (profile.role !== "super_admin" && profile.role !== "tenant_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: target, error: fetchErr } = await admin
    .from("user_profiles")
    .select("user_id, role, tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr || !target) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  if (target.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Utilisateur n'appartient pas a ce tenant" }, { status: 403 });
  }

  if (target.role === "tenant_admin") {
    return NextResponse.json({ error: "Impossible de supprimer un tenant_admin" }, { status: 403 });
  }

  // Delete profile
  const { error: profileErr } = await admin
    .from("user_profiles")
    .delete()
    .eq("user_id", userId);

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // Delete auth user
  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    console.error("[DELETE team] auth delete failed:", authErr.message);
  }

  return NextResponse.json({ success: true });
}