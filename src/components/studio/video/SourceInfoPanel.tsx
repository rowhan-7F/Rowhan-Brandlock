"use client";

import { Video, AlertCircle, Lock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { VideoProject, VIDEO_FORMAT_DIMENSIONS } from "@/lib/video/types";
import { formatDuration, formatFileSize } from "@/lib/video/thumbnail";
import VideoDropzone from "./VideoDropzone";

const BRAND_BORDEAUX = "#B11E2F";

type Props = {
  project: VideoProject;
  onProjectUpdated: () => void;
};

export default function SourceInfoPanel({ project, onProjectUpdated }: Props) {
  const [showReplace, setShowReplace] = useState(false);
  const dims = VIDEO_FORMAT_DIMENSIONS[project.format];
  const hasSource = !!project.source_video_url;
  const isLocked = project.status === "approved" || project.status === "archived";

  if (isLocked) {
    return (
      <div className="space-y-4">
        <MetadataCard project={project} dims={dims} />
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Lock size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">
                Source verrouillee
              </div>
              <p className="text-xs text-amber-900">
                Projet deja rendu. Creez un nouveau projet pour modifier la source.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSource) {
    return (
      <VideoDropzone
        projectId={project.id}
        tenantId={project.tenant_id}
        format={project.format}
        onUploadComplete={() => { onProjectUpdated(); setShowReplace(false); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <MetadataCard project={project} dims={dims} />

      {showReplace ? (
        <div className="space-y-3">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-orange-600 shrink-0 mt-0.5" />
              <div className="text-xs text-orange-900">
                <strong>Attention :</strong> remplacer la source peut desynchroniser la transcription et les b-rolls.
              </div>
            </div>
          </div>
          <VideoDropzone
            projectId={project.id}
            tenantId={project.tenant_id}
            format={project.format}
            onUploadComplete={() => { onProjectUpdated(); setShowReplace(false); }}
          />
          <button
            type="button"
            onClick={() => setShowReplace(false)}
            className="w-full px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 rounded-lg transition"
          >
            Annuler le remplacement
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowReplace(true)}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border-2 transition hover:bg-neutral-50"
          style={{ borderColor: BRAND_BORDEAUX, color: BRAND_BORDEAUX }}
        >
          <RefreshCw size={13} />
          Remplacer la source
        </button>
      )}

      <div className="bg-green-50 border border-green-200 rounded-xl p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-green-700">
          Source pret pour l'edition
        </div>
        <p className="text-xs text-green-900 mt-1">
          Vous pouvez ajouter une voix-off, lancer la transcription et editer les sous-titres.
        </p>
      </div>
    </div>
  );
}

function MetadataCard({ project, dims }: { project: VideoProject; dims: any }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Video size={14} className="text-neutral-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
          Source actuelle
        </span>
      </div>
      <MetaField label="Format cible" value={dims.width + "x" + dims.height + " (" + dims.label + ")"} />
      {project.source_duration_seconds ? (
        <MetaField label="Duree" value={formatDuration(project.source_duration_seconds)} />
      ) : null}
      {project.source_dimensions ? (
        <MetaField
          label="Dimensions"
          value={project.source_dimensions.width + "x" + project.source_dimensions.height}
        />
      ) : null}
      {project.source_size_bytes ? (
        <MetaField label="Taille" value={formatFileSize(project.source_size_bytes)} />
      ) : null}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">
        {label}
      </div>
      <div className="text-sm font-bold text-neutral-900">{value}</div>
    </div>
  );
}