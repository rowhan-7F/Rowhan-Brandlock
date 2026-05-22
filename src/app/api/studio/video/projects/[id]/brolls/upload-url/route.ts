// ============================================================
//  POST /api/studio/video/projects/[id]/brolls/upload-url
//
//  Génère une SIGNED URL Supabase Storage pour uploader un b-roll
//  (vidéo MP4/MOV ou image PNG/JPG/WEBP) directement depuis le browser.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  MAX_BROLL_SIZE_BYTES,
  ACCEPTED_BROLL_VIDEO_MIME_TYPES,
  ACCEPTED_BROLL_IMAGE_MIME_TYPES,
} from "@/lib/video/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const BUCKET_NAME = "video-brolls";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    const {
      data: { user },
    } = await userClient.auth.getUser();
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

    console.log("[brolls/upload-url] Body received:", { fileName, fileSize, fileType });

    if (!fileName || !fileSize || !fileType) {
      return NextResponse.json(
        { error: "fileName, fileSize et fileType sont requis" },
        { status: 400 }
      );
    }

    // Validate MIME type (vidéo ou image)
    const acceptedVideo: readonly string[] = ACCEPTED_BROLL_VIDEO_MIME_TYPES;
    const acceptedImage: readonly string[] = ACCEPTED_BROLL_IMAGE_MIME_TYPES;
    const isVideo = acceptedVideo.includes(fileType);
    const isImage = acceptedImage.includes(fileType);

    if (!isVideo && !isImage) {
      return NextResponse.json(
        {
          error: `Format non supporté: ${fileType}. Utilise MP4, MOV, PNG, JPG ou WEBP.`,
        },
        { status: 400 }
      );
    }

    // Validate size
    if (fileSize > MAX_BROLL_SIZE_BYTES) {
      const maxMB = Math.round(MAX_BROLL_SIZE_BYTES / 1024 / 1024);
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${maxMB} MB).` },
        { status: 400 }
      );
    }

    // Verify project exists + ownership
    const { data: project, error: projectErr } = await supabaseAdmin
      .from("studio_video_projects")
      .select("id, tenant_id, archived_at")
      .eq("id", id)
      .maybeSingle();

    if (projectErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.archived_at) {
      return NextResponse.json(
        { error: "Project is archived" },
        { status: 400 }
      );
    }

    if (user.role !== "super_admin" && project.tenant_id !== user.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate unique path in bucket
    const ext = fileName.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "png");
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const path = `${project.tenant_id}/${id}/broll-${timestamp}-${random}.${ext}`;

    // Create signed upload URL
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(path);

    if (signErr || !signed) {
      return NextResponse.json(
        { error: `Erreur génération URL: ${signErr?.message}` },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return NextResponse.json({
      uploadUrl: signed.signedUrl,
      path,
      token: signed.token,
      publicUrl: publicUrlData.publicUrl,
      brollType: isVideo ? "video" : "image",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server error: ${err.message}` },
      { status: 500 }
    );
  }
}