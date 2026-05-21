import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/prospects
//  GET  → liste prospects avec filtres + stats
//  POST → créer prospect (depuis landing publique, pas d'auth)
// ============================================================

const VALID_STATUSES = ["new", "qualified", "demo_planned", "client", "rejected"];

// ------------------------------------------------------------
//  Helper : auth super_admin uniquement
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
    .select("scope, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.scope !== "platform" || profile.role !== "super_admin") {
    return { error: "Accès super-admin uniquement", status: 403 };
  }

  return { user, supabase };
}

// ============================================================
//  GET — liste prospects + stats
// ============================================================
export async function GET(req: NextRequest) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const sortBy = url.searchParams.get("sortBy") || "created_at";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    // 1) Liste filtrée
    let query = supabase.from("prospect_messages").select("*");

    if (status && status !== "all" && VALID_STATUSES.includes(status)) {
      query = query.eq("status", status);
    }

    if (search) {
      const s = search.toLowerCase();
      query = query.or(
        `name.ilike.%${s}%,email.ilike.%${s}%,company.ilike.%${s}%,message.ilike.%${s}%`
      );
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    const { data: prospects, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2) Stats globales (toutes les lignes, pas que filtrées)
    const { data: allProspects } = await supabase
      .from("prospect_messages")
      .select("status, created_at");

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: allProspects?.length || 0,
      new: allProspects?.filter((p) => p.status === "new").length || 0,
      qualified: allProspects?.filter((p) => p.status === "qualified").length || 0,
      demo_planned: allProspects?.filter((p) => p.status === "demo_planned").length || 0,
      client: allProspects?.filter((p) => p.status === "client").length || 0,
      rejected: allProspects?.filter((p) => p.status === "rejected").length || 0,
      this_week: allProspects?.filter((p) => new Date(p.created_at) >= weekAgo).length || 0,
      conversion_rate:
        allProspects && allProspects.length > 0
          ? Math.round(
              ((allProspects.filter((p) => p.status === "client").length || 0) / allProspects.length) * 100
            )
          : 0,
    };

    return NextResponse.json({
      prospects: prospects || [],
      stats,
    });
  } catch (err: any) {
    console.error("[prospects GET] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
//  POST — créer prospect (depuis landing, PAS d'auth)
// ============================================================
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const { name, company, email, phone, message } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Nom, email et message sont obligatoires" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("prospect_messages")
      .insert({
        name: name.trim(),
        company: company?.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        message: message.trim(),
        status: "new",
        read: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, prospect: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
