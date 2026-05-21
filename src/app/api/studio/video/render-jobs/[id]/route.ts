// ============================================================
//  GET /api/studio/video/render-jobs/[id]
//  Récupère le status d'un job de rendu pour polling frontend
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

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

    // Fetch job + project tenant for RLS check
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("studio_video_render_jobs")
      .select(`
        id,
        project_id,
        job_type,
        status,
        progress_percent,
        progress_message,
        estimated_seconds_remaining,
        attempts,
        max_attempts,
        error_message,
        started_at,
        completed_at,
        created_at,
        result_data,
        studio_video_projects!inner(tenant_id)
      `)
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Verify user belongs to project's tenant
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    // @ts-expect-error - join type
    const projectTenant = job.studio_video_projects?.tenant_id;
    const isSameTenant = profile?.tenant_id === projectTenant;

    if (!isSuperAdmin && !isSameTenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return cleaned job (without the join)
    const { studio_video_projects: _, ...cleanJob } = job as any;

    return NextResponse.json({ job: cleanJob });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /render-jobs/[id]] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}