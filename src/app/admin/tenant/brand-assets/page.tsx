"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { confirmDialog } from "@/lib/confirmDialog";
import { Loader2 } from "lucide-react";
import StudioHeader from "@/components/StudioHeader";
import AdminTenantMenu from "@/components/admin/AdminTenantMenu";
import BrandAssetsTenantSection from "@/components/admin/BrandAssetsTenantSection";

function TenantBrandAssetsPageInner() {
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

      let resolvedTenantId: string | null = null;

      if (profile.role === "super_admin") {
        const queryTenantId = searchParams.get("tenantId");
        if (queryTenantId) {
          resolvedTenantId = queryTenantId;
          setIsSuperAdminView(true);
        } else {
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


  const handleLogout = async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d'accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <StudioHeader
        backHref={isSuperAdminView ? "/super-admin/clients" : "/admin/tenant"}
        eyebrowMain={isSuperAdminView ? "SUPER ADMIN" : "ADMINISTRATION"}
        eyebrowSubtitle={tenantName}
        title="Brand Assets"
        showAdminMenu={!isSuperAdminView}
        adminMenuActive="brand-assets"
        tenantId={tenantId}
        showNotifications={true}
        showLogout={true}
        onLogout={handleLogout}
      />

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

export default function TenantBrandAssetsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-neutral-400" size={28} /></div>}>
      <TenantBrandAssetsPageInner />
    </Suspense>
  );
}
