// ============================================================
//  Card pour afficher un projet vidéo dans le dashboard /studio
// ============================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Trash2, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import {
  VideoProject,
  VideoStatus,
  VIDEO_MODE_INFO,
  VIDEO_MODE_INFO_FULL,
} from "@/lib/video/types";
import { formatDuration } from "@/lib/video/thumbnail";

type StatusConfig = { label: string; bgClass: string; textClass: string; borderClass: string };
const STATUS_CONFIG: Record<VideoStatus, StatusConfig> = {
  draft: { label: "Brouillon", bgClass: "bg-neutral-100", textClass: "text-neutral-700", borderClass: "border-neutral-200" },
  uploaded: { label: "Source uploadée", bgClass: "bg-blue-50", textClass: "text-blue-700", borderClass: "border-blue-200" },
  transcribed: { label: "Transcrit", bgClass: "bg-indigo-50", textClass: "text-indigo-700", borderClass: "border-indigo-200" },
  composing: { label: "En composition", bgClass: "bg-purple-50", textClass: "text-purple-700", borderClass: "border-purple-200" },
  pending_approval: { label: "En validation", bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200" },
  approved: { label: "Approuvé", bgClass: "bg-green-50", textClass: "text-green-700", borderClass: "border-green-200" },
  rejected: { label: "À retravailler", bgClass: "bg-orange-50", textClass: "text-orange-700", borderClass: "border-orange-200" },
  rendering: { label: "En rendu", bgClass: "bg-sky-50", textClass: "text-sky-700", borderClass: "border-sky-200" },
  completed: { label: "Terminé", bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-emerald-200" },
  failed: { label: "Échec", bgClass: "bg-red-50", textClass: "text-red-700", borderClass: "border-red-200" },
  archived: { label: "Archivé", bgClass: "bg-neutral-100", textClass: "text-neutral-500", borderClass: "border-neutral-200" },
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffH / 24);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffDay < 7) return `il y a ${diffDay}j`;
  return date.toLocaleDateString("fr-CH", { day: "numeric", month: "short" });
}

function formatLabel(format: string): string {
  return format.replace("_", ":");
}

type VideoProjectCardProps = {
  project: VideoProject;
  onDelete: () => void;
};

export default function VideoProjectCard({ project, onDelete }: VideoProjectCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const modeInfo = VIDEO_MODE_INFO_FULL[project.mode];
  const statusConfig = STATUS_CONFIG[project.status];

  const handleClick = () => {
    if (deleting) return;
    router.push(`/studio/video/${project.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const confirmed = await confirmDialog(
        "Supprimer ce projet vidéo ?",
        {
          description: `« ${project.title} » sera archivé. Cette action peut être annulée par un super admin.`,
          confirmLabel: "Supprimer",
          cancelLabel: "Annuler",
          destructive: true,
        }
      );

    if (!confirmed) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expirée");

      const res = await fetch(`/api/studio/video/projects/${project.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur suppression");
      }

      toast.success("Projet archivé ✓");
      onDelete();
    } catch (err: any) {
      toast.error("Suppression impossible", { description: err.message });
      setDeleting(false);
    }
  };

  const aspectClass =
    project.format === "9_16"
      ? "aspect-[9/16]"
      : project.format === "1_1"
      ? "aspect-square"
      : "aspect-video";

  return (
    <div
      onClick={handleClick}
      className={`
        group relative bg-white rounded-2xl overflow-hidden border-2 border-neutral-200
        hover:border-[#B11E2F]/40 hover:shadow-lg transition-all cursor-pointer
        ${deleting ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      <div className={`relative ${aspectClass} bg-neutral-900 overflow-hidden`}>
        {project.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">
            {(() => { const I = modeInfo?.icon; return I ? <I size={16} /> : null; })()}
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <Play size={20} className="text-neutral-900 ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>

        {project.source_duration_seconds && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded">
            {formatDuration(project.source_duration_seconds)}
          </div>
        )}

        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-[9px] font-black uppercase tracking-wider rounded">
          {formatLabel(project.format)}
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
          title="Supprimer"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-base shrink-0 leading-none mt-0.5">{(() => { const I = modeInfo?.icon; return I ? <I size={16} /> : null; })()}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
              {modeInfo.label}
            </div>
            <div className="text-sm font-bold text-neutral-900 truncate" title={project.title}>
              {project.title}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div
            className={`
              px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border
              ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}
            `}
          >
            {statusConfig.label}
          </div>
          <div className="text-[10px] text-neutral-400 flex items-center gap-1 shrink-0">
            <Clock size={9} />
            {timeAgo(project.updated_at)}
          </div>
        </div>

        {project.status === "rejected" && (
          <div className="mt-2 px-2 py-1 bg-orange-50 border border-orange-200 rounded text-[10px] text-orange-700 flex items-center gap-1">
            <AlertCircle size={10} />
            <span>Retours admin à corriger</span>
          </div>
        )}
      </div>
    </div>
  );
}