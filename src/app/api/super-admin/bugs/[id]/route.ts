import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ============================================================
//  /api/super-admin/bugs/[id]
//  PATCH  → status, priority, resolution_notes, read
//  DELETE → supprimer bug
// ============================================================

const VALID_STATUSES = ["new", "investigating", "resolved", "ignored"];
const VALID_PRIORITIES = ["critical", "high", "medium", "low"];

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
//  PATCH — Mettre à jour bug
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, supabase } = auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, priority, resolution_notes, read } = body;

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Statut invalide. Valeurs : ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.status = status;

      if (status === "resolved") {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = user.id;
      } else if (status === "new" || status === "investigating") {
        updates.resolved_at = null;
        updates.resolved_by = null;
      }
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return NextResponse.json(
          { error: `Priorité invalide. Valeurs : ${VALID_PRIORITIES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.priority = priority;
    }

    if (resolution_notes !== undefined) {
      updates.resolution_notes = resolution_notes;
    }

    if (read !== undefined) {
      updates.read = read;
    }

    const { data, error } = await supabase
      .from("feedback_reports")
      .update(updates)
      .eq("id", id)
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

// ============================================================
//  DELETE — Supprimer bug
// ============================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateSuperAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { supabase } = auth;

  try {
    const { id } = await params;

    // Récupérer le screenshot pour le supprimer du Storage
    const { data: bug } = await supabase
      .from("feedback_reports")
      .select("screenshot_url")
      .eq("id", id)
      .maybeSingle();

    if (bug?.screenshot_url) {
      // Extraire le path du URL public
      const match = bug.screenshot_url.match(/feedback-screenshots\/(.+)$/);
      if (match) {
        await supabase.storage.from("feedback-screenshots").remove([match[1]]);
      }
    }

    const { error } = await supabase
      .from("feedback_reports")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
