// ============================================================
//  BrollsPanel — Upload + gestion des b-rolls (vidéos/images overlay)
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Film,
  Upload,
  Loader2,
  Trash2,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import {
  VideoProject,
  BRoll,
  BRollPosition,
  MAX_BROLL_SIZE_BYTES,
  ACCEPTED_BROLL_VIDEO_MIME_TYPES,
  ACCEPTED_BROLL_IMAGE_MIME_TYPES,
  DEFAULT_BROLL_SCALE,
  DEFAULT_BROLL_POSITION,
  DEFAULT_IMAGE_DURATION_SECONDS,
} from "@/lib/video/types";

type Props = {
  project: VideoProject;
  onProjectUpdated: () => void;
};

const BRAND_BORDEAUX = "#B11E2F";
const PATCH_DEBOUNCE_MS = 600;

const POSITION_LABELS: Record<BRollPosition, string> = {
  fullscreen: "Plein écran",
  "top-left": "Haut gauche",
  "top-right": "Haut droite",
  "bottom-left": "Bas gauche",
  "bottom-right": "Bas droite",
  center: "Centre",
};

export default function BrollsPanel({ project, onProjectUpdated }: Props) {
  const brolls: BRoll[] = Array.isArray(project.state_json?.brolls)
    ? project.state_json.brolls
    : [];
  const sourceDuration = project.source_duration_seconds ?? 30;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMediaDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const isVideo = file.type.startsWith("video/");
      if (!isVideo) {
        resolve(DEFAULT_IMAGE_DURATION_SECONDS);
        return;
      }
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve(video.duration);
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => {
        resolve(5); // fallback
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    // Validate MIME
    const acceptedVideo: readonly string[] = ACCEPTED_BROLL_VIDEO_MIME_TYPES;
    const acceptedImage: readonly string[] = ACCEPTED_BROLL_IMAGE_MIME_TYPES;
    const isVideo = acceptedVideo.includes(file.type);
    const isImage = acceptedImage.includes(file.type);

    if (!isVideo && !isImage) {
      toast.error("Format non supporté", {
        description: "Utilise MP4, MOV, PNG, JPG ou WEBP.",
      });
      return;
    }

    if (file.size > MAX_BROLL_SIZE_BYTES) {
      const maxMB = Math.round(MAX_BROLL_SIZE_BYTES / 1024 / 1024);
      toast.error("Fichier trop volumineux", {
        description: `Maximum ${maxMB} MB.`,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const duration = await getMediaDuration(file);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        setIsUploading(false);
        return;
      }

      // Step 1: Get signed URL
      setUploadProgress(10);
      const urlRes = await fetch(
        `/api/studio/video/projects/${project.id}/brolls/upload-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          }),
        }
      );
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || "Erreur génération URL");

      // Step 2: Upload to signed URL
      setUploadProgress(30);
      const uploadRes = await fetch(urlData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);

      // Step 3: Confirm + add to state_json.brolls[]
      setUploadProgress(80);
      const confirmRes = await fetch(
        `/api/studio/video/projects/${project.id}/brolls`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            publicUrl: urlData.publicUrl,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            brollType: urlData.brollType,
            duration_seconds: duration,
            start_time: 0,
            end_time: Math.min(sourceDuration, duration),
            position: DEFAULT_BROLL_POSITION,
            scale: DEFAULT_BROLL_SCALE,
          }),
        }
      );
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || "Erreur confirmation");

      setUploadProgress(100);
      toast.success("B-roll ajouté", {
        description: `${file.name} (${urlData.brollType})`,
      });
      onProjectUpdated();
    } catch (err: any) {
      toast.error("Erreur upload b-roll", {
        description: err.message || String(err),
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ============================================================
  //  STATE : Upload en cours
  // ============================================================
  if (isUploading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: `${BRAND_BORDEAUX}15`,
              color: BRAND_BORDEAUX,
            }}
          >
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Upload b-roll</h3>
            <p className="text-[10px] text-neutral-400 uppercase tracking-widest">
              {uploadProgress}%
            </p>
          </div>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${uploadProgress}%`,
              backgroundColor: BRAND_BORDEAUX,
            }}
          />
        </div>
      </div>
    );
  }

  // ============================================================
  //  STATE : Liste de b-rolls (ou vide)
  // ============================================================
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: `${BRAND_BORDEAUX}15`,
            color: BRAND_BORDEAUX,
          }}
        >
          <Film className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-neutral-900">B-rolls overlay</h3>
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest">
            {brolls.length} clip{brolls.length > 1 ? "s" : ""} · vidéo + image
          </p>
        </div>
      </div>

      {/* Liste */}
      {brolls.length > 0 && (
        <div className="space-y-3 mb-4">
          {brolls.map((broll) => (
            <BrollCard
              key={broll.id}
              projectId={project.id}
              broll={broll}
              sourceDuration={sourceDuration}
              onUpdated={onProjectUpdated}
            />
          ))}
        </div>
      )}

      {/* Bouton Add */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full px-4 py-4 rounded-xl border-2 border-dashed border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-colors flex flex-col items-center gap-1.5"
      >
        <Upload className="w-5 h-5 text-neutral-400" />
        <div className="text-xs font-medium text-neutral-700">
          {brolls.length === 0
            ? "Ajouter un premier b-roll"
            : "Ajouter un autre b-roll"}
        </div>
        <div className="text-[10px] text-neutral-400">
          MP4, MOV, PNG, JPG, WEBP — max 100 MB
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,image/png,image/jpeg,image/webp,.mp4,.mov,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
        className="hidden"
      />
    </div>
  );
}

// ============================================================
//  Sub-component : BrollCard (1 b-roll = 1 card)
// ============================================================

type BrollCardProps = {
  projectId: string;
  broll: BRoll;
  sourceDuration: number;
  onUpdated: () => void;
};

function BrollCard({ projectId, broll, sourceDuration, onUpdated }: BrollCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Local state pour les inputs (debounced save)
  const [localStart, setLocalStart] = useState(broll.start_time);
  const [localEnd, setLocalEnd] = useState(broll.end_time);
  const [localPosition, setLocalPosition] = useState<BRollPosition>(broll.position);
  const [localScale, setLocalScale] = useState(broll.scale);

  // Sync si broll change (refresh externe)
  useEffect(() => {
    setLocalStart(broll.start_time);
    setLocalEnd(broll.end_time);
    setLocalPosition(broll.position);
    setLocalScale(broll.scale);
  }, [broll.start_time, broll.end_time, broll.position, broll.scale]);

  // Debounced PATCH
  useEffect(() => {
    const changed =
      localStart !== broll.start_time ||
      localEnd !== broll.end_time ||
      localPosition !== broll.position ||
      localScale !== broll.scale;

    if (!changed) return;

    const timer = setTimeout(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        await fetch(`/api/studio/video/projects/${projectId}/brolls/${broll.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            start_time: localStart,
            end_time: localEnd,
            position: localPosition,
            scale: localScale,
          }),
        });
        onUpdated();
      } catch {
        // silent fail (toast géré par parent si besoin)
      }
    }, PATCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStart, localEnd, localPosition, localScale]);

  const handleDelete = async () => {
    const ok = await confirmDialog("Supprimer ce b-roll ?", {
      description: `${broll.filename} sera définitivement supprimé.`,
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        setIsDeleting(false);
        return;
      }

      const res = await fetch(
        `/api/studio/video/projects/${projectId}/brolls/${broll.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur suppression");

      toast.success("B-roll supprimé");
      onUpdated();
    } catch (err: any) {
      toast.error("Erreur", { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const isVideo = broll.type === "video";

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
      {/* Header : preview + filename + delete */}
      <div className="flex items-start gap-3 mb-3">
        {/* Preview thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-200 shrink-0 flex items-center justify-center">
          {isVideo ? (
            <video
              src={broll.url}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={broll.url}
              alt={broll.filename}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Filename + type badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {isVideo ? (
              <VideoIcon className="w-3 h-3 text-neutral-400" />
            ) : (
              <ImageIcon className="w-3 h-3 text-neutral-400" />
            )}
            <span className="text-[9px] uppercase tracking-widest text-neutral-400 font-bold">
              {isVideo ? "Vidéo" : "Image"} · {broll.duration_seconds.toFixed(1)}s
            </span>
          </div>
          <div className="text-xs font-bold text-neutral-900 truncate">
            {broll.filename}
          </div>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1.5 rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
          title="Supprimer ce b-roll"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Inputs grid */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* Start time */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
            Début (s)
          </label>
          <input
            type="number"
            min={0}
            max={sourceDuration}
            step={0.1}
            value={localStart.toFixed(1)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) setLocalStart(Math.max(0, Math.min(sourceDuration, v)));
            }}
            className="w-full px-2 py-1.5 rounded-md border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white tabular-nums"
          />
        </div>

        {/* End time */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
            Fin (s)
          </label>
          <input
            type="number"
            min={localStart}
            max={sourceDuration}
            step={0.1}
            value={localEnd.toFixed(1)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) setLocalEnd(Math.max(localStart, Math.min(sourceDuration, v)));
            }}
            className="w-full px-2 py-1.5 rounded-md border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white tabular-nums"
          />
        </div>
      </div>

      {/* Position dropdown */}
      <div className="mb-2">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
          Position
        </label>
        <select
          value={localPosition}
          onChange={(e) => setLocalPosition(e.target.value as BRollPosition)}
          className="w-full px-2 py-1.5 rounded-md border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white"
        >
          {(Object.keys(POSITION_LABELS) as BRollPosition[]).map((pos) => (
            <option key={pos} value={pos}>
              {POSITION_LABELS[pos]}
            </option>
          ))}
        </select>
      </div>

      {/* Scale slider (caché si fullscreen) */}
      {localPosition !== "fullscreen" && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
              Taille
            </label>
            <span className="text-[10px] font-bold text-neutral-700 tabular-nums">
              {Math.round(localScale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.05}
            value={localScale}
            onChange={(e) => setLocalScale(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${BRAND_BORDEAUX} 0%, ${BRAND_BORDEAUX} ${
                localScale * 100
              }%, #f3f4f6 ${localScale * 100}%, #f3f4f6 100%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}