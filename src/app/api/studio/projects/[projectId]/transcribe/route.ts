// ============================================================
//  POST /api/studio/video/projects/[id]/transcribe
//  Insère un job de transcription dans la queue
//  Le worker local le récupère, transcrit, et update le projet
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // 1. Extract project ID from params (Next.js 15+ async params)
    const { projectId } = await params;

    // 2. Auth check via bearer token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice("Bearer ".length);

    // 3. Create Supabase client with user token (for RLS check)
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser(token);

    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 4. Fetch project + verify ownership via RLS
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: project, error: projectErr } = await supabaseAdmin
      .from("studio_video_projects")
      .select("id, tenant_id, status, archived_at")
      .eq("id", projectId)
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

    // 5. Verify user belongs to project's tenant
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    const isSameTenant = profile?.tenant_id === project.tenant_id;

    if (!isSuperAdmin && !isSameTenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 6. Check project status — must be "uploaded" (or "transcribed" for re-transcribe)
    if (project.status !== "uploaded" && project.status !== "transcribed") {
      return NextResponse.json(
        {
          error: `Cannot transcribe project in status '${project.status}'. Status must be 'uploaded' or 'transcribed'.`,
        },
        { status: 400 }
      );
    }

    // 7. Check if there's already an active job for this project
    const { data: activeJobs } = await supabaseAdmin
      .from("studio_video_render_jobs")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("job_type", "transcribe")
      .in("status", ["queued", "processing"])
      .limit(1);

    if (activeJobs && activeJobs.length > 0) {
      return NextResponse.json(
        {
          error: "Une transcription est déjà en cours pour ce projet",
          existing_job_id: activeJobs[0].id,
        },
        { status: 409 }
      );
    }

    // 8. Insert new job
    const { data: newJob, error: insertErr } = await supabaseAdmin
      .from("studio_video_render_jobs")
      .insert({
        project_id: projectId,
        job_type: "transcribe",
        status: "queued",
        payload: {
          trigger: "user",
          requested_by: user.id,
          requested_at: new Date().toISOString(),
        },
      })
      .select("id, status, created_at")
      .single();

    if (insertErr || !newJob) {
      return NextResponse.json(
        { error: `Failed to create job: ${insertErr?.message || "unknown"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      job: newJob,
      message: "Transcription en attente — un worker va la traiter sous peu",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /transcribe] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
