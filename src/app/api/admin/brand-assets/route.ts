import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// ============================================================
//  GET /api/admin/brand-assets
//  Liste assets + TOUS les BGs (approved + pending + rejected) du tenant
//
//  Auth : super_admin (avec ?tenantId=) OU tenant_admin OU graphist
// ============================================================

export async function GET(req: Request) {
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase } = auth;

  // Détermine le tenant_id
  let tenantId = user.tenant_id;
  const url = new URL(req.url);
  const queryTenantId = url.searchParams.get("tenantId");
  if (user.role === "super_admin" && queryTenantId) {
    tenantId = queryTenantId;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant requis" }, { status: 400 });
  }

  // Auth roles
  const allowedRoles = ["super_admin", "tenant_admin", "graphist"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (user.role !== "super_admin" && user.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Accès refusé (autre tenant)" }, { status: 403 });
  }

  // Liste tous les assets + BGs (TOUT statut)
  const { data: assets, error } = await supabase
    .from("brand_video_assets")
    .select(`
      id, asset_type, name, overlay_url, overlay_filename, overlay_format,
      overlay_width, overlay_height, duration_seconds,
      default_bg_url, default_bg_filename, default_bg_kind,
      position_x, position_y, is_active, created_at,
      backgrounds:brand_video_asset_backgrounds (
        id, name, bg_url, bg_filename, bg_format, bg_kind,
        width, height, is_approved, uploaded_by_role, uploaded_by,
        approved_by, approved_at, rejected_at, rejection_reason, created_at
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("asset_type", { ascending: true });

  if (error) {
    console.error("[GET admin brand-assets]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assets: assets || [] });
}