import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/bugs
//  GET  → liste bugs + stats (super_admin)
//  POST → créer bug (depuis FeedbackWidget, user connecté)
// ============================================================

const VALID_STATUSES = ["new", "investigating", "resolved", "ignored"];
const VALID_PRIORITIES = ["critical", "high", "medium", "low"];

// ------------------------------------------------------------
//  Auto-détection priorité selon mots-clés
// ------------------------------------------------------------
function detectPriority(message: string): "critical" | "high" | "medium" | "low" {
  const lower = message.toLowerCase();

  const criticalKeywords = [
    "plante", "plantage", "crash", "tout cassé", "tout est cassé",
    "impossible", "bloqué", "ne marche pas du tout", "perdu mes données",
    "critique", "urgence", "urgent",
  ];

  const highKeywords = [
    "ne fonctionne pas", "ne marche pas", "erreur", "error",
    "bug majeur", "important", "priorité", "vite",
  ];

  const lowKeywords = [
    "suggestion", "amélioration", "esthétique", "nice to have",
    "design", "couleur", "police", "typographie",
  ];

  if (criticalKeywords.some((kw) => lower.includes(kw))) return "critical";
  if (highKeywords.some((kw) => lower.includes(kw))) return "high";
  if (lowKeywords.some((kw) => lower.includes(kw))) return "low";

  return "medium";
}

// ------------------------------------------------------------
//  Helper : auth super_admin
// ------------------------------------------------------------
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
    .select("scope, role, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, supabase, profile };
}

// ============================================================
//  GET — liste bugs + stats (super_admin uniquement)
// ============================================================
export async function GET(req: NextRequest) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase, profile } = auth;

  if (!profile || profile.scope !== "platform" || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Accès super-admin uniquement" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const search = url.searchParams.get("search");
    const sortBy = url.searchParams.get("sortBy") || "created_at";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    // Liste filtrée
    let query = supabase.from("feedback_reports").select("*");

    if (status && status !== "all" && VALID_STATUSES.includes(status)) {
      query = query.eq("status", status);
    }
    if (priority && priority !== "all" && VALID_PRIORITIES.includes(priority)) {
      query = query.eq("priority", priority);
    }
    if (search) {
      const s = search.toLowerCase();
      query = query.or(
        `message.ilike.%${s}%,page_origin.ilike.%${s}%,client_email.ilike.%${s}%`
      );
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    const { data: bugs, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Stats globales
    const { data: all } = await supabase
      .from("feedback_reports")
      .select("status, priority, created_at");

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: all?.length || 0,
      new: all?.filter((b) => b.status === "new").length || 0,
      investigating: all?.filter((b) => b.status === "investigating").length || 0,
      resolved: all?.filter((b) => b.status === "resolved").length || 0,
      ignored: all?.filter((b) => b.status === "ignored").length || 0,
      critical: all?.filter((b) => b.priority === "critical" && b.status !== "resolved" && b.status !== "ignored").length || 0,
      high: all?.filter((b) => b.priority === "high" && b.status !== "resolved" && b.status !== "ignored").length || 0,
      this_week: all?.filter((b) => new Date(b.created_at) >= weekAgo).length || 0,
      resolved_this_week:
        all?.filter((b) => b.status === "resolved" && new Date(b.created_at) >= weekAgo).length || 0,
    };

    return NextResponse.json({
      bugs: bugs || [],
      stats,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
//  POST — Créer bug (depuis FeedbackWidget, user connecté)
// ============================================================
export async function POST(req: NextRequest) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase, profile } = auth;

  // tenant_admin et graphist peuvent reporter des bugs (PAS le super_admin)
  if (!profile || !["tenant_admin", "graphist"].includes(profile.role)) {
    return NextResponse.json({ error: "Action non autorisée" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      message,
      priority: userPriority,
      page_origin,
      screenshot_url,
      browser_info,
    } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message obligatoire" }, { status: 400 });
    }

    // Auto-détection si pas spécifiée par l'user
    const finalPriority =
      userPriority && VALID_PRIORITIES.includes(userPriority)
        ? userPriority
        : detectPriority(message);

    const { data, error } = await supabase
      .from("feedback_reports")
      .insert({
        message: message.trim(),
        priority: finalPriority,
        status: "new",
        read: false,
        page_origin: page_origin || null,
        screenshot_url: screenshot_url || null,
        browser_info: browser_info || null,
        client_email: user.email || null,
        tenant_id: profile.tenant_id || null,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bug: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
