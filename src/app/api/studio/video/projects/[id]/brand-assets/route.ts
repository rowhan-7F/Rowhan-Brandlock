import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// ============================================================
//  GET /api/studio/video/projects/[id]/brand-assets
//
//  Liste les brand assets ACTIFS du tenant du projet (lecture seule).
//  Filtre : assets is_active=true, backgrounds is_approved=true.
//
//  Auth : utilisateur du tenant du projet (tenant_admin/graphist) OU super_admin
// ============================================================

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase } = auth;
  const { id: projectId } = await params;

  // 1. Récupère le tenant_id du projet
  const { data: project, error: projErr } = await supabase
    .from("studio_video_projects")
    .select("tenant_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projErr || !project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  // 2. Vérif droits
  if (user.role !== "super_admin" && user.tenant_id !== project.tenant_id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // 3. Liste les assets actifs avec leurs BGs
  const { data: assets, error: assetsErr } = await supabase
    .from("brand_video_assets")
    .select(`
      id, asset_type, name, overlay_url, overlay_format,
      overlay_width, overlay_height, duration_seconds,
      default_bg_url, default_bg_filename, default_bg_kind,
      backgrounds:brand_video_asset_backgrounds (
        id, name, bg_url, bg_kind, bg_format, width, height, is_approved
      )
    `)
    .eq("tenant_id", project.tenant_id)
    .eq("is_active", true)
    .order("asset_type", { ascending: true });

  if (assetsErr) {
    console.error("[GET studio brand-assets]", assetsErr);
    return NextResponse.json({ error: assetsErr.message }, { status: 500 });
  }

  // ⚠️ Phase 7.3 : on retourne TOUS les BGs (avec leur statut is_approved)
  // Le composant BrandAssetsSelector filtrera côté UI selon le rôle/statut.
  // Le worker filtre déjà is_approved=true au render time.
  return NextResponse.json({ assets: assets || [] });
}