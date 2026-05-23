"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Library } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  STUDIO MENU - Phase 11 UX
//  Menu unifie pour les pages du STUDIO (graphist) :
//  [Projets] [Bibliotheque]
//
//  Active state ROUGE bordeaux pour la page courante.
//  Compteur badge sur Bibliotheque (uploads en attente).
// ============================================================

const BRAND_BORDEAUX = "#B11E2F";

type ActivePage = "projects" | "library";

type Props = {
  active: ActivePage;
  tenantId: string | null;
};

export default function StudioMenu({ active, tenantId }: Props) {
  const [pendingImages, setPendingImages] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    (async () => {
      const { count } = await supabase
        .from("brand_images")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_approved", false);

      if (!cancelled) {
        setPendingImages(count || 0);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantId]);

  return (
    <div className="flex items-center gap-2">
      <MenuButton
        href="/studio"
        icon={<LayoutGrid size={13} />}
        label="Projets"
        active={active === "projects"}
      />
      <MenuButton
        href="/studio/library"
        icon={<Library size={13} />}
        label="Bibliotheque"
        active={active === "library"}
        badge={pendingImages > 0 ? pendingImages : undefined}
      />
    </div>
  );
}

function MenuButton({
  href, icon, label, active, badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
}) {
  const activeClass = active
    ? "text-white shadow-sm"
    : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300";

  const style = active
    ? { backgroundColor: BRAND_BORDEAUX, borderColor: BRAND_BORDEAUX }
    : {};

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
        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500 text-white animate-pulse">
          {badge}
        </span>
      )}
    </Link>
  );
}