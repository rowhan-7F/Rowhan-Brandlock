import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/clients/[tenantId]/brand-assets/[assetId]
//  PATCH  → modifie un asset
//  DELETE → supprime un asset (cascade vers backgrounds + storage cleanup)
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
//  PATCH — modifie un asset
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; assetId: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;
  const { tenantId, assetId } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowedFields = [
    "name",
    "overlay_url", "overlay_filename", "overlay_format",
    "overlay_width", "overlay_height", "duration_seconds",
    "default_bg_url", "default_bg_filename", "default_bg_kind",
    "position_x", "position_y",
    "is_active",
  ];

  const updates: any = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("brand_video_assets")
    .update(updates)
    .eq("id", assetId)
    .eq("tenant_id", tenantId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Asset introuvable" }, { status: 404 });
  }

  return NextResponse.json({ asset: data });
}

// ============================================================
//  DELETE — supprime asset + cascade backgrounds + storage cleanup
// ============================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; assetId: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;
  const { tenantId, assetId } = await params;

  // 1. Récupère l'asset et ses backgrounds pour cleanup storage
  const { data: asset } = await supabase
    .from("brand_video_assets")
    .select("overlay_url, brand_video_asset_backgrounds:brand_video_asset_backgrounds(bg_url)")
    .eq("id", assetId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ error: "Asset introuvable" }, { status: 404 });
  }

  // 2. Cleanup Storage (best-effort, on continue même si échec)
  const overlayPath = extractStoragePath(asset.overlay_url, "brand-video-overlays");
  if (overlayPath) {
    await supabase.storage.from("brand-video-overlays").remove([overlayPath]).catch(() => null);
  }

  const bgPaths: string[] = ((asset as any).brand_video_asset_backgrounds || [])
    .map((bg: any) => extractStoragePath(bg.bg_url, "brand-video-asset-backgrounds"))
    .filter(Boolean) as string[];

  if (bgPaths.length > 0) {
    await supabase.storage.from("brand-video-asset-backgrounds").remove(bgPaths).catch(() => null);
  }

  // 3. Delete asset (cascade DB sur backgrounds)
  const { error } = await supabase
    .from("brand_video_assets")
    .delete()
    .eq("id", assetId)
    .eq("tenant_id", tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function extractStoragePath(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const regex = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
  const match = url.match(regex);
  return match ? match[1] : null;
}