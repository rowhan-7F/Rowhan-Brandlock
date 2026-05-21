// ============================================================
//  POST /api/studio/video/projects/[id]/upload
//
//  Génère une SIGNED URL Supabase Storage pour uploader la source
//  vidéo directement depuis le browser (bypass Next.js, pas de timeout).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MAX_SIZE_BYTES = 500 * 1024 * 1024;
const ACCEPTED_MIME = ["video/mp4", "video/quicktime"];

async function getAuthenticatedUser(req: NextRequest): Promise<{
  userId: string;
  tenantId: string | null;
  role: string;
} | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) return null;

    return {
      userId: user.id,
      tenantId: profile.tenant_id,
      role: profile.role,
    };
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { fileName, fileSize, fileType } = body;

    if (!fileName || !fileSize || !fileType) {
      return NextResponse.json(
        { error: "fileName, fileSize et fileType sont requis" },
        { status: 400 }
      );
    }

    if (!ACCEPTED_MIME.includes(fileType)) {
      return NextResponse.json(
        { error: `Format non supporté. Utilise MP4 ou MOV.` },
        { status: 400 }
      );
    }

    if (fileSize > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${MAX_SIZE_BYTES / 1024 / 1024} MB)` },
        { status: 400 }
      );
    }

    const { data: project, error: projErr } = await supabaseAdmin
      .from("studio_video_projects")
      .select("id, tenant_id, status, source_video_url")
      .eq("id", id)
      .maybeSingle();

    if (projErr || !project) {
      return NextResponse.json(
        { error: "Projet introuvable" },
        { status: 404 }
      );
    }

    if (user.role !== "super_admin" && project.tenant_id !== user.tenantId) {
      return NextResponse.json(
        { error: "Accès interdit" },
        { status: 403 }
      );
    }

    if (project.status !== "draft") {
      return NextResponse.json(
        { error: `Upload impossible : le projet est en status "${project.status}"` },
        { status: 400 }
      );
    }

    const ext = fileName.split(".").pop()?.toLowerCase() || "mp4";
    const allowedExts = ["mp4", "mov"];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: "Extension non supportée. Utilise .mp4 ou .mov" },
        { status: 400 }
      );
    }

    const storagePath = `${project.tenant_id}/${id}/source.${ext}`;

    const { data: signedData, error: signedErr } = await supabaseAdmin.storage
      .from("video-sources")
      .createSignedUploadUrl(storagePath, { upsert: true });

    if (signedErr || !signedData) {
      console.error("[upload signed URL] error:", signedErr);
      return NextResponse.json(
        { error: "Impossible de générer le lien d'upload" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      uploadUrl: signedData.signedUrl,
      path: storagePath,
      token: signedData.token,
    });
  } catch (err: any) {
    console.error("[POST upload] error:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}