"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Film,
  Loader2,
  Check,
  Download,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Subtitles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { useJobStatus } from "@/lib/video/transcriptStatus";
import { VideoProject } from "@/lib/video/types";

type Props = {
  project: VideoProject;
  onProjectUpdated: () => void;
};

const BRAND_BORDEAUX = "#B11E2F";

export default function RenderPanel({ project, onProjectUpdated }: Props) {
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [subtitleOffset, setSubtitleOffset] = useState<number>(
      typeof (project.state_json as any)?.subtitle_offset_seconds === "number"
        ? (project.state_json as any).subtitle_offset_seconds
        : 0
    );

  const { job } = useJobStatus({
    jobId: activeJobId,
    onComplete: () => {
      toast.success("Video generee", {
        description: "Tu peux la telecharger ci-dessous",
      });
      setActiveJobId(null);
      onProjectUpdated();
    },
    onError: (failedJob) => {
      toast.error("Echec du rendu", {
        description: failedJob.error_message || "Erreur inconnue",
      });
      setActiveJobId(null);
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (project.status !== "completed" || !project.final_video_url) {
        setDownloadUrl(null);
        return;
      }
      const path = `${project.tenant_id}/${project.id}/final.mp4`;
      const { data } = await supabase.storage
        .from("video-exports")
        .createSignedUrl(path, 3600);
      if (!cancelled && data?.signedUrl) {
        setDownloadUrl(data.signedUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.status, project.final_video_url, project.tenant_id, project.id]);

  const handleStartRender = useCallback(async () => {
    setIsStarting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expiree, reconnecte-toi");
        return;
      }

      const res = await fetch(
        `/api/studio/video/projects/${project.id}/render`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subtitle_offset_seconds: subtitleOffset,
          }),
        }
      );

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Reponse serveur invalide (status ${res.status}). Next a-t-il ete redemarre ?`
        );
      }

      if (!res.ok) throw new Error(data.error || "Erreur creation job");

      setActiveJobId(data.job.id);
      toast.success("Rendu lance", {
        description: "Burn des sous-titres + encodage video final",
      });
    } catch (err: any) {
      toast.error("Impossible de lancer le rendu", { description: err.message });
    } finally {
      setIsStarting(false);
    }
  }, [project.id]);

  // ETAT 2 - Rendu en cours
  if (job && (job.status === "queued" || job.status === "processing")) {
    return (
      <div className="bg-white rounded-2xl border-2 border-[#B11E2F]/20 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#B11E2F]/10 flex items-center justify-center">
            <Loader2 size={20} className="text-[#B11E2F] animate-spin" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#B11E2F]">
              Rendu video
            </div>
            <h3 className="text-base font-bold text-neutral-900">
              {job.progress_message || "Traitement en cours..."}
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{ width: `${job.progress_percent || 0}%`, backgroundColor: BRAND_BORDEAUX }}
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
          FFmpeg + libass - Sous-titres burned dans la video - Tentative {job.attempts}/{job.max_attempts}
        </div>
      </div>
    );
  }

  // ETAT 3 - Video rendue
  if (project.status === "completed" && project.final_video_url) {
    return (
      <div className="bg-white rounded-2xl border-2 border-green-200 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Check size={20} className="text-green-600" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-green-700">
                Rendu termine
              </div>
              <h3 className="text-base font-bold text-neutral-900">
                Video avec sous-titres prete
              </h3>
            </div>
          </div>
        </div>

        {downloadUrl ? (
          <video
            src={downloadUrl}
            controls
            className="w-full max-h-[60vh] rounded-xl bg-neutral-900 mb-4"
          />
        ) : (
          <div className="w-full aspect-video bg-neutral-100 rounded-xl flex items-center justify-center mb-4">
            <Loader2 size={20} className="text-neutral-400 animate-spin" />
          </div>
        )}

        {/* ⭐ Plan B : Slider de calibration */}
        <div className="mb-5 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
              Décalage des sous-titres
            </label>
            <span className="text-sm font-bold tabular-nums text-[#B11E2F]">
              {subtitleOffset > 0 ? "+" : ""}{subtitleOffset.toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min="-3"
            max="3"
            step="0.1"
            value={subtitleOffset}
            onChange={(e) => setSubtitleOffset(Number(e.target.value))}
            className="w-full accent-[#B11E2F]"
          />
          <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
            <span>-3.0s</span>
            <span>0</span>
            <span>+3.0s</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">
            💡 Si les subs sont en avance, mets une valeur positive (+0.5s).
            Si en retard, négative (-0.5s). Re-génère pour appliquer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download={`${project.title || "video"}.mp4`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition shadow-sm hover:shadow-md"
              style={{ backgroundColor: BRAND_BORDEAUX }}
            >
              <Download size={14} />
              Telecharger la video
            </a>
          ) : null}

          <button
            type="button"
            onClick={handleStartRender}
            disabled={isStarting}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-neutral-200 text-neutral-700 text-xs font-bold uppercase tracking-wider rounded-lg hover:border-neutral-400 transition disabled:opacity-40"
          >
            {isStarting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Re-generer
          </button>
        </div>

        {project.rendered_at ? (
          <div className="mt-3 text-[11px] text-neutral-400">
            Genere le : {new Date(project.rendered_at).toLocaleString("fr-CH")}
          </div>
        ) : null}
      </div>
    );
  }

  // ETAT 1 - Pas encore rendu
  const canRender = project.status === "transcribed";

  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 p-6 sm:p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-[#B11E2F]/10 flex items-center justify-center mx-auto mb-3">
        <Film size={22} className="text-[#B11E2F]" />
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-[#B11E2F] mb-1">
        Rendu video
      </div>
      <h3 className="text-base font-bold text-neutral-900 mb-1">
        Genere la video avec sous-titres
      </h3>
      <p className="text-xs text-neutral-500 max-w-md mx-auto mb-5">
        Les sous-titres seront burned directement dans la video
        (style luxury Helvetica Bold blanc, ombre noire, position bas-centre).
      </p>

      {/* ⭐ Plan B : Slider de calibration (visible avant 1er render aussi) */}
      {canRender && (
        <div className="max-w-sm mx-auto mb-5 p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-left">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
              Décalage subs (optionnel)
            </label>
            <span className="text-sm font-bold tabular-nums text-[#B11E2F]">
              {subtitleOffset > 0 ? "+" : ""}{subtitleOffset.toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min="-3"
            max="3"
            step="0.1"
            value={subtitleOffset}
            onChange={(e) => setSubtitleOffset(Number(e.target.value))}
            className="w-full accent-[#B11E2F]"
          />
          <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
            <span>-3s</span>
            <span>0</span>
            <span>+3s</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleStartRender}
        disabled={isStarting || !canRender}
        className="inline-flex items-center gap-2 px-6 py-3 text-white text-sm font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
        style={{ backgroundColor: BRAND_BORDEAUX }}
      >
        {isStarting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Subtitles size={16} />
        )}
        {isStarting ? "Lancement..." : "Generer video finale"}
      </button>

      {!canRender ? (
        <div className="mt-3 text-[11px] text-amber-600 flex items-center justify-center gap-1.5">
          <AlertCircle size={12} />
          La video doit etre transcrite d&apos;abord (status actuel : {project.status})
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-neutral-400 flex items-center justify-center gap-1.5">
          <Sparkles size={12} />
          Prendra environ 30-90 secondes selon la duree video
        </div>
      )}
    </div>
  );
}