"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Film, Loader2, Check, Download, RefreshCw, Sparkles, AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { useJobStatus } from "@/lib/video/transcriptStatus";
import { VideoProject } from "@/lib/video/types";

// ============================================================
//  Phase 12 - RenderBar
//  Composant compact rendu + telechargement
//  Place SOUS la timeline (vs ancien RenderPanel dans drawer)
//
//  Etats :
//    - idle      -> bouton "Lancer le rendu"
//    - processing -> progress bar + label
//    - completed  -> bouton "Telecharger MP4" + "Re-lancer"
// ============================================================

const BRAND_BORDEAUX = "#B11E2F";

type Props = {
  project: VideoProject;
  onProjectUpdated: () => void;
};

export default function RenderBar({ project, onProjectUpdated }: Props) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const { job } = useJobStatus({
    jobId: activeJobId,
    onComplete: () => {
      toast.success("Video generee", {
        description: "Telechargement disponible ci-dessous",
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
      const path = project.tenant_id + "/" + project.id + "/final.mp4";
      const { data } = await supabase.storage
        .from("video-exports")
        .createSignedUrl(path, 3600);
      if (!cancelled && data?.signedUrl) {
        setDownloadUrl(data.signedUrl);
      }
    })();
    return () => { cancelled = true; };
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
        "/api/studio/video/projects/" + project.id + "/render",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + session.access_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Reponse serveur invalide (status " + res.status + ")");
      }
      if (!res.ok) throw new Error(data.error || "Erreur creation job");
      setActiveJobId(data.job.id);
      toast.success("Rendu lance", {
        description: "Burn des sous-titres + encodage final",
      });
    } catch (err: any) {
      toast.error("Impossible de lancer le rendu", { description: err.message });
    } finally {
      setIsStarting(false);
    }
  }, [project.id]);

  // ============================================================
  //  ETAT : Rendering (queued ou processing)
  // ============================================================
  if (job && (job.status === "queued" || job.status === "processing")) {
    const percent = job.progress_percent || 0;
    const msg = job.progress_message || "Traitement...";
    return (
      <div className="bg-white rounded-2xl border-2 border-[#B11E2F]/20 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#B11E2F]/10 flex items-center justify-center shrink-0">
            <Loader2 size={16} className="text-[#B11E2F] animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#B11E2F]">Rendu en cours</div>
            <div className="text-sm font-bold text-neutral-900 truncate">{msg}</div>
          </div>
          <div className="text-2xl font-black text-[#B11E2F]">{percent}%</div>
        </div>
        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500 rounded-full"
            style={{ width: percent + "%", backgroundColor: BRAND_BORDEAUX }}
          />
        </div>
        {job.estimated_seconds_remaining ? (
          <div className="text-[10px] text-neutral-500 mt-2">
            ~{Math.ceil(job.estimated_seconds_remaining)}s restantes
          </div>
        ) : null}
      </div>
    );
  }

  // ============================================================
  //  ETAT : Completed (avec download disponible)
  // ============================================================
  if (project.status === "completed" && project.final_video_url) {
    return (
      <div className="bg-white rounded-2xl border-2 border-green-200 p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Check size={16} className="text-green-600" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-green-700">Rendu termine</div>
            <div className="text-sm font-bold text-neutral-900">Video luxury prete a etre telechargee</div>
          </div>
          {/* Phase 12 peaufinage #6+7 : Telecharger deplace dans header. Garde juste re-rendre */}
          <button
            type="button"
            onClick={handleStartRender}
            disabled={isStarting}
            className="inline-flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50 shrink-0"
            title="Re-lancer un rendu"
          >
            <RefreshCw size={12} />
            Re-rendre
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  //  ETAT : Idle (pret a rendre)
  // ============================================================
  // Verifier qu'on a une source et un transcript pour pouvoir rendre
  const hasSource = !!project.source_video_url;
  const hasTranscript = !!(project.state_json?.transcript?.segments?.length);
  const canRender = hasSource && hasTranscript;

  return (
    <div className="bg-white rounded-2xl border-2 border-neutral-200 p-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-neutral-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Rendu final</div>
          <div className="text-sm font-bold text-neutral-900">
            {canRender ? "Pret pour le rendu video luxury" : "Source + transcription requises"}
          </div>
          {!canRender && (
            <div className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
              <AlertCircle size={10} />
              {!hasSource ? "Uploadez la source" : "Lancez la transcription"}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleStartRender}
          disabled={isStarting || !canRender}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          style={{ backgroundColor: BRAND_BORDEAUX }}
        >
          {isStarting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Demarrage...
            </>
          ) : (
            <>
              <Film size={14} />
              Lancer le rendu
            </>
          )}
        </button>
      </div>
    </div>
  );
}
