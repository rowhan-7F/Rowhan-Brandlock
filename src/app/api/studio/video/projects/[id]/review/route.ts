import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  isTenantAdmin,
  createNotification,
} from "@/lib/auth-helpers";

// ============================================================
//  POST /api/studio/video/projects/[id]/review
//  Actions de validation sur un projet VIDEO par l'admin client
//  Body : { action: "approve" | "reject" | "request_changes" | "unapprove", message?: string }
// ============================================================
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user, supabase } = auth;

  // Recupere le projet
  const { data: project, error: fetchErr } = await supabase
    .from("studio_video_projects")
    .select("id, title, tenant_id, status, created_by, task_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  // Verifier que l'user est bien admin de ce tenant
  if (!isTenantAdmin(user, project.tenant_id)) {
    return NextResponse.json({ error: "Acces refuse (admin uniquement)" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const { action, message } = body;

  if (!["approve", "reject", "request_changes", "unapprove"].includes(action)) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }

  // === APPROVE ===
  if (action === "approve") {
    const { error } = await supabase
      .from("studio_video_projects")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

      // Phase 9.3.8 : Marque la task associee comme completed (s'il y en a une)
      if (project.task_id) {
        await supabase
          .from("studio_tasks")
          .update({ status: "completed" })
          .eq("id", project.task_id);
      }

    if (project.created_by && project.created_by !== user.user_id) {
      await createNotification(supabase, {
        userId: project.created_by,
        tenantId: project.tenant_id,
        type: "project_approved",
        title: "Video approuvee",
        message: project.title || "Video",
        relatedProjectId: id,
      });
    }

    if (message && typeof message === "string" && message.trim()) {
      await supabase.from("project_comments").insert({
        project_id: id,
        tenant_id: project.tenant_id,
        author_id: user.user_id,
        author_role: user.role || "tenant_admin",
        content: message.trim().slice(0, 2000),
      });
    }

    return NextResponse.json({ success: true, new_status: "approved" });
  }

  // === REJECT ===
  if (action === "reject") {
    const { error } = await supabase
      .from("studio_video_projects")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (project.created_by && project.created_by !== user.user_id) {
      await createNotification(supabase, {
        userId: project.created_by,
        tenantId: project.tenant_id,
        type: "project_rejected",
        title: "Video refusee",
        message: (project.title || "Video") + (message ? " - " + message.slice(0, 100) : ""),
        relatedProjectId: id,
      });
    }

    if (message && typeof message === "string" && message.trim()) {
      await supabase.from("project_comments").insert({
        project_id: id,
        tenant_id: project.tenant_id,
        author_id: user.user_id,
        author_role: user.role || "tenant_admin",
        content: "[Refus] " + message.trim().slice(0, 2000),
      });
    }

    return NextResponse.json({ success: true, new_status: "rejected" });
  }

  // === UNAPPROVE === (annuler approbation, remet en pending_approval)
  if (action === "unapprove") {
    const { error } = await supabase
      .from("studio_video_projects")
      .update({ status: "pending_approval", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (project.created_by && project.created_by !== user.user_id) {
      await createNotification(supabase, {
        userId: project.created_by,
        tenantId: project.tenant_id,
        type: "project_submitted",
        title: "Video remise en attente",
        message: (project.title || "Video") + " - L'admin a annule l'approbation",
        relatedProjectId: id,
      });
    }

    return NextResponse.json({ success: true, new_status: "pending_approval" });
  }

  // === REQUEST_CHANGES === (renvoyer en draft pour modifs)
  if (action === "request_changes") {
    const { error } = await supabase
      .from("studio_video_projects")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (project.created_by && project.created_by !== user.user_id) {
      await createNotification(supabase, {
        userId: project.created_by,
        tenantId: project.tenant_id,
        type: "project_rejected",
        title: "Modifications demandees",
        message: (project.title || "Video") + (message ? " - " + message.slice(0, 100) : ""),
        relatedProjectId: id,
      });
    }

    if (message && typeof message === "string" && message.trim()) {
      await supabase.from("project_comments").insert({
        project_id: id,
        tenant_id: project.tenant_id,
        author_id: user.user_id,
        author_role: user.role || "tenant_admin",
        content: "[Corrections demandees] " + message.trim().slice(0, 2000),
      });
    }

    return NextResponse.json({ success: true, new_status: "draft" });
  }

  return NextResponse.json({ error: "Action non geree" }, { status: 400 });
}
