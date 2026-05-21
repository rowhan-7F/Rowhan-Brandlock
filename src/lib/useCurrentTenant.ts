"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { BrandConfig } from "../types/brandConfig";

export type TenantUser = {
  userId: string;
  email: string;
  scope: "platform" | "tenant";
  role: "super_admin" | "tenant_admin" | "graphist" | "viewer";
  tenantId: string | null;
  displayName: string | null;
};

export type CurrentTenantState =
  | { status: "loading"; user: null; config: null; error: null }
  | { status: "unauthenticated"; user: null; config: null; error: null }
  | { status: "no_profile"; user: null; config: null; error: string }
  | { status: "no_tenant"; user: TenantUser; config: null; error: string }
  | { status: "ready"; user: TenantUser; config: BrandConfig; error: null }
  | { status: "error"; user: null; config: null; error: string };

/**
 * Hook centralisé : récupère le user connecté + sa config JSON.
 * - Si super_admin : pas de tenant rattaché, config est null
 * - Si tenant_admin/graphist : charge automatiquement le config_json de son tenant
 * - Si non connecté : status='unauthenticated'
 */
export function useCurrentTenant(): CurrentTenantState {
  const [state, setState] = useState<CurrentTenantState>({
    status: "loading",
    user: null,
    config: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Récupère le user authentifié
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) {
          if (!cancelled) {
            setState({ status: "unauthenticated", user: null, config: null, error: null });
          }
          return;
        }

        // 2. Récupère son profile
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("scope, role, tenant_id, display_name")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
          if (!cancelled) {
            setState({
              status: "no_profile",
              user: null,
              config: null,
              error: "Aucun profil métier trouvé pour cet utilisateur",
            });
          }
          return;
        }

        const user: TenantUser = {
          userId: authData.user.id,
          email: authData.user.email || "",
          scope: profile.scope as "platform" | "tenant",
          role: profile.role as TenantUser["role"],
          tenantId: profile.tenant_id,
          displayName: profile.display_name,
        };

        // 3. Si super_admin : pas de tenant à charger
        if (user.scope === "platform") {
          if (!cancelled) {
            setState({
              status: "no_tenant",
              user,
              config: null,
              error: "Le super_admin n'est rattaché à aucun tenant",
            });
          }
          return;
        }

        // 4. Tenant user : charge sa config JSON
        if (!user.tenantId) {
          if (!cancelled) {
            setState({
              status: "no_tenant",
              user,
              config: null,
              error: "Aucun tenant_id rattaché à cet utilisateur",
            });
          }
          return;
        }

        const { data: tenantRow, error: tenantError } = await supabase
          .from("tenant_configs")
          .select("config_json")
          .eq("tenant_id", user.tenantId)
          .eq("is_active", true)
          .maybeSingle();

        if (tenantError) throw tenantError;
        if (!tenantRow) {
          if (!cancelled) {
            setState({
              status: "no_tenant",
              user,
              config: null,
              error: `Aucune configuration active pour le tenant ${user.tenantId}`,
            });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            user,
            config: tenantRow.config_json as BrandConfig,
            error: null,
          });
        }
      } catch (err: any) {
        console.error("[useCurrentTenant]", err);
        if (!cancelled) {
          setState({
            status: "error",
            user: null,
            config: null,
            error: err.message || "Erreur inconnue",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
