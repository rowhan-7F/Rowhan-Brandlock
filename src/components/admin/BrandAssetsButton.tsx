// ============================================================
//  Bouton "Brand Assets" pour le menu admin tenant
//  Affiche un badge avec le nombre de BGs en attente d'approbation.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
  tenantId: string | null;
};

export default function BrandAssetsButton({ tenantId }: Props) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("brand_video_asset_backgrounds")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_approved", false)
        .is("rejected_at", null);
      if (!cancelled) setPendingCount(count || 0);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  return (
    <Link
      href="/admin/tenant/brand-assets"
      className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-xs font-bold text-neutral-700 hover:bg-orange-50 hover:border-orange-300 transition flex items-center gap-1.5 relative"
      title="Brand Assets - Intro/Outro"
    >
      <Film size={13} />
      Brand Assets
      {pendingCount > 0 && (
        <span className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded animate-pulse">
          {pendingCount}
        </span>
      )}
    </Link>
  );
}