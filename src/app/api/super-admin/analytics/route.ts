import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/analytics
//  GET → toutes les stats agrégées pour le dashboard analytics
//  Filtres : ?period=7d|30d|90d|all & ?tenant=all|<tenant_id>
// ============================================================

async function authenticateSuperAdmin(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Non authentifié", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const tempClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user } } = await tempClient.auth.getUser(token);
  if (!user) return { error: "Token invalide", status: 401 };

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("scope, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.scope !== "platform" || profile.role !== "super_admin") {
    return { error: "Accès super-admin uniquement", status: 403 };
  }

  return { user, supabase };
}

const PERIOD_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "all": 99999,
};

export async function GET(req: NextRequest) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "30d";
    const tenantFilter = url.searchParams.get("tenant") || "all";

    const days = PERIOD_DAYS[period] || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const sinceDate = period === "all" ? null : since;

    // ============================================================
    //  1) USAGE EVENTS (Coûts IA, providers, models)
    // ============================================================
    let eventsQuery = supabase.from("usage_events").select("*");
    if (sinceDate) eventsQuery = eventsQuery.gte("created_at", sinceDate);
    // Note: usage_events n'a pas de tenant_id, on filtre par brand_name si tenant
    if (tenantFilter !== "all") {
      eventsQuery = eventsQuery.eq("brand_name", tenantFilter);
    }
    const { data: events = [] } = await eventsQuery;
    const eventsList = events || [];

    // ============================================================
    //  2) STUDIO PROJECTS
    // ============================================================
    let projectsQuery = supabase.from("studio_projects").select("*");
    if (sinceDate) projectsQuery = projectsQuery.gte("created_at", sinceDate);
    if (tenantFilter !== "all") {
      projectsQuery = projectsQuery.eq("tenant_id", tenantFilter);
    }
    const { data: projects = [] } = await projectsQuery;
    const projectsList = projects || [];

    // ============================================================
    //  3) BRAND IMAGES
    // ============================================================
    let imagesQuery = supabase.from("brand_images").select("*");
    if (tenantFilter !== "all") {
      imagesQuery = imagesQuery.eq("tenant_id", tenantFilter);
    }
    const { data: images = [] } = await imagesQuery;
    const imagesList = images || [];

    // ============================================================
    //  4) FEEDBACK + PROSPECTS
    // ============================================================
    let bugsQuery = supabase.from("feedback_reports").select("*");
    if (sinceDate) bugsQuery = bugsQuery.gte("created_at", sinceDate);
    if (tenantFilter !== "all") {
      bugsQuery = bugsQuery.eq("tenant_id", tenantFilter);
    }
    const { data: bugs = [] } = await bugsQuery;
    const bugsList = bugs || [];

    let prospectsQuery = supabase.from("prospect_messages").select("*");
    if (sinceDate) prospectsQuery = prospectsQuery.gte("created_at", sinceDate);
    const { data: prospects = [] } = await prospectsQuery;
    const prospectsList = prospects || [];

    // ============================================================
    //  5) NOTIFICATIONS
    // ============================================================
    let notifQuery = supabase.from("notifications").select("read, created_at");
    if (sinceDate) notifQuery = notifQuery.gte("created_at", sinceDate);
    const { data: notifs = [] } = await notifQuery;
    const notifsList = notifs || [];

    // ============================================================
    //  6) USER PROFILES (graphistes)
    // ============================================================
    let usersQuery = supabase
      .from("user_profiles")
      .select("user_id, email, display_name, role, tenant_id");
    if (tenantFilter !== "all") {
      usersQuery = usersQuery.eq("tenant_id", tenantFilter);
    }
    const { data: users = [] } = await usersQuery;
    const usersList = users || [];

    // ============================================================
    //  7) TENANTS LIST (pour le sélecteur)
    // ============================================================
    const { data: allTenants = [] } = await supabase
      .from("tenant_configs")
      .select("tenant_id, config_json");

    // ============================================================
    //  AGRÉGATIONS — KPIs
    // ============================================================
    const totalCost = eventsList.reduce((s: number, e: any) => s + (parseFloat(e.cost_usd) || 0), 0);
    const totalInputTokens = eventsList.reduce((s: number, e: any) => s + (e.input_tokens || 0), 0);
    const totalOutputTokens = eventsList.reduce((s: number, e: any) => s + (e.output_tokens || 0), 0);
    const successRate = eventsList.length > 0
      ? Math.round((eventsList.filter((e: any) => e.success).length / eventsList.length) * 100)
      : 0;

    const projectsApproved = projectsList.filter((p: any) => p.status === "approved").length;
    const projectsPending = projectsList.filter((p: any) => p.status === "pending_approval").length;
    const projectsDraft = projectsList.filter((p: any) => p.status === "draft").length;
    const projectsRejected = projectsList.filter((p: any) => p.status === "rejected").length;
    const approvalRate = projectsList.length > 0
      ? Math.round((projectsApproved / projectsList.length) * 100)
      : 0;

    // Temps moyen draft → approved (en heures)
    const approvedWithTime = projectsList.filter((p: any) => p.status === "approved" && p.approved_at && p.created_at);
    const avgApprovalTimeHours = approvedWithTime.length > 0
      ? approvedWithTime.reduce((s: number, p: any) => {
          const created = new Date(p.created_at).getTime();
          const approved = new Date(p.approved_at).getTime();
          return s + (approved - created) / 1000 / 3600;
        }, 0) / approvedWithTime.length
      : 0;

    // ============================================================
    //  EVENTS PAR JOUR (pour line chart)
    // ============================================================
    const eventsByDay: Record<string, { date: string; count: number; cost: number }> = {};
    eventsList.forEach((e: any) => {
      const day = new Date(e.created_at).toISOString().split("T")[0];
      if (!eventsByDay[day]) eventsByDay[day] = { date: day, count: 0, cost: 0 };
      eventsByDay[day].count++;
      eventsByDay[day].cost += parseFloat(e.cost_usd) || 0;
    });
    const eventsTimeline = Object.values(eventsByDay).sort((a, b) => a.date.localeCompare(b.date));

    // ============================================================
    //  COÛTS PAR EVENT TYPE
    // ============================================================
    const costByType: Record<string, { type: string; cost: number; count: number }> = {};
    eventsList.forEach((e: any) => {
      const type = e.event_type || "unknown";
      if (!costByType[type]) costByType[type] = { type, cost: 0, count: 0 };
      costByType[type].cost += parseFloat(e.cost_usd) || 0;
      costByType[type].count++;
    });
    const costsByType = Object.values(costByType).sort((a, b) => b.cost - a.cost);

    // ============================================================
    //  COÛTS PAR PROVIDER
    // ============================================================
    const costByProvider: Record<string, { provider: string; cost: number; count: number }> = {};
    eventsList.forEach((e: any) => {
      const provider = e.provider || "unknown";
      if (!costByProvider[provider]) costByProvider[provider] = { provider, cost: 0, count: 0 };
      costByProvider[provider].cost += parseFloat(e.cost_usd) || 0;
      costByProvider[provider].count++;
    });
    const costsByProvider = Object.values(costByProvider).sort((a, b) => b.cost - a.cost);

    // ============================================================
    //  COÛTS PAR MODEL
    // ============================================================
    const costByModel: Record<string, { model: string; cost: number; count: number }> = {};
    eventsList.forEach((e: any) => {
      const model = e.model || "unknown";
      if (!costByModel[model]) costByModel[model] = { model, cost: 0, count: 0 };
      costByModel[model].cost += parseFloat(e.cost_usd) || 0;
      costByModel[model].count++;
    });
    const costsByModel = Object.values(costByModel).sort((a, b) => b.cost - a.cost).slice(0, 5);

    // ============================================================
    //  PROJETS PAR TENANT (vue plateforme)
    // ============================================================
    const projectsByTenant: Record<string, { tenant: string; total: number; approved: number; cost: number }> = {};
    projectsList.forEach((p: any) => {
      const t = p.tenant_id || "unknown";
      if (!projectsByTenant[t]) projectsByTenant[t] = { tenant: t, total: 0, approved: 0, cost: 0 };
      projectsByTenant[t].total++;
      if (p.status === "approved") projectsByTenant[t].approved++;
    });
    // Ajouter les coûts par tenant
    eventsList.forEach((e: any) => {
      const t = e.brand_name || "unknown";
      if (projectsByTenant[t]) {
        projectsByTenant[t].cost += parseFloat(e.cost_usd) || 0;
      }
    });
    const tenantsActivity = Object.values(projectsByTenant).sort((a, b) => b.total - a.total);

    // ============================================================
    //  PERFORMANCE GRAPHISTES
    // ============================================================
    const projectsByCreator: Record<string, { 
      user_id: string; email: string; display_name: string;
      total: number; approved: number; rejected: number; pending: number;
    }> = {};
    projectsList.forEach((p: any) => {
      const uid = p.created_by;
      if (!uid) return;
      if (!projectsByCreator[uid]) {
        const user = usersList.find((u: any) => u.user_id === uid);
        projectsByCreator[uid] = {
          user_id: uid,
          email: user?.email || "Inconnu",
          display_name: user?.display_name || user?.email || "Inconnu",
          total: 0, approved: 0, rejected: 0, pending: 0,
        };
      }
      projectsByCreator[uid].total++;
      if (p.status === "approved") projectsByCreator[uid].approved++;
      else if (p.status === "rejected") projectsByCreator[uid].rejected++;
      else if (p.status === "pending_approval") projectsByCreator[uid].pending++;
    });
    const graphistesPerf = Object.values(projectsByCreator)
      .filter(g => g.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ============================================================
    //  TOP IMAGES UTILISÉES (use_count)
    // ============================================================
    const topImages = imagesList
      .filter((img: any) => (img.use_count || 0) > 0)
      .sort((a: any, b: any) => (b.use_count || 0) - (a.use_count || 0))
      .slice(0, 10)
      .map((img: any) => ({
        id: img.id,
        filename: img.filename,
        thumbnail_url: img.thumbnail_url || img.public_url,
        use_count: img.use_count || 0,
        is_approved: img.is_approved,
      }));

    // ============================================================
    //  COULEURS DOMINANTES (palette globale)
    // ============================================================
    const colorCounts: Record<string, number> = {};
    imagesList.forEach((img: any) => {
      if (!img.dominant_colors || !Array.isArray(img.dominant_colors)) return;
      img.dominant_colors.forEach((color: any) => {
        // color peut être un hex direct ou un objet {hex, ratio}
        const hex = typeof color === "string" ? color : color?.hex || color?.color;
        if (hex) {
          colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        }
      });
    });
    const dominantColors = Object.entries(colorCounts)
      .map(([hex, count]) => ({ hex, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // ============================================================
    //  STATS BIBLIOTHÈQUE
    // ============================================================
    const totalImages = imagesList.length;
    const approvedImages = imagesList.filter((i: any) => i.is_approved).length;
    const totalImagesSize = imagesList.reduce((s: number, i: any) => s + (i.size_bytes || 0), 0);
    const imagesUsed = imagesList.filter((i: any) => (i.use_count || 0) > 0).length;

    // ============================================================
    //  ACTIVITÉ PAR HEURE (heatmap simplifié)
    // ============================================================
    const activityByHour: Record<number, number> = {};
    for (let h = 0; h < 24; h++) activityByHour[h] = 0;
    eventsList.forEach((e: any) => {
      const hour = new Date(e.created_at).getHours();
      activityByHour[hour]++;
    });
    const activityHourly = Object.entries(activityByHour).map(([hour, count]) => ({
      hour: parseInt(hour),
      count: count as number,
    }));

    // ============================================================
    //  ACTIVITÉ PAR JOUR DE SEMAINE
    // ============================================================
    const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const activityByDow: Record<number, number> = {};
    for (let d = 0; d < 7; d++) activityByDow[d] = 0;
    eventsList.forEach((e: any) => {
      const dow = new Date(e.created_at).getDay();
      activityByDow[dow]++;
    });
    const activityWeekly = Object.entries(activityByDow).map(([dow, count]) => ({
      day: dayLabels[parseInt(dow)],
      count: count as number,
    }));

    // ============================================================
    //  SANTÉ PLATEFORME
    // ============================================================
    const bugsNew = bugsList.filter((b: any) => b.status === "new").length;
    const bugsResolved = bugsList.filter((b: any) => b.status === "resolved").length;
    const bugsCritical = bugsList.filter((b: any) =>
      b.priority === "critical" && b.status !== "resolved" && b.status !== "ignored"
    ).length;

    const prospectsNew = prospectsList.filter((p: any) => p.status === "new").length;
    const prospectsClients = prospectsList.filter((p: any) => p.status === "client").length;
    const conversionRate = prospectsList.length > 0
      ? Math.round((prospectsClients / prospectsList.length) * 100)
      : 0;

    // ============================================================
    //  ENGAGEMENT (notifications)
    // ============================================================
    const notifsTotal = notifsList.length;
    const notifsRead = notifsList.filter((n: any) => n.read).length;
    const notifsReadRate = notifsTotal > 0
      ? Math.round((notifsRead / notifsTotal) * 100)
      : 0;

    // ============================================================
    //  LISTE TENANTS (pour le sélecteur)
    // ============================================================
    const tenantsList = (allTenants || []).map((t: any) => ({
      id: t.tenant_id,
      name: t.config_json?.tenant?.name || t.tenant_id,
    }));

    // ============================================================
    //  RÉPONSE FINALE
    // ============================================================
    return NextResponse.json({
      period,
      tenant: tenantFilter,
      filters: {
        availableTenants: tenantsList,
      },
      kpis: {
        totalCost: parseFloat(totalCost.toFixed(4)),
        totalEvents: eventsList.length,
        totalInputTokens,
        totalOutputTokens,
        successRate,
        totalProjects: projectsList.length,
        projectsApproved,
        projectsPending,
        projectsDraft,
        projectsRejected,
        approvalRate,
        avgApprovalTimeHours: parseFloat(avgApprovalTimeHours.toFixed(1)),
        totalImages,
        approvedImages,
        imagesUsed,
        totalImagesSize,
        totalImagesMB: parseFloat((totalImagesSize / 1024 / 1024).toFixed(2)),
        bugsNew,
        bugsResolved,
        bugsCritical,
        prospectsNew,
        prospectsClients,
        conversionRate,
        notifsTotal,
        notifsRead,
        notifsReadRate,
      },
      charts: {
        eventsTimeline,
        costsByType,
        costsByProvider,
        costsByModel,
        tenantsActivity,
        graphistesPerf,
        topImages,
        dominantColors,
        activityHourly,
        activityWeekly,
      },
    });
  } catch (err: any) {
    console.error("[analytics GET] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}