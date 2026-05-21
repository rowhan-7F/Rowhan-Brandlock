"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, Plus, Loader2, Users, ChevronRight, Crown,
  AlertCircle, CheckCircle2, XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  PAGE LISTE TENANTS (V2)
//  Affiche tous les tenants avec compteurs + bouton "Nouveau client"
// ============================================================

type Tenant = {
  tenant_id: string;
  tenant_name: string;
  tier: string;
  config_version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  notes: string | null;
  admins_count: number;
  graphists_count: number;
};

export default function SuperAdminClientsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Non authentifié");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/super-admin/tenants", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Erreur de chargement");
        } else {
          setTenants(data.tenants || []);
        }
      } catch (err: any) {
        setError(err.message || "Erreur réseau");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-10 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Crown size={14} className="text-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
              Super Administration
            </span>
          </div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">
            Clients
          </h1>
          <p className="text-sm text-neutral-500">
            Gestion des tenants et de leurs utilisateurs
          </p>
        </div>

        <Link
          href="/super-admin/clients/new"
          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm"
        >
          <Plus size={14} strokeWidth={3} />
          Nouveau client
        </Link>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-red-700 mb-1">Erreur</div>
            <div className="text-xs text-red-600">{error}</div>
          </div>
        </div>
      ) : tenants.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <TenantCard key={t.tenant_id} tenant={t} />
          ))}
        </div>
      )}
    </div>
  );
}


// ============================================================
//  TENANT CARD
// ============================================================
function TenantCard({ tenant }: { tenant: Tenant }) {
  const totalUsers = tenant.admins_count + tenant.graphists_count;

  const tierColors: Record<string, string> = {
    enterprise_b2g: "bg-orange-50 text-orange-700 border-orange-200",
    pro_b2b: "bg-blue-50 text-blue-700 border-blue-200",
    starter: "bg-neutral-50 text-neutral-700 border-neutral-200",
  };
  const tierColor = tierColors[tenant.tier] || tierColors.starter;

  return (
    <Link
      href={`/super-admin/clients/${tenant.tenant_id}`}
      className="bg-white rounded-xl border border-neutral-200 hover:border-neutral-300 hover:shadow-sm transition p-5 flex items-center gap-4 group"
    >
      <div className="w-12 h-12 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
        <Building2 size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="text-sm font-bold text-neutral-900 truncate">{tenant.tenant_name}</h3>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${tierColor}`}>
            {tenant.tier}
          </span>
          {tenant.is_active ? (
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
              <CheckCircle2 size={9} />
              Actif
            </span>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
              <XCircle size={9} />
              Inactif
            </span>
          )}
        </div>
        <div className="text-[11px] text-neutral-500 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-neutral-400">{tenant.tenant_id}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Users size={11} />
            {tenant.admins_count} admin{tenant.admins_count > 1 ? "s" : ""} · {tenant.graphists_count} membre studio{tenant.graphists_count > 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>Créé le {new Date(tenant.created_at).toLocaleDateString("fr-CH")}</span>
        </div>
      </div>

      <ChevronRight size={18} className="text-neutral-300 group-hover:text-neutral-500 transition shrink-0" />
    </Link>
  );
}


// ============================================================
//  EMPTY STATE
// ============================================================
function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-300 p-16 text-center">
      <Building2 size={36} className="text-neutral-300 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-neutral-900 mb-1">Aucun client pour l&apos;instant</h3>
      <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
        Créez votre premier client pour commencer à utiliser BrandLock avec des tenants réels.
      </p>
      <Link
        href="/super-admin/clients/new"
        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg inline-flex items-center gap-2 transition shadow-sm"
      >
        <Plus size={14} strokeWidth={3} />
        Créer le premier client
      </Link>
    </div>
  );
}
