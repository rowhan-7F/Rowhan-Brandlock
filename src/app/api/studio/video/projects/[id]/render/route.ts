import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.slice("Bearer ".length);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabaseAdmin.auth.getUser(token);

    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // ⭐ Lit l'offset depuis le body (Plan B calibration)
    let bodyOffset = 0;
    try {
      const body = await req.json();
      if (typeof body?.subtitle_offset_seconds === "number") {
        bodyOffset = Math.max(-3, Math.min(3, body.subtitle_offset_seconds));
      }
    } catch {
      // Pas de body JSON, on garde 0
    }

    const { data: project, error: projectErr } = await supabaseAdmin
      .from("studio_video_projects")
      .select("id, tenant_id, status, archived_at, state_json")
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.archived_at) {
      return NextResponse.json({ error: "Project is archived" }, { status: 400 });
    }

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

    // Status must be 'transcribed' or 'rendered' (re-render)
    if (project.status !== "transcribed" && project.status !== "completed") {
      return NextResponse.json(
        {
          error: `Cannot render in status '${project.status}'. Transcrivez d'abord la video.`,
        },
        { status: 400 }
      );
    }

    // Verify transcript with segments exists
    const transcript = (project.state_json as any)?.transcript;
    if (!transcript || !transcript.segments || transcript.segments.length === 0) {
      return NextResponse.json(
        { error: "Pas de transcript avec segments. Retranscrivez d'abord." },
        { status: 400 }
      );
    }

    // Check active job
    const { data: activeJobs } = await supabaseAdmin
      .from("studio_video_render_jobs")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("job_type", "render_final")
      .in("status", ["queued", "processing"])
      .limit(1);

    if (activeJobs && activeJobs.length > 0) {
      return NextResponse.json(
        {
          error: "Un rendu est deja en cours pour ce projet",
          existing_job_id: activeJobs[0].id,
        },
        { status: 409 }
      );
    }

    // ⭐ Sauve l'offset dans state_json avant de lancer le job
    const updatedStateJson = {
      ...(project.state_json as Record<string, any> || {}),
      subtitle_offset_seconds: bodyOffset,
    };
    await supabaseAdmin
      .from("studio_video_projects")
      .update({ state_json: updatedStateJson })
      .eq("id", projectId);

    // Insert new render job
    const { data: newJob, error: insertErr } = await supabaseAdmin
      .from("studio_video_render_jobs")
      .insert({
        project_id: projectId,
        job_type: "render_final",
        status: "queued",
        payload: {
          trigger: "user",
          requested_by: user.id,
          requested_at: new Date().toISOString(),
          render_type: "subs_burned",
          subtitle_offset_seconds: bodyOffset,
        },
      })
      .select("id, status, created_at")
      .single();

    if (insertErr || !newJob) {
      return NextResponse.json(
        { error: `Failed to create render job: ${insertErr?.message || "unknown"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      job: newJob,
      message: "Rendu en attente",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /render] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}