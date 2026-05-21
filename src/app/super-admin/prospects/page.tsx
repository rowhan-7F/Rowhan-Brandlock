"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Loader2, Inbox, Search, Mail, Phone, Building2, Calendar,
  CheckCircle2, XCircle, Clock, Sparkles, Trash2, Save, Copy,
  AlertCircle, Crown, X, ChevronRight, Filter, MailOpen,
  TrendingUp, Users, Target, UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ConvertProspectModal from "@/components/ConvertProspectModal";

// ============================================================
//  PAGE PROSPECTS — LUXURY EDITION (Split-pane)
//  Liste à gauche, détail à droite, keyboard shortcuts j/k
//  + Bouton "Convertir en client" sur la fiche
// ============================================================

type Prospect = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  message: string;
  status: "new" | "qualified" | "demo_planned" | "client" | "rejected";
  internal_notes: string | null;
  read: boolean;
  read_at: string | null;
  contacted_at: string | null;
  qualified_by: string | null;
  created_at: string;
  updated_at: string | null;
};

type Stats = {
  total: number;
  new: number;
  qualified: number;
  demo_planned: number;
  client: number;
  rejected: number;
  this_week: number;
  conversion_rate: number;
};

type ProspectStatus = "new" | "qualified" | "demo_planned" | "client" | "rejected";
type StatusFilter = "all" | ProspectStatus;

const STATUS_CONFIG: Record<ProspectStatus, { label: string; color: string; icon: any }> = {
  new: { label: "Nouveau", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Sparkles },
  qualified: { label: "Qualifié", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Target },
  demo_planned: { label: "Démo planifiée", color: "bg-purple-50 text-purple-700 border-purple-200", icon: Calendar },
  client: { label: "Client 🎉", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  rejected: { label: "Refusé", color: "bg-neutral-50 text-neutral-600 border-neutral-200", icon: XCircle },
};

const STATUS_KEYS = Object.keys(STATUS_CONFIG) as ProspectStatus[];

export default function SuperAdminProspectsPage() {
  const [loading, setLoading] = useState(true);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ⭐ NOUVEAU : state pour la modal de conversion
  const [convertModalOpen, setConvertModalOpen] = useState(false);

  // ============================================================
  //  Fetch data
  // ============================================================
  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Non authentifié");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (search) params.set("search", search);

      const res = await fetch(`/api/super-admin/prospects?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setProspects(data.prospects || []);
        setStats(data.stats || null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================================
  //  Sélection auto du premier élément si rien de sélectionné
  // ============================================================
  useEffect(() => {
    if (!selectedId && prospects.length > 0) {
      setSelectedId(prospects[0].id);
    }
    if (selectedId && !prospects.find((p) => p.id === selectedId)) {
      setSelectedId(prospects[0]?.id || null);
    }
  }, [prospects, selectedId]);

  // Marquer comme lu quand on sélectionne
  useEffect(() => {
    if (!selectedId) return;
    const p = prospects.find((p) => p.id === selectedId);
    if (p && !p.read) {
      handleUpdate(selectedId, { read: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ============================================================
  //  Keyboard shortcuts (j/k navigation, Esc deselect)
  // ============================================================
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Ne pas naviguer si la modal est ouverte
      if (convertModalOpen) return;

      const idx = prospects.findIndex((p) => p.id === selectedId);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = prospects[Math.min(prospects.length - 1, idx + 1)];
        if (next) setSelectedId(next.id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = prospects[Math.max(0, idx - 1)];
        if (prev) setSelectedId(prev.id);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prospects, selectedId, convertModalOpen]);

  // ============================================================
  //  Update prospect (PATCH)
  // ============================================================
  const handleUpdate = async (id: string, updates: Partial<Prospect>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/super-admin/prospects/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) {
        setProspects((prev) => prev.map((p) => (p.id === id ? data.prospect : p)));
        // Refresh stats
        fetchData();
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  // ============================================================
  //  Delete
  // ============================================================
  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer ce prospect définitivement ?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/super-admin/prospects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        setProspects((prev) => prev.filter((p) => p.id !== id));
        setSelectedId(null);
        fetchData();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const selectedProspect = useMemo(
    () => prospects.find((p) => p.id === selectedId) || null,
    [prospects, selectedId]
  );

  // ============================================================
  //  Loading
  // ============================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* HEADER */}
      <div className="px-8 py-6 border-b border-neutral-200 bg-white shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown size={12} className="text-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                Super Administration
              </span>
            </div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">
              Prospects
            </h1>
          </div>

          {/* Stats LUXURY */}
          {stats && (
            <div className="flex items-center gap-3">
              <StatPill icon={<Inbox size={11} />} label="Total" value={stats.total} color="neutral" />
              <StatPill icon={<Sparkles size={11} />} label="Nouveaux" value={stats.new} color="blue" highlight={stats.new > 0} />
              <StatPill icon={<TrendingUp size={11} />} label="Cette semaine" value={stats.this_week} color="amber" />
              <StatPill icon={<Target size={11} />} label="Conversion" value={`${stats.conversion_rate}%`} color="green" />
            </div>
          )}
        </div>

        {/* Filtres LUXURY */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, entreprise..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:border-orange-500 focus:outline-none transition"
            />
          </div>

          <FilterButton
            label="Tous"
            active={filterStatus === "all"}
            onClick={() => setFilterStatus("all")}
            count={stats?.total}
          />
          <FilterButton
            label="Nouveaux"
            active={filterStatus === "new"}
            onClick={() => setFilterStatus("new")}
            count={stats?.new}
            highlight
          />
          <FilterButton
            label="Qualifiés"
            active={filterStatus === "qualified"}
            onClick={() => setFilterStatus("qualified")}
            count={stats?.qualified}
          />
          <FilterButton
            label="Démos"
            active={filterStatus === "demo_planned"}
            onClick={() => setFilterStatus("demo_planned")}
            count={stats?.demo_planned}
          />
          <FilterButton
            label="Clients"
            active={filterStatus === "client"}
            onClick={() => setFilterStatus("client")}
            count={stats?.client}
          />
          <FilterButton
            label="Refusés"
            active={filterStatus === "rejected"}
            onClick={() => setFilterStatus("rejected")}
            count={stats?.rejected}
          />
        </div>
      </div>

      {/* SPLIT-PANE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LISTE GAUCHE */}
        <div className="w-96 border-r border-neutral-200 bg-white overflow-y-auto shrink-0">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {prospects.length === 0 ? (
            <EmptyState search={search} status={filterStatus} />
          ) : (
            <div className="divide-y divide-neutral-100">
              {prospects.map((p) => (
                <ProspectListItem
                  key={p.id}
                  prospect={p}
                  selected={p.id === selectedId}
                  onClick={() => setSelectedId(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* DÉTAIL DROITE */}
        <div className="flex-1 overflow-y-auto bg-neutral-50">
          {selectedProspect ? (
            <ProspectDetail
              prospect={selectedProspect}
              onUpdate={(updates) => handleUpdate(selectedProspect.id, updates)}
              onDelete={() => handleDelete(selectedProspect.id)}
              onConvert={() => setConvertModalOpen(true)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-neutral-400">
              Sélectionnez un prospect
            </div>
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-8 py-2 border-t border-neutral-200 bg-neutral-50 text-[10px] text-neutral-400 flex items-center gap-3 shrink-0">
        <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 font-mono">j / k</kbd> Navigation</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 font-mono">Esc</kbd> Désélectionner</span>
        <span className="ml-auto">{prospects.length} prospect{prospects.length > 1 ? "s" : ""}</span>
      </div>

      {/* ⭐ MODAL DE CONVERSION PROSPECT → CLIENT */}
      {convertModalOpen && selectedProspect && (
        <ConvertProspectModal
          prospect={selectedProspect}
          onClose={() => setConvertModalOpen(false)}
          onSuccess={() => {
            // Refresh la liste pour afficher le nouveau statut "client"
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
//  COMPONENTS
// ============================================================

function StatPill({
  icon, label, value, color, highlight,
}: { icon: React.ReactNode; label: string; value: number | string; color: string; highlight?: boolean }) {
  const colorMap: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${colorMap[color]} ${highlight ? "ring-2 ring-orange-200" : ""}`}>
      {icon}
      <span className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-sm font-black">{value}</span>
    </div>
  );
}

function FilterButton({
  label, active, onClick, count, highlight,
}: { label: string; active: boolean; onClick: () => void; count?: number; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
        active
          ? "bg-orange-500 text-white"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
      } ${highlight && !active && (count || 0) > 0 ? "ring-2 ring-orange-200" : ""}`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`px-1.5 py-0.5 rounded text-[9px] ${active ? "bg-white/20" : "bg-white/80 text-neutral-700"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ProspectListItem({
  prospect, selected, onClick,
}: { prospect: Prospect; selected: boolean; onClick: () => void }) {
  const config = STATUS_CONFIG[prospect.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition relative ${
        selected ? "bg-orange-50 hover:bg-orange-50" : ""
      } ${!prospect.read ? "font-semibold" : ""}`}
    >
      {selected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
      )}
      <div className="flex items-start gap-2 mb-1">
        {!prospect.read && (
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-neutral-900 truncate">{prospect.name}</div>
          {prospect.company && (
            <div className="text-[11px] text-neutral-500 truncate">{prospect.company}</div>
          )}
        </div>
        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${config.color}`}>
          {config.label}
        </span>
      </div>
      <div className="text-[11px] text-neutral-500 line-clamp-2 mb-1">{prospect.message}</div>
      <div className="text-[10px] text-neutral-400">
        {new Date(prospect.created_at).toLocaleDateString("fr-CH", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        })}
      </div>
    </button>
  );
}

function ProspectDetail({
  prospect, onUpdate, onDelete, onConvert,
}: {
  prospect: Prospect;
  onUpdate: (u: Partial<Prospect>) => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  const [notes, setNotes] = useState(prospect.internal_notes || "");
  const [notesSaved, setNotesSaved] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNotes(prospect.internal_notes || "");
    setNotesSaved(true);
  }, [prospect.id, prospect.internal_notes]);

  // Auto-save notes après 1s sans frappe
  useEffect(() => {
    if (notes === (prospect.internal_notes || "")) {
      setNotesSaved(true);
      return;
    }
    setNotesSaved(false);
    const timer = setTimeout(() => {
      onUpdate({ internal_notes: notes });
      setNotesSaved(true);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const copyContactInfo = () => {
    const text = `${prospect.name}\n${prospect.email}${prospect.phone ? `\n${prospect.phone}` : ""}${prospect.company ? `\n${prospect.company}` : ""}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const config = STATUS_CONFIG[prospect.status];
  const StatusIcon = config.icon;
  const isAlreadyClient = prospect.status === "client";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* ⭐ BANNIÈRE CONVERSION (en haut, ultra visible) */}
      {!isAlreadyClient ? (
        <div
          className="mb-4 rounded-2xl p-5 flex items-center justify-between gap-4 border-2"
          style={{
            background: "linear-gradient(135deg, #F5F1EA 0%, #EBE5D8 100%)",
            borderColor: "#D4AF7A",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #7A1320 0%, #B11E2F 100%)",
                color: "white",
                boxShadow: "0 8px 20px -8px rgba(177, 30, 47, 0.5)",
              }}
            >
              <UserPlus size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black tracking-tight" style={{ color: "#181614" }}>
                Prêt à le convertir en client ?
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#807972" }}>
                Création automatique du tenant + administrateur avec credentials prêts à transmettre.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onConvert}
            className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-[0.15em] transition-all hover:-translate-y-0.5 flex items-center gap-2 shrink-0"
            style={{
              backgroundColor: "#B11E2F",
              color: "white",
              boxShadow: "0 10px 25px -10px rgba(177, 30, 47, 0.6)",
            }}
          >
            <UserPlus size={13} />
            Ajouter au client
          </button>
        </div>
      ) : (
        <div
          className="mb-4 rounded-2xl p-4 flex items-center gap-3 border"
          style={{
            backgroundColor: "#F5F1EA",
            borderColor: "#D4AF7A",
            color: "#7A1320",
          }}
        >
          <CheckCircle2 size={18} style={{ color: "#B11E2F" }} />
          <div>
            <div className="text-sm font-black uppercase tracking-wider">
              Converti en client
            </div>
            <div className="text-xs mt-0.5" style={{ color: "#807972" }}>
              Ce prospect a été ajouté à ta liste de clients actifs.
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight mb-1">{prospect.name}</h2>
            {prospect.company && (
              <div className="text-sm text-neutral-500 flex items-center gap-1.5">
                <Building2 size={13} />
                {prospect.company}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Contact actions */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <a
            href={`mailto:${prospect.email}`}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 transition"
          >
            <Mail size={13} className="text-orange-600 shrink-0" />
            <span className="text-xs font-bold text-orange-700 truncate">{prospect.email}</span>
          </a>
          {prospect.phone && (
            <a
              href={`tel:${prospect.phone}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
            >
              <Phone size={13} className="text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-blue-700 truncate">{prospect.phone}</span>
            </a>
          )}
          <button
            type="button"
            onClick={copyContactInfo}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition border ${
              copied
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-neutral-50 border-neutral-200 hover:bg-neutral-100 text-neutral-700"
            }`}
          >
            {copied ? (
              <>
                <CheckCircle2 size={13} />
                <span className="text-xs font-bold">Copié !</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span className="text-xs font-bold">Copier infos</span>
              </>
            )}
          </button>
        </div>

        <div className="text-[10px] text-neutral-400 flex items-center gap-1.5">
          <Calendar size={10} />
          Reçu le {new Date(prospect.created_at).toLocaleString("fr-CH")}
        </div>
      </div>

      {/* MESSAGE */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-3">
          Message
        </h3>
        <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
          {prospect.message}
        </p>
      </div>

      {/* STATUS WORKFLOW */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500">
            Statut
          </h3>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${config.color}`}>
            <StatusIcon size={11} />
            {config.label}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {STATUS_KEYS.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            const isActive = prospect.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onUpdate({ status })}
                className={`px-2 py-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 border ${
                  isActive
                    ? cfg.color
                    : "bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100"
                }`}
              >
                <Icon size={13} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* NOTES INTERNES */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500">
            Notes internes
          </h3>
          <span className={`text-[10px] font-bold transition ${
            notesSaved ? "text-green-600" : "text-orange-600"
          }`}>
            {notesSaved ? "✓ Enregistré" : "Enregistrement..."}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes pour toi-même : suite à donner, démo planifiée le X, points discutés..."
          rows={4}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:border-orange-500 focus:outline-none transition resize-y"
        />
      </div>
    </div>
  );
}

function EmptyState({ search, status }: { search: string; status: StatusFilter }) {
  return (
    <div className="p-8 text-center">
      <Inbox size={32} className="mx-auto mb-3 text-neutral-300" />
      <p className="text-sm font-bold text-neutral-700 mb-1">
        {search || status !== "all" ? "Aucun résultat" : "Aucun prospect"}
      </p>
      <p className="text-xs text-neutral-500">
        {search || status !== "all"
          ? "Essaie d'ajuster les filtres"
          : "Les nouveaux prospects depuis la landing apparaîtront ici"}
      </p>
    </div>
  );
}