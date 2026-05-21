import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  isTenantAdmin,
  belongsToTenant,
  createNotification,
} from "@/lib/auth-helpers";

// ============================================================
//  GET /api/admin/tasks/[taskId]
// ============================================================
export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { user, supabase } = auth;

  try {
    const { data, error } = await supabase
      .from("studio_tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (error) {
      console.error("[GET task] fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Task introuvable" }, { status: 404 });
    }

    if (!belongsToTenant(user, data.tenant_id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json({ task: data });
  } catch (err: any) {
    console.error("[GET task] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}


// ============================================================
//  PATCH /api/admin/tasks/[taskId]
//  Body possible :
//   - { status, priority, deadline, brief, title, assigned_to }  (admin)
//   - { action: "claim" }  → graphiste s'assigne la task
//   - { action: "create_project" }  → crée un projet lié
// ============================================================
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  console.log("[PATCH task] START", { taskId });

  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    console.log("[PATCH task] AUTH FAILED", auth.error);
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  console.log("[PATCH task] AUTH OK", { user_id: auth.user.user_id, role: auth.user.role });

  const { user, supabase } = auth;

  try {
    // Récupère la task
    const { data: task, error: fetchErr } = await supabase
      .from("studio_tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[PATCH task] task fetch error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!task) {
      return NextResponse.json({ error: "Task introuvable" }, { status: 404 });
    }
    console.log("[PATCH task] TASK FOUND", { title: task.title, tenant_id: task.tenant_id });

    if (!belongsToTenant(user, task.tenant_id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body invalide" }, { status: 400 });
    }
    console.log("[PATCH task] BODY", body);

    // ============================================================
    //  ACTION : create_project
    //  Le graphiste démarre un brief → crée un projet lié
    // ============================================================
    if (body.action === "create_project") {
      if (user.role !== "graphist" && user.role !== "super_admin") {
        return NextResponse.json({ error: "Action réservée aux graphistes" }, { status: 403 });
      }

      console.log("[PATCH task] create_project");

      // Récupère le template par défaut du tenant
      const { data: tenantConfig, error: configErr } = await supabase
        .from("tenant_configs")
        .select("config_json")
        .eq("tenant_id", task.tenant_id)
        .maybeSingle();

      if (configErr) {
        console.error("[PATCH task] tenant_configs error:", configErr);
      }

      const templateKey = tenantConfig?.config_json?.exportTemplates
        ? Object.keys(tenantConfig.config_json.exportTemplates)[0]
        : "carrousel_instagram";

      console.log("[PATCH task] templateKey:", templateKey);

      // Crée le projet
      const projectTitle = task.title.slice(0, 100);
      const insertPayload = {
        tenant_id: task.tenant_id,
        title: projectTitle,
        status: "draft",
        created_by: user.user_id,
        task_id: task.id,
        state_json: {
          template: templateKey,
          slides: [],
        },
      };
      console.log("[PATCH task] INSERTING PROJECT:", insertPayload);

      const { data: newProject, error: projErr } = await supabase
        .from("studio_projects")
        .insert(insertPayload)
        .select()
        .single();

      if (projErr) {
        console.error("[PATCH task] create_project error:", JSON.stringify(projErr, null, 2));
        return NextResponse.json({
          error: "Erreur création projet: " + (projErr.message || JSON.stringify(projErr)),
          code: projErr.code,
          details: projErr.details,
        }, { status: 500 });
      }
      console.log("[PATCH task] PROJECT CREATED", { id: newProject.id });

      // Update la task
      const { error: updateErr } = await supabase
        .from("studio_tasks")
        .update({
          status: "in_progress",
          assigned_to: user.user_id,
          linked_project_id: newProject.id,
        })
        .eq("id", taskId);

      if (updateErr) {
        console.error("[PATCH task] task update error:", updateErr);
      }

      // Marque les notifs comme lues
      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.user_id)
          .eq("related_task_id", taskId);
      } catch (e) {
        console.error("[PATCH task] notif update error:", e);
      }

      console.log("[PATCH task] SUCCESS create_project");
      return NextResponse.json({ project: newProject });
    }

    // ============================================================
    //  ACTION : claim
    // ============================================================
    if (body.action === "claim") {
      if (user.role !== "graphist" && user.role !== "super_admin") {
        return NextResponse.json({ error: "Action réservée aux graphistes" }, { status: 403 });
      }
      const { data, error } = await supabase
        .from("studio_tasks")
        .update({ assigned_to: user.user_id, status: "in_progress" })
        .eq("id", taskId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ task: data });
    }

    // ============================================================
    //  UPDATE STANDARD (admin uniquement)
    // ============================================================
    if (!isTenantAdmin(user, task.tenant_id)) {
      return NextResponse.json({ error: "Accès refusé (admin uniquement)" }, { status: 403 });
    }

    const updates: Record<string, any> = {};
    if (typeof body.title === "string") updates.title = body.title.trim().slice(0, 200);
    if (typeof body.brief === "string") updates.brief = body.brief.slice(0, 5000);
    if (body.status && ["open", "in_progress", "completed", "cancelled"].includes(body.status)) {
      updates.status = body.status;
    }
    if (body.priority && ["low", "normal", "high", "urgent"].includes(body.priority)) {
      updates.priority = body.priority;
    }
    if (body.deadline === null || body.deadline === "") {
      updates.deadline = null;
    } else if (typeof body.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline)) {
      updates.deadline = body.deadline;
    }
    if (body.assigned_to === null) {
      updates.assigned_to = null;
    } else if (typeof body.assigned_to === "string") {
      updates.assigned_to = body.assigned_to;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("studio_tasks")
      .update(updates)
      .eq("id", taskId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ task: data });
  } catch (err: any) {
    console.error("[PATCH task] fatal:", err);
    return NextResponse.json({
      error: err.message || "Erreur serveur",
      stack: err.stack,
    }, { status: 500 });
  }
}


// ============================================================
//  DELETE /api/admin/tasks/[taskId]
// ============================================================
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { user, supabase } = auth;

  const { data: task } = await supabase
    .from("studio_tasks")
    .select("tenant_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    return NextResponse.json({ error: "Task introuvable" }, { status: 404 });
  }

  if (!isTenantAdmin(user, task.tenant_id)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { error } = await supabase
    .from("studio_tasks")
    .delete()
    .eq("id", taskId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}