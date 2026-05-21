import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  isTenantAdmin,
  belongsToTenant,
  createNotification,
} from "../../../../lib/auth-helpers";

// ============================================================
//  GET /api/admin/tasks
//  - tenant_admin : retourne TOUTES les tasks de son tenant
//  - graphist     : retourne les tasks qui lui sont assignées
//                    OU non assignées (assigned_to NULL) de son tenant
//  - super_admin  : ?tenant_id=xxx pour filtrer (sinon tout)
// ============================================================
export async function GET(req: Request) {
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { user, supabase } = auth;
  const url = new URL(req.url);
  const tenantIdFilter = url.searchParams.get("tenant_id");
  const statusFilter = url.searchParams.get("status");

  // Détermine le tenant_id à filtrer
  let tenantId: string;
  if (user.role === "super_admin" && tenantIdFilter) {
    tenantId = tenantIdFilter;
  } else if (user.tenant_id) {
    tenantId = user.tenant_id;
  } else {
    return NextResponse.json({ error: "Tenant manquant" }, { status: 400 });
  }

  let query = supabase
    .from("studio_tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  // Si graphiste : filtre sur tasks assignées OU non-assignées
  if (user.role === "graphist") {
    query = query.or(`assigned_to.eq.${user.user_id},assigned_to.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/admin/tasks] erreur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data || [] });
}


// ============================================================
//  POST /api/admin/tasks
//  Crée une nouvelle task (admin uniquement)
//  Body : { title, brief, deadline?, priority?, assigned_to? }
// ============================================================
export async function POST(req: Request) {
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { user, supabase } = auth;

  if (!user.tenant_id) {
    return NextResponse.json({ error: "Tenant manquant" }, { status: 400 });
  }

  // Seul l'admin du tenant peut créer
  if (!isTenantAdmin(user, user.tenant_id)) {
    return NextResponse.json({ error: "Accès refusé (admin uniquement)" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const { title, brief, deadline, priority, assigned_to } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Titre obligatoire" }, { status: 400 });
  }

  const cleanTitle = title.trim().slice(0, 200);
  const cleanBrief = (brief && typeof brief === "string") ? brief.slice(0, 5000) : null;
  const cleanPriority = ["low", "normal", "high", "urgent"].includes(priority) ? priority : "normal";
  const cleanDeadline = deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null;
  const cleanAssignedTo = assigned_to && typeof assigned_to === "string" ? assigned_to : null;

  const { data, error } = await supabase
    .from("studio_tasks")
    .insert({
      tenant_id: user.tenant_id,
      title: cleanTitle,
      brief: cleanBrief,
      deadline: cleanDeadline,
      priority: cleanPriority,
      status: "open",
      created_by: user.user_id,
      assigned_to: cleanAssignedTo,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/admin/tasks] erreur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notification au graphiste (si assigné spécifiquement)
  if (cleanAssignedTo) {
    await createNotification(supabase, {
      userId: cleanAssignedTo,
      tenantId: user.tenant_id,
      type: "task_assigned",
      title: "Nouveau brief reçu",
      message: cleanTitle,
      relatedTaskId: data.id,
    });
  } else {
    // Notification à tous les graphistes du tenant
    const { data: graphists } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("tenant_id", user.tenant_id)
      .eq("role", "graphist");

    if (graphists && graphists.length > 0) {
      for (const g of graphists) {
        await createNotification(supabase, {
          userId: g.user_id,
          tenantId: user.tenant_id,
          type: "task_assigned",
          title: "Nouveau brief disponible",
          message: cleanTitle,
          relatedTaskId: data.id,
        });
      }
    }
  }

  return NextResponse.json({ task: data });
}
