// ============================================================
//  Génération de thumbnail JPEG + extraction de métadonnées
//  100% browser-side (pas de FFmpeg, pas de backend).
// ============================================================

export type VideoMetadata = {
    duration: number;
    width: number;
    height: number;
  };
  
  // ============================================================
  //  GÉNÉRATION THUMBNAIL
  // ============================================================
  
  export async function generateVideoThumbnail(
    file: File,
    options: {
      atSeconds?: number;
      quality?: number;
      maxWidth?: number;
    } = {}
  ): Promise<Blob> {
    const { atSeconds = 1, quality = 0.85, maxWidth = 1280 } = options;
  
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
  
      const cleanup = () => {
        URL.revokeObjectURL(video.src);
        video.remove();
      };
  
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout : génération thumbnail trop longue"));
      }, 30_000);
  
      video.onloadedmetadata = () => {
        const targetTime = Math.min(atSeconds, video.duration / 2);
        video.currentTime = targetTime;
      };
  
      video.onseeked = () => {
        clearTimeout(timeout);
        try {
          let targetWidth = video.videoWidth;
          let targetHeight = video.videoHeight;
  
          if (maxWidth && targetWidth > maxWidth) {
            const ratio = maxWidth / targetWidth;
            targetWidth = maxWidth;
            targetHeight = Math.round(video.videoHeight * ratio);
          }
  
          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
  
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            cleanup();
            return reject(new Error("Canvas 2D context unavailable"));
          }
  
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  
          canvas.toBlob(
            (blob) => {
              cleanup();
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Thumbnail blob generation failed"));
              }
            },
            "image/jpeg",
            quality
          );
        } catch (err: any) {
          cleanup();
          reject(err);
        }
      };
  
      video.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error("Impossible de lire ce fichier vidéo"));
      };
  
      video.src = URL.createObjectURL(file);
    });
  }
  
  // ============================================================
  //  EXTRACTION MÉTADONNÉES
  // ============================================================
  
  export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
  
      const cleanup = () => {
        URL.revokeObjectURL(video.src);
        video.remove();
      };
  
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout : lecture métadonnées trop longue"));
      }, 15_000);
  
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        const meta: VideoMetadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };
        cleanup();
        resolve(meta);
      };
  
      video.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error("Impossible de lire les métadonnées du fichier"));
      };
  
      video.src = URL.createObjectURL(file);
    });
  }
  
  // ============================================================
  //  HELPERS DE FORMATTING
  // ============================================================
  
  export function formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return "0:00";
  
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
  
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  
  export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  
  export function estimateRemainingSeconds(
    uploadedBytes: number,
    totalBytes: number,
    startTimeMs: number
  ): number {
    const elapsedMs = Date.now() - startTimeMs;
    if (elapsedMs < 200 || uploadedBytes === 0) return -1;
  
    const bytesPerMs = uploadedBytes / elapsedMs;
    const remainingBytes = totalBytes - uploadedBytes;
    const remainingMs = remainingBytes / bytesPerMs;
  
    return Math.max(0, Math.round(remainingMs / 1000));
  }