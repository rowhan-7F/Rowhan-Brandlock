import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  GET /api/library
//  Liste les images du tenant pour STUDIO (graphist) OU ADMIN
//  Query params :
//   - status : "pending" | "approved" | "all" (default: all)
//   - search : string (recherche par filename/tags)
//   - limit : number (default: 50)
//   - offset : number (default: 0)
// ============================================================

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const token = authHeader.substring("Bearer ".length);
  const admin = getAdminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return { error: "Invalid token", status: 401 };
  }
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, email, role, scope, tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!profile) {
    return { error: "Profile not found", status: 403 };
  }
  return { profile, admin };
}

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { profile, admin } = auth;

  const { searchParams } = new URL(req.url);
  const tenantId = profile.role === "super_admin"
    ? (searchParams.get("tenantId") || null)
    : profile.tenant_id;

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant requis" }, { status: 400 });
  }

  // Accept : graphist OR tenant_admin OR super_admin (tous du tenant)
  if (profile.role !== "super_admin" && profile.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = searchParams.get("status") || "all";
  const search = (searchParams.get("search") || "").trim();
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = admin
    .from("brand_images")
    .select(
      "id, public_url, thumbnail_url, filename, brand_name, tags, is_approved, uploaded_by, uploaded_at, approved_at, approved_by, width, height, dominant_colors, size_bytes, batch_name, description, mood, client_email, created_at",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === "pending") {
    query = query.eq("is_approved", false);
  } else if (status === "approved") {
    query = query.eq("is_approved", true);
  }

  if (search) {
    query = query.or(`filename.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count pending/approved separes (pour les badges)
  const { count: pendingCount } = await admin
    .from("brand_images")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_approved", false);

  const { count: approvedCount } = await admin
    .from("brand_images")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_approved", true);

  return NextResponse.json({
    images: data || [],
    total: count || 0,
    counts: {
      pending: pendingCount || 0,
      approved: approvedCount || 0,
      total: (pendingCount || 0) + (approvedCount || 0),
    },
  });
}