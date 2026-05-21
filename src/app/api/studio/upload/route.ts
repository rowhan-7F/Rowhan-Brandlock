import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "../../../../lib/supabase-server";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("scope, role, tenant_id, display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil introuvable" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const requestedTenantId = formData.get("tenantId") as string;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }
    if (!requestedTenantId) {
      return NextResponse.json({ error: "tenantId requis" }, { status: 400 });
    }

    const isSuperAdmin =
      profile.scope === "platform" && profile.role === "super_admin";
    const isOwnTenant =
      profile.scope === "tenant" && profile.tenant_id === requestedTenantId;

    if (!isSuperAdmin && !isOwnTenant) {
      return NextResponse.json(
        { error: "Tu n'as pas accès à ce tenant" },
        { status: 403 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Seules les images sont autorisées" },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 10 Mo)" },
        { status: 400 }
      );
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const uniqueId = randomUUID();
    const storagePath = `${requestedTenantId}/${uniqueId}.${ext}`;

    const admin = createAdminSupabaseClient();
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await admin.storage
      .from("brand-libraries")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Erreur upload storage:", uploadError);
      return NextResponse.json(
        { error: `Upload échoué : ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = admin.storage
      .from("brand-libraries")
      .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    const autoApproved = isSuperAdmin || profile.role === "tenant_admin";

    const insertPayload: any = {
      id: uniqueId,
      tenant_id: requestedTenantId,
      client_email: user.email,
      storage_path: storagePath,
      public_url: publicUrl,
      filename: file.name,
      size_bytes: file.size,
      uploaded_by: user.id,
      is_approved: autoApproved,
      uploaded_at: new Date().toISOString(),
    };

    if (autoApproved) {
      insertPayload.approved_by = user.id;
      insertPayload.approved_at = new Date().toISOString();
    }

    const { data: inserted, error: insertError } = await admin
      .from("brand_images")
      .insert(insertPayload)
      .select(
        "id, public_url, thumbnail_url, filename, brand_name, tags, is_approved, uploaded_by, approved_at, width, height, dominant_colors"
      )
      .single();

    if (insertError) {
      await admin.storage.from("brand-libraries").remove([storagePath]);
      return NextResponse.json(
        { error: `Insert DB échoué : ${insertError.message}` },
        { status: 500 }
      );
    }

    await admin.from("metric_events").insert({
      id: randomUUID(),
      tenant_id: requestedTenantId,
      user_id: user.id,
      event_type: "media.uploaded",
      metadata: {
        image_id: uniqueId,
        auto_approved: autoApproved,
        filename: file.name,
        size_bytes: file.size,
      },
    });

    return NextResponse.json({ success: true, image: inserted });
  } catch (err: any) {
    console.error("[POST /api/studio/upload]", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
