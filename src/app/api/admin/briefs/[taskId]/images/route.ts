import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  POST /api/admin/briefs/[taskId]/images
//  Upload une IMAGE attachée à un brief
//  → Stockée dans brand_images avec :
//    - is_approved = true (validée par l'admin lui-même)
//    - related_task_id = taskId
// ============================================================

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

async function authenticateAdmin(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const authHeader = req.headers.get("authorization");
  let user = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const tempClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await tempClient.auth.getUser(token);
    user = data.user;
  }

  if (!user) {
    return { error: "Non authentifié", status: 401 };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return { error: "Profil introuvable", status: 403 };
  }

  if (!["tenant_admin", "super_admin"].includes(profile.role)) {
    return { error: "Action réservée aux admins", status: 403 };
  }

  return {
    user,
    supabase,
    tenantId: profile.tenant_id as string,
    role: profile.role as string,
  };
}

// ============================================================
//  POST — Upload image (auto-approuvée, liée au brief)
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = await authenticateAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user, supabase, tenantId } = auth;

  try {
    const { taskId } = await params;

    // Vérifier le brief
    const { data: task } = await supabase
      .from("studio_tasks")
      .select("id, tenant_id")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) {
      return NextResponse.json({ error: "Brief introuvable" }, { status: 404 });
    }

    if (task.tenant_id !== tenantId && auth.role !== "super_admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Type d'image non autorisé : ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `Image trop volumineuse (max ${MAX_IMAGE_SIZE / 1024 / 1024} MB)` },
        { status: 400 }
      );
    }

    // Upload vers Storage
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `briefs/${task.tenant_id}/${taskId}/images/${timestamp}_${safeName}`;

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from("brand-libraries")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("[brief images POST] upload error:", uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("brand-libraries")
      .getPublicUrl(storagePath);

    // ⭐ Insère dans brand_images avec le bon mapping de colonnes
    const { data: image, error: insertErr } = await supabase
      .from("brand_images")
      .insert({
        tenant_id: task.tenant_id,
        public_url: urlData.publicUrl,
        storage_path: storagePath,
        filename: file.name,
        size_bytes: file.size,
        uploaded_by: user.id,
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        related_task_id: taskId,
        source: "admin_brief",
      })
      .select()
      .single();

    if (insertErr) {
      await supabase.storage.from("brand-libraries").remove([storagePath]);
      console.error("[brief images POST] insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, image });
  } catch (err: any) {
    console.error("[brief images POST] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
//  GET — Liste les images liées à ce brief
// ============================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const authHeader = req.headers.get("authorization");
  let user = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const tempClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await tempClient.auth.getUser(token);
    user = data.user;
  }

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { taskId } = await params;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 403 });
    }

    const { data: task } = await supabase
      .from("studio_tasks")
      .select("id, tenant_id")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) {
      return NextResponse.json({ error: "Brief introuvable" }, { status: 404 });
    }

    const hasAccess =
      profile.role === "super_admin" ||
      (profile.tenant_id === task.tenant_id &&
        ["tenant_admin", "graphist"].includes(profile.role));

    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { data: images, error } = await supabase
      .from("brand_images")
      .select("*")
      .eq("related_task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ images: images || [] });
  } catch (err: any) {
    console.error("[brief images GET] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}