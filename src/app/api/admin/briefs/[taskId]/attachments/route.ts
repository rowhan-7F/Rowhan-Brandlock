import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  POST /api/admin/briefs/[taskId]/attachments
//  Upload un fichier (PDF, etc.) attaché à un brief
//  Multipart/form-data : file
// ============================================================

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

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

  // Service role pour bypass RLS (on contrôle nous-même)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Vérifier que l'user est admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, tenant_id, scope")
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
//  POST — Upload fichier attaché à un brief
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

    // Vérifier que le brief existe et appartient au tenant
    const { data: task, error: taskErr } = await supabase
      .from("studio_tasks")
      .select("id, tenant_id")
      .eq("id", taskId)
      .maybeSingle();

    if (taskErr || !task) {
      return NextResponse.json({ error: "Brief introuvable" }, { status: 404 });
    }

    if (task.tenant_id !== tenantId && auth.role !== "super_admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Récupérer le fichier
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Type de fichier non autorisé : ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
        { status: 400 }
      );
    }

    // Upload vers Supabase Storage
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `briefs/${task.tenant_id}/${taskId}/${timestamp}_${safeName}`;

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from("brand-libraries")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("[brief attachments POST] upload error:", uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("brand-libraries")
      .getPublicUrl(storagePath);

    // Insérer dans la table
    const { data: attachment, error: insertErr } = await supabase
      .from("brief_attachments")
      .insert({
        task_id: taskId,
        tenant_id: task.tenant_id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      // Rollback : supprimer le fichier uploadé
      await supabase.storage.from("brand-libraries").remove([storagePath]);
      console.error("[brief attachments POST] insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, attachment });
  } catch (err: any) {
    console.error("[brief attachments POST] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
//  GET — Liste les attachments d'un brief
//  Accessible aux admins ET au graphiste assigné
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

    // Récupérer le profil + la task pour vérifier l'accès
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
      .select("id, tenant_id, assigned_to")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) {
      return NextResponse.json({ error: "Brief introuvable" }, { status: 404 });
    }

    // Accès si : admin du tenant, super_admin, ou graphiste assigné
    const hasAccess =
      profile.role === "super_admin" ||
      (profile.tenant_id === task.tenant_id &&
        ["tenant_admin", "graphist"].includes(profile.role));

    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { data: attachments, error } = await supabase
      .from("brief_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attachments: attachments || [] });
  } catch (err: any) {
    console.error("[brief attachments GET] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
//  DELETE — Supprime un attachment
//  Body : { attachment_id: string }
// ============================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = await authenticateAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabase, tenantId } = auth;

  try {
    const { taskId } = await params;
    const body = await req.json();
    const { attachment_id } = body;

    if (!attachment_id) {
      return NextResponse.json({ error: "attachment_id requis" }, { status: 400 });
    }

    const { data: attachment } = await supabase
      .from("brief_attachments")
      .select("*")
      .eq("id", attachment_id)
      .eq("task_id", taskId)
      .maybeSingle();

    if (!attachment) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    if (attachment.tenant_id !== tenantId && auth.role !== "super_admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Supprimer du Storage
    if (attachment.storage_path) {
      await supabase.storage.from("brand-libraries").remove([attachment.storage_path]);
    }

    // Supprimer de la DB
    const { error } = await supabase
      .from("brief_attachments")
      .delete()
      .eq("id", attachment_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
