import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  Helper auth — Récupère l'user puis utilise un client SERVICE_ROLE pour les queries
//  (bypass RLS qui causait 0 résultats)
// ============================================================
async function authenticateRequest(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  let user = null;

  // Mode 1 : Authorization header (Bearer token)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    // Client temporaire pour valider le token et récupérer l'user
    const tempClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await tempClient.auth.getUser(token);
    if (error || !data.user) {
      console.warn("[notifications auth] Bearer token invalid:", error?.message);
      return { user: null, supabase: null };
    }
    user = data.user;
  } else {
    // Mode 2 : Cookies
    const serverClient = await createServerSupabaseClient();
    const { data: { user: cookieUser } } = await serverClient.auth.getUser();
    user = cookieUser;
  }

  if (!user) {
    return { user: null, supabase: null };
  }

  // ⭐ Client avec SERVICE_ROLE pour bypass RLS
  // (on a déjà validé l'identité de l'user, on contrôle les permissions manuellement
  //  via .eq("user_id", user.id) sur chaque query)
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { user, supabase: adminClient };
}

// ============================================================
//  GET /api/notifications
// ============================================================
export async function GET(req: Request) {
  try {
    console.log("[GET /api/notifications] called");

    const { user, supabase } = await authenticateRequest(req);

    if (!user || !supabase) {
      console.warn("[GET /api/notifications] No user");
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    console.log("[GET /api/notifications] user:", user.email, "id:", user.id);

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const unreadOnly = url.searchParams.get("unread_only") === "true";

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error("[GET /api/notifications] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count unread
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    console.log("[GET /api/notifications] returned:", notifications?.length || 0, "notifs,", unreadCount || 0, "unread");

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0,
    });
  } catch (err: any) {
    console.error("[GET /api/notifications] fatal:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}


// ============================================================
//  PATCH /api/notifications
//  Marque une ou toutes les notifs comme lues
// ============================================================
export async function PATCH(req: Request) {
  try {
    const { user, supabase } = await authenticateRequest(req);

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, mark_all_read } = body;

    if (mark_all_read) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (id) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Body invalide : 'id' ou 'mark_all_read' requis" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[PATCH /api/notifications] fatal:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}


// ============================================================
//  DELETE /api/notifications
// ============================================================
export async function DELETE(req: Request) {
  try {
    const { user, supabase } = await authenticateRequest(req);

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, delete_all_read } = body;

    if (delete_all_read) {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id)
        .eq("is_read", true);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (id) {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Body invalide" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}