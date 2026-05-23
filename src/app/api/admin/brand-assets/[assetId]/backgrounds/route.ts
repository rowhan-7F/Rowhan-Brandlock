import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// ============================================================
//  POST /api/admin/brand-assets/[assetId]/backgrounds
//  Upload BG variant.
//
//  Auth : super_admin / tenant_admin -> auto-approved
//         graphist -> pending (is_approved=false)
//
//  Body : { name, bg_url, bg_filename, bg_format, bg_kind, width, height }
// ============================================================

export async function POST(
  req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase } = auth;
  const { assetId } = await params;

  // Auth roles
  const allowedRoles = ["super_admin", "tenant_admin", "graphist"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Récupère l'asset pour valider tenant
  const { data: asset, error: assetErr } = await supabase
    .from("brand_video_assets")
    .select("id, tenant_id")
    .eq("id", assetId)
    .maybeSingle();

  if (assetErr || !asset) {
    return NextResponse.json({ error: "Asset introuvable" }, { status: 404 });
  }
  if (user.role !== "super_admin" && user.tenant_id !== asset.tenant_id) {
    return NextResponse.json({ error: "Accès refusé (autre tenant)" }, { status: 403 });
  }

  // Parse body
  const body = await req.json();
  const { name, bg_url, bg_filename, bg_format, bg_kind, width, height } = body;

  if (!name || !bg_url || !bg_filename || !bg_format || !bg_kind || !width || !height) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  // Validation
  const allowedFormats = ["mp4", "png", "jpg", "jpeg", "webp"];
  const allowedKinds = ["video", "image"];
  if (!allowedFormats.includes(bg_format)) {
    return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  }
  if (!allowedKinds.includes(bg_kind)) {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }

  // Status selon role
  const isAutoApproved = user.role === "super_admin" || user.role === "tenant_admin";
  const now = new Date().toISOString();

  const { data: bg, error: insertErr } = await supabase
    .from("brand_video_asset_backgrounds")
    .insert({
      asset_id: assetId,
      tenant_id: asset.tenant_id,
      name,
      bg_url,
      bg_filename,
      bg_format,
      bg_kind,
      width,
      height,
      is_approved: isAutoApproved,
      uploaded_by: user.id,
      uploaded_by_role: user.role,
      approved_by: isAutoApproved ? user.id : null,
      approved_at: isAutoApproved ? now : null,
    })
    .select()
    .single();

  if (insertErr) {
    console.error("[POST admin bg]", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ background: bg }, { status: 201 });
}