"use client";

import { toPng } from "html-to-image";
import JSZip from "jszip";

// ============================================================
//  TYPES
// ============================================================

export type ExportProgress = {
  step: "preparing" | "capturing" | "zipping" | "done" | "error";
  current?: number;
  total?: number;
  message?: string;
};

export type ExportOptions = {
  projectTitle: string;
  /** Container DOM qui contient des groupes [data-export-format] */
  container: HTMLElement;
  onProgress?: (progress: ExportProgress) => void;
  /** @deprecated - ignorés (dims lues par groupe [data-export-format]) */
  slideSelector?: string;
  width?: number;
  height?: number;
};

// ============================================================
//  HELPER : Convertir une image URL en data-URL base64 (contourne CORS)
// ============================================================

async function imageUrlToDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn(`[Export] Erreur fetch image ${url}:`, err);
    return url;
  }
}

async function prefetchImagesInContainer(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
  const seen = new Map<string, string>();
  for (const img of images) {
    const originalSrc = img.src;
    if (!originalSrc || originalSrc.startsWith("data:")) continue;
    let dataUrl = seen.get(originalSrc);
    if (!dataUrl) {
      dataUrl = await imageUrlToDataUrl(originalSrc);
      seen.set(originalSrc, dataUrl);
    }
    img.src = dataUrl;
    img.crossOrigin = "anonymous";
    if (!img.complete) {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }
  }
}

async function waitForFonts(): Promise<void> {
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await (document as any).fonts.ready;
    } catch {
      // ignore
    }
  }
  await new Promise((r) => setTimeout(r, 200));
}

function sanitizeName(text: string): string {
  return (text || "")
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "format";
}

// ============================================================
//  EXPORT PRINCIPAL — multi-format (1 dossier par format)
// ============================================================

export async function exportCarouselAsZip(options: ExportOptions): Promise<Blob> {
  const { container, onProgress } = options;

  onProgress?.({ step: "preparing", message: "Préparation de l'export..." });

  await prefetchImagesInContainer(container);
  await waitForFonts();

  const groups = Array.from(
    container.querySelectorAll("[data-export-format]")
  ) as HTMLElement[];

  if (groups.length === 0) {
    throw new Error("Aucun format à exporter");
  }

  const zip = new JSZip();

  let total = 0;
  for (const g of groups) {
    total += g.querySelectorAll("[data-export-slide]").length;
  }
  let done = 0;

  for (const group of groups) {
    const rawLabel =
      group.dataset.formatLabel || group.dataset.exportFormat || "format";
    const w = parseInt(group.dataset.formatW || "1080", 10);
    const h = parseInt(group.dataset.formatH || "1350", 10);
    const label = sanitizeName(rawLabel);

    const folderName = `${label} (${w}x${h})`;
    const folder = zip.folder(folderName) || zip;

    const slides = Array.from(
      group.querySelectorAll("[data-export-slide]")
    ) as HTMLElement[];

    for (let i = 0; i < slides.length; i++) {
      done++;
      onProgress?.({
        step: "capturing",
        current: done,
        total,
        message: `Capture ${label} ${i + 1}/${slides.length}...`,
      });

      try {
        const dataUrl = await toPng(slides[i], {
          width: w,
          height: h,
          pixelRatio: 1,
          cacheBust: true,
          skipFonts: false,
          backgroundColor: "#1A1A1A",
          style: { width: `${w}px`, height: `${h}px` },
        });
        const base64 = dataUrl.split(",")[1];
        const filename = `Slide ${String(i + 1).padStart(2, "0")} - ${label} (${w}x${h}).png`;
        folder.file(filename, base64, { base64: true });
      } catch (err: any) {
        console.error(`[Export] Erreur capture ${label} slide ${i + 1}:`, err);
        throw new Error(`Erreur capture ${label} slide ${i + 1} : ${err.message || err}`);
      }
    }
  }

  onProgress?.({ step: "zipping", message: "Création du ZIP..." });
  const zipBlob = await zip.generateAsync({ type: "blob" });

  onProgress?.({ step: "done", message: "Export terminé !" });
  return zipBlob;
}

// ============================================================
//  HELPER : Déclencher le téléchargement d'un Blob
// ============================================================

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}