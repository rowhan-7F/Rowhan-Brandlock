"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Loader2, Bug, Search, Calendar, CheckCircle2, XCircle, Clock,
  AlertTriangle, AlertCircle, AlertOctagon, Info, Trash2, Save,
  Crown, ExternalLink, Monitor, User as UserIcon, Building2,
  Image as ImageIcon, Zap, TrendingUp, Eye, ShieldCheck, Flame,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  PAGE BUGS — LUXURY EDITION (Split-pane Linear style)
//  Liste à gauche, détail à droite, keyboard shortcuts j/k
// ============================================================

type Bug = {
  id: string;
  message: string;
  status: "new" | "investigating" | "resolved" | "ignored";
  priority: "critical" | "high" | "medium" | "low";
  page_origin: string | null;
  screenshot_url: string | null;
  browser_info: any;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  client_email: string | null;
  brand_name: string | null;
  tenant_id: string | null;
  user_id: string | null;
  read: boolean;
  created_at: string;
  updated_at: string | null;
};

type Stats = {
  total: number;
  new: number;
  investigating: number;
  resolved: number;
  ignored: number;
  critical: number;
  high: number;
  this_week: number;
  resolved_this_week: number;
};

type BugStatus = "new" | "investigating" | "resolved" | "ignored";
type BugPriority = "critical" | "high" | "medium" | "low";
type StatusFilter = "all" | BugStatus;
type PriorityFilter = "all" | BugPriority;

const STATUS_CONFIG: Record<BugStatus, { label: string; color: string; icon: any }> = {
  new: { label: "Nouveau", color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  investigating: { label: "Investigation", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Eye },
  resolved: { label: "Résolu", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  ignored: { label: "Ignoré", color: "bg-neutral-50 text-neutral-600 border-neutral-200", icon: XCircle },
};

const PRIORITY_CONFIG: Record<BugPriority, { label: string; color: string; icon: any; dot: string }> = {
  critical: { label: "Critique", color: "bg-red-100 text-red-800 border-red-300", icon: Flame, dot: "bg-red-500" },
  high: { label: "Haute", color: "bg-orange-100 text-orange-800 border-orange-300", icon: AlertOctagon, dot: "bg-orange-500" },
  medium: { label: "Moyenne", color: "bg-blue-50 text-blue-700 border-blue-200", icon: AlertTriangle, dot: "bg-blue-500" },
  low: { label: "Basse", color: "bg-neutral-50 text-neutral-600 border-neutral-200", icon: Info, dot: "bg-neutral-400" },
};

const STATUS_KEYS = Object.keys(STATUS_CONFIG) as BugStatus[];
const PRIORITY_KEYS = Object.keys(PRIORITY_CONFIG) as BugPriority[];

export default function SuperAdminBugsPage() {
  const [loading, setLoading] = useState(true);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      if (filterPriority !== "all") params.set("priority", filterPriority);
      if (search) params.set("search", search);

      const res = await fetch(`/api/super-admin/bugs?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setBugs(data.bugs || []);
        setStats(data.stats || null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-select first
  useEffect(() => {
    if (!selectedId && bugs.length > 0) {
      setSelectedId(bugs[0].id);
    }
    if (selectedId && !bugs.find((b) => b.id === selectedId)) {
      setSelectedId(bugs[0]?.id || null);
    }
  }, [bugs, selectedId]);

  // Mark as read on selection
  useEffect(() => {
    if (!selectedId) return;
    const b = bugs.find((b) => b.id === selectedId);
    if (b && !b.read) {
      handleUpdate(selectedId, { read: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const idx = bugs.findIndex((b) => b.id === selectedId);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = bugs[Math.min(bugs.length - 1, idx + 1)];
        if (next) setSelectedId(next.id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = bugs[Math.max(0, idx - 1)];
        if (prev) setSelectedId(prev.id);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bugs, selectedId]);

  // ============================================================
  //  Update / Delete
  // ============================================================
  const handleUpdate = async (id: string, updates: Partial<Bug>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/super-admin/bugs/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) {
        setBugs((prev) => prev.map((b) => (b.id === id ? data.bug : b)));
        fetchData();
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer ce bug définitivement ?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/super-admin/bugs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        setBugs((prev) => prev.filter((b) => b.id !== id));
        setSelectedId(null);
        fetchData();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const selectedBug = useMemo(
    () => bugs.find((b) => b.id === selectedId) || null,
    [bugs, selectedId]
  );

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
            <h1 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              Bugs
              {stats && stats.critical > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-100 text-red-800 text-[10px] font-black uppercase tracking-wider border border-red-300 animate-pulse">
                  <Flame size={11} />
                  {stats.critical} critique{stats.critical > 1 ? "s" : ""}
                </span>
              )}
            </h1>
          </div>

          {stats && (
            <div className="flex items-center gap-3">
              <StatPill icon={<Bug size={11} />} label="Total" value={stats.total} color="neutral" />
              <StatPill icon={<AlertCircle size={11} />} label="Nouveaux" value={stats.new} color="red" highlight={stats.new > 0} />
              <StatPill icon={<Eye size={11} />} label="En cours" value={stats.investigating} color="amber" />
              <StatPill icon={<CheckCircle2 size={11} />} label="Résolus" value={stats.resolved} color="green" />
              <StatPill icon={<Zap size={11} />} label="7j résolus" value={stats.resolved_this_week} color="purple" />
            </div>
          )}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Rechercher dans message, email, page..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:border-orange-500 focus:outline-none transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mr-1">Statut :</span>
          <FilterButton label="Tous" active={filterStatus === "all"} onClick={() => setFilterStatus("all")} count={stats?.total} />
          <FilterButton label="Nouveaux" active={filterStatus === "new"} onClick={() => setFilterStatus("new")} count={stats?.new} highlight />
          <FilterButton label="En cours" active={filterStatus === "investigating"} onClick={() => setFilterStatus("investigating")} count={stats?.investigating} />
          <FilterButton label="Résolus" active={filterStatus === "resolved"} onClick={() => setFilterStatus("resolved")} count={stats?.resolved} />
          <FilterButton label="Ignorés" active={filterStatus === "ignored"} onClick={() => setFilterStatus("ignored")} count={stats?.ignored} />

          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-3 mr-1">Priorité :</span>
          <FilterButton label="Toutes" active={filterPriority === "all"} onClick={() => setFilterPriority("all")} />
          <FilterButton label="Critique" active={filterPriority === "critical"} onClick={() => setFilterPriority("critical")} count={stats?.critical} highlight />
          <FilterButton label="Haute" active={filterPriority === "high"} onClick={() => setFilterPriority("high")} count={stats?.high} />
          <FilterButton label="Moyenne" active={filterPriority === "medium"} onClick={() => setFilterPriority("medium")} />
          <FilterButton label="Basse" active={filterPriority === "low"} onClick={() => setFilterPriority("low")} />
        </div>
      </div>

      {/* SPLIT-PANE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LISTE */}
        <div className="w-96 border-r border-neutral-200 bg-white overflow-y-auto shrink-0">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {bugs.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <div className="divide-y divide-neutral-100">
              {bugs.map((b) => (
                <BugListItem
                  key={b.id}
                  bug={b}
                  selected={b.id === selectedId}
                  onClick={() => setSelectedId(b.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* DÉTAIL */}
        <div className="flex-1 overflow-y-auto bg-neutral-50">
          {selectedBug ? (
            <BugDetail
              bug={selectedBug}
              onUpdate={(u) => handleUpdate(selectedBug.id, u)}
              onDelete={() => handleDelete(selectedBug.id)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-neutral-400">
              Sélectionnez un bug
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-2 border-t border-neutral-200 bg-neutral-50 text-[10px] text-neutral-400 flex items-center gap-3 shrink-0">
        <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 font-mono">j / k</kbd> Navigation</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 font-mono">Esc</kbd> Désélectionner</span>
        <span className="ml-auto">{bugs.length} bug{bugs.length > 1 ? "s" : ""}</span>
      </div>
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
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${colorMap[color]} ${highlight ? "ring-2 ring-red-200 animate-pulse" : ""}`}>
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
      } ${highlight && !active && (count || 0) > 0 ? "ring-2 ring-red-200" : ""}`}
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

function BugListItem({
  bug, selected, onClick,
}: { bug: Bug; selected: boolean; onClick: () => void }) {
  const statusCfg = STATUS_CONFIG[bug.status];
  const priorityCfg = PRIORITY_CONFIG[bug.priority];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition relative ${
        selected ? "bg-orange-50 hover:bg-orange-50" : ""
      } ${!bug.read ? "font-semibold" : ""}`}
    >
      {selected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
      )}
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-2 h-2 rounded-full ${priorityCfg.dot} shrink-0`} title={`Priorité : ${priorityCfg.label}`} />
        {!bug.read && (
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
        )}
        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
        {bug.screenshot_url && (
          <ImageIcon size={11} className="text-neutral-400 shrink-0" />
        )}
      </div>
      <div className="text-sm text-neutral-800 line-clamp-2 mb-1">{bug.message}</div>
      <div className="flex items-center gap-2 text-[10px] text-neutral-400">
        {bug.client_email && (
          <span className="truncate max-w-[180px]">{bug.client_email}</span>
        )}
        <span>•</span>
        <span>
          {new Date(bug.created_at).toLocaleDateString("fr-CH", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
          })}
        </span>
      </div>
    </button>
  );
}

function BugDetail({
  bug, onUpdate, onDelete,
}: { bug: Bug; onUpdate: (u: Partial<Bug>) => void; onDelete: () => void }) {
  const [notes, setNotes] = useState(bug.resolution_notes || "");
  const [notesSaved, setNotesSaved] = useState(true);

  useEffect(() => {
    setNotes(bug.resolution_notes || "");
    setNotesSaved(true);
  }, [bug.id, bug.resolution_notes]);

  useEffect(() => {
    if (notes === (bug.resolution_notes || "")) {
      setNotesSaved(true);
      return;
    }
    setNotesSaved(false);
    const timer = setTimeout(() => {
      onUpdate({ resolution_notes: notes });
      setNotesSaved(true);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const statusCfg = STATUS_CONFIG[bug.status];
  const priorityCfg = PRIORITY_CONFIG[bug.priority];
  const StatusIcon = statusCfg.icon;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${priorityCfg.color}`}>
              <priorityCfg.icon size={11} />
              Priorité {priorityCfg.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${statusCfg.color}`}>
              <StatusIcon size={11} />
              {statusCfg.label}
            </span>
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

        <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap mb-4">
          {bug.message}
        </p>

        {/* META */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {bug.client_email && (
            <MetaItem icon={<UserIcon size={12} />} label="Utilisateur" value={bug.client_email} />
          )}
          {bug.tenant_id && (
            <MetaItem icon={<Building2 size={12} />} label="Tenant" value={bug.tenant_id} />
          )}
          {bug.page_origin && (
            <MetaItem
              icon={<ExternalLink size={12} />}
              label="Page"
              value={
                <a
                  href={bug.page_origin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:underline truncate"
                >
                  {bug.page_origin}
                </a>
              }
            />
          )}
          <MetaItem
            icon={<Calendar size={12} />}
            label="Reçu"
            value={new Date(bug.created_at).toLocaleString("fr-CH")}
          />
        </div>

        {bug.browser_info && (
          <details className="mt-3 group">
            <summary className="text-[10px] font-black uppercase tracking-widest text-neutral-500 cursor-pointer hover:text-neutral-700 flex items-center gap-1.5">
              <Monitor size={11} />
              Infos navigateur
            </summary>
            <div className="mt-2 p-3 bg-neutral-50 rounded-lg text-[11px] font-mono text-neutral-700 leading-relaxed">
              {Object.entries(bug.browser_info).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-neutral-500">{k}:</span>
                  <span className="text-neutral-800">{String(v)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* SCREENSHOT */}
      {bug.screenshot_url && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-1.5">
            <ImageIcon size={11} />
            Capture d'écran
          </h3>
          <a
            href={bug.screenshot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg overflow-hidden border border-neutral-200 hover:border-orange-300 transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bug.screenshot_url}
              alt="Capture d'écran du bug"
              className="w-full h-auto block"
            />
          </a>
          <p className="text-[10px] text-neutral-400 mt-2">Cliquer pour ouvrir en grand</p>
        </div>
      )}

      {/* PRIORITY */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-3">
          Priorité
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITY_KEYS.map((priority) => {
            const cfg = PRIORITY_CONFIG[priority];
            const Icon = cfg.icon;
            const isActive = bug.priority === priority;
            return (
              <button
                key={priority}
                type="button"
                onClick={() => onUpdate({ priority })}
                className={`px-3 py-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1.5 border ${
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

      {/* STATUS WORKFLOW */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-3">
          Statut
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {STATUS_KEYS.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            const isActive = bug.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onUpdate({ status })}
                className={`px-3 py-2 rounded-lg text-[10px] font-bold transition flex flex-col items-center gap-1 border ${
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
        {bug.resolved_at && (
          <div className="mt-3 text-[11px] text-green-700 flex items-center gap-1.5">
            <ShieldCheck size={12} />
            Résolu le {new Date(bug.resolved_at).toLocaleString("fr-CH")}
          </div>
        )}
      </div>

      {/* NOTES */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500">
            Notes de résolution
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
          placeholder="Comment ce bug a été résolu, fix appliqué, contournement, etc."
          rows={4}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:border-orange-500 focus:outline-none transition resize-y"
        />
      </div>
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-neutral-400 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{label}</div>
        <div className="text-xs text-neutral-700 truncate">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="p-8 text-center">
      <Bug size={32} className="mx-auto mb-3 text-neutral-300" />
      <p className="text-sm font-bold text-neutral-700 mb-1">
        {search ? "Aucun résultat" : "Aucun bug 🎉"}
      </p>
      <p className="text-xs text-neutral-500">
        {search ? "Essaie d'ajuster les filtres" : "Les bugs signalés apparaîtront ici"}
      </p>
    </div>
  );
}
