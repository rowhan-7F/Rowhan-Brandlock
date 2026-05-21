// ============================================================
//  Drag & drop + upload signed URL + thumbnail generation +
//  PATCH metadata. Tout le flow d'upload Phase 1.
// ============================================================

"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import {
  ACCEPTED_VIDEO_MIME_TYPES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  VideoFormat,
  VIDEO_FORMAT_DIMENSIONS,
} from "@/lib/video/types";
import {
  generateVideoThumbnail,
  getVideoMetadata,
  formatDuration,
  formatFileSize,
  estimateRemainingSeconds,
} from "@/lib/video/thumbnail";
import VideoUploadProgress from "./VideoUploadProgress";

type VideoDropzoneProps = {
  projectId: string;
  tenantId: string;
  format: VideoFormat;
  onUploadComplete: () => void;
};

type UploadState =
  | { phase: "idle" }
  | { phase: "validating"; fileName: string }
  | { phase: "uploading"; fileName: string; progress: number; etaSeconds: number; totalSize: number }
  | { phase: "processing"; message: string }
  | { phase: "error"; message: string }
  | { phase: "complete" };

export default function VideoDropzone({
  projectId,
  tenantId,
  format,
  onUploadComplete,
}: VideoDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const validateFile = async (file: File): Promise<string | null> => {
    if (!ACCEPTED_VIDEO_MIME_TYPES.includes(file.type as any)) {
      return `Format non supporté (${file.type}). Utilise MP4 ou MOV.`;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      return `Fichier trop volumineux (${formatFileSize(file.size)}). Max : ${formatFileSize(MAX_VIDEO_SIZE_BYTES)}.`;
    }

    try {
      const meta = await getVideoMetadata(file);
      if (meta.duration > MAX_VIDEO_DURATION_SECONDS) {
        return `Vidéo trop longue (${formatDuration(meta.duration)}). Max : ${formatDuration(MAX_VIDEO_DURATION_SECONDS)}.`;
      }
      if (meta.duration < 1) {
        return `Vidéo trop courte (${formatDuration(meta.duration)}). Min : 1 seconde.`;
      }
    } catch (err: any) {
      return `Impossible de lire la vidéo : ${err.message}`;
    }

    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      setState({ phase: "validating", fileName: file.name });

      const validationError = await validateFile(file);
      if (validationError) {
        setState({ phase: "error", message: validationError });
        toast.error("Fichier rejeté", { description: validationError });
        return;
      }

      try {
        const meta = await getVideoMetadata(file);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Session expirée, reconnecte-toi");

        setState({ phase: "processing", message: "Préparation de l'upload..." });
        const signedRes = await fetch(`/api/studio/video/projects/${projectId}/upload`, {
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
        });

        const signedData = await signedRes.json();
        if (!signedRes.ok) {
          throw new Error(signedData.error || "Erreur préparation upload");
        }

        const startTimeMs = Date.now();
        setState({
          phase: "uploading",
          fileName: file.name,
          progress: 0,
          etaSeconds: -1,
          totalSize: file.size,
        });

        await uploadWithProgress({
          url: signedData.uploadUrl,
          file,
          onProgress: (loaded, total) => {
            const progress = Math.round((loaded / total) * 100);
            const etaSeconds = estimateRemainingSeconds(loaded, total, startTimeMs);
            setState({
              phase: "uploading",
              fileName: file.name,
              progress,
              etaSeconds,
              totalSize: total,
            });
          },
          xhrRef,
        });

        const sourceVideoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/video-sources/${signedData.path}`;

        setState({ phase: "processing", message: "Génération de la miniature..." });
        const thumbBlob = await generateVideoThumbnail(file, { atSeconds: 1 });
        const thumbPath = `${tenantId}/${projectId}/thumb.jpg`;

        const { error: thumbErr } = await supabase.storage
          .from("video-thumbnails")
          .upload(thumbPath, thumbBlob, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (thumbErr) {
          console.error("[VideoDropzone] thumbnail upload error:", thumbErr);
        }

        const { data: thumbUrlData } = supabase.storage
          .from("video-thumbnails")
          .getPublicUrl(thumbPath);

        setState({ phase: "processing", message: "Enregistrement des informations..." });
        const ext = (file.name.split(".").pop() || "mp4").toLowerCase();

        const patchRes = await fetch(`/api/studio/video/projects/${projectId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            source_video_url: sourceVideoUrl,
            source_duration_seconds: meta.duration,
            source_format: ext,
            source_dimensions: { width: meta.width, height: meta.height },
            source_size_bytes: file.size,
            thumbnail_url: thumbErr ? null : thumbUrlData.publicUrl,
            status: "uploaded",
          }),
        });

        const patchData = await patchRes.json();
        if (!patchRes.ok) {
          throw new Error(patchData.error || "Erreur sauvegarde métadonnées");
        }

        setState({ phase: "complete" });
        toast.success("Vidéo uploadée ✓", {
          description: `${formatDuration(meta.duration)} · ${meta.width}×${meta.height}`,
        });

        setTimeout(() => {
          onUploadComplete();
        }, 800);
      } catch (err: any) {
        console.error("[VideoDropzone] upload error:", err);
        setState({ phase: "error", message: err.message || "Erreur upload" });
        toast.error("Upload impossible", { description: err.message });
      }
    },
    [projectId, tenantId, onUploadComplete]
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (state.phase !== "idle" && state.phase !== "error") return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setState({ phase: "idle" });
  };

  const handleRetry = () => {
    setState({ phase: "idle" });
    fileInputRef.current?.click();
  };

  const dims = VIDEO_FORMAT_DIMENSIONS[format];

  if (state.phase === "uploading" || state.phase === "processing" || state.phase === "validating") {
    return (
      <VideoUploadProgress
        state={state}
        onCancel={state.phase === "uploading" ? handleCancelUpload : undefined}
      />
    );
  }

  if (state.phase === "complete") {
    return (
      <div className="w-full max-w-2xl mx-auto p-12 bg-green-50 border-2 border-green-300 rounded-2xl text-center">
        <CheckCircle2 size={48} className="text-green-600 mx-auto mb-3" />
        <div className="text-base font-bold text-green-900">Upload terminé ✓</div>
        <div className="text-xs text-green-700 mt-1">Préparation de l'éditeur...</div>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="w-full max-w-2xl mx-auto p-12 bg-red-50 border-2 border-red-300 rounded-2xl text-center">
        <AlertCircle size={48} className="text-red-600 mx-auto mb-3" />
        <div className="text-base font-bold text-red-900">Upload impossible</div>
        <div className="text-xs text-red-700 mt-1 max-w-md mx-auto">{state.message}</div>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-5 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition"
        >
          Réessayer
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_VIDEO_MIME_TYPES.join(",")}
          onChange={handleBrowse}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`
        w-full max-w-2xl mx-auto p-12 border-2 border-dashed rounded-2xl text-center transition-all cursor-pointer
        ${dragActive
          ? "border-[#B11E2F] bg-[#B11E2F]/5 scale-[1.01]"
          : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50"
        }
      `}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_VIDEO_MIME_TYPES.join(",")}
        onChange={handleBrowse}
        className="hidden"
      />

      <Upload size={48} className={`mx-auto mb-4 ${dragActive ? "text-[#B11E2F]" : "text-neutral-400"}`} />

      <div className="text-base font-bold text-neutral-900 mb-1">
        {dragActive ? "Dépose le fichier ici" : "Dépose ta vidéo ici"}
      </div>
      <div className="text-xs text-neutral-500 mb-4">
        ou clique pour parcourir tes fichiers
      </div>

      <div className="inline-flex items-center gap-4 px-4 py-2 bg-neutral-100 rounded-lg text-[10px] font-medium text-neutral-600">
        <span>📹 MP4 · MOV</span>
        <span>·</span>
        <span>Max {formatFileSize(MAX_VIDEO_SIZE_BYTES)}</span>
        <span>·</span>
        <span>Max {formatDuration(MAX_VIDEO_DURATION_SECONDS)}</span>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[10px] text-blue-700">
        <span>📐</span>
        <span>Format choisi : <strong>{dims.width}×{dims.height}</strong> ({dims.label}). Filme dans ce ratio pour un rendu optimal.</span>
      </div>
    </div>
  );
}

function uploadWithProgress(args: {
  url: string;
  file: File;
  onProgress: (loaded: number, total: number) => void;
  xhrRef: React.RefObject<XMLHttpRequest | null>;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    args.xhrRef.current = xhr;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        args.onProgress(e.loaded, e.total);
      }
    });

    xhr.addEventListener("load", () => {
      args.xhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload échoué (HTTP ${xhr.status})`));
      }
    });

    xhr.addEventListener("error", () => {
      args.xhrRef.current = null;
      reject(new Error("Erreur réseau pendant l'upload"));
    });

    xhr.addEventListener("abort", () => {
      args.xhrRef.current = null;
      reject(new Error("Upload annulé"));
    });

    xhr.open("PUT", args.url);
    xhr.setRequestHeader("Content-Type", args.file.type);
    xhr.send(args.file);
  });
}