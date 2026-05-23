import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/admin/team
//  GET  : liste les membres d'un tenant
//  POST : cree un nouveau studio user dans un tenant
//
//  Auth : tenant_admin (sur son tenant) ou super_admin (n'importe quel tenant)
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

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { profile, admin } = auth;

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requis" }, { status: 400 });
  }

  // Authorization checks
  if (profile.role !== "super_admin" && profile.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (profile.role !== "super_admin" && profile.role !== "tenant_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("user_profiles")
    .select("user_id, email, display_name, role, service, tenant_id, created_at")
    .eq("tenant_id", tenantId)
    .in("role", ["tenant_admin", "graphist"])
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data || [] });
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { profile, admin } = auth;

  const body = await req.json();
  const { email, display_name, password, service, tenant_id } = body;

  if (!email || !password || !service || !tenant_id) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Mot de passe trop court (min 8)" }, { status: 400 });
  }

  if (profile.role !== "super_admin" && profile.tenant_id !== tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (profile.role !== "super_admin" && profile.role !== "tenant_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verifier que l'email n'existe pas deja
  const { data: existing } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Cet email est deja utilise" }, { status: 409 });
  }

  // 1. Creer l'auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message || "Erreur creation auth" }, { status: 500 });
  }

  const userId = authData.user.id;

  // 2. Creer le profil
  const { error: profileErr } = await admin.from("user_profiles").insert({
    user_id: userId,
    email,
    display_name: display_name || null,
    role: "graphist",
    scope: "tenant",
    tenant_id,
    service,
  });

  if (profileErr) {
    // Rollback
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    user: { user_id: userId, email, service, tenant_id },
  });
}