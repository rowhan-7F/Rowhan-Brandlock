"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Building2, Users, FileText, Trash2, Loader2,
  CheckCircle2, XCircle, AlertCircle, Crown, Calendar,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import BrandAssetsSection from "@/components/admin/BrandAssetsSection";

// ============================================================
//  PAGE DÉTAIL TENANT
//  Affiche infos + liste users + actions (delete)
//  Édition complète viendra plus tard
// ============================================================

type Tenant = {
  tenant_id: string;
  tenant_name: string;
  tier: string;
  config_json: any;
  config_version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  notes: string | null;
};

type TenantUser = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
};

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const router = useRouter();
  const { tenantId } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [stats, setStats] = useState<{ total_projects: number } | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const loadTenant = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Non authentifié");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur de chargement");
      } else {
        setTenant(data.tenant);
        setUsers(data.users || []);
        setStats(data.stats || null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleDelete = async () => {
    if (confirmText !== tenantId) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur suppression");
      }
      router.push("/super-admin/clients");
    } catch (err: any) {
      alert("Erreur : " + err.message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-10 max-w-3xl mx-auto">
        <Link
          href="/super-admin/clients"
          className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-4 w-fit"
        >
          <ArrowLeft size={12} />
          Retour à la liste
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-red-700 mb-1">Erreur</div>
            <div className="text-xs text-red-600">{error || "Tenant introuvable"}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      {/* HEADER */}
      <div className="mb-8">
        <Link
          href="/super-admin/clients"
          className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-4 w-fit"
        >
          <ArrowLeft size={12} />
          Retour à la liste
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown size={14} className="text-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                Super Administration
              </span>
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-1">
              {tenant.tenant_name}
            </h1>
            <p className="text-xs font-mono text-neutral-400">{tenant.tenant_id}</p>
          </div>
        </div>
      </div>

      {/* STATS RAPIDES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatBox
          icon={<Users size={16} />}
          label="Admins"
          value={users.filter((u) => u.role === "tenant_admin").length}
          color="blue"
        />
        <StatBox
          icon={<Users size={16} />}
          label="Studio"
          value={users.filter((u) => u.role === "graphist").length}
          color="purple"
        />
        <StatBox
          icon={<FileText size={16} />}
          label="Projets"
          value={stats?.total_projects || 0}
          color="green"
        />
        <StatBox
          icon={tenant.is_active ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          label="Statut"
          value={tenant.is_active ? "Actif" : "Inactif"}
          color={tenant.is_active ? "green" : "red"}
        />
      </div>

      {/* SECTION INFOS */}
      <Section title="Informations">
        <InfoRow label="Identifiant" value={<span className="font-mono">{tenant.tenant_id}</span>} />
        <InfoRow label="Nom affiché" value={tenant.tenant_name} />
        <InfoRow label="Formule" value={<TierBadge tier={tenant.tier} />} />
        <InfoRow label="Version config" value={tenant.config_version} />
        <InfoRow
          label="Créé le"
          value={new Date(tenant.created_at).toLocaleString("fr-CH")}
        />
        {tenant.updated_at && (
          <InfoRow
            label="Modifié le"
            value={new Date(tenant.updated_at).toLocaleString("fr-CH")}
          />
        )}
        {tenant.notes && <InfoRow label="Notes" value={tenant.notes} />}
      </Section>

      {/* SECTION USERS */}
      <Section title={`Utilisateurs (${users.length})`}>
        {users.length === 0 ? (
          <div className="text-center py-6 text-sm text-neutral-400">
            Aucun utilisateur. Ce tenant est inutilisable.
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.user_id}
                className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                    u.role === "tenant_admin"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-purple-50 text-purple-700 border-purple-200"
                  }`}>
                    {u.role === "tenant_admin" ? "Admin" : "Studio"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-neutral-900 truncate">
                      {u.display_name || u.email}
                    </div>
                    {u.display_name && (
                      <div className="text-[11px] text-neutral-500 truncate">{u.email}</div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-neutral-400 shrink-0 flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(u.created_at).toLocaleDateString("fr-CH")}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-neutral-400 mt-3 text-center">
          💡 L&apos;ajout/suppression d&apos;utilisateurs sera disponible dans une prochaine version
        </p>
      </Section>

      {/* SECTION BRAND ASSETS (Phase 7 V2) */}
      <BrandAssetsSection tenantId={tenant.tenant_id} />

      {/* SECTION CONFIG JSON (collapsible) */}
      <Section title="Configuration JSON">
        <details className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 group">
          <summary className="cursor-pointer text-xs font-bold text-neutral-700 hover:text-orange-600">
            Voir le JSON complet ({JSON.stringify(tenant.config_json).length} caractères)
          </summary>
          <pre className="mt-3 text-[10px] font-mono bg-neutral-900 text-neutral-100 p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(tenant.config_json, null, 2)}
          </pre>
        </details>
      </Section>

      {/* DANGER ZONE */}
      <section className="mt-12 bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <AlertCircle size={16} />
          </div>
          <div>
            <h2 className="text-base font-bold text-red-700">Zone dangereuse</h2>
            <p className="text-xs text-red-600 mt-0.5">
              Supprimer ce tenant supprimera également TOUS ses utilisateurs et données associées.
            </p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="bg-white border border-red-300 hover:bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Trash2 size={13} />
            Supprimer ce client
          </button>
        ) : (
          <div className="bg-white border border-red-200 rounded-lg p-4">
            <p className="text-xs text-neutral-700 mb-3">
              Pour confirmer la suppression, tape <code className="px-1.5 py-0.5 bg-neutral-100 rounded font-mono font-bold">{tenant.tenant_id}</code> ci-dessous :
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={tenant.tenant_id}
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm font-mono focus:border-red-500 focus:outline-none mb-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmText("");
                }}
                disabled={deleting}
                className="px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || confirmText !== tenant.tenant_id}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                {deleting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 size={12} />
                    Confirmer la suppression
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}


// ============================================================
//  STAT BOX
// ============================================================
function StatBox({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: "blue" | "purple" | "green" | "red";
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    green: "bg-green-50 text-green-600 border-green-100",
    red: "bg-red-50 text-red-600 border-red-100",
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{label}</div>
        <div className="text-lg font-black text-neutral-900">{value}</div>
      </div>
    </div>
  );
}


// ============================================================
//  SECTION
// ============================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 bg-white rounded-2xl border border-neutral-200 p-6">
      <h2 className="text-base font-bold text-neutral-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}


// ============================================================
//  INFO ROW
// ============================================================
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start py-2 border-b border-neutral-100 last:border-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-32 shrink-0 pt-0.5">
        {label}
      </div>
      <div className="text-sm text-neutral-900 flex-1">{value}</div>
    </div>
  );
}


// ============================================================
//  TIER BADGE
// ============================================================
function TierBadge({ tier }: { tier: string }) {
  const tierColors: Record<string, string> = {
    enterprise_b2g: "bg-orange-50 text-orange-700 border-orange-200",
    pro_b2b: "bg-blue-50 text-blue-700 border-blue-200",
    starter: "bg-neutral-50 text-neutral-700 border-neutral-200",
  };
  const color = tierColors[tier] || tierColors.starter;

  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${color}`}>
      {tier}
    </span>
  );
}
