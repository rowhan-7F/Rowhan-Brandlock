import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// ============================================================
//  PATCH : approuver / rejeter un BG (tenant_admin OR super_admin)
//  Body : { action: "approve" | "reject", reason?: string }
// ============================================================

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ assetId: string; bgId: string }> }
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase } = auth;
  const { bgId } = await params;

  // Auth : SEUL super_admin OU tenant_admin peut approuver/rejeter
  const allowedRoles = ["super_admin", "tenant_admin"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { error: "Accès refusé (rôle admin requis)" },
      { status: 403 }
    );
  }

  // Récupère le BG pour valider tenant
  const { data: bg, error: bgErr } = await supabase
    .from("brand_video_asset_backgrounds")
    .select("id, tenant_id, is_approved")
    .eq("id", bgId)
    .maybeSingle();

  if (bgErr || !bg) {
    return NextResponse.json({ error: "Background introuvable" }, { status: 404 });
  }
  if (user.role !== "super_admin" && user.tenant_id !== bg.tenant_id) {
    return NextResponse.json({ error: "Accès refusé (autre tenant)" }, { status: 403 });
  }

  const body = await req.json();
  const { action, reason } = body;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Action invalide (approve|reject)" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates =
    action === "approve"
      ? {
          is_approved: true,
          approved_by: user.id,
          approved_at: now,
          rejected_at: null,
          rejection_reason: null,
        }
      : {
          is_approved: false,
          approved_by: null,
          approved_at: null,
          rejected_at: now,
          rejection_reason: reason || "Non spécifié",
        };

  const { data: updated, error: updateErr } = await supabase
    .from("brand_video_asset_backgrounds")
    .update(updates)
    .eq("id", bgId)
    .select()
    .single();

  if (updateErr) {
    console.error("[PATCH bg]", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ background: updated });
}

// ============================================================
//  DELETE : supprime BG + cleanup Storage (tenant_admin OR super_admin)
// ============================================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ assetId: string; bgId: string }> }
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase } = auth;
  const { bgId } = await params;

  const allowedRoles = ["super_admin", "tenant_admin"];
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { data: bg, error: bgErr } = await supabase
    .from("brand_video_asset_backgrounds")
    .select("id, tenant_id, bg_url")
    .eq("id", bgId)
    .maybeSingle();

  if (bgErr || !bg) {
    return NextResponse.json({ error: "Background introuvable" }, { status: 404 });
  }
  if (user.role !== "super_admin" && user.tenant_id !== bg.tenant_id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Cleanup Storage best-effort
  const urlMatch = (bg.bg_url as string).match(
    /\/storage\/v1\/object\/public\/brand-video-asset-backgrounds\/(.+)$/
  );
  if (urlMatch) {
    await supabase.storage
      .from("brand-video-asset-backgrounds")
      .remove([urlMatch[1]])
      .catch(() => null);
  }

  const { error: deleteErr } = await supabase
    .from("brand_video_asset_backgrounds")
    .delete()
    .eq("id", bgId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}