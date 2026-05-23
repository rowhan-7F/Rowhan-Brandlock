"use client";

import { useEffect, useRef, useState } from "react";
import { VideoFormat, TranscriptSegment, VIDEO_FORMAT_DIMENSIONS } from "@/lib/video/types";

// ============================================================
//  Phase 11 - VideoSubsPreview
//  Player video HTML5 + canvas overlay qui dessine les subs
//  en temps reel selon currentTime. Match du style .ass genere
//  par le worker (font Arial, blanc + outline noir, position bas).
// ============================================================

type Props = {
  videoUrl: string | null;
  segments: TranscriptSegment[];
  format: VideoFormat;
  externalVideoRef?: React.RefObject<HTMLVideoElement | null>;
};

// Config style subs par format (match generateAss.ts cote worker)
const FORMAT_CONFIG: Record<VideoFormat, {
  fontSize: number;
  marginBottomPct: number; // pct de la hauteur video
  maxCharsPerLine: number;
}> = {
  "9_16": { fontSize: 56, marginBottomPct: 0.12, maxCharsPerLine: 26 },
  "1_1":  { fontSize: 42, marginBottomPct: 0.12, maxCharsPerLine: 30 },
  "16_9": { fontSize: 52, marginBottomPct: 0.12, maxCharsPerLine: 60 },
};

export default function VideoSubsPreview({ videoUrl, segments, format, externalVideoRef }: Props) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const [activeSubText, setActiveSubText] = useState<string>("");
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const targetDims = VIDEO_FORMAT_DIMENSIONS[format];
  const aspectRatio = targetDims.width / targetDims.height;

  // ============================================================
  //  Resize observer : reactualise les dimensions du canvas
  //  quand le container change (responsive)
  // ============================================================
  useEffect(() => {
    if (!containerRef.current) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      setContainerSize({ width: rect.width, height: rect.height });
    });

    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ============================================================
  //  Sync canvas size avec video display size
  // ============================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const updateCanvasSize = () => {
      // Le canvas doit matcher la taille du <video> dans le viewport
      // (pas la taille reelle du fichier video)
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    updateCanvasSize();
    video.addEventListener("loadedmetadata", updateCanvasSize);
    return () => video.removeEventListener("loadedmetadata", updateCanvasSize);
  }, [containerSize]);

  // ============================================================
  //  rAF loop : detecte le segment actif et redraw canvas
  // ============================================================
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const config = FORMAT_CONFIG[format];

    const drawSubtitle = (text: string) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!text) return;

      // Scale du fontSize selon la hauteur du canvas vs hauteur ref
      // Ref : 1080px de hauteur (FullHD) = fontSize du config
      // Si canvas plus petit : on reduit proportionnellement
      const scale = canvas.height / 1080;
      const fontSize = Math.max(14, Math.round(config.fontSize * scale));

      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      // Wrap : split en 2 lignes max si depasse maxCharsPerLine
      const lines = wrapTextTwoLines(text, config.maxCharsPerLine);

      const x = canvas.width / 2;
      const lineHeight = fontSize * 1.25;
      const marginBottom = canvas.height * config.marginBottomPct;
      let y = canvas.height - marginBottom;

      // Dessine de bas en haut (textBaseline = bottom)
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];

        // Outline noir epais (effet "stroke")
        ctx.strokeStyle = "#000";
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.10));
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(line, x, y);

        // Fill blanc
        ctx.fillStyle = "#fff";
        ctx.fillText(line, x, y);

        y -= lineHeight;
      }
    };

    const loop = () => {
      const t = video.currentTime;
      const activeSeg = segments.find((s) => t >= s.start && t < s.end);
      const text = activeSeg ? activeSeg.text.trim() : "";

      // Update state si change (evite re-renders inutiles)
      if (text !== activeSubText) {
        setActiveSubText(text);
      }

      drawSubtitle(text);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [segments, format, activeSubText]);

  if (!videoUrl) {
    return (
      <div className="bg-neutral-900 rounded-lg flex items-center justify-center text-neutral-500 text-sm" style={{ aspectRatio: aspectRatio }}>
        Pas de source video
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-lg overflow-hidden"
      style={{ aspectRatio: aspectRatio }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      {segments.length > 0 && (
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded">
          PREVIEW SUBS LIVE - {segments.length} segments
        </div>
      )}
    </div>
  );
}

// ============================================================
//  Helper : wrap text en 2 lignes max
//  Reprend la logique de wrapToTwoLines du worker generateAss.ts
// ============================================================
function wrapTextTwoLines(text: string, maxCharsPerLine: number): string[] {
  const clean = text.replace(/\\N/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= maxCharsPerLine) return [clean];

  const words = clean.split(" ");
  if (words.length <= 1) return [clean];

  // Split equilibre au mot
  let bestSplit = -1;
  let bestScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    const line1 = words.slice(0, i).join(" ");
    const line2 = words.slice(i).join(" ");
    if (line1.length > maxCharsPerLine || line2.length > maxCharsPerLine) continue;

    const score = Math.abs(line1.length - line2.length);
    if (score < bestScore) {
      bestScore = score;
      bestSplit = i;
    }
  }

  if (bestSplit > 0) {
    return [
      words.slice(0, bestSplit).join(" "),
      words.slice(bestSplit).join(" "),
    ];
  }

  // Fallback : tout sur 1 ligne (sera tronque visuellement si besoin)
  return [clean];
}