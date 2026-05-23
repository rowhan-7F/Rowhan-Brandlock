"use client";

import { useState } from "react";
import {
  Mic, AudioLines, Sparkles, FileAudio, ChevronRight, Check,
} from "lucide-react";
import { VideoProject } from "@/lib/video/types";
import VoiceoverPanel from "./VoiceoverPanel";
import TranscriptPanel from "./TranscriptPanel";

// ============================================================
//  Phase 12.D - AudioSubsPanel
//  Fusion VoiceoverPanel + TranscriptPanel dans 1 drawer unifie.
//
//  Workflow :
//    1. User ajoute voix-off OU pas (optionnel)
//    2. Indication claire de la source qui sera transcrite
//       (voix-off prioritaire si presente, sinon audio video)
//    3. Click "Transcrire" -> background job
//    4. Edition du texte transcrit
//
//  Le worker auto-detecte la voix-off (Phase X1).
// ============================================================

type Props = {
  project: VideoProject;
  onProjectUpdated: () => void;
};

type ActiveSection = "voiceover" | "transcription";

const BRAND_BORDEAUX = "#B11E2F";

export default function AudioSubsPanel({ project, onProjectUpdated }: Props) {
  const [activeSection, setActiveSection] = useState<ActiveSection>("voiceover");

  const hasVoiceover = !!project.state_json?.voiceover_audio;
  const transcript = project.state_json?.transcript;
  const segmentsCount = Array.isArray(transcript?.segments) ? transcript.segments.length : 0;
  const hasTranscript = segmentsCount > 0;

  const transcriptionSource = hasVoiceover ? "Voix-off" : "Audio source video";

  return (
    <div className="space-y-4">
      {/* Status banner intelligent */}
      <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
          <Sparkles size={11} />
          Audio detecte pour transcription
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <FileAudio size={13} className="text-neutral-500 shrink-0" />
            {transcriptionSource}
            {hasVoiceover && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-black uppercase tracking-wider">
                PRIORITAIRE
              </span>
            )}
          </div>
          {hasTranscript && (
            <div className="flex items-center gap-1 text-[10px] text-green-700 font-bold shrink-0">
              <Check size={11} />
              {segmentsCount} segments
            </div>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        <TabButton
          active={activeSection === "voiceover"}
          onClick={() => setActiveSection("voiceover")}
          icon={<AudioLines size={13} />}
          label="Voix-off"
          subtitle={hasVoiceover ? "Active" : "Optionnel"}
          subtitleColor={hasVoiceover ? "green" : "neutral"}
        />
        <TabButton
          active={activeSection === "transcription"}
          onClick={() => setActiveSection("transcription")}
          icon={<Mic size={13} />}
          label="Transcription"
          subtitle={hasTranscript ? segmentsCount + " segments" : "Non lancee"}
          subtitleColor={hasTranscript ? "green" : "neutral"}
        />
      </div>

      {/* Content panel */}
      <div>
        {activeSection === "voiceover" && (
          <VoiceoverPanel project={project} onProjectUpdated={onProjectUpdated} />
        )}
        {activeSection === "transcription" && (
          <TranscriptPanel project={project} onProjectUpdated={onProjectUpdated} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, subtitle, subtitleColor = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  subtitleColor?: "neutral" | "green";
}) {
  const subtitleClass = subtitleColor === "green"
    ? "text-green-700"
    : "text-neutral-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={"flex-1 px-3 py-2.5 text-left transition border-b-2 -mb-px " + (active ? "border-[#B11E2F]" : "border-transparent hover:bg-neutral-50")}
    >
      <div className="flex items-center gap-1.5">
        <span className={active ? "text-[#B11E2F]" : "text-neutral-500"}>
          {icon}
        </span>
        <span className={"text-xs font-bold " + (active ? "text-neutral-900" : "text-neutral-600")}>
          {label}
        </span>
      </div>
      <div className={"text-[9px] font-bold uppercase tracking-wider mt-0.5 " + subtitleClass}>
        {subtitle}
      </div>
    </button>
  );
}