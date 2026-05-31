"use client";

import { Loader2, Check, AlertCircle } from "lucide-react";

type Seg = { start: number; end: number; text: string };

type Props = {
  segments: Seg[];
  onChange: (segs: Seg[]) => void;
  readOnly?: boolean;
  saveStatus?: "idle" | "saving" | "saved" | "error";
};

function fmt(s: number) {
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export default function SubtitleEditor({ segments, onChange, readOnly, saveStatus = "idle" }: Props) {
  const update = (i: number, patch: Partial<Seg>) => {
    const next = segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  };

  if (segments.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-xs text-neutral-500">Lance la transcription dans la section 03 pour generer les sous-titres.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end h-4">
        {saveStatus === "saving" && <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Sauvegarde...</span>}
        {saveStatus === "saved" && <span className="text-[10px] font-bold text-green-600 flex items-center gap-1"><Check size={10} /> Sauvegarde</span>}
        {saveStatus === "error" && <span className="text-[10px] font-bold text-red-600 flex items-center gap-1"><AlertCircle size={10} /> Erreur</span>}
      </div>

      {segments.map((seg, i) => (
        <div key={i} className="rounded-lg border border-neutral-200 bg-white p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <input
              type="number" step={0.1} min={0}
              value={Number(seg.start.toFixed(2))}
              disabled={readOnly}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) update(i, { start: Math.max(0, Math.min(v, seg.end)) }); }}
              className="w-16 px-1.5 py-1 rounded border border-neutral-200 text-[10px] tabular-nums outline-none focus:border-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400"
            />
            <span className="text-[10px] text-neutral-300">{">"}</span>
            <input
              type="number" step={0.1} min={0}
              value={Number(seg.end.toFixed(2))}
              disabled={readOnly}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) update(i, { end: Math.max(seg.start, v) }); }}
              className="w-16 px-1.5 py-1 rounded border border-neutral-200 text-[10px] tabular-nums outline-none focus:border-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400"
            />
            <span className="text-[9px] text-neutral-400 ml-auto tabular-nums">{fmt(seg.start)}-{fmt(seg.end)}</span>
          </div>
          <textarea
            value={seg.text}
            disabled={readOnly}
            onChange={(e) => update(i, { text: e.target.value })}
            rows={2}
            style={{ fontSize: "13px" }}
            className="w-full px-2 py-1.5 rounded border border-neutral-200 text-neutral-800 leading-snug outline-none focus:border-[#B11E2F] resize-none disabled:bg-neutral-50 disabled:text-neutral-500"
          />
        </div>
      ))}
    </div>
  );
}