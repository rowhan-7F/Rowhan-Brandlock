"use client";

import { useEffect, useRef } from "react";
import { VideoFormat, TranscriptSegment, VIDEO_FORMAT_DIMENSIONS } from "@/lib/video/types";

type Props = {
  videoUrl: string | null;
  segments: TranscriptSegment[];
  format: VideoFormat;
  externalVideoRef?: React.RefObject<HTMLVideoElement | null>;
  subsBurnedIn?: boolean;
};

// Taille FIXE + marge laterale en %.
const FORMAT_CONFIG: Record<VideoFormat, { fontSize: number; marginBottomPct: number; sideMarginPct: number }> = {
  "9_16": { fontSize: 36, marginBottomPct: 0.12, sideMarginPct: 0.06 },
  "1_1":  { fontSize: 30, marginBottomPct: 0.12, sideMarginPct: 0.06 },
  "16_9": { fontSize: 26, marginBottomPct: 0.12, sideMarginPct: 0.06 },
};

// Coupe le texte en lignes EQUILIBREES : au plus proche du milieu, et si une
// ponctuation (, . ; : ! ?) finit un mot a +-2 mots du milieu, on coupe la.
function balancedWrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (ctx.measureText(clean).width <= maxWidth) return [clean];

  const words = clean.split(/\s+/);
  if (words.length < 2) return [clean];

  const spaceW = ctx.measureText(" ").width;
  const cum: number[] = [];
  let acc = 0;
  for (let i = 0; i < words.length; i++) {
    acc += (i === 0 ? 0 : spaceW) + ctx.measureText(words[i]).width;
    cum[i] = acc;
  }
  const half = cum[words.length - 1] / 2;

  // 1) frontiere de mot la plus proche du milieu (equilibre)
  let bestIdx = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < words.length - 1; i++) {
    const d = Math.abs(cum[i] - half);
    if (d < bestDelta) { bestDelta = d; bestIdx = i; }
  }

  // 2) snap sur une ponctuation a +-2 mots du milieu si elle existe
  let cutIdx = bestIdx;
  if (!/[,.;:!?]$/.test(words[bestIdx])) {
    let snapped = -1;
    for (let off = 1; off <= 2 && snapped < 0; off++) {
      for (const j of [bestIdx - off, bestIdx + off]) {
        if (j >= 0 && j < words.length - 1 && /[,.;:!?]$/.test(words[j])) { snapped = j; break; }
      }
    }
    if (snapped >= 0) cutIdx = snapped;
  }

  const l1 = words.slice(0, cutIdx + 1).join(" ");
  const l2 = words.slice(cutIdx + 1).join(" ");
  return [...balancedWrap(ctx, l1, maxWidth), ...balancedWrap(ctx, l2, maxWidth)];
}

// Respecte les retours a la ligne manuels (\n), puis equilibre chaque morceau.
function layoutLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const forced = text.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  const out: string[] = [];
  for (const part of forced) out.push(...balancedWrap(ctx, part, maxWidth));
  return out.length ? out : [text.trim()];
}

export default function VideoSubsPreview({ videoUrl, segments, format, externalVideoRef, subsBurnedIn }: Props) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const segmentsRef = useRef<TranscriptSegment[]>(segments);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  const targetDims = VIDEO_FORMAT_DIMENSIONS[format];
  const aspectRatio = targetDims.width / targetDims.height;

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const config = FORMAT_CONFIG[format];

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cw = Math.max(1, Math.round(rect.width * dpr));
      const ch = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const segs = subsBurnedIn ? [] : segmentsRef.current;
      if (segs.length > 0 && rect.height > 1) {
        const t = video.currentTime;
        let seg = segs.find((s) => t >= s.start && t < s.end);
        if (!seg && video.paused) {
          seg = segs.reduce((b, s) => (Math.abs(s.start - t) < Math.abs(b.start - t) ? s : b), segs[0]);
        }
        const raw = seg ? (seg.text || "") : "";
        const text = raw.replace(/[^\S\n]+/g, " ").replace(/[ \t]*\n[ \t]*/g, "\n").trim();
        if (text) {
          const scale = canvas.height / targetDims.height;
          const fontSize = Math.max(14, Math.round(config.fontSize * scale));
          ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";

          const maxWidth = canvas.width * (1 - 2 * config.sideMarginPct);
          const lines = layoutLines(ctx, text, maxWidth);
          const lineHeight = fontSize * 1.28;
          const x = canvas.width / 2;
          const marginBottom = canvas.height * config.marginBottomPct;
          let y = canvas.height - marginBottom;
          for (let i = lines.length - 1; i >= 0; i--) {
            ctx.lineJoin = "round";
            ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.16));
            ctx.strokeStyle = "rgba(0,0,0,0.92)";
            ctx.strokeText(lines[i], x, y);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(lines[i], x, y);
            y -= lineHeight;
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [format, targetDims.height, videoRef, subsBurnedIn, videoUrl]);

  if (!videoUrl) {
    return (
      <div className="bg-neutral-900 rounded-lg flex items-center justify-center text-neutral-500 text-sm" style={{ aspectRatio }}>
        Pas de source video
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio }}>
      <video ref={videoRef} src={videoUrl} controls className="absolute inset-0 w-full h-full object-cover" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      {!subsBurnedIn && segments.length > 0 && (
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded">
          Sous-titres (live)
        </div>
      )}
    </div>
  );
}