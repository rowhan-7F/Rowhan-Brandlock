import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { randomUUID } from "crypto";

// === Helper : récupère le tenant_id du user connecté ===
async function getCurrentTenantUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié", status: 401 };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("scope, role, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return { error: "Profil utilisateur introuvable", status: 403 };
  if (profile.scope !== "tenant" || !profile.tenant_id) {
    return { error: "Cet utilisateur n'est rattaché à aucun tenant", status: 403 };
  }

  return { user, supabase, tenantId: profile.tenant_id as string, role: profile.role as string };
}

// === GET : liste des projets du tenant courant ===
export async function GET() {
  const ctx = await getCurrentTenantUser();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from("studio_projects")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data || [] });
}

// === POST : crée un nouveau projet vierge ===
export async function POST(req: NextRequest) {
  const ctx = await getCurrentTenantUser();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const body = await req.json();
    const { title, templateKey } = body;

    if (!title || !templateKey) {
      return NextResponse.json(
        { error: "title et templateKey requis" },
        { status: 400 }
      );
    }

    // État initial : un projet vide avec un templateKey (le studio créera la 1ère slide à l'ouverture)
    const initialState = {
      templateKey,
      slides: [],
    };

    const projectId = randomUUID();

    const { data, error } = await ctx.supabase
      .from("studio_projects")
      .insert({
        id: projectId,
        tenant_id: ctx.tenantId,
        title,
        status: "draft",
        state_json: initialState,
        created_by: ctx.user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Logge la création dans metric_events (pour facturation à la conso)
    await ctx.supabase.from("metric_events").insert({
      id: randomUUID(),
      tenant_id: ctx.tenantId,
      user_id: ctx.user.id,
      event_type: "project.created",
      metadata: { project_id: projectId, template_key: templateKey },
    });

    return NextResponse.json({ project: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
