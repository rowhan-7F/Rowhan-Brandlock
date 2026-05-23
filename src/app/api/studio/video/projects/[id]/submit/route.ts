// ============================================================
//  POST /api/studio/video/projects/[id]/submit
//  Phase 12 peaufinage #6+7 : Soumettre la video pour validation admin
//  Change status -> "pending_approval"
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function authenticate(req: NextRequest): Promise<{
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
    return { userId: user.id, tenantId: profile.tenant_id, role: profile.role };
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  // Recuperer le projet
  const { data: project, error: projectErr } = await supabaseAdmin
    .from("studio_video_projects")
    .select("id, tenant_id, status, source_video_url")
    .eq("id", id)
    .maybeSingle();

  if (projectErr || !project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  // Verifier tenant
  if (user.role !== "super_admin" && project.tenant_id !== user.tenantId) {
    return NextResponse.json({ error: "Acces interdit" }, { status: 403 });
  }

  // Verifier qu'il y a au moins une source
  if (!project.source_video_url) {
    return NextResponse.json(
      { error: "Aucune source video uploadee. Uploadez la source avant de soumettre." },
      { status: 400 }
    );
  }

  // Update status
  const { error: updateErr } = await supabaseAdmin
    .from("studio_video_projects")
    .update({
      status: "pending_approval",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}