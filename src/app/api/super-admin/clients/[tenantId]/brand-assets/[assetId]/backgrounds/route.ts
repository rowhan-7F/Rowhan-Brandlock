import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/clients/[tenantId]/brand-assets/[assetId]/backgrounds
//  GET  → liste les BGs de l'asset
//  POST → ajoute un BG variant (auto-approved car superadmin)
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
//  GET — liste des backgrounds de l'asset
// ============================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; assetId: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;
  const { tenantId, assetId } = await params;

  const { data, error } = await supabase
    .from("brand_video_asset_backgrounds")
    .select("*")
    .eq("asset_id", assetId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ backgrounds: data || [] });
}

// ============================================================
//  POST — upload BG variant (auto-approved car superadmin)
//  Body : { name, bg_url, bg_filename, bg_format, bg_kind, width, height }
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; assetId: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase } = auth;
  const { tenantId, assetId } = await params;

  // Vérif asset existe et belongs to tenant
  const { data: asset } = await supabase
    .from("brand_video_assets")
    .select("id")
    .eq("id", assetId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ error: "Asset introuvable" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errors: string[] = [];
  if (!body.name) errors.push("name requis");
  if (!body.bg_url) errors.push("bg_url requis");
  if (!body.bg_filename) errors.push("bg_filename requis");
  if (!body.bg_format || !["mp4", "png", "jpg", "jpeg", "webp"].includes(body.bg_format)) {
    errors.push("bg_format requis (mp4/png/jpg/jpeg/webp)");
  }
  if (!body.bg_kind || !["video", "image"].includes(body.bg_kind)) {
    errors.push("bg_kind requis (video/image)");
  }
  if (!body.width || !body.height) errors.push("width et height requis");

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" — ") }, { status: 400 });
  }

  const bgData = {
    asset_id: assetId,
    tenant_id: tenantId,
    name: body.name.trim(),
    bg_url: body.bg_url,
    bg_filename: body.bg_filename,
    bg_format: body.bg_format,
    bg_kind: body.bg_kind,
    width: parseInt(body.width, 10),
    height: parseInt(body.height, 10),
    is_approved: true, // ⭐ auto-approved car superadmin upload
    uploaded_by: user.id,
    uploaded_by_role: "superadmin",
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("brand_video_asset_backgrounds")
    .insert(bgData)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ background: data }, { status: 201 });
}