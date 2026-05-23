"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Film, Loader2, ArrowLeft } from "lucide-react";
import BrandAssetsTenantSection from "@/components/admin/BrandAssetsTenantSection";

const BRAND_BORDEAUX = "#B11E2F";
const BRAND_BORDEAUX_LIGHT = "#B11E2F1A";

export default function TenantBrandAssetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [isSuperAdminView, setIsSuperAdminView] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("scope, role, tenant_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile) {
        router.push("/");
        return;
      }

      // Cas 1 : tenant_admin / graphist -> son propre tenant_id
      // Cas 2 : super_admin -> tenant_id via ?tenantId=...
      let resolvedTenantId: string | null = null;

      if (profile.role === "super_admin") {
        const queryTenantId = searchParams.get("tenantId");
        if (queryTenantId) {
          resolvedTenantId = queryTenantId;
          setIsSuperAdminView(true);
        } else {
          // Pas de tenantId en query : redirige vers /super-admin/clients pour choisir
          router.push("/super-admin/clients");
          return;
        }
      } else if (profile.role === "tenant_admin" || profile.role === "graphist") {
        if (!profile.tenant_id) {
          router.push("/");
          return;
        }
        resolvedTenantId = profile.tenant_id;
      } else {
        router.push("/");
        return;
      }

      setTenantId(resolvedTenantId);

      const { data: tenant } = await supabase
        .from("tenant_configs")
        .select("tenant_name")
        .eq("tenant_id", resolvedTenantId)
        .maybeSingle();

      setTenantName(tenant?.tenant_name || resolvedTenantId || "");
      setLoading(false);
    })();
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!tenantId) return null;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND_BORDEAUX_LIGHT }}>
              <Film size={18} style={{ color: BRAND_BORDEAUX }} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-0.5">
                {isSuperAdminView ? "Super Admin -" : "Administration"} {tenantName}
              </div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter">
                Brand Assets
              </h1>
            </div>
          </div>
          <a href={isSuperAdminView ? "/super-admin/clients" : "/admin/tenant"} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition">
            <ArrowLeft size={12} />
            Retour
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-sm text-neutral-600 max-w-2xl">
            Gerez les <strong>backgrounds</strong> de vos templates intro et outro. Les overlays (logo + titre) sont <strong>verrouilles par votre BrandLock manager</strong> pour garantir la charte luxury.
          </p>
        </div>
        <BrandAssetsTenantSection tenantId={tenantId} />
      </main>
    </div>
  );
}