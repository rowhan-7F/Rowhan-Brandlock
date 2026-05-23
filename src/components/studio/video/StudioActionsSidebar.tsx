"use client";

import { Video, AudioLines, Film, Music } from "lucide-react";
import { VideoProject } from "@/lib/video/types";

// ============================================================
//  Phase 12.D - StudioActionsSidebar V2
//  4 boutons reorganises en logique business :
//    01. Source video    (upload + replace + metadata)
//    02. Audio & Subs    (fusion voix-off + transcription)
//    03. B-Rolls         (upload + gestion)
//    04. Musique         (background music)
//
//  Le bouton Rendu a ete deplace sous la timeline (RenderBar).
// ============================================================

const BRAND_BORDEAUX = "#B11E2F";

export type ActionKey = "source" | "audio" | "brolls" | "music";

type Props = {
  project: VideoProject;
  active: ActionKey | null;
  onSelect: (key: ActionKey) => void;
};

export default function StudioActionsSidebar({ project, active, onSelect }: Props) {
  const hasVoiceover = !!project.state_json?.voiceover_audio;
  const transcript = project.state_json?.transcript;
  const segmentsCount = Array.isArray(transcript?.segments) ? transcript.segments.length : 0;

  const brollsCount = Array.isArray(project.state_json?.brolls) ? project.state_json.brolls.length : 0;

  const hasMusic = !!project.state_json?.background_music_id;
  const hasSource = !!project.source_video_url;

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3">
      <ActionButton
        index="01"
        active={active === "source"}
        onClick={() => onSelect("source")}
        icon={<Video size={18} />}
        label="Source"
        badge={hasSource ? "OK" : null}
        badgeColor="green"
      />

      <ActionButton
        index="02"
        active={active === "audio"}
        onClick={() => onSelect("audio")}
        icon={<AudioLines size={18} />}
        label="Audio & Subs"
        badge={segmentsCount > 0 ? String(segmentsCount) : (hasVoiceover ? "VO" : null)}
        badgeColor={segmentsCount > 0 ? "green" : "neutral"}
      />

      <ActionButton
        index="03"
        active={active === "brolls"}
        onClick={() => onSelect("brolls")}
        icon={<Film size={18} />}
        label="B-Rolls"
        badge={brollsCount > 0 ? String(brollsCount) : null}
        badgeColor="neutral"
      />

      <ActionButton
        index="04"
        active={active === "music"}
        onClick={() => onSelect("music")}
        icon={<Music size={18} />}
        label="Musique"
        badge={hasMusic ? "ON" : null}
        badgeColor="neutral"
      />
    </div>
  );
}

function ActionButton({
  index, active, onClick, icon, label, badge, badgeColor,
}: {
  index: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge: string | null;
  badgeColor: "neutral" | "green" | "orange";
}) {
  const ringStyle = active
    ? { boxShadow: "0 0 0 3px " + BRAND_BORDEAUX }
    : {};

  const badgeClassMap = {
    neutral: "bg-neutral-900 text-white",
    green: "bg-green-500 text-white",
    orange: "bg-orange-500 text-white animate-pulse",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={index + " - " + label}
      className="group relative w-14 h-14 rounded-full bg-white shadow-md flex flex-col items-center justify-center text-neutral-700 hover:text-neutral-900 hover:shadow-lg transition-all hover:scale-105"
      style={ringStyle}
    >
      {/* Index micro top-left */}
      <span className="absolute top-1 left-2 text-[8px] font-black text-neutral-300 leading-none">
        {index}
      </span>

      {/* Icon */}
      <div className="relative z-10 mt-1">
        {icon}
      </div>

      {/* Badge */}
      {badge && (
        <span
          className={"absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center " + badgeClassMap[badgeColor]}
        >
          {badge}
        </span>
      )}

      {/* Tooltip */}
      <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {label}
      </span>
    </button>
  );
}