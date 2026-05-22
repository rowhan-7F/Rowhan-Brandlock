import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/clients/[tenantId]/brand-assets
//  GET  → liste les brand assets (intro/outro) d'un tenant
//  POST → crée un nouveau template (superadmin only)
//         Body : { asset_type, name, overlay_url, overlay_filename,
//                  overlay_format, overlay_width, overlay_height,
//                  duration_seconds, default_bg_url?, default_bg_kind?,
//                  position_x?, position_y? }
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
//  GET — liste assets du tenant (avec compteurs BG)
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
  const { tenantId } = await params;

  try {
    const { data: assets, error } = await supabase
      .from("brand_video_assets")
      .select("*, backgrounds:brand_video_asset_backgrounds(id, name, bg_url, bg_kind, is_approved, created_at)")
      .eq("tenant_id", tenantId)
      .order("asset_type", { ascending: true });

    if (error) {
      console.error("[GET brand-assets]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assets: assets || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
//  POST — crée un brand asset template (superadmin only)
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase } = auth;
  const { tenantId } = await params;

  // Vérif tenant existe
  const { data: tenant } = await supabase
    .from("tenant_configs")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validation
  const errors: string[] = [];
  if (!body.asset_type || !["intro", "outro"].includes(body.asset_type)) {
    errors.push("asset_type requis ('intro' ou 'outro')");
  }
  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    errors.push("name requis");
  }
  if (!body.overlay_url || typeof body.overlay_url !== "string") {
    errors.push("overlay_url requis");
  }
  if (!body.overlay_filename) errors.push("overlay_filename requis");
  if (!body.overlay_format || !["png", "gif", "mov", "webm"].includes(body.overlay_format)) {
    errors.push("overlay_format requis (png/gif/mov/webm)");
  }
  if (!body.overlay_width || !body.overlay_height) {
    errors.push("overlay_width et overlay_height requis");
  }
  if (!body.duration_seconds || body.duration_seconds <= 0 || body.duration_seconds > 30) {
    errors.push("duration_seconds requis (> 0 et <= 30)");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" — ") }, { status: 400 });
  }

  const assetData = {
    tenant_id: tenantId,
    asset_type: body.asset_type,
    name: body.name.trim(),
    overlay_url: body.overlay_url,
    overlay_filename: body.overlay_filename,
    overlay_format: body.overlay_format,
    overlay_width: parseInt(body.overlay_width, 10),
    overlay_height: parseInt(body.overlay_height, 10),
    duration_seconds: parseFloat(body.duration_seconds),
    default_bg_url: body.default_bg_url || null,
    default_bg_filename: body.default_bg_filename || null,
    default_bg_kind: body.default_bg_kind || null,
    position_x: body.position_x ?? 0,
    position_y: body.position_y ?? 0,
    is_active: body.is_active ?? true,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("brand_video_assets")
    .insert(assetData)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[POST brand-assets]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ asset: data }, { status: 201 });
}