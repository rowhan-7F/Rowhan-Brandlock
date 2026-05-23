"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Users, Film, Library } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  ADMIN TENANT MENU - Phase 10 UX
//  Menu unifie pour les 4 pages de l'espace admin-client :
//  Dashboard / Ma Team / Brand Assets / Bibliotheque
//
//  Le bouton actif est mis en BORDEAUX (white text).
//  Les autres restent neutres (white bg + neutre text).
//  Compteurs affiches en badge orange/rouge si pending.
// ============================================================

const BRAND_BORDEAUX = "#B11E2F";

type ActivePage = "dashboard" | "team" | "brand-assets" | "library";

type Props = {
  active: ActivePage;
  tenantId: string | null;
};

export default function AdminTenantMenu({ active, tenantId }: Props) {
  const [teamCount, setTeamCount] = useState(0);
  const [brandAssetsPending, setBrandAssetsPending] = useState(0);
  const [libraryPending, setLibraryPending] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    (async () => {
      // Count users in tenant
      const { count: usersC } = await supabase
        .from("user_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("role", "graphist");

      // Count pending BG brand assets
      const { count: brandC } = await supabase
        .from("brand_video_asset_backgrounds")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_approved", false)
        .is("rejected_at", null);

      // Count pending brand images library
      const { count: libC } = await supabase
        .from("brand_images")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_approved", false);

      if (!cancelled) {
        setTeamCount(usersC || 0);
        setBrandAssetsPending(brandC || 0);
        setLibraryPending(libC || 0);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantId]);

  return (
    <div className="flex items-center gap-2">
      <MenuButton
        href="/admin/tenant"
        icon={<LayoutDashboard size={13} />}
        label="Dashboard"
        active={active === "dashboard"}
      />
      <MenuButton
        href="/admin/tenant/team"
        icon={<Users size={13} />}
        label="Ma Team"
        active={active === "team"}
        badge={teamCount > 0 ? teamCount : undefined}
        badgeColor="neutral"
      />
      <MenuButton
        href="/admin/tenant/brand-assets"
        icon={<Film size={13} />}
        label="Brand Assets"
        active={active === "brand-assets"}
        badge={brandAssetsPending > 0 ? brandAssetsPending : undefined}
        badgeColor="orange"
      />
      <MenuButton
        href="/admin/tenant/library"
        icon={<Library size={13} />}
        label="Bibliotheque"
        active={active === "library"}
        badge={libraryPending > 0 ? libraryPending : undefined}
        badgeColor="orange"
      />
    </div>
  );
}

function MenuButton({
  href, icon, label, active, badge, badgeColor = "neutral",
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  badgeColor?: "neutral" | "orange" | "red";
}) {
  const activeClass = active
    ? "text-white shadow-sm"
    : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300";

  const style = active
    ? { backgroundColor: BRAND_BORDEAUX, borderColor: BRAND_BORDEAUX }
    : {};

  const badgeClass = badgeColor === "orange"
    ? "bg-orange-500 text-white animate-pulse"
    : badgeColor === "red"
    ? "bg-red-600 text-white animate-pulse"
    : "bg-neutral-100 text-neutral-600";

  return (
    <Link
      href={href}
      style={style}
      className={"px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 relative " + activeClass}
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={"text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded " + badgeClass}>
          {badge}
        </span>
      )}
    </Link>
  );
}