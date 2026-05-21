import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  isTenantAdmin,
  createNotification,
} from "@/lib/auth-helpers";

// ============================================================
//  POST /api/studio/projects/[projectId]/review
//  Actions de validation sur un projet par l'admin client
//  Body : { action: "approve" | "reject" | "request_changes", message?: string }
// ============================================================
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user, supabase } = auth;

  // Récupère le projet
  const { data: project, error: fetchErr } = await supabase
    .from("studio_projects")
    .select("id, title, tenant_id, status, created_by, task_id")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchErr || !project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  // Vérifier que l'user est bien admin de ce tenant
  if (!isTenantAdmin(user, project.tenant_id)) {
    return NextResponse.json({ error: "Accès refusé (admin uniquement)" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const { action, message } = body;

  if (!["approve", "reject", "request_changes"].includes(action)) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }

  // === APPROVE ===
  if (action === "approve") {
    const { error } = await supabase
      .from("studio_projects")
      .update({ status: "approved" })
      .eq("id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Marque la task associée comme completed (s'il y en a une)
    if (project.task_id) {
      await supabase
        .from("studio_tasks")
        .update({ status: "completed" })
        .eq("id", project.task_id);
    }

    // Notification au graphiste
    if (project.created_by && project.created_by !== user.user_id) {
      await createNotification(supabase, {
        userId: project.created_by,
        tenantId: project.tenant_id,
        type: "project_approved",
        title: "Projet approuvé ✅",
        message: project.title,
        relatedProjectId: projectId,
      });
    }

    // Si un message d'approbation est fourni, on l'ajoute comme commentaire
    if (message && typeof message === "string" && message.trim()) {
      await supabase.from("project_comments").insert({
        project_id: projectId,
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
      .from("studio_projects")
      .update({ status: "rejected" })
      .eq("id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notification au graphiste
    if (project.created_by && project.created_by !== user.user_id) {
      await createNotification(supabase, {
        userId: project.created_by,
        tenantId: project.tenant_id,
        type: "project_rejected",
        title: "Projet refusé ❌",
        message: project.title + (message ? " — " + message.slice(0, 100) : ""),
        relatedProjectId: projectId,
      });
    }

    // Ajoute le message comme commentaire (obligatoire pour un refus)
    if (message && typeof message === "string" && message.trim()) {
      await supabase.from("project_comments").insert({
        project_id: projectId,
        tenant_id: project.tenant_id,
        author_id: user.user_id,
        author_role: user.role || "tenant_admin",
        content: "[Refus] " + message.trim().slice(0, 2000),
      });
    }

    return NextResponse.json({ success: true, new_status: "rejected" });
  }

  // === REQUEST_CHANGES === (renvoyer en draft pour modifs)
  if (action === "request_changes") {
    const { error } = await supabase
      .from("studio_projects")
      .update({ status: "draft" })
      .eq("id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notification au graphiste
    if (project.created_by && project.created_by !== user.user_id) {
      await createNotification(supabase, {
        userId: project.created_by,
        tenantId: project.tenant_id,
        type: "project_rejected",
        title: "Modifications demandées 🔄",
        message: project.title + (message ? " — " + message.slice(0, 100) : ""),
        relatedProjectId: projectId,
      });
    }

    // Ajoute le message comme commentaire
    if (message && typeof message === "string" && message.trim()) {
      await supabase.from("project_comments").insert({
        project_id: projectId,
        tenant_id: project.tenant_id,
        author_id: user.user_id,
        author_role: user.role || "tenant_admin",
        content: "[Corrections demandées] " + message.trim().slice(0, 2000),
      });
    }

    return NextResponse.json({ success: true, new_status: "draft" });
  }

  return NextResponse.json({ error: "Action non gérée" }, { status: 400 });
}