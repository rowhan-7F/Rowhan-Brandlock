// ============================================================
//  Modal de création d'un nouveau projet vidéo.
//  Phase 8 : 4 thèmes audio orientés client + 2 formats.
//  Le studio choisit son thème, le worker s'adapte automatiquement.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import {
  ActiveVideoMode,
  VideoFormat,
  VIDEO_MODE_INFO,
} from "@/lib/video/types";
import FormatSelector from "./FormatSelector";

type Task = {
  id: string;
  title: string;
  status: string;
};

type NewVideoProjectModalProps = {
  open: boolean;
  onClose: () => void;
  brandColor?: string;
};

const DEFAULT_MODE: ActiveVideoMode = "studio_clean";

export default function NewVideoProjectModal({
  open,
  onClose,
  brandColor = "#B11E2F",
}: NewVideoProjectModalProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<ActiveVideoMode>(DEFAULT_MODE);
  const [format, setFormat] = useState<VideoFormat>("9_16");
  const [taskId, setTaskId] = useState<string>("");

  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoadingTasks(true);
      const { data, error } = await supabase
        .from("studio_tasks")
        .select("id, title, status")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (error) console.error("[NewVideoProjectModal] briefs error:", error);
        else setOpenTasks(data || []);
        setLoadingTasks(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setMode(DEFAULT_MODE);
      setFormat("9_16");
      setTaskId("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Titre obligatoire", { description: "Donne un nom a ton projet." });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Session expiree, reconnecte-toi");
      }

      const res = await fetch("/api/studio/video/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({
          title: title.trim(),
          mode,
          format,
          task_id: taskId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur creation");
      }

      toast.success("Projet video cree", {
        description: "Tu peux maintenant uploader ta source.",
      });

      router.push("/studio/video/" + data.project.id);
    } catch (err: any) {
      toast.error("Creation impossible", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const modes = Object.keys(VIDEO_MODE_INFO) as ActiveVideoMode[];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Nouveau</div>
            <h3 className="text-base font-bold text-neutral-900">Projet video</h3>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Titre du projet *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Interview Conseil d'Etat Q1"
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:border-[#B11E2F] focus:outline-none focus:ring-2 focus:ring-[#B11E2F]/20"
              maxLength={200}
              autoFocus
              disabled={submitting}
            />
            <div className="text-[9px] text-neutral-400 text-right mt-1">{title.length}/200</div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Type de tournage *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {modes.map((m) => {
                const info = VIDEO_MODE_INFO[m];
                const selected = mode === m;
                const Icon = info.icon;

                const btnClass = "relative p-3 rounded-xl border-2 transition-all text-left " +
                  (selected
                    ? "border-[#B11E2F] bg-[#B11E2F]/5 ring-2 ring-[#B11E2F]/20"
                    : "border-neutral-200 hover:border-neutral-300 bg-white") +
                  " " +
                  (submitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer");

                const iconClass = "mb-2 " + (selected ? "text-[#B11E2F]" : "text-neutral-700");

                const labelClass = "text-xs font-black uppercase tracking-wider " +
                  (selected ? "text-[#B11E2F]" : "text-neutral-900");

                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    disabled={submitting}
                    title={info.longHint}
                    className={btnClass}
                  >
                    <div className={iconClass}>
                      <Icon size={24} strokeWidth={2.2} />
                    </div>
                    <div className={labelClass}>{info.label}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5 leading-tight">
                      {info.description}
                    </div>
                    {selected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#B11E2F] flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Format *</label>
            <FormatSelector value={format} onChange={setFormat} disabled={submitting} />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Brief lie (optionnel)</label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              disabled={submitting || loadingTasks}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:border-[#B11E2F] focus:outline-none focus:ring-2 focus:ring-[#B11E2F]/20 bg-white"
            >
              <option value="">-- Aucun brief lie --</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            {loadingTasks && (
              <div className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                Chargement des briefs...
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-white rounded-lg transition disabled:opacity-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Creation...
              </>
            ) : (
              <>
                <Send size={12} />
                Creer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}