import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";

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

  return { user, supabase, tenantId: profile.tenant_id as string };
}

// === GET : récupère un projet spécifique ===
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await getCurrentTenantUser();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { projectId } = await params;
  const { data, error } = await ctx.supabase
    .from("studio_projects")
    .select("*")
    .eq("id", projectId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  return NextResponse.json({ project: data });
}

// === DELETE : supprime un projet (soft delete = archived) ===
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await getCurrentTenantUser();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { projectId } = await params;
  const { error } = await ctx.supabase
    .from("studio_projects")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
