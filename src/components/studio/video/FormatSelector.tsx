// ============================================================
//  Composant réutilisable pour choisir un format vidéo.
//  Phase 8 : 2 tiles (9:16 / 16:9). Carré 1:1 supprimé de l'UI.
//  Les anciens projets en 1:1 restent fonctionnels en DB.
// ============================================================

"use client";

import { VideoFormat, VIDEO_FORMAT_DIMENSIONS } from "@/lib/video/types";

type FormatSelectorProps = {
  value: VideoFormat;
  onChange: (format: VideoFormat) => void;
  disabled?: boolean;
};

const FORMATS: Array<{
  key: VideoFormat;
  label: string;
  shortLabel: string;
  iconRatio: { w: number; h: number };
}> = [
  { key: "9_16", label: "Vertical", shortLabel: "Reels / TikTok / Stories", iconRatio: { w: 9, h: 16 } },
  { key: "16_9", label: "Horizontal", shortLabel: "YouTube / Site / LinkedIn", iconRatio: { w: 16, h: 9 } },
];

export default function FormatSelector({ value, onChange, disabled }: FormatSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FORMATS.map((f) => {
        const selected = value === f.key;
        const dims = VIDEO_FORMAT_DIMENSIONS[f.key];

        const ICON_MAX = 36;
        const iconW = f.iconRatio.w >= f.iconRatio.h
          ? ICON_MAX
          : Math.round((f.iconRatio.w / f.iconRatio.h) * ICON_MAX);
        const iconH = f.iconRatio.h >= f.iconRatio.w
          ? ICON_MAX
          : Math.round((f.iconRatio.h / f.iconRatio.w) * ICON_MAX);

        const btnClass = "relative p-4 rounded-xl border-2 transition-all text-left " +
          (selected
            ? "border-[#B11E2F] bg-[#B11E2F]/5 ring-2 ring-[#B11E2F]/20"
            : "border-neutral-200 hover:border-neutral-300 bg-white") +
          " " +
          (disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer");

        const iconBoxClass = "border-2 rounded flex-shrink-0 " +
          (selected ? "border-[#B11E2F]" : "border-neutral-400");

        const labelClass = "text-xs font-black uppercase tracking-wider " +
          (selected ? "text-[#B11E2F]" : "text-neutral-900");

        return (
          <button
            key={f.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(f.key)}
            className={btnClass}
          >
            <div className="flex items-center gap-4">
              <div className={iconBoxClass} style={{ width: iconW, height: iconH }} />
              <div>
                <div className={labelClass}>{f.label}</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">{f.shortLabel}</div>
                <div className="text-[9px] text-neutral-400 mt-0.5">
                  {dims.width}x{dims.height}
                </div>
              </div>
            </div>

            {selected && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#B11E2F] flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}