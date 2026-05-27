"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Loader2, AlertCircle, Plus, X, Trash2, Mail, User, Briefcase, Eye, EyeOff,
} from "lucide-react";
import StudioHeader from "@/components/StudioHeader";
import AdminTenantMenu from "@/components/admin/AdminTenantMenu";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import AdminMobileHeader from "@/components/admin/AdminMobileHeader";

const BRAND_BORDEAUX = "#B11E2F";

const AVAILABLE_SERVICES = [
  { value: "graphic_studio", label: "Graphic Studio" },
  // V2 : { value: "rh_studio", label: "RH Studio" },
  // V2 : { value: "marketing_studio", label: "Marketing Studio" },
];

type TeamMember = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  service: string | null;
  tenant_id: string | null;
  created_at: string;
};

function TeamPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [isSuperAdminView, setIsSuperAdminView] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = useCallback(async (resolvedTenantId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/");
      return;
    }
    const url = "/api/admin/team?tenantId=" + resolvedTenantId;
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + session.access_token },
    });
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members || []);
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error("Erreur chargement", { description: data.error });
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
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
      } else if (profile.role === "tenant_admin") {
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
      await fetchData(resolvedTenantId!);
      setLoading(false);
    })();
  }, [router, searchParams, fetchData]);

  const handleDelete = async (member: TeamMember) => {
    const ok = await confirmDialog(
      "Supprimer " + (member.display_name || member.email) + " ?",
      {
        description: "L'utilisateur perdra l'acces a la plateforme. Action irreversible.",
        confirmLabel: "Supprimer",
        destructive: true,
      }
    );
    if (!ok) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = "/api/admin/team/" + member.user_id + "?tenantId=" + tenantId;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + session?.access_token },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur");
      }
      toast.success("Utilisateur supprime");
      if (tenantId) await fetchData(tenantId);
    } catch (err: any) {
      toast.error("Suppression impossible", { description: err.message });
    }
  };

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
        <AdminMobileHeader title="Mon équipe" tenantName={tenantName || "Brand"} />
        <div className="hidden md:block">
      <StudioHeader
        backHref={isSuperAdminView ? "/super-admin/clients" : "/admin/tenant"}
        eyebrowMain={isSuperAdminView ? "SUPER ADMIN" : "ADMINISTRATION"}
        eyebrowSubtitle={tenantName}
        title="Ma Team"
        showAdminMenu={!isSuperAdminView}
        adminMenuActive="team"
        tenantId={tenantId}
        showNotifications={true}
        showLogout={true}
        onLogout={handleLogout}
      />
        </div>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-neutral-600">
              Gerez les utilisateurs de votre tenant <strong>{tenantName}</strong>.
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Chaque utilisateur est assigne a un service (studio). Pour V1 : <em>Graphic Studio</em>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition hover:opacity-90"
            style={{ backgroundColor: BRAND_BORDEAUX }}
          >
            <Plus size={14} />
            Ajouter un utilisateur
          </button>
        </div>

        {members.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
            <User size={28} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-500">Aucun membre dans cette equipe pour l'instant.</p>
            <p className="text-xs text-neutral-400 mt-1">Cliquez sur "Ajouter un utilisateur" pour commencer.</p>
          </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => (
              <MemberCard
                key={m.user_id}
                member={m}
                onDelete={() => handleDelete(m)}
              />
            ))}
          </div>
        )}
      </main>

      {showAddModal && tenantId && (
        <AddStudioModal
          tenantId={tenantId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData(tenantId);
          }}
        />
      )}
    </div>
  );
}

function MemberCard({ member, onDelete }: { member: TeamMember; onDelete: () => void }) {
  const serviceLabel = AVAILABLE_SERVICES.find((s) => s.value === member.service)?.label
    || (member.role === "tenant_admin" ? "Administration" : "—");

  const isAdmin = member.role === "tenant_admin";

  return (
      <div className="group bg-white rounded-2xl border border-neutral-200 p-5 hover:border-neutral-300 hover:shadow-lg transition-all flex flex-col">
        {/* Avatar avec initiales en gradient */}
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-lg shadow-md"
            style={{
              background: isAdmin
                ? `linear-gradient(135deg, ${BRAND_BORDEAUX} 0%, #7A1320 100%)`
                : `linear-gradient(135deg, #1A2332 0%, #2A3445 100%)`,
            }}
          >
            {(member.display_name || member.email).slice(0, 2).toUpperCase()}
          </div>
        </div>

        {/* Nom */}
        <div className="text-center mb-1">
          <h3 className="text-sm font-bold text-neutral-900 truncate">
            {member.display_name || member.email.split("@")[0]}
          </h3>
        </div>

        {/* Email */}
        <div className="text-center mb-4">
          <p className="text-xs text-neutral-500 truncate flex items-center justify-center gap-1.5">
            <Mail size={11} />
            {member.email}
          </p>
        </div>

        {/* Separator + Role badge */}
        <div className="flex items-center justify-center gap-2 mb-3 py-2 border-t border-b border-neutral-100">
          <span
            className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded text-white"
            style={{ backgroundColor: isAdmin ? BRAND_BORDEAUX : "#1A2332" }}
          >
            {isAdmin ? "Admin" : "Graphiste"}
          </span>
        </div>

        {/* Service / metier */}
        <div className="text-center mb-4 flex-1">
          <div className="text-[10px] text-neutral-400 flex items-center justify-center gap-1.5">
            <Briefcase size={10} />
            {serviceLabel}
          </div>
        </div>

        {/* Action Delete (bas, discret) */}
        {!isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            className="w-full mt-2 py-2 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100"
            title="Supprimer"
          >
            <Trash2 size={11} />
            Retirer
          </button>
        )}
      </div>
    );
}

function AddStudioModal({
  tenantId, onClose, onSuccess,
}: {
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [service, setService] = useState(AVAILABLE_SERVICES[0].value);
  const [submitting, setSubmitting] = useState(false);

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
    setShowPassword(true);
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Champs obligatoires", { description: "Email et mot de passe requis." });
      return;
    }
    if (password.length < 8) {
      toast.error("Mot de passe trop court", { description: "Min 8 caracteres." });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + session?.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          display_name: displayName.trim() || null,
          password,
          service,
          tenant_id: tenantId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur creation");

      toast.success("Utilisateur ajouté", {
        description: "Transmettez l'email et le mot de passe a " + email + ".",
      });
      onSuccess();
    } catch (err: any) {
      toast.error("Creation impossible", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Nouveau</div>
            <h3 className="text-base font-bold text-neutral-900">Utilisateur</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean@example.com"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-[#B11E2F] focus:outline-none focus:ring-2 focus:ring-[#B11E2F]/20"
              autoFocus
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">
              Nom d'affichage (optionnel)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-[#B11E2F] focus:outline-none focus:ring-2 focus:ring-[#B11E2F]/20"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">
              Mot de passe initial *
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 caracteres"
                  className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-lg text-sm focus:border-[#B11E2F] focus:outline-none focus:ring-2 focus:ring-[#B11E2F]/20 font-mono"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={generatePassword}
                className="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition shrink-0"
                disabled={submitting}
              >
                Generer
              </button>
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">
              Transmettez ce mot de passe a l'utilisateur (email, SMS, etc.)
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">
              Utilisateur *
            </label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-[#B11E2F] focus:outline-none focus:ring-2 focus:ring-[#B11E2F]/20 bg-white"
              disabled={submitting}
            >
              {AVAILABLE_SERVICES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div className="text-[10px] text-neutral-400 mt-1">
              Determine les droits d'acces sur la plateforme.
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-white rounded-lg transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !email.trim() || !password.trim()}
            className="text-white text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-lg transition flex items-center gap-1.5 disabled:opacity-40"
            style={{ backgroundColor: BRAND_BORDEAUX }}
          >
            {submitting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Creation...
              </>
            ) : (
              <>
                <Plus size={12} />
                Creer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-neutral-400" size={28} /></div>}>
      <TeamPageInner />
    </Suspense>
  );
}
