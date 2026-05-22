// ============================================================
//  /api/studio/video/projects/[id]/brolls/[brollId]
//
//  PATCH  : Update timing/position d'un b-roll
//  DELETE : Supprime un b-roll (state_json + storage)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BRoll, BRollPosition } from "@/lib/video/types";

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

// ============================================================
//  PATCH : Update un b-roll (timing, position, scale, durée)
// ============================================================
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; brollId: string }> }
) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, brollId } = await context.params;

  try {
    const body = await req.json();
    const { start_time, end_time, position, scale, duration_seconds } = body;

    const { data: project, error: projectErr } = await supabaseAdmin
      .from("studio_video_projects")
      .select("id, tenant_id, state_json, archived_at")
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

    const stateJson = project.state_json || {};
    const brolls: BRoll[] = Array.isArray(stateJson.brolls) ? stateJson.brolls : [];

    const brollIndex = brolls.findIndex((b) => b.id === brollId);
    if (brollIndex === -1) {
      return NextResponse.json({ error: "B-roll not found" }, { status: 404 });
    }

    // Update only provided fields
    const updatedBroll: BRoll = {
      ...brolls[brollIndex],
      ...(typeof start_time === "number" && { start_time }),
      ...(typeof end_time === "number" && { end_time }),
      ...(position && { position: position as BRollPosition }),
      ...(typeof scale === "number" && { scale }),
      ...(typeof duration_seconds === "number" && { duration_seconds }),
    };

    const newBrolls = [...brolls];
    newBrolls[brollIndex] = updatedBroll;

    const { error: updateErr } = await supabaseAdmin
      .from("studio_video_projects")
      .update({
        state_json: { ...stateJson, brolls: newBrolls },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json(
        { error: `Erreur update: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, broll: updatedBroll });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server error: ${err.message}` },
      { status: 500 }
    );
  }
}

// ============================================================
//  DELETE : Supprime un b-roll
// ============================================================
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; brollId: string }> }
) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, brollId } = await context.params;

  try {
    const { data: project, error: projectErr } = await supabaseAdmin
      .from("studio_video_projects")
      .select("id, tenant_id, state_json, archived_at")
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

    const stateJson = project.state_json || {};
    const brolls: BRoll[] = Array.isArray(stateJson.brolls) ? stateJson.brolls : [];

    const brollToDelete = brolls.find((b) => b.id === brollId);
    if (!brollToDelete) {
      return NextResponse.json({ error: "B-roll not found" }, { status: 404 });
    }

    // Try to delete file from storage
    if (brollToDelete.url) {
      const urlMatch = brollToDelete.url.match(
        /\/storage\/v1\/object\/public\/video-brolls\/(.+)$/
      );
      if (urlMatch) {
        const path = urlMatch[1];
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
      }
    }

    // Remove from state_json.brolls[]
    const newBrolls = brolls.filter((b) => b.id !== brollId);

    const { error: updateErr } = await supabaseAdmin
      .from("studio_video_projects")
      .update({
        state_json: { ...stateJson, brolls: newBrolls },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json(
        { error: `Erreur update: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server error: ${err.message}` },
      { status: 500 }
    );
  }
}