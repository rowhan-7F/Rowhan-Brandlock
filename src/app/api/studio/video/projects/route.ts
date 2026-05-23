// ============================================================
//  POST /api/studio/video/projects
//  Crée un nouveau projet vidéo (status: 'draft')
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================
//  AUTH HELPER
// ============================================================

async function getAuthenticatedUser(req: NextRequest): Promise<{
  userId: string;
  email: string;
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
      email: user.email || "",
      tenantId: profile.tenant_id,
      role: profile.role,
    };
  } catch {
    return null;
  }
}

// ============================================================
//  POST /api/studio/video/projects
// ============================================================

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.tenantId && user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Aucun tenant associé à votre compte" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { title, mode, format, task_id } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Le titre est obligatoire" },
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: "Le titre doit faire 200 caractères maximum" },
        { status: 400 }
      );
    }

    const validModes = ["voice_off", "interview", "event", "studio_clean", "voice_music", "field_event", "premium_demux"];
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: `Mode invalide. Valeurs acceptées : ${validModes.join(", ")}` },
        { status: 400 }
      );
    }

    const validFormats = ["9_16", "1_1", "16_9"];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Format invalide. Valeurs acceptées : ${validFormats.join(", ")}` },
        { status: 400 }
      );
    }

    if (task_id) {
      const { data: task, error: taskErr } = await supabaseAdmin
        .from("studio_tasks")
        .select("id, tenant_id")
        .eq("id", task_id)
        .maybeSingle();

      if (taskErr || !task) {
        return NextResponse.json(
          { error: "Brief introuvable" },
          { status: 400 }
        );
      }

      if (user.role !== "super_admin" && task.tenant_id !== user.tenantId) {
        return NextResponse.json(
          { error: "Ce brief n'appartient pas à votre tenant" },
          { status: 403 }
        );
      }
    }

    const { data: project, error } = await supabaseAdmin
      .from("studio_video_projects")
      .insert({
        tenant_id: user.tenantId,
        created_by: user.userId,
        title: title.trim(),
        mode,
        format,
        status: "draft",
        task_id: task_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/studio/video/projects] DB error:", error);
      return NextResponse.json(
        { error: "Impossible de créer le projet" },
        { status: 500 }
      );
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/studio/video/projects] error:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}