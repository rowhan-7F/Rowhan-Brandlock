"use client";

import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { Film, ImageIcon as ImageLucide, Clock, Music } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { VideoProject, BRoll } from "@/lib/video/types";

type Seg = { start: number; end: number; text: string };

const BRAND_BORDEAUX = "#B11E2F";
const BLUE = "#3B82F6";
const SUB_COLOR = "#6366F1";
const RULER_HEIGHT = 22;
const SUB_RAIL = 42;
const EL_RAIL = 56;
const MUSIC_RAIL = 34;
const SNAP_STEP_SEC = 0.5;
const PATCH_DEBOUNCE_MS = 400;

type Props = {
  project: VideoProject;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  segments: Seg[];
  onSegmentsChange: (segs: Seg[]) => void;
  readOnly?: boolean;
  onProjectUpdated: () => void;
};

export default function MediaTimeline({ project, videoRef, segments, onSegmentsChange, readOnly, onProjectUpdated }: Props) {
  const brolls: BRoll[] = Array.isArray(project.state_json?.brolls) ? project.state_json.brolls : [];
  const sourceDuration = project.source_duration_seconds ?? 30;
  const musicAudio: any = (project.state_json as any)?.music_audio || null;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [selectedBroll, setSelectedBroll] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const rafRef = useRef<number | null>(null);
  const patchTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const loop = () => {
      const v = videoRef.current;
      if (v) setCurrentTime(v.currentTime);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [videoRef]);

  const secToPx = (sec: number) => (sourceDuration <= 0 ? 0 : (sec / sourceDuration) * containerWidth);
  const pxToSec = (px: number) => (containerWidth <= 0 ? 0 : (px / containerWidth) * sourceDuration);
  const snapSec = (sec: number) => Math.round(sec / SNAP_STEP_SEC) * SNAP_STEP_SEC;
  const formatTime = (sec: number) => {
    const mm = Math.floor(sec / 60);
    const ss = Math.floor(sec % 60);
    return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  };

  const patchBrollDebounced = (brollId: string, updates: Partial<BRoll>) => {
    const existing = patchTimers.current.get(brollId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`/api/studio/video/projects/${project.id}/brolls/${brollId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          toast.error("Erreur update element", { description: d.error });
        } else {
          onProjectUpdated();
        }
      } catch (err: any) {
        toast.error("Erreur reseau", { description: err.message });
      }
    }, PATCH_DEBOUNCE_MS);
    patchTimers.current.set(brollId, timer);
  };

  const brollDragStop = (b: BRoll, newXpx: number) => {
    const dur = b.end_time - b.start_time;
    const start = Math.max(0, Math.min(snapSec(pxToSec(newXpx)), sourceDuration - dur));
    patchBrollDebounced(b.id, { start_time: start, end_time: start + dur });
  };
  const brollResizeStop = (b: BRoll, newXpx: number, newWpx: number) => {
    const start = snapSec(Math.max(0, pxToSec(newXpx)));
    const end = snapSec(Math.min(sourceDuration, pxToSec(newXpx + newWpx)));
    if (end <= start + 0.3) return;
    patchBrollDebounced(b.id, { start_time: start, end_time: end });
  };

  const updateSeg = (i: number, patch: Partial<Seg>) => {
    onSegmentsChange(segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const subDragStop = (i: number, seg: Seg, newXpx: number) => {
    const dur = seg.end - seg.start;
    const start = Math.max(0, Math.min(snapSec(pxToSec(newXpx)), sourceDuration - dur));
    updateSeg(i, { start, end: start + dur });
  };
  const subResizeStop = (i: number, newXpx: number, newWpx: number) => {
    const start = snapSec(Math.max(0, pxToSec(newXpx)));
    const end = snapSec(Math.min(sourceDuration, pxToSec(newXpx + newWpx)));
    if (end <= start + 0.3) return;
    updateSeg(i, { start, end });
  };

  const seekToMouseX = (clientX: number) => {
    const c = containerRef.current; const v = videoRef.current;
    if (!c || !v) return;
    const rect = c.getBoundingClientRect();
    const xPx = Math.max(0, Math.min(rect.width, clientX - rect.left));
    v.currentTime = Math.max(0, Math.min(sourceDuration, pxToSec(xPx)));
  };
  const onContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-rnd-bloc]")) return;
    setSelectedSub(null); setSelectedBroll(null);
    setIsScrubbing(true);
    seekToMouseX(e.clientX);
  };
  useEffect(() => {
    if (!isScrubbing) return;
    const move = (e: MouseEvent) => seekToMouseX(e.clientX);
    const up = () => setIsScrubbing(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrubbing, sourceDuration, containerWidth]);

  const totalHeight = RULER_HEIGHT + SUB_RAIL + EL_RAIL + MUSIC_RAIL;
  const playheadX = secToPx(currentTime);
  const tickStep = sourceDuration < 30 ? 5 : sourceDuration < 90 ? 10 : 15;
  const ticks: number[] = [];
  for (let t = 0; t <= sourceDuration; t += tickStep) ticks.push(t);
  const resizeOpt = (on: boolean) => ({ left: on, right: on, top: false, bottom: false, topLeft: false, topRight: false, bottomLeft: false, bottomRight: false });

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-neutral-500" />
          <h3 className="text-sm font-bold text-neutral-900">Timeline</h3>
          <span className="text-[10px] text-neutral-400">({formatTime(sourceDuration)})</span>
        </div>
        <div className="text-[10px] text-neutral-400">{readOnly ? "Lecture seule" : "Glisser / redimensionner les blocs"}</div>
      </div>

      <div
        ref={containerRef}
        onMouseDown={onContainerMouseDown}
        className="relative bg-neutral-50 rounded-lg border border-neutral-200 overflow-hidden select-none cursor-pointer"
        style={{ height: totalHeight }}
      >
        {containerWidth > 0 && (
          <>
            <div className="absolute left-0 top-0 right-0" style={{ height: RULER_HEIGHT }}>
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 bottom-0" style={{ left: secToPx(t), transform: "translateX(-50%)" }}>
                  <span className="text-[9px] font-bold text-neutral-400 ml-1 select-none">{formatTime(t)}</span>
                </div>
              ))}
            </div>

            <div className="absolute left-0 right-0 bg-indigo-50/40 border-t border-neutral-200" style={{ top: RULER_HEIGHT, height: SUB_RAIL }} />
            <div className="absolute left-0 right-0 bg-neutral-100 border-t border-neutral-200" style={{ top: RULER_HEIGHT + SUB_RAIL, height: EL_RAIL }} />
            <span className="absolute left-1 text-[8px] font-black uppercase tracking-wider text-indigo-300 pointer-events-none" style={{ top: RULER_HEIGHT + 2 }}>Sous-titres</span>
            <span className="absolute left-1 text-[8px] font-black uppercase tracking-wider text-neutral-300 pointer-events-none" style={{ top: RULER_HEIGHT + SUB_RAIL + 2 }}>Elements</span>
            <div className="absolute left-0 right-0 bg-amber-50/40 border-t border-neutral-200" style={{ top: RULER_HEIGHT + SUB_RAIL + EL_RAIL, height: MUSIC_RAIL }} />
            <span className="absolute left-1 text-[8px] font-black uppercase tracking-wider text-amber-300 pointer-events-none" style={{ top: RULER_HEIGHT + SUB_RAIL + EL_RAIL + 2 }}>Musique</span>
            {musicAudio && (
              <div className="absolute rounded-md flex items-center gap-1 px-2 overflow-hidden" style={{ left: 2, right: 2, top: RULER_HEIGHT + SUB_RAIL + EL_RAIL + 6, height: MUSIC_RAIL - 12, backgroundColor: "#F59E0BCC", border: "1.5px solid #F59E0B" }}>
                <Music size={10} className="text-white shrink-0" />
                <span className="text-[9px] font-bold text-white truncate">{musicAudio.filename}</span>
              </div>
            )}

            {segments.map((seg, i) => {
              const xPx = secToPx(seg.start);
              const wPx = Math.max(8, secToPx(seg.end - seg.start));
              const sel = selectedSub === i;
              return (
                <Rnd
                  key={`sub-${i}`}
                  size={{ width: wPx, height: SUB_RAIL - 10 }}
                  position={{ x: xPx, y: RULER_HEIGHT + 5 }}
                  bounds="parent"
                  enableResizing={resizeOpt(!readOnly)}
                  disableDragging={!!readOnly}
                  dragAxis="x"
                  onDragStop={(_e, d) => subDragStop(i, seg, d.x)}
                  onResizeStop={(_e, _dir, ref, _delta, pos) => subResizeStop(i, pos.x, ref.offsetWidth)}
                  onClick={() => { setSelectedSub(i); const v = videoRef.current; if (v) v.currentTime = seg.start; }}
                  style={{ backgroundColor: sel ? SUB_COLOR : `${SUB_COLOR}CC`, border: `1.5px solid ${SUB_COLOR}`, borderRadius: "5px", cursor: readOnly ? "pointer" : "grab" }}
                  data-rnd-bloc="true"
                  resizeHandleStyles={{ left: { width: "8px", left: "-4px", cursor: "ew-resize" }, right: { width: "8px", right: "-4px", cursor: "ew-resize" } }}
                >
                  <div className="w-full h-full flex items-center px-1.5 text-white overflow-hidden select-none pointer-events-none">
                    <span className="text-[9px] font-bold truncate">{seg.text}</span>
                  </div>
                </Rnd>
              );
            })}

            {brolls.map((b) => {
              const xPx = secToPx(b.start_time);
              const wPx = Math.max(8, secToPx(b.end_time - b.start_time));
              const isVideo = b.type === "video";
              const color = isVideo ? BRAND_BORDEAUX : BLUE;
              const sel = selectedBroll === b.id;
              return (
                <Rnd
                  key={`broll-${b.id}`}
                  size={{ width: wPx, height: EL_RAIL - 12 }}
                  position={{ x: xPx, y: RULER_HEIGHT + SUB_RAIL + 6 }}
                  bounds="parent"
                  enableResizing={resizeOpt(!readOnly)}
                  disableDragging={!!readOnly}
                  dragAxis="x"
                  onDragStop={(_e, d) => brollDragStop(b, d.x)}
                  onResizeStop={(_e, _dir, ref, _delta, pos) => brollResizeStop(b, pos.x, ref.offsetWidth)}
                  onClick={() => { setSelectedBroll(b.id); const v = videoRef.current; if (v) v.currentTime = b.start_time; }}
                  style={{ backgroundColor: sel ? color : `${color}CC`, border: `2px solid ${color}`, borderRadius: "6px", cursor: readOnly ? "pointer" : "grab" }}
                  data-rnd-bloc="true"
                  resizeHandleStyles={{ left: { width: "8px", left: "-4px", cursor: "ew-resize" }, right: { width: "8px", right: "-4px", cursor: "ew-resize" } }}
                >
                  <div className="w-full h-full flex items-center gap-1 px-2 text-white overflow-hidden select-none pointer-events-none">
                    {isVideo ? <Film size={11} /> : <ImageLucide size={11} />}
                    <span className="text-[10px] font-bold truncate flex-1">{b.filename}</span>
                  </div>
                </Rnd>
              );
            })}

            <div className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: playheadX, width: "2px", backgroundColor: BRAND_BORDEAUX }}>
              <div className="absolute -top-1 -left-1" style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `6px solid ${BRAND_BORDEAUX}` }} />
            </div>
          </>
        )}

        {segments.length === 0 && brolls.length === 0 && !musicAudio && containerWidth > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-xs text-neutral-400">Transcris (section 03) et ajoute des elements (section 05)</div>
          </div>
        )}
      </div>
    </div>
  );
}