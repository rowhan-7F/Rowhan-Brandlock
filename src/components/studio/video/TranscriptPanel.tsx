// ============================================================
//  TranscriptPanel — Le panneau de transcription dans l'éditeur vidéo
//  Gère 3 états :
//  1. Pas de transcript → bouton "Transcrire"
//  2. En cours → progress bar + status
//  3. Transcribed → textarea éditable + auto-save + bouton manuel
// ============================================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Brain,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  Save,
  Languages,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { useJobStatus } from "@/lib/video/transcriptStatus";
import { VideoProject } from "@/lib/video/types";

type TranscriptData = {
  raw?: string;
  edited?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  language?: string;
  duration_seconds?: number;
  applied_replacements_count?: number;
  sanitized_at?: string;
  edited_at?: string;
};

type Props = {
  project: VideoProject;
  onProjectUpdated: () => void;
};

const BRAND_BORDEAUX = "#B11E2F";
const AUTOSAVE_DEBOUNCE_MS = 2000;

export default function TranscriptPanel({ project, onProjectUpdated }: Props) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isStartingTranscribe, setIsStartingTranscribe] = useState(false);

  // Edition transcript
  const transcriptData = (project.state_json?.transcript as TranscriptData) || null;
  const [editedText, setEditedText] = useState(transcriptData?.edited || "");
  const [originalText, setOriginalText] = useState(transcriptData?.edited || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Sync editedText quand project change (après retranscription)
  useEffect(() => {
    const newText = transcriptData?.edited || "";
    setEditedText(newText);
    setOriginalText(newText);
    setSaveStatus("idle");
  }, [transcriptData?.edited]);

  // Auto-save debounced
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (editedText === originalText) {
      setSaveStatus("idle");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void handleSave(true);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedText, originalText]);

  // Polling job actif
  const { job } = useJobStatus({
    jobId: activeJobId,
    onComplete: () => {
      toast.success("Transcription terminée ✨");
      setActiveJobId(null);
      onProjectUpdated();
    },
    onError: (failedJob) => {
      toast.error("Échec de la transcription", {
        description: failedJob.error_message || "Erreur inconnue",
      });
      setActiveJobId(null);
    },
  });

  // ============================================================
  //  Démarrer transcription
  // ============================================================
  const handleStartTranscribe = useCallback(async () => {
    setIsStartingTranscribe(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée, reconnecte-toi");
        return;
      }

      const res = await fetch(
        `/api/studio/video/projects/${project.id}/transcribe`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur création job");

      setActiveJobId(data.job.id);
      toast.success("Transcription lancée 🚀", {
        description: "Le worker traite ta vidéo, ça prend ~15s",
      });
    } catch (err: any) {
      toast.error("Impossible de lancer la transcription", { description: err.message });
    } finally {
      setIsStartingTranscribe(false);
    }
  }, [project.id]);

  // ============================================================
  //  Sauvegarder transcript édité
  // ============================================================
  const handleSave = useCallback(
    async (silent = false) => {
      if (editedText === originalText) return;
      setSaveStatus("saving");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Session expirée");

        const newTranscriptData: TranscriptData = {
          ...(transcriptData || {}),
          edited: editedText,
          edited_at: new Date().toISOString(),
        };

        const newStateJson = {
          ...(project.state_json || {}),
          transcript: newTranscriptData,
        };

        const res = await fetch(`/api/studio/video/projects/${project.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state_json: newStateJson }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        setOriginalText(editedText);
        setSaveStatus("saved");
        if (!silent) toast.success("Transcript sauvegardé ✓");

        // Reset le badge "saved" après 2s
        setTimeout(() => {
          setSaveStatus((s) => (s === "saved" ? "idle" : s));
        }, 2000);
      } catch (err: any) {
        setSaveStatus("error");
        toast.error("Erreur de sauvegarde", { description: err.message });
      }
    },
    [editedText, originalText, transcriptData, project.id, project.state_json]
  );

  // ============================================================
  //  ÉTAT 2 — Transcription en cours
  // ============================================================
  if (job && (job.status === "queued" || job.status === "processing")) {
    return (
      <div className="bg-white rounded-2xl border-2 border-[#B11E2F]/20 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#B11E2F]/10 flex items-center justify-center">
            <Loader2 size={20} className="text-[#B11E2F] animate-spin" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#B11E2F]">
              Transcription
            </div>
            <h3 className="text-base font-bold text-neutral-900">
              {job.progress_message || "Traitement en cours..."}
            </h3>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{
                width: `${job.progress_percent || 0}%`,
                backgroundColor: BRAND_BORDEAUX,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500">
            <span>{job.progress_percent || 0}%</span>
            {job.estimated_seconds_remaining ? (
              <span>~{Math.ceil(job.estimated_seconds_remaining)}s restantes</span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 text-[11px] text-neutral-400">
        Whisper.cpp local (large-v3, souverain 🇨🇭) · Tentative {job.attempts}/{job.max_attempts}
        </div>
      </div>
    );
  }

  // ============================================================
  //  ÉTAT 3 — Transcribed (textarea éditable)
  // ============================================================
  if (project.status === "transcribed" && transcriptData?.edited) {
    return (
      <div className="bg-white rounded-2xl border-2 border-neutral-200 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Check size={20} className="text-green-600" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-green-700">
                Transcription
              </div>
              <h3 className="text-base font-bold text-neutral-900">Texte transcrit</h3>
            </div>
          </div>

          {/* Save status badge */}
          {saveStatus === "saving" && (
            <span className="text-[11px] font-bold text-neutral-500 flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> Sauvegarde...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-[11px] font-bold text-green-600 flex items-center gap-1.5">
              <Check size={11} /> Sauvegardé
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-[11px] font-bold text-red-600 flex items-center gap-1.5">
              <AlertCircle size={11} /> Erreur de sauvegarde
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-3 mb-4 text-[11px] text-neutral-500">
          {transcriptData.language && (
            <span className="flex items-center gap-1.5">
              <Languages size={12} />
              {transcriptData.language.toUpperCase()}
            </span>
          )}
          <span>·</span>
          <span>{editedText.length} caractères</span>
          {typeof transcriptData.applied_replacements_count === "number" && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                <Sparkles size={12} />
                {transcriptData.applied_replacements_count} correction
                {transcriptData.applied_replacements_count > 1 ? "s" : ""} auto
              </span>
            </>
          )}
        </div>

        {/* Textarea éditable */}
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="w-full min-h-[200px] p-4 border-2 border-neutral-200 rounded-xl text-sm leading-relaxed text-neutral-900 focus:outline-none focus:border-[#B11E2F] resize-y font-mono"
          placeholder="Le transcript apparaîtra ici..."
        />

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saveStatus === "saving" || editedText === originalText}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saveStatus === "saving" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Sauvegarder
          </button>

          <button
            type="button"
            onClick={handleStartTranscribe}
            disabled={isStartingTranscribe}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-neutral-200 text-neutral-700 text-xs font-bold uppercase tracking-wider rounded-lg hover:border-neutral-400 transition disabled:opacity-40"
          >
            {isStartingTranscribe ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Retranscrire
          </button>

          {transcriptData.edited_at && (
            <span className="text-[11px] text-neutral-400 ml-auto">
              Modifié : {new Date(transcriptData.edited_at).toLocaleString("fr-CH")}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  //  ÉTAT 1 — Pas encore transcrit
  // ============================================================
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-6 sm:p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-[#B11E2F]/10 flex items-center justify-center mx-auto mb-3">
        <Brain size={22} className="text-[#B11E2F]" />
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-[#B11E2F] mb-1">
        Transcription
      </div>
      <h3 className="text-base font-bold text-neutral-900 mb-1">
        Transcris ta vidéo avec Whisper
      </h3>
      <p className="text-xs text-neutral-500 max-w-md mx-auto mb-5">
        L&apos;IA souveraine 🇨🇭 va générer un texte précis depuis l&apos;audio de ta vidéo.
        Le lexique de ta marque sera appliqué automatiquement.
      </p>

      <button
        type="button"
        onClick={handleStartTranscribe}
        disabled={isStartingTranscribe || project.status !== "uploaded"}
        className="inline-flex items-center gap-2 px-6 py-3 text-white text-sm font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
        style={{ backgroundColor: BRAND_BORDEAUX }}
      >
        {isStartingTranscribe ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Brain size={16} />
        )}
        {isStartingTranscribe ? "Lancement..." : "Transcrire la vidéo"}
      </button>

      {project.status !== "uploaded" && (
        <div className="mt-3 text-[11px] text-amber-600 flex items-center justify-center gap-1.5">
          <AlertCircle size={12} />
          La vidéo doit d&apos;abord être uploadée (status actuel : {project.status})
        </div>
      )}
    </div>
  );
}