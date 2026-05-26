import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  belongsToTenant,
  getEffectiveRole,
  createNotification,
} from "@/lib/auth-helpers";

// ============================================================
//  GET /api/studio/video/projects/[id]/comments
//  Liste les commentaires d'un projet VIDEO
// ============================================================
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user, supabase } = auth;

  try {
    const { data: project, error: projErr } = await supabase
      .from("studio_video_projects")
      .select("tenant_id")
      .eq("id", id)
      .maybeSingle();

    if (projErr) {
      console.error("[GET video comments] project fetch error:", projErr);
      return NextResponse.json({ error: projErr.message }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
    }

    if (!belongsToTenant(user, project.tenant_id)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("project_comments")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET video comments] comments fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrichit avec l'email de l'auteur
    const comments = data || [];
    const authorIds = [...new Set(comments.map((c: any) => c.author_id))];
    let authors: Record<string, string> = {};

    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, email")
        .in("user_id", authorIds);

      if (profiles) {
        authors = profiles.reduce((acc: Record<string, string>, p: any) => {
          acc[p.user_id] = p.email || "Inconnu";
          return acc;
        }, {});
      }
    }

    const enriched = comments.map((c: any) => ({
      ...c,
      author_email: authors[c.author_id] || "Inconnu",
    }));

    return NextResponse.json({ comments: enriched });
  } catch (err: any) {
    console.error("[GET video comments] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}


// ============================================================
//  POST /api/studio/video/projects/[id]/comments
//  Cree un nouveau commentaire sur un projet VIDEO
// ============================================================
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthenticatedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user, supabase } = auth;

  try {
    const { data: project } = await supabase
      .from("studio_video_projects")
      .select("tenant_id, title, created_by")
      .eq("id", id)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
    }

    if (!belongsToTenant(user, project.tenant_id)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body invalide" }, { status: 400 });
    }

    const { content } = body;
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Contenu vide" }, { status: 400 });
    }

    const role = getEffectiveRole(user);

    const { data, error } = await supabase
      .from("project_comments")
      .insert({
        project_id: id,
        tenant_id: project.tenant_id,
        author_id: user.user_id,
        author_role: role,
        content: content.trim().slice(0, 2000),
      })
      .select()
      .single();

    if (error) {
      console.error("[POST video comments] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // === Notifications ===
    if (role === "tenant_admin" || role === "super_admin") {
      if (project.created_by && project.created_by !== user.user_id) {
        await createNotification(supabase, {
          userId: project.created_by,
          tenantId: project.tenant_id,
          type: "comment_added",
          title: "Nouveau feedback admin",
          message: content.trim().slice(0, 100),
          relatedProjectId: id,
          relatedCommentId: data.id,
        });
      }
    } else {
      const { data: admins } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("tenant_id", project.tenant_id)
        .eq("role", "tenant_admin");

      if (admins) {
        for (const a of admins) {
          if (a.user_id !== user.user_id) {
            await createNotification(supabase, {
              userId: a.user_id,
              tenantId: project.tenant_id,
              type: "comment_added",
              title: "Nouveau commentaire du studio",
              message: content.trim().slice(0, 100),
              relatedProjectId: id,
              relatedCommentId: data.id,
            });
          }
        }
      }
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("user_id", user.user_id)
      .maybeSingle();

    return NextResponse.json({
      comment: {
        ...data,
        author_email: profile?.email || user.email || "Inconnu",
      },
    });
  } catch (err: any) {
    console.error("[POST video comments] fatal:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}