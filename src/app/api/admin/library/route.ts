import { NextResponse } from "next/server";
import { getAuthenticatedUser, isTenantAdmin } from "@/lib/auth-helpers";

// ============================================================
//  GET /api/admin/library
//  Liste les images du tenant avec filtres
//  Query params :
//   - status : "pending" | "approved" | "all" (default: all)
//   - search : string (recherche par filename/tags)
//   - limit : number (default: 50)
//   - offset : number (default: 0)
// ============================================================
export async function GET(req: Request) {
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user, supabase } = auth;

  // Récupère le tenant_id (admin du tenant ou super_admin)
  let tenantId = user.tenant_id;

  // super_admin peut requêter un tenant spécifique via query param
  const url = new URL(req.url);
  const queryTenantId = url.searchParams.get("tenantId");
  if (user.role === "super_admin" && queryTenantId) {
    tenantId = queryTenantId;
  }

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant requis" }, { status: 400 });
  }

  // Vérif droits
  if (!isTenantAdmin(user, tenantId)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const status = url.searchParams.get("status") || "all";
  const search = url.searchParams.get("search") || "";
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  try {
    let query = supabase
      .from("brand_images")
      .select(
        "id, public_url, thumbnail_url, filename, brand_name, tags, is_approved, uploaded_by, approved_at, approved_by, width, height, dominant_colors, size_bytes, created_at, uploaded_at, client_email",
        { count: "exact" }
      )
      .eq("tenant_id", tenantId);

    // Filtre status
    if (status === "pending") {
      query = query.eq("is_approved", false);
    } else if (status === "approved") {
      query = query.eq("is_approved", true);
    }

    // Recherche
    if (search.trim()) {
      query = query.or(
        `filename.ilike.%${search.trim()}%,brand_name.ilike.%${search.trim()}%`
      );
    }

    // Pagination + tri
    query = query
      .order("created_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET library] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compteurs (pour les badges)
    const { count: pendingCount } = await supabase
      .from("brand_images")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_approved", false);

    const { count: approvedCount } = await supabase
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
  } catch (err: any) {
    console.error("[GET library] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
