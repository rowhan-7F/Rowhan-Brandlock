import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  isTenantAdmin,
  createNotification,
} from "@/lib/auth-helpers";

// ============================================================
//  PATCH /api/admin/library/[imageId]
//  Body : { action: "approve" | "reject" }
// ============================================================
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user, supabase } = auth;

  try {
    // Récupère l'image
    const { data: image, error: fetchErr } = await supabase
      .from("brand_images")
      .select("id, tenant_id, filename, uploaded_by, is_approved")
      .eq("id", imageId)
      .maybeSingle();

    if (fetchErr || !image) {
      return NextResponse.json({ error: "Image introuvable" }, { status: 404 });
    }

    // Vérif droits
    if (!isTenantAdmin(user, image.tenant_id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "approve") {
      const { error } = await supabase
        .from("brand_images")
        .update({
          is_approved: true,
          approved_by: user.user_id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", imageId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Notification graphiste
      if (image.uploaded_by && image.uploaded_by !== user.user_id) {
        await createNotification(supabase, {
          userId: image.uploaded_by,
          tenantId: image.tenant_id,
          type: "comment_added", // on réutilise ce type pour l'instant
          title: "✅ Image approuvée",
          message: image.filename || "Une de tes images a été approuvée",
        });
      }

      return NextResponse.json({ success: true, status: "approved" });
    }

    if (action === "reject") {
      // Reject = on supprime l'image (table + storage)
      const { data: imageFull } = await supabase
        .from("brand_images")
        .select("storage_path")
        .eq("id", imageId)
        .maybeSingle();

      // Supprime du storage
      if (imageFull?.storage_path) {
        await supabase.storage
          .from("brand-libraries")
          .remove([imageFull.storage_path]);
      }

      // Supprime de la table
      const { error } = await supabase
        .from("brand_images")
        .delete()
        .eq("id", imageId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Notification graphiste
      if (image.uploaded_by && image.uploaded_by !== user.user_id) {
        await createNotification(supabase, {
          userId: image.uploaded_by,
          tenantId: image.tenant_id,
          type: "comment_added",
          title: "❌ Image refusée",
          message: image.filename || "Une de tes images a été refusée",
        });
      }

      return NextResponse.json({ success: true, status: "rejected" });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (err: any) {
    console.error("[PATCH library/imageId] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}


// ============================================================
//  DELETE /api/admin/library/[imageId]
//  Supprime définitivement (même si déjà approuvée)
// ============================================================
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user, supabase } = auth;

  try {
    const { data: image } = await supabase
      .from("brand_images")
      .select("id, tenant_id, storage_path")
      .eq("id", imageId)
      .maybeSingle();

    if (!image) {
      return NextResponse.json({ error: "Image introuvable" }, { status: 404 });
    }

    if (!isTenantAdmin(user, image.tenant_id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Supprime du storage
    if (image.storage_path) {
      await supabase.storage
        .from("brand-libraries")
        .remove([image.storage_path]);
    }

    const { error } = await supabase
      .from("brand_images")
      .delete()
      .eq("id", imageId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE library/imageId] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
