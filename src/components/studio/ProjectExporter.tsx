"use client";

import { useEffect, useRef } from "react";
import SlideRenderer from "./SlideRenderer";
import { getResolvedInputs } from "@/lib/formatOverrides";
import { exportCarouselAsZip, downloadBlob } from "@/lib/exportCarousel";
import { toast } from "@/lib/toast";

// ============================================================
//  PROJECT EXPORTER — Export d'un carrousel SANS ouvrir l'editeur
//  Rend les slides hors-ecran (1 groupe par format) puis lance
//  exportCarouselAsZip et telecharge le ZIP, puis se demonte.
// ============================================================

type Props = {
  project: any;
  config: any;
  onDone: () => void;
};

export default function ProjectExporter({ project, config, onDone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const sj = project?.state_json || {};
  const slides: any[] = sj.slides || [];
  const primaryFormat: string = sj.templateKey || "carrousel_instagram";
  const rawFormats = sj.activeFormats || [primaryFormat];
  const activeFormats: string[] = (Array.isArray(rawFormats) ? rawFormats : [primaryFormat]).filter(
    (f: any) => typeof f === "string" && f.length > 0
  );
  const allTemplates: Record<string, any> = config?.exportTemplates || {};
  const title: string = project?.title || "carrousel";

  useEffect(() => {
    console.log("[Exporter] mount", { slides: slides.length, formats: activeFormats, hasConfig: !!config });
    let cancelled = false;

    (async () => {
      try {
        if (slides.length === 0) throw new Error("Aucune slide a exporter");
        // Laisser React rendre le container cache + les polices
        await new Promise((r) => setTimeout(r, 700));
        const container = containerRef.current;
        if (!container) throw new Error("Rendu d'export introuvable");
        console.log("[Exporter] groups", container.querySelectorAll("[data-export-format]").length, "slidesDOM", container.querySelectorAll("[data-export-slide]").length);

        console.log("[Exporter] exportCarouselAsZip START");
        const blob = await Promise.race([
          exportCarouselAsZip({ projectTitle: title, container, onProgress: (p) => console.log("[Exporter] progress", p) }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Timeout export (50s) - images trop lentes ?")), 50000)),
        ]);
        console.log("[Exporter] zip pret", blob.size);
        if (cancelled) return;

        const filename = `${title.replace(/[^a-zA-Z0-9-_]/g, "_")}.zip`;
        downloadBlob(blob, filename);
        console.log("[Exporter] download OK", filename, "size", blob.size);
        toast.success("Export termine", { description: "Le ZIP a ete telecharge." });
      } catch (err: any) {
        console.error("[Exporter] ERROR", err);
        if (!cancelled) toast.error("Export impossible", { description: err.message || String(err) });
      } finally {
        if (!cancelled) onDone();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[60] px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-lg flex items-center gap-2">
        <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        Export en cours...
      </div>

      <div
        ref={containerRef}
        style={{ position: "fixed", top: 0, left: -99999, opacity: 0, pointerEvents: "none", zIndex: -1 }}
        aria-hidden="true"
      >
        {activeFormats.map((fmt) => {
          const t = allTemplates[fmt];
          const fw = t?.dimensions?.width || t?.canvas?.widthPx || 1080;
          const fh = t?.dimensions?.height || t?.canvas?.heightPx || 1350;
          const flabel = t?.label || fmt;
          return (
            <div key={`fmt-${fmt}`} data-export-format={fmt} data-format-label={flabel} data-format-w={fw} data-format-h={fh}>
              {slides.map((slide: any, idx: number) => (
                <div
                  key={`exp-${fmt}-${slide.id}`}
                  data-export-slide
                  data-slide-index={idx}
                  style={{ width: fw, height: fh, backgroundColor: "#1A1A1A" }}
                >
                  <SlideRenderer
                    config={config}
                    variant={slide.variant}
                    subVariant={slide.subVariant}
                    inputValues={getResolvedInputs(slide, fmt)}
                    templateKey={fmt}
                    scale={1}
                    slide={slide}
                    activeFormat={fmt}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
