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
  /** Container DOM qui contient les slides à exporter (déjà rendues à scale=1) */
  container: HTMLElement;
  /** Selector pour identifier chaque slide individuelle dans le container */
  slideSelector?: string;
  /** Callback pour reporter la progression */
  onProgress?: (progress: ExportProgress) => void;
  /** Taille cible (défaut: 1080×1350 portrait Instagram) */
  width?: number;
  height?: number;
};

// ============================================================
//  HELPER : Convertir une image URL en data-URL base64
//  (contourne les problèmes CORS de Supabase Storage)
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
    return url; // fallback : on garde l'URL d'origine
  }
}

// ============================================================
//  HELPER : Pré-fetch toutes les images du container en data-URL
//  → Remplace src="https://..." par src="data:image/...;base64,..."
// ============================================================

async function prefetchImagesInContainer(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
  const seen = new Map<string, string>(); // cache URL → dataURL

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

    // Attendre que la nouvelle image soit chargée
    if (!img.complete) {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }
  }
}

// ============================================================
//  HELPER : Attendre que toutes les polices soient chargées
// ============================================================

async function waitForFonts(): Promise<void> {
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await (document as any).fonts.ready;
    } catch {
      // ignore
    }
  }
  // Délai supplémentaire pour Recharts qui calcule ses dimensions
  await new Promise((r) => setTimeout(r, 200));
}

// ============================================================
//  HELPER : Slugify pour nom de fichier
// ============================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50) || "carrousel";
}

// ============================================================
//  EXPORT PRINCIPAL
// ============================================================

export async function exportCarouselAsZip(options: ExportOptions): Promise<Blob> {
  const {
    projectTitle,
    container,
    slideSelector = "[data-export-slide]",
    onProgress,
    width = 1080,
    height = 1350,
  } = options;

  // Étape 1 : Préparation
  onProgress?.({ step: "preparing", message: "Préparation de l'export..." });

  // Récupérer toutes les slides
  const slides = Array.from(container.querySelectorAll(slideSelector)) as HTMLElement[];
  if (slides.length === 0) {
    throw new Error("Aucune slide à exporter");
  }

  // Pré-fetch toutes les images en data-URL pour éviter CORS
  await prefetchImagesInContainer(container);
  await waitForFonts();

  // Étape 2 : Capture chaque slide
  const zip = new JSZip();
  const folder = zip.folder(slugify(projectTitle)) || zip;

  for (let i = 0; i < slides.length; i++) {
    onProgress?.({
      step: "capturing",
      current: i + 1,
      total: slides.length,
      message: `Capture slide ${i + 1}/${slides.length}...`,
    });

    const slide = slides[i];

    try {
      const dataUrl = await toPng(slide, {
        width,
        height,
        pixelRatio: 1,
        cacheBust: true,
        skipFonts: false,
        backgroundColor: "#1A1A1A", // fallback noir au cas où
        // S'assurer que les dimensions sont respectées
        style: {
          width: `${width}px`,
          height: `${height}px`,
        },
      });

      // Convertir data-URL → Blob → ajouter au ZIP
      const base64 = dataUrl.split(",")[1];
      const filename = `slide-${String(i + 1).padStart(2, "0")}.png`;
      folder.file(filename, base64, { base64: true });
    } catch (err: any) {
      console.error(`[Export] Erreur capture slide ${i + 1}:`, err);
      throw new Error(`Erreur capture slide ${i + 1} : ${err.message || err}`);
    }
  }

  // Étape 3 : Génération du ZIP
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