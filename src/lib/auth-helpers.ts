import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================================
//  AUTH HELPERS — Version robuste avec logs et fallback
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type UserProfile = {
  user_id: string;
  email: string;
  tenant_id: string | null;
  role: "super_admin" | "tenant_admin" | "graphist" | null;
  temporary_role: "tenant_admin" | "graphist" | null;
  temporary_role_expires_at: string | null;
  delegated_by: string | null;
  display_name: string | null;
};

export type AuthResult =
  | { ok: true; user: UserProfile; supabase: SupabaseClient }
  | { ok: false; status: number; error: string };

/**
 * Récupère l'utilisateur authentifié + son profil complet
 * Version robuste : ne demande QUE les colonnes essentielles
 */
export async function getAuthenticatedUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[auth] NO BEARER TOKEN");
    return { ok: false, status: 401, error: "Non authentifié" };
  }
  const token = authHeader.slice(7);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1) Récupère l'auth user
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    console.log("[auth] INVALID TOKEN", authError?.message);
    return { ok: false, status: 401, error: "Token invalide" };
  }

  // 2) Récupère le profile — UNIQUEMENT les colonnes essentielles
  //    (on évite temporary_role, delegated_by qui peuvent ne pas exister)
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("user_id, email, tenant_id, role, display_name")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[auth] PROFILE QUERY ERROR:", profileError);
    return { ok: false, status: 500, error: "Erreur lecture profil: " + profileError.message };
  }

  if (!profile) {
    console.log("[auth] PROFILE NOT FOUND for user_id:", authData.user.id);
    return { ok: false, status: 403, error: "Profil introuvable" };
  }

  // 3) Tentative de récupérer les colonnes de délégation (optionnel)
  //    Si elles existent, on les ajoute. Si pas, on met null.
  let temporary_role: any = null;
  let temporary_role_expires_at: any = null;
  let delegated_by: any = null;

  try {
    const { data: delegation } = await supabase
      .from("user_profiles")
      .select("temporary_role, temporary_role_expires_at, delegated_by")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (delegation) {
      temporary_role = delegation.temporary_role || null;
      temporary_role_expires_at = delegation.temporary_role_expires_at || null;
      delegated_by = delegation.delegated_by || null;
    }
  } catch (e) {
    // Si les colonnes n'existent pas, on ignore silencieusement
    console.log("[auth] delegation columns not available (OK)");
  }

  // Email fallback depuis auth user
  const email = profile.email || authData.user.email || "";

  return {
    ok: true,
    user: {
      ...profile,
      email,
      temporary_role,
      temporary_role_expires_at,
      delegated_by,
    } as UserProfile,
    supabase,
  };
}

/**
 * Vrai si le user est admin pour ce tenant (incluant délégation active)
 */
export function isTenantAdmin(user: UserProfile, tenantId: string): boolean {
  if (user.role === "super_admin") return true;
  if (user.tenant_id !== tenantId) return false;
  if (user.role === "tenant_admin") return true;
  if (
    user.temporary_role === "tenant_admin" &&
    user.temporary_role_expires_at &&
    new Date(user.temporary_role_expires_at) > new Date()
  ) {
    return true;
  }
  return false;
}

/**
 * Vrai si le user appartient au tenant
 */
export function belongsToTenant(user: UserProfile, tenantId: string): boolean {
  if (user.role === "super_admin") return true;
  return user.tenant_id === tenantId;
}

/**
 * Détermine le rôle effectif du user
 */
export function getEffectiveRole(user: UserProfile): "super_admin" | "tenant_admin" | "graphist" {
  if (user.role === "super_admin") return "super_admin";
  if (
    user.temporary_role &&
    user.temporary_role_expires_at &&
    new Date(user.temporary_role_expires_at) > new Date()
  ) {
    return user.temporary_role;
  }
  return user.role || "graphist";
}

/**
 * Crée une notification pour un user
 */
export async function createNotification(
  supabase: SupabaseClient,
  params: {
    userId: string;
    tenantId: string;
    type:
      | "task_assigned"
      | "task_completed"
      | "project_submitted"
      | "project_approved"
      | "project_rejected"
      | "comment_added"
      | "role_delegated";
    title: string;
    message?: string;
    relatedProjectId?: string;
    relatedTaskId?: string;
    relatedCommentId?: string;
  }
): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      type: params.type,
      title: params.title,
      message: params.message || null,
      related_project_id: params.relatedProjectId || null,
      related_task_id: params.relatedTaskId || null,
      related_comment_id: params.relatedCommentId || null,
    });
  } catch (err) {
    console.error("[createNotification] error:", err);
    // Ne throw pas — on ne veut pas bloquer le flow principal
  }
}