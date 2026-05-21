// ============================================================
//  PATCH  /api/studio/video/projects/[id]
//  DELETE /api/studio/video/projects/[id]  (soft delete)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getAuthenticatedUser(req: NextRequest): Promise<{
  userId: string;
  email: string;
  tenantId: string | null;
  role: string;
} | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) return null;

    return {
      userId: user.id,
      email: user.email || "",
      tenantId: profile.tenant_id,
      role: profile.role,
    };
  } catch {
    return null;
  }
}

async function checkProjectAccess(
  projectId: string,
  user: { tenantId: string | null; role: string }
): Promise<{ ok: boolean; project: any | null; error?: string }> {
  const { data: project, error } = await supabaseAdmin
    .from("studio_video_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project) {
    return { ok: false, project: null, error: "Projet introuvable" };
  }

  if (user.role !== "super_admin" && project.tenant_id !== user.tenantId) {
    return { ok: false, project: null, error: "Accès interdit" };
  }

  return { ok: true, project };
}

// ============================================================
//  PATCH /api/studio/video/projects/[id]
// ============================================================

const ALLOWED_UPDATE_FIELDS = [
  "title",
  "source_video_url",
  "source_audio_url",
  "source_duration_seconds",
  "source_format",
  "source_dimensions",
  "source_size_bytes",
  "thumbnail_url",
  "status",
  "state_json",
  "task_id",
];

const VALID_STATUSES = [
  "draft",
  "uploaded",
  "transcribed",
  "composing",
  "pending_approval",
  "approved",
  "rejected",
  "rendering",
  "completed",
  "failed",
  "archived",
];

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const access = await checkProjectAccess(id, user);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: 404 });
  }

  try {
    const body = await req.json();
    const updates: Record<string, any> = {};

    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Aucun champ à mettre à jour" },
        { status: 400 }
      );
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return NextResponse.json(
        { error: `Status invalide : ${updates.status}` },
        { status: 400 }
      );
    }

    if (updates.title !== undefined) {
      const t = String(updates.title).trim();
      if (!t || t.length > 200) {
        return NextResponse.json(
          { error: "Titre invalide (1-200 caractères)" },
          { status: 400 }
        );
      }
      updates.title = t;
    }

    if (updates.source_duration_seconds !== undefined) {
      const d = Number(updates.source_duration_seconds);
      if (isNaN(d) || d < 0 || d > 300) {
        return NextResponse.json(
          { error: "Durée hors limite (max 5 min)" },
          { status: 400 }
        );
      }
      updates.source_duration_seconds = d;
    }

    if (updates.status === "uploaded" && !access.project.uploaded_at) {
      updates.uploaded_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabaseAdmin
      .from("studio_video_projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PATCH project] DB error:", error);
      return NextResponse.json(
        { error: "Impossible de mettre à jour le projet" },
        { status: 500 }
      );
    }

    return NextResponse.json({ project: updated });
  } catch (err: any) {
    console.error("[PATCH project] error:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================================
//  DELETE /api/studio/video/projects/[id]  (soft delete)
// ============================================================

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const access = await checkProjectAccess(id, user);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("studio_video_projects")
    .update({
      archived_at: new Date().toISOString(),
      status: "archived",
    })
    .eq("id", id);

  if (error) {
    console.error("[DELETE project] DB error:", error);
    return NextResponse.json(
      { error: "Impossible de supprimer le projet" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}