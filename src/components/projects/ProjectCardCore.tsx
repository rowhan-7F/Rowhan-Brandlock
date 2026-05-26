"use client";

import { Play, Clock, ImageIcon, Layers, Film } from "lucide-react";
import SlideRenderer from "@/components/studio/SlideRenderer";
import { formatDuration } from "@/lib/video/thumbnail";

// ============================================================
//  PROJECT CARD CORE - Composant pur, visuel only
//
//  Affiche un projet (carrousel OU video) avec :
//  - Vignette format 4:5 (carrousel slide preview ou video thumbnail)
//  - Badge type (Carrousel / Video)
//  - Badge statut (pending_approval / approved / rejected)
//  - Footer : titre + statut + temps
//  - Hover overlay Play
//
//  PAS de logique routage, PAS de click, PAS de delete.
//  Le parent (wrapper Admin/Studio) gere ces comportements.
// ============================================================

type StatusConfig = { label: string; bgClass: string; textClass: string; borderClass: string };
const STATUS_CONFIG: Record<string, StatusConfig> = {
  draft: { label: "Brouillon", bgClass: "bg-neutral-100", textClass: "text-neutral-700", borderClass: "border-neutral-200" },
  pending_approval: { label: "En validation", bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200" },
  approved: { label: "Approuve", bgClass: "bg-green-50", textClass: "text-green-700", borderClass: "border-green-200" },
  rejected: { label: "A retravailler", bgClass: "bg-orange-50", textClass: "text-orange-700", borderClass: "border-orange-200" },
  archived: { label: "Archive", bgClass: "bg-neutral-100", textClass: "text-neutral-500", borderClass: "border-neutral-200" },
  published: { label: "Publie", bgClass: "bg-blue-50", textClass: "text-blue-700", borderClass: "border-blue-200" },
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffH / 24);
  if (diffMin < 1) return "a l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffDay < 7) return `il y a ${diffDay}j`;
  return date.toLocaleDateString("fr-CH", { day: "numeric", month: "short" });
}

export type ProjectType = "carousel" | "video";

type Props = {
  project: any;          // carrousel ou video project
  type: ProjectType;     // "carousel" | "video"
  config?: any;          // requis pour carrousel (SlideRenderer)
  rightSlot?: React.ReactNode;  // ex: bouton delete, badge urgent, etc
  className?: string;
};

export default function ProjectCardCore({ project, type, config, rightSlot, className = "" }: Props) {
  const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;
  const isVideo = type === "video";

  // Donnees specifiques carrousel
  const slides = project.state_json?.slides || [];
  const firstSlide = slides[0];
  const slidesCount = slides.length;

  // Donnees specifiques video
  const thumbnailUrl = project.thumbnail_url || project.video_url;
  const duration = project.duration_seconds;

  return (
    <div
      className={`
        group relative bg-white rounded-2xl overflow-hidden border-2 border-neutral-200
        hover:border-[#B11E2F]/40 hover:shadow-lg transition-all
        ${className}
      `}
    >
      {/* ============================================================
          VIGNETTE : Format 4:5 (1080x1350 si carrousel, sinon carre)
          ============================================================ */}
      <div className="relative aspect-[4/5] bg-neutral-900 overflow-hidden">
        
        {/* CARROUSEL : Preview live de la 1ere slide */}
        {!isVideo && firstSlide && config ? (
          <div className="absolute inset-0 origin-top-left" style={{ transform: "scale(0.2)", width: "1080px", height: "1350px" }}>
            <SlideRenderer
              config={config}
              variant={firstSlide.variant}
              subVariant={firstSlide.subVariant}
              inputValues={firstSlide.inputs || {}}
              templateKey="carrousel_instagram"
              scale={1}
            />
          </div>
        ) : null}

        {/* VIDEO : Thumbnail */}
        {isVideo && thumbnailUrl ? (
          <img src={thumbnailUrl} alt={project.title} className="w-full h-full object-cover" />
        ) : null}

        {/* Fallback : placeholder */}
        {((!isVideo && (!firstSlide || !config)) || (isVideo && !thumbnailUrl)) && (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo ? <Film size={32} className="text-neutral-600" /> : <ImageIcon size={32} className="text-neutral-600" />}
          </div>
        )}

        {/* Hover overlay - Play pour videos, Layers pour carrousels */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              {isVideo ? (
                <Play size={20} className="text-neutral-900 ml-0.5" fill="currentColor" />
              ) : (
                <Layers size={20} className="text-neutral-900" />
              )}
            </div>
          </div>
        </div>

        {/* Badge Type (Carrousel / Video) - top-left */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-[9px] font-black uppercase tracking-wider rounded flex items-center gap-1">
          {isVideo ? <Film size={9} /> : <Layers size={9} />}
          {isVideo ? "Video" : "Carrousel"}
        </div>

        {/* Slot droit (delete admin, badge urgent, etc) - top-right */}
        {rightSlot && (
          <div className="absolute top-2 right-2">
            {rightSlot}
          </div>
        )}

        {/* Info bas - nb slides (carrousel) ou duree (video) */}
        {!isVideo && slidesCount > 0 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded">
            {slidesCount} slide{slidesCount > 1 ? "s" : ""}
          </div>
        )}
        {isVideo && duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded">
            {formatDuration(duration)}
          </div>
        )}
      </div>

      {/* ============================================================
          FOOTER : Titre + statut + temps
          ============================================================ */}
      <div className="p-3">
        <div className="text-sm font-bold text-neutral-900 truncate mb-2" title={project.title}>
          {project.title}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}`}>
            {statusConfig.label}
          </div>
          <div className="text-[10px] text-neutral-400 flex items-center gap-1 shrink-0">
            <Clock size={9} />
            {timeAgo(project.updated_at || project.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}
