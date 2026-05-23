"use client";

import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { Film, ImageIcon as ImageLucide, Plus, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { VideoProject, BRoll } from "@/lib/video/types";

// ============================================================
//  Phase 12 - BrollsTimeline
//  Timeline visuelle horizontale avec b-rolls draggable + resizable
//  - Drag horizontal = repositionne dans le temps
//  - Resize handles = ajuste start_time / end_time
//  - Click bloc = seek video au start_time
//  - Snap par pas de 0.5s
//  - Playhead sync sur videoRef.currentTime via rAF
//  - Couleurs : bordeaux pour VIDEO, bleu pour IMAGE
// ============================================================

const BRAND_BORDEAUX = "#B11E2F";
const BLUE = "#3B82F6";
const TIMELINE_HEIGHT = 60; // px hauteur de la rangee b-rolls
const RULER_HEIGHT = 24; // px hauteur graduation
const SNAP_STEP_SEC = 0.5; // snap par 500ms
const PATCH_DEBOUNCE_MS = 400;

type Props = {
  project: VideoProject;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onProjectUpdated: () => void;
};

export default function BrollsTimeline({ project, videoRef, onProjectUpdated }: Props) {
  const brolls: BRoll[] = Array.isArray(project.state_json?.brolls)
    ? project.state_json.brolls
    : [];
  const sourceDuration = project.source_duration_seconds ?? 30;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const rafRef = useRef<number | null>(null);
  const patchTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ============================================================
  //  ResizeObserver pour containerWidth
  // ============================================================
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ============================================================
  //  rAF loop pour sync playhead
  // ============================================================
  useEffect(() => {
    const loop = () => {
      const video = videoRef.current;
      if (video) {
        setCurrentTime(video.currentTime);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef]);

  // ============================================================
  //  Helpers : conversion temps <-> pixels
  // ============================================================
  const secToPx = (sec: number) => {
    if (sourceDuration <= 0) return 0;
    return (sec / sourceDuration) * containerWidth;
  };
  const pxToSec = (px: number) => {
    if (containerWidth <= 0) return 0;
    return (px / containerWidth) * sourceDuration;
  };
  const snapSec = (sec: number) => Math.round(sec / SNAP_STEP_SEC) * SNAP_STEP_SEC;
  const formatTime = (sec: number) => {
    const mm = Math.floor(sec / 60);
    const ss = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}.${ms}`;
  };

  // ============================================================
  //  PATCH debounced : update b-roll timing dans l'API
  // ============================================================
  const patchBrollDebounced = (brollId: string, updates: Partial<BRoll>) => {
    const existing = patchTimers.current.get(brollId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(
          `/api/studio/video/projects/${project.id}/brolls/${brollId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(updates),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error("Erreur update b-roll", { description: data.error });
        } else {
          onProjectUpdated();
        }
      } catch (err: any) {
        toast.error("Erreur reseau", { description: err.message });
      }
    }, PATCH_DEBOUNCE_MS);

    patchTimers.current.set(brollId, timer);
  };

  // ============================================================
  //  Handlers : drag end + resize stop
  // ============================================================
  const handleDragStop = (broll: BRoll, newXpx: number) => {
    const newStart = snapSec(pxToSec(newXpx));
    const duration = broll.end_time - broll.start_time;
    const newEnd = newStart + duration;
    // Clamp dans la duree video
    const clampedStart = Math.max(0, Math.min(newStart, sourceDuration - duration));
    const clampedEnd = clampedStart + duration;

    patchBrollDebounced(broll.id, {
      start_time: clampedStart,
      end_time: clampedEnd,
    });
  };

  const handleResizeStop = (broll: BRoll, newXpx: number, newWidthPx: number) => {
    const newStart = snapSec(Math.max(0, pxToSec(newXpx)));
    const newEnd = snapSec(Math.min(sourceDuration, pxToSec(newXpx + newWidthPx)));
    if (newEnd <= newStart + 0.3) return; // duree minimum 0.3s

    patchBrollDebounced(broll.id, {
      start_time: newStart,
      end_time: newEnd,
    });
  };

  const handleBlockClick = (broll: BRoll) => {
    setSelectedId(broll.id);
    const video = videoRef.current;
    if (video) {
      video.currentTime = broll.start_time;
    }
  };

  // Phase 12 peaufinage #4 : Scrub video au click/drag sur la timeline (style Premiere/YouTube)
  const seekToMouseX = (clientX: number) => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;
    const rect = container.getBoundingClientRect();
    const xPx = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const sec = pxToSec(xPx);
    const clamped = Math.max(0, Math.min(sourceDuration, sec));
    video.currentTime = clamped;
    setSelectedId(null); // deselectionner les blocs en scrubbing
  };

  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignorer si l'event vient d'un bloc Rnd (b-roll)
    const target = e.target as HTMLElement;
    if (target.closest("[data-rnd-bloc]")) return;
    setIsScrubbing(true);
    seekToMouseX(e.clientX);
  };

  // Listener global pour suivre la souris meme hors container
  useEffect(() => {
    if (!isScrubbing) return;
    const handleMove = (e: MouseEvent) => seekToMouseX(e.clientX);
    const handleUp = () => setIsScrubbing(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrubbing, sourceDuration, containerWidth]);

  // ============================================================
  //  Render
  // ============================================================
  const totalHeight = RULER_HEIGHT + TIMELINE_HEIGHT;
  const playheadX = secToPx(currentTime);

  // Graduations : toutes les 5s par defaut, ou 1s si video courte
  const tickStep = sourceDuration < 30 ? 1 : sourceDuration < 90 ? 5 : 10;
  const ticks: number[] = [];
  for (let t = 0; t <= sourceDuration; t += tickStep) {
    ticks.push(t);
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-neutral-500" />
          <h3 className="text-sm font-bold text-neutral-900">Timeline B-Rolls</h3>
          <span className="text-[10px] text-neutral-400">
            ({brolls.length} bloc{brolls.length > 1 ? "s" : ""}, {formatTime(sourceDuration)})
          </span>
        </div>
        <div className="text-[10px] text-neutral-400">
          Drag pour deplacer · Resize bords pour ajuster
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseDown={handleContainerMouseDown}
        className="relative bg-neutral-50 rounded-lg border border-neutral-200 overflow-hidden select-none cursor-pointer"
        style={{ height: totalHeight }}
      >
        {containerWidth > 0 && (
          <>
            {/* Graduations + labels */}
            <div className="absolute left-0 top-0 right-0" style={{ height: RULER_HEIGHT }}>
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 flex flex-col items-start"
                  style={{ left: secToPx(t), transform: "translateX(-50%)" }}
                >
                  <span className="text-[9px] font-bold text-neutral-500 mt-1 ml-1 select-none">
                    {formatTime(t)}
                  </span>
                  <div className="w-px h-2 bg-neutral-300 absolute bottom-0 left-1/2" />
                </div>
              ))}
            </div>

            {/* Rail des brolls */}
            <div
              className="absolute left-0 right-0 bg-neutral-100 border-t border-neutral-200"
              style={{ top: RULER_HEIGHT, height: TIMELINE_HEIGHT }}
            />

            {/* Blocs b-rolls draggable */}
            {brolls.map((broll) => {
              const xPx = secToPx(broll.start_time);
              const widthPx = secToPx(broll.end_time - broll.start_time);
              const isVideo = broll.type === "video";
              const baseColor = isVideo ? BRAND_BORDEAUX : BLUE;
              const isSelected = selectedId === broll.id;

              return (
                <Rnd
                  key={broll.id}
                  size={{ width: widthPx, height: TIMELINE_HEIGHT - 8 }}
                  position={{ x: xPx, y: RULER_HEIGHT + 4 }}
                  bounds="parent"
                  enableResizing={{
                    left: true,
                    right: true,
                    top: false,
                    bottom: false,
                    topLeft: false,
                    topRight: false,
                    bottomLeft: false,
                    bottomRight: false,
                  }}
                  dragAxis="x"
                  onDragStop={(_e, data) => handleDragStop(broll, data.x)}
                  onResizeStop={(_e, _dir, ref, _delta, pos) => {
                    handleResizeStop(broll, pos.x, ref.offsetWidth);
                  }}
                  onClick={() => handleBlockClick(broll)}
                  style={{
                    backgroundColor: isSelected ? baseColor : `${baseColor}CC`,
                    border: `2px solid ${baseColor}`,
                    borderRadius: "6px",
                    boxShadow: isSelected ? `0 0 0 2px ${baseColor}40` : "none",
                    transition: "box-shadow 0.15s",
                    cursor: "grab",
                  }}
                  className="hover:opacity-90"
                  data-rnd-bloc="true"
                  resizeHandleStyles={{
                    left: { width: "8px", left: "-4px", cursor: "ew-resize" },
                    right: { width: "8px", right: "-4px", cursor: "ew-resize" },
                  }}
                >
                  <div className="w-full h-full flex items-center gap-1 px-2 text-white overflow-hidden select-none pointer-events-none">
                    {isVideo ? <Film size={11} /> : <ImageLucide size={11} />}
                    <span className="text-[10px] font-bold truncate flex-1">
                      {broll.filename}
                    </span>
                    <span className="text-[9px] opacity-80 whitespace-nowrap">
                      {formatTime(broll.start_time)}-{formatTime(broll.end_time)}
                    </span>
                  </div>
                </Rnd>
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-10"
              style={{ left: playheadX, width: "2px", backgroundColor: BRAND_BORDEAUX }}
            >
              <div
                className="absolute -top-1 -left-1"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: `6px solid ${BRAND_BORDEAUX}`,
                }}
              />
            </div>
          </>
        )}

        {/* Empty state */}
        {brolls.length === 0 && containerWidth > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-xs text-neutral-400 flex items-center gap-2 mt-3">
              <Plus size={12} />
              Aucun b-roll. Utilisez le panneau d'upload ci-dessous.
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <div className="mt-2 text-[10px] text-neutral-500">
          B-roll selectionne · clic ailleurs pour deselectionner
        </div>
      )}
    </div>
  );
}