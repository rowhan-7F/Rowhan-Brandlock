// ============================================================
//  TranscriptPanel - bouton Transcrire / statut / etat transcrit.
//  L'edition du texte + timing des sous-titres se fait dans le
//  panneau de droite (SubtitleEditor). Plus de textarea ici.
// ============================================================

"use client";

import { useCallback, useState } from "react";
import { Brain, Loader2, Check, AlertCircle, RefreshCw, Languages, Sparkles } from "lucide-react";
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

export default function TranscriptPanel({ project, onProjectUpdated }: Props) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isStartingTranscribe, setIsStartingTranscribe] = useState(false);

  const transcriptData = (project.state_json?.transcript as TranscriptData) || null;
  const segmentsCount = Array.isArray(transcriptData?.segments) ? transcriptData!.segments!.length : 0;
  const hasTranscript = segmentsCount > 0;
  const hasVoiceover = !!project.state_json?.voiceover_audio;

  const { job } = useJobStatus({
    jobId: activeJobId,
    onComplete: () => {
      toast.success("Transcription terminee");
      setActiveJobId(null);
      onProjectUpdated();
    },
    onError: (failedJob) => {
      toast.error("Echec de la transcription", { description: failedJob.error_message || "Erreur inconnue" });
      setActiveJobId(null);
    },
  });

  const handleStartTranscribe = useCallback(async () => {
    setIsStartingTranscribe(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Session expiree, reconnecte-toi"); return; }
      const res = await fetch(`/api/studio/video/projects/${project.id}/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur creation job");
      setActiveJobId(data.job.id);
      toast.success("Transcription lancee", { description: "Le worker traite ta video, ~15s" });
    } catch (err: any) {
      toast.error("Impossible de lancer la transcription", { description: err.message });
    } finally {
      setIsStartingTranscribe(false);
    }
  }, [project.id]);

  // ETAT 2 - en cours
  if (job && (job.status === "queued" || job.status === "processing")) {
    return (
      <div className="bg-white rounded-2xl border-2 border-[#B11E2F]/20 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#B11E2F]/10 flex items-center justify-center">
            <Loader2 size={20} className="text-[#B11E2F] animate-spin" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#B11E2F]">Transcription</div>
            <h3 className="text-base font-bold text-neutral-900">{job.progress_message || "Traitement en cours..."}</h3>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${job.progress_percent || 0}%`, backgroundColor: BRAND_BORDEAUX }} />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500">
            <span>{job.progress_percent || 0}%</span>
            {job.estimated_seconds_remaining ? <span>~{Math.ceil(job.estimated_seconds_remaining)}s restantes</span> : null}
          </div>
        </div>
        <div className="mt-4 text-[11px] text-neutral-400">Whisper.cpp local (large-v3, souverain) - Tentative {job.attempts}/{job.max_attempts}</div>
      </div>
    );
  }

  // ETAT 3 - transcrit (edition a droite)
  if (hasTranscript) {
    return (
      <div className="bg-white rounded-2xl border-2 border-neutral-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Check size={20} className="text-green-600" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-green-700">Transcription</div>
            <h3 className="text-base font-bold text-neutral-900">Sous-titres generes</h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] text-neutral-500">
          <span className="font-bold text-neutral-700">{segmentsCount} segments</span>
          {transcriptData?.language && (<><span>-</span><span className="flex items-center gap-1.5"><Languages size={12} />{transcriptData.language.toUpperCase()}</span></>)}
          {typeof transcriptData?.applied_replacements_count === "number" && transcriptData.applied_replacements_count > 0 && (
            <><span>-</span><span className="flex items-center gap-1.5 text-amber-600 font-bold"><Sparkles size={12} />{transcriptData.applied_replacements_count} correction{transcriptData.applied_replacements_count > 1 ? "s" : ""} auto</span></>
          )}
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[11px] text-blue-800 mb-4 leading-snug">
          Edite le texte et le timing des sous-titres dans le panneau de droite : les changements se refletent dans l&apos;apercu et le rendu final.
        </div>

        <button type="button" onClick={handleStartTranscribe} disabled={isStartingTranscribe}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-neutral-200 text-neutral-700 text-xs font-bold uppercase tracking-wider rounded-lg hover:border-neutral-400 transition disabled:opacity-40">
          {isStartingTranscribe ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Retranscrire
        </button>
        <p className="text-[10px] text-neutral-400 mt-2">Retranscrire remplace les sous-titres actuels par une nouvelle transcription Whisper.</p>
      </div>
    );
  }

  // ETAT 1 - pas encore transcrit
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-[#B11E2F]/10 flex items-center justify-center mx-auto mb-3">
        <Brain size={22} className="text-[#B11E2F]" />
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-[#B11E2F] mb-1">Transcription</div>
      <h3 className="text-base font-bold text-neutral-900 mb-1">Genere les sous-titres avec Whisper</h3>
      <p className="text-xs text-neutral-500 max-w-md mx-auto mb-2">
        La transcription IA souveraine genere un texte precis depuis {hasVoiceover ? "la voix-off" : "l'audio de la video"}. Le lexique de ta marque est applique automatiquement.
      </p>
      {hasVoiceover && (
        <div className="text-[10px] font-bold text-blue-700 mb-4">Source detectee : voix-off (prioritaire)</div>
      )}

      <button type="button" onClick={handleStartTranscribe} disabled={isStartingTranscribe || project.status !== "uploaded"}
        className="inline-flex items-center gap-2 px-6 py-3 text-white text-sm font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
        style={{ backgroundColor: BRAND_BORDEAUX }}>
        {isStartingTranscribe ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
        {isStartingTranscribe ? "Lancement..." : hasVoiceover ? "Transcrire la voix-off" : "Transcrire la video"}
      </button>

      {project.status !== "uploaded" && (
        <div className="mt-3 text-[11px] text-amber-600 flex items-center justify-center gap-1.5">
          <AlertCircle size={12} />
          La video doit d&apos;abord etre uploadee (status : {project.status})
        </div>
      )}
    </div>
  );
}