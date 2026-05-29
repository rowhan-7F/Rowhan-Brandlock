"use client";

import SlideRenderer from "./SlideRenderer";
import SafeZoneOverlay from "./SafeZoneOverlay";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { getDefaultSubVariant, getSubVariantConfig, variantLabel } from "@/lib/studioHelpers";
import { getResolvedInputs as getResolvedInputsFromHelper } from "@/lib/formatOverrides";

// ============================================================
//  SlidePreview - Phase 9.4.4
//  Carte de previsualisation d'une slide (extrait de page.tsx)
// ============================================================
export default function SlidePreview({
  slide, index, isOpen, brandColor, config, onClick,
  activeEditingFormat, allTemplates, safeZonesEnabled,
}: any) {
  const templateKey = activeEditingFormat || "carrousel_instagram"; // Sprint 3+4 : dynamique
  // Sprint 3+4 : dimensions dynamiques selon le format actif
  // Sprint 3+4 : le schema utilise dimensions.width/height (pas canvas.widthPx)
  const _tmpl = allTemplates?.[templateKey];
  const dim = _tmpl?.dimensions
    ? { widthPx: _tmpl.dimensions.width, heightPx: _tmpl.dimensions.height }
    : _tmpl?.canvas
      ? { widthPx: _tmpl.canvas.widthPx, heightPx: _tmpl.canvas.heightPx }
      : { widthPx: 1080, heightPx: 1350 };


  const subVariant = (slide as any).subVariant || getDefaultSubVariant(config, slide.variant);
  const subVariantConfig = getSubVariantConfig(config, slide.variant, subVariant);
  const review = (slide as any).review;

  const SCALE = 0.27;
  const FIXED_WIDTH = dim.widthPx * SCALE;
  const FIXED_HEIGHT = dim.heightPx * SCALE;

  const outline = review?.status === "ok"
    ? "3px solid #16a34a"
    : review?.status === "needs_changes"
      ? "3px solid #f59e0b"
      : "3px solid transparent";

      return (
        <div
          onClick={onClick}
          className={`rounded-2xl overflow-hidden bg-white shrink-0 transition-all cursor-pointer ${
            isOpen ? "shadow-xl scale-100" : "opacity-50 scale-[0.97] hover:opacity-75"
          }`}
          style={{
            width: FIXED_WIDTH,
              height: FIXED_HEIGHT + 24, // +24 pour le bandeau header de la slide
            outline,
            outlineOffset: "2px",
          }}
        >
      <div
        className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white truncate flex items-center justify-between"
        style={{ backgroundColor: brandColor, width: FIXED_WIDTH }}
        >
        <span className="truncate">
          {variantLabel(config, slide.variant)}
        </span>
        {review?.status === "ok" && <CheckCircle2 size={11} />}
        {review?.status === "needs_changes" && <AlertCircle size={11} />}
      </div>
      <div style={{ position: "relative", width: FIXED_WIDTH, height: FIXED_HEIGHT }}>
      <SlideRenderer
        config={config}
        variant={slide.variant}
        subVariant={subVariant}
        inputValues={getResolvedInputsFromHelper(slide as any, templateKey)}
        templateKey={templateKey}
        scale={SCALE}
          slide={slide as any}
            activeFormat={templateKey}
      />
        {safeZonesEnabled && (() => {
          const variantData = _tmpl?.slideVariants?.[slide.variant];
          const subVariantKey = (slide as any).subVariant || Object.keys(variantData?.subVariants || {})[0];
          const subVariantData = variantData?.subVariants?.[subVariantKey];
          const safeZones = subVariantData?.layoutRules?.safeZonesPx || { top: 60, left: 60, right: 60, bottom: 60 };
          return (
            <SafeZoneOverlay
              safeZonesPx={safeZones}
              canvasWidth={dim.widthPx}
              canvasHeight={dim.heightPx}
              scale={SCALE}
            />
          );
        })()}
      </div>
      {/* ⭐ Slide approuvée (status ok) */}
      {review?.status === "ok" && (
        <div className="px-3 py-2 bg-green-50 border-t border-green-200 flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-green-600 shrink-0" />
          <span className="font-bold uppercase tracking-wider text-[9px] text-green-700">
            Slide approuvée
          </span>
        </div>
      )}
      {/* À corriger (status needs_changes + commentaire) */}
      {review?.status === "needs_changes" && review.comment?.trim() && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-[10px] text-amber-900">
          <div className="font-bold uppercase tracking-wider text-[9px] text-amber-700 mb-0.5">
            ⚠ À corriger
          </div>
          {review.comment}
        </div>
      )}
    </div>
  );
}
