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

const FORMAT_CONFIG: Record<VideoFormat, { fontSize: number; marginBottomPct: number; maxCharsPerLine: number; sideMarginPct: number }> = {
  "9_16": { fontSize: 72, marginBottomPct: 0.12, maxCharsPerLine: 22, sideMarginPct: 0.08 },
  "1_1":  { fontSize: 60, marginBottomPct: 0.12, maxCharsPerLine: 26, sideMarginPct: 0.07 },
  "16_9": { fontSize: 52, marginBottomPct: 0.12, maxCharsPerLine: 50, sideMarginPct: 0.06 },
};

function wrapTwoLines(text: string, maxChars: number): string[] {
  const clean = text.replace(/\\N/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(" ");
  if (words.length <= 1) return [clean];
  let best = -1;
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ");
    const l2 = words.slice(i).join(" ");
    if (l1.length > maxChars || l2.length > maxChars) continue;
    const score = Math.abs(l1.length - l2.length);
    if (score < bestScore) { bestScore = score; best = i; }
  }
  if (best > 0) return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
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
        const text = seg ? (seg.text || "").replace(/\s+/g, " ").trim() : "";
        if (text) {
          const scale = canvas.height / targetDims.height;
          let fontSize = Math.max(14, Math.round(config.fontSize * scale));
          ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";

          const lines = wrapTwoLines(text, config.maxCharsPerLine);
          const maxW = canvas.width * (1 - 2 * config.sideMarginPct);
          let widest = 0;
          for (const l of lines) { const w = ctx.measureText(l).width; if (w > widest) widest = w; }
          if (widest > maxW && widest > 0) {
            fontSize = Math.max(10, Math.floor(fontSize * (maxW / widest)));
            ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
          }

          const lineHeight = fontSize * 1.25;
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