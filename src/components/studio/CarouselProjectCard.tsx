"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Trash2, Clock, AlertCircle, ImageIcon, Layers } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import SlideRenderer from "./SlideRenderer";

// ============================================================
//  CAROUSEL PROJECT CARD - Phase 12 peaufinage
//
//  Affiche un projet carrousel dans le dashboard avec :
//  - Live preview de la 1ere slide (intro) via SlideRenderer
//  - Format 4:5 (1080x1350) presque carre
//  - Badge "Carrousel IG"
//  - Badge statut (pending_approval/approved/rejected)
//  - Hover overlay Play
//  - Click -> /studio/{id}
// ============================================================

type StatusConfig = { label: string; bgClass: string; textClass: string; borderClass: string };
const STATUS_CONFIG: Record<string, StatusConfig> = {
  draft: { label: "Brouillon", bgClass: "bg-neutral-100", textClass: "text-neutral-700", borderClass: "border-neutral-200" },
  pending_approval: { label: "En validation", bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200" },
  approved: { label: "Approuve", bgClass: "bg-green-50", textClass: "text-green-700", borderClass: "border-green-200" },
  rejected: { label: "A retravailler", bgClass: "bg-orange-50", textClass: "text-orange-700", borderClass: "border-orange-200" },
  archived: { label: "Archive", bgClass: "bg-neutral-100", textClass: "text-neutral-500", borderClass: "border-neutral-200" },
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

type Props = {
  project: any;
  config: any;
  brandColor: string;
  onDelete: () => void;
};

export default function CarouselProjectCard({ project, config, brandColor, onDelete }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;
  const slides = project.state_json?.slides || [];
  const firstSlide = slides[0];
  const slidesCount = slides.length;

  const handleClick = () => {
    if (deleting) return;
    router.push(`/studio/${project.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDialog(`Supprimer "${project.title}" ?`, {
      description: "Cette action est definitive.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expiree");
      const res = await fetch(`/api/studio/projects/${project.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur suppression");
      }
      toast.success("Projet supprime");
      onDelete();
    } catch (err: any) {
      toast.error("Suppression impossible", { description: err.message });
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group relative bg-white rounded-2xl overflow-hidden border-2 border-neutral-200
        hover:border-[#B11E2F]/40 hover:shadow-lg transition-all cursor-pointer
        ${deleting ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      {/* Vignette : 4/5 ratio (1080x1350 slide IG) */}
      <div className="relative aspect-[4/5] bg-neutral-900 overflow-hidden">
        {firstSlide && config ? (
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
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={32} className="text-neutral-600" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <Play size={20} className="text-neutral-900 ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>

        {/* Badge Carrousel IG */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-[9px] font-black uppercase tracking-wider rounded flex items-center gap-1">
          <Layers size={9} />
          Carrousel
        </div>

        {/* Nb slides */}
        {slidesCount > 0 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded">
            {slidesCount} slide{slidesCount > 1 ? "s" : ""}
          </div>
        )}

        {/* Delete button */}
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

      {/* Footer */}
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
            {timeAgo(project.updated_at)}
          </div>
        </div>
      </div>
    </div>
  );
}