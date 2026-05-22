// ============================================================
//  POST /api/studio/video/projects/[id]/brolls
//
//  Confirme l'upload d'un b-roll et l'ajoute à state_json.brolls[]
//  GET : retourne tous les b-rolls du projet
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  BRoll,
  BRollType,
  BRollPosition,
  DEFAULT_BROLL_SCALE,
  DEFAULT_BROLL_POSITION,
  DEFAULT_IMAGE_DURATION_SECONDS,
} from "@/lib/video/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

function generateBrollId(): string {
  return `broll_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================
//  POST : Confirme upload + ajoute b-roll à la liste
// ============================================================
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
    const {
      publicUrl,
      fileName,
      fileSize,
      fileType,
      brollType,
      duration_seconds,
      start_time,
      end_time,
      position,
      scale,
    } = body;

    if (!publicUrl || !fileName || !brollType) {
      return NextResponse.json(
        { error: "publicUrl, fileName, brollType requis" },
        { status: 400 }
      );
    }

    // Fetch project
    const { data: project, error: projectErr } = await supabaseAdmin
      .from("studio_video_projects")
      .select("id, tenant_id, state_json, source_duration_seconds, archived_at")
      .eq("id", id)
      .maybeSingle();

    if (projectErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.archived_at) {
      return NextResponse.json({ error: "Project is archived" }, { status: 400 });
    }

    if (user.role !== "super_admin" && project.tenant_id !== user.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build the new b-roll entry with defaults
    const sourceDuration = project.source_duration_seconds ?? 30;
    const defaultDuration = brollType === "image" ? DEFAULT_IMAGE_DURATION_SECONDS : 5;
    const broll: BRoll = {
      id: generateBrollId(),
      type: brollType as BRollType,
      url: publicUrl,
      filename: fileName,
      size_bytes: fileSize || 0,
      mime_type: fileType || (brollType === "video" ? "video/mp4" : "image/png"),
      duration_seconds: duration_seconds ?? defaultDuration,
      start_time: typeof start_time === "number" ? start_time : 0,
      end_time:
        typeof end_time === "number"
          ? end_time
          : Math.min(sourceDuration, defaultDuration),
      position: (position as BRollPosition) || DEFAULT_BROLL_POSITION,
      scale: typeof scale === "number" ? scale : DEFAULT_BROLL_SCALE,
      uploaded_at: new Date().toISOString(),
    };

    // Append to state_json.brolls[]
    const currentState = project.state_json || {};
    const existingBrolls: BRoll[] = Array.isArray(currentState.brolls)
      ? currentState.brolls
      : [];

    const newStateJson = {
      ...currentState,
      brolls: [...existingBrolls, broll],
    };

    const { error: updateErr } = await supabaseAdmin
      .from("studio_video_projects")
      .update({
        state_json: newStateJson,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json(
        { error: `Erreur update: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      broll,
      brolls: newStateJson.brolls,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server error: ${err.message}` },
      { status: 500 }
    );
  }
}

// ============================================================
//  GET : Retourne tous les b-rolls du projet (utility)
// ============================================================
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: project, error: projectErr } = await supabaseAdmin
    .from("studio_video_projects")
    .select("id, tenant_id, state_json")
    .eq("id", id)
    .maybeSingle();

  if (projectErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (user.role !== "super_admin" && project.tenant_id !== user.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const brolls = Array.isArray(project.state_json?.brolls)
    ? project.state_json.brolls
    : [];

  return NextResponse.json({ brolls });
}