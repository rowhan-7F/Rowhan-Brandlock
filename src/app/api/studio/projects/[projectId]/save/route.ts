import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

  return {
    user,
    supabase,
    tenantId: profile.tenant_id as string,
    role: profile.role as string,
  };
}

// ============================================================
//  PATCH : Met à jour un projet (title, state_json, status)
//  Version PERMISSIVE : permet toutes les transitions sauf depuis approved/published
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await getCurrentTenantUser();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { projectId } = await params;
    const body = await req.json();
    const { state_json, status, title } = body;

    console.log("[PATCH save] projectId:", projectId);
    console.log("[PATCH save] body keys:", Object.keys(body));
    console.log("[PATCH save] status requested:", status);

    if (state_json === undefined && status === undefined && title === undefined) {
      return NextResponse.json(
        { error: "Aucun champ à mettre à jour (title, state_json ou status requis)" },
        { status: 400 }
      );
    }

    if (state_json !== undefined) {
      if (typeof state_json !== "object" || !Array.isArray(state_json.slides)) {
        console.error("[PATCH save] state_json invalide:", typeof state_json, state_json?.slides);
        return NextResponse.json(
          { error: "state_json invalide (slides doit être un tableau)" },
          { status: 400 }
        );
      }
    }

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return NextResponse.json({ error: "title doit être une chaîne non vide" }, { status: 400 });
      }
      if (title.length > 100) {
        return NextResponse.json({ error: "title trop long (max 100 caractères)" }, { status: 400 });
      }
    }

    const { data: existing } = await ctx.supabase
      .from("studio_projects")
      .select("id, tenant_id, status")
      .eq("id", projectId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: "Projet introuvable ou accès refusé" },
        { status: 404 }
      );
    }

    console.log("[PATCH save] current status:", existing.status, "→ target:", status);

    // Validation status — PERMISSIVE
    if (status !== undefined) {
      const ALLOWED_TARGET = ["draft", "pending_approval", "rejected"];

      if (!ALLOWED_TARGET.includes(status)) {
        return NextResponse.json(
          { error: `Statut cible invalide : ${status}. Autorisés : ${ALLOWED_TARGET.join(", ")}` },
          { status: 400 }
        );
      }

      if (existing.status === "approved" || existing.status === "published") {
        return NextResponse.json(
          { error: `Un projet ${existing.status} ne peut plus être modifié` },
          { status: 403 }
        );
      }
    }

    if ((state_json !== undefined || title !== undefined) &&
        (existing.status === "approved" || existing.status === "published")) {
      return NextResponse.json(
        { error: `Un projet ${existing.status} ne peut plus être modifié` },
        { status: 403 }
      );
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (state_json !== undefined) updatePayload.state_json = state_json;
    if (title !== undefined) updatePayload.title = title.trim();
    if (status !== undefined) updatePayload.status = status;

    const { error } = await ctx.supabase
      .from("studio_projects")
      .update(updatePayload)
      .eq("id", projectId)
      .eq("tenant_id", ctx.tenantId);

    if (error) {
      console.error("[PATCH save] update DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PATCH save] fatal:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}