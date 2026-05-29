import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/admin/settings — Phase 9.3.22
//  GET   : lit les settings tenant (autoApproveImages)
//  PATCH : met a jour autoApproveImages (merge dans config_json)
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { profile: null, admin: null };
  }
  const token = authHeader.replace("Bearer ", "");

  const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error } = await tempClient.auth.getUser(token);
  if (error || !userData.user) {
    return { profile: null, admin: null };
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, role, tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return { profile, admin };
}

// ---------- GET ----------
export async function GET(req: Request) {
  try {
    const { profile, admin } = await authenticate(req);
    if (!profile || !admin) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }
    if (!profile.tenant_id) {
      return NextResponse.json({ autoApproveImages: false });
    }

    const { data: tcfg } = await admin
      .from("tenant_configs")
      .select("config_json")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    const autoApproveImages =
      (tcfg?.config_json as any)?.autoApproveImages === true;

    return NextResponse.json({ autoApproveImages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------- PATCH ----------
export async function PATCH(req: Request) {
  try {
    const { profile, admin } = await authenticate(req);
    if (!profile || !admin) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }
    // Seuls les admins tenant (ou super_admin) peuvent changer le setting
    if (profile.role !== "tenant_admin" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }
    if (!profile.tenant_id) {
      return NextResponse.json({ error: "Tenant manquant" }, { status: 400 });
    }

    const body = await req.json();
    const autoApproveImages = body?.autoApproveImages === true;

    // Lire config actuelle pour MERGER (pas ecraser exportTemplates etc.)
    const { data: tcfg } = await admin
      .from("tenant_configs")
      .select("config_json")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    const currentConfig = (tcfg?.config_json as any) || {};
    const newConfig = { ...currentConfig, autoApproveImages };

    const { error: updateErr } = await admin
      .from("tenant_configs")
      .update({ config_json: newConfig })
      .eq("tenant_id", profile.tenant_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, autoApproveImages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}