// ============================================================
//  Types TypeScript pour le module vidéo BrandLock.
//  Mirrors la structure des tables Supabase.
// ============================================================

// ============================================================
//  ENUMS (matches les types Postgres)
// ============================================================

// Phase 8 : 4 modes actifs (UI). 3 legacy gardés pour anciens projets.
export type VideoMode =
  | "voice_off"      // legacy
  | "interview"      // legacy
  | "event"          // legacy
  | "studio_clean"   // Phase 8 - Interview voix claire studio
  | "voice_music"    // Phase 8 - Podcast voix + musique
  | "field_event"    // Phase 8 - Event terrain bruyant
  | "premium_demux"; // Phase 8 - Audio difficile, démixage IA

export type ActiveVideoMode =
  | "studio_clean"
  | "voice_music"
  | "field_event"
  | "premium_demux";

export type VideoFormat = "9_16" | "1_1" | "16_9";

export type VideoStatus =
  | "draft"
  | "uploaded"
  | "transcribed"
  | "composing"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "rendering"
  | "completed"
  | "failed"
  | "archived";

export type RenderJobType = "extract_audio" | "transcribe" | "render_final";

export type RenderJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

// ============================================================
//  MAIN MODEL : VideoProject
// ============================================================

export type VideoProject = {
  id: string;
  tenant_id: string;
  created_by: string;

  title: string;
  mode: VideoMode;
  format: VideoFormat;
  status: VideoStatus;

  source_video_url: string | null;
  source_audio_url: string | null;
  source_duration_seconds: number | null;
  source_format: string | null;
  source_dimensions: { width: number; height: number } | null;
  source_size_bytes: number | null;
  thumbnail_url: string | null;

  state_json: VideoStateJson;

  output_video_url: string | null;
  output_srt_url: string | null;
  output_size_bytes: number | null;

  // Phase 4+5 — rendu final
  final_video_url: string | null;
  render_settings: Record<string, unknown> | null;

  task_id: string | null;

  created_at: string;
  updated_at: string;
  uploaded_at: string | null;
  transcribed_at: string | null;
  rendered_at: string | null;
  archived_at: string | null;
};

// ============================================================
//  STATE JSON (évolue avec les phases)
// ============================================================

export type VideoStateJson = {
  transcript?: {
    raw?: string;
    edited?: string;
    segments?: TranscriptSegment[];
    language?: string;
    duration_seconds?: number;
    sanitized_at?: string;
    applied_replacements_count?: number;
    edited_at?: string;
  };

  // === Phase 6A : Voice-Off ===
  voiceover_audio?: VoiceoverAudio;
  audio_mix?: AudioMix;

  // === Phase 6B : B-rolls overlay ===
  brolls?: BRoll[];

  slides?: VoiceOffSlide[];

  framing?: {
    x_offset?: number;
    y_offset?: number;
    scale?: number;
  };

  intro_id?: string;
  intro_background_id?: string;        // ⭐ Phase 7.5 : BG variant sélectionnée
  outro_id?: string;
  outro_background_id?: string;        // ⭐ Phase 7.5 : BG variant sélectionnée
  background_music_id?: string;
  color_grading_lut_id?: string;

  subtitle_overrides?: Partial<SubtitleStyle>;
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

// === Phase 6A : Voice-Off audio overlay ===
export type VoiceoverAudio = {
  url: string;
  filename: string;
  duration_seconds: number;
  size_bytes: number;
  mime_type: string;
  uploaded_at: string;
};

export type AudioMix = {
  main_volume: number;       // 0.0 - 1.0 (volume audio original)
  voiceover_volume: number;  // 0.0 - 1.0 (volume voix-off)
};

// === Phase 6B : B-rolls overlay video/image ===
export type BRollType = "video" | "image";

export type BRollPosition =
  | "fullscreen"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export type BRoll = {
  id: string;                    // uuid client-generated
  type: BRollType;
  url: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  duration_seconds: number;      // pour images : durée d'affichage (default 3s)
  start_time: number;            // début dans la vidéo principale (sec)
  end_time: number;              // fin dans la vidéo principale (sec)
  position: BRollPosition;       // emplacement à l'écran
  scale: number;                 // 0.1 - 1.0 (fullscreen = 1.0, sinon ~0.3)
  uploaded_at: string;
};

export type VoiceOffSlide = {
  id: string;
  start: number;
  end: number;
  text: string;
  broll?: {
    type: "image" | "video";
    url: string;
    position?: { x: number; y: number; scale: number };
  };
};

export type SubtitleStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  position: "top" | "bottom" | "center";
  marginBottom: number;
  padding: number;
  lineHeight: number;
  letterSpacing: number;
};

// ============================================================
//  TENANT VIDEO TEMPLATE
// ============================================================

export type VideoTemplate = {
  dimensions: { width: number; height: number };
  fps: number;
  allowedModes: VideoMode[];
  intros: string[];
  outros: string[];
  audioBrandJingle: string | null;
  colorGradingLUT: string | null;
  subtitleStyle: SubtitleStyle;
};

export type TenantVideoConfig = {
  video_story_9_16?: VideoTemplate;
  video_square_1_1?: VideoTemplate;
  video_landscape_16_9?: VideoTemplate;
};

// ============================================================
//  RENDER JOB
// ============================================================

export type RenderJob = {
  id: string;
  project_id: string;
  job_type: RenderJobType;
  status: RenderJobStatus;
  payload: Record<string, any>;
  progress_percent: number;
  progress_message: string | null;
  estimated_seconds_remaining: number | null;
  result_data: Record<string, any> | null;
  error_message: string | null;
  worker_id: string | null;
  attempts: number;
  max_attempts: number;
  locked_until: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

// ============================================================
//  API REQUEST/RESPONSE TYPES
// ============================================================

export type CreateVideoProjectPayload = {
  title: string;
  mode: VideoMode;
  format: VideoFormat;
  task_id?: string;
};

export type UpdateVideoProjectPayload = Partial<{
  title: string;
  source_video_url: string;
  source_audio_url: string;
  source_duration_seconds: number;
  source_format: string;
  source_dimensions: { width: number; height: number };
  source_size_bytes: number;
  thumbnail_url: string;
  status: VideoStatus;
  state_json: VideoStateJson;
  task_id: string | null;
}>;

export type UploadSignedUrlResponse = {
  uploadUrl: string;
  path: string;
  token: string;
};

// ============================================================
//  CONSTANTS
// ============================================================

export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;          // 500 MB
export const MAX_VIDEO_DURATION_SECONDS = 300;                  // 5 min

export const MAX_VOICEOVER_SIZE_BYTES = 50 * 1024 * 1024;       // 50 MB
export const MAX_VOICEOVER_DURATION_SECONDS = 600;              // 10 min

export const DEFAULT_MAIN_VOLUME_WITH_VOICEOVER = 0.25;         // baisse audio original quand voice-off active
export const DEFAULT_MAIN_VOLUME_WITHOUT_VOICEOVER = 1.0;
export const DEFAULT_VOICEOVER_VOLUME = 1.0;

// === Phase 6B : B-rolls constants ===
export const MAX_BROLL_SIZE_BYTES = 100 * 1024 * 1024;          // 100 MB par b-roll
export const MAX_BROLL_DURATION_SECONDS = 60;                   // 1 min par b-roll
export const DEFAULT_IMAGE_DURATION_SECONDS = 3;                // image affichée 3s par défaut
export const DEFAULT_BROLL_SCALE = 0.3;                         // 30% scale (overlay coin)
export const DEFAULT_BROLL_POSITION = "bottom-right" as const;

export const ACCEPTED_BROLL_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
] as const;

export const ACCEPTED_BROLL_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const ACCEPTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
] as const;

export const ACCEPTED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",         // Variante MP3 (Windows surtout)
  "audio/wav",
  "audio/wave",        // Variante WAV
  "audio/x-wav",       // Variante WAV
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",         // Variante M4A
  "audio/aac",         // AAC compatible
] as const;

export const VIDEO_FORMAT_DIMENSIONS: Record<VideoFormat, { width: number; height: number; label: string }> = {
  "9_16": { width: 1080, height: 1920, label: "Vertical (Reels, Stories)" },
  "1_1": { width: 1080, height: 1080, label: "Carré (Posts Insta)" },
  "16_9": { width: 1920, height: 1080, label: "Horizontal (YouTube, LinkedIn)" },
};

import { Mic, Music, Building2, Gem, type LucideIcon } from "lucide-react";

// ============================================================
//  Phase 8 - 4 thèmes audio orientés CLIENT
//  Le worker s'adapte automatiquement selon le mode choisi.
//  Labels parlants vs noms techniques internes.
// ============================================================
export const VIDEO_MODE_INFO: Record<
  ActiveVideoMode,
  { label: string; description: string; icon: LucideIcon; longHint: string }
> = {
  studio_clean: {
    label: "Interview",
    description: "Voix claire, studio ou booth",
    icon: Mic,
    longHint: "Interview en intérieur calme, voix-off enregistrée, podcast pro",
  },
  voice_music: {
    label: "Podcast",
    description: "Voix sur fond musical",
    icon: Music,
    longHint: "Communication institutionnelle, social media avec musique d'ambiance",
  },
  field_event: {
    label: "Event",
    description: "Reportage extérieur, terrain bruyant",
    icon: Building2,
    longHint: "Conférence avec foule, rue, événement, vent, drone",
  },
  premium_demux: {
    label: "Audio difficile",
    description: "Démixage IA, qualité max (+30s)",
    icon: Gem,
    longHint: "Voix très faible vs musique forte, audio dégradé, captation distante",
  },
};

// ============================================================
//  Map complet (Phase 8 actifs + legacy) - utilise partout
//  ou on lit project.mode pour gerer les anciens projets
//  en voice_off/interview/event.
// ============================================================
export const VIDEO_MODE_INFO_FULL: Record<VideoMode, typeof VIDEO_MODE_INFO[ActiveVideoMode]> = {
  ...VIDEO_MODE_INFO,
  voice_off: VIDEO_MODE_INFO.studio_clean,
  interview: VIDEO_MODE_INFO.studio_clean,
  event: VIDEO_MODE_INFO.field_event,
};

export const TEMPLATE_KEY_BY_FORMAT: Record<VideoFormat, string> = {
  "9_16": "video_story_9_16",
  "1_1": "video_square_1_1",
  "16_9": "video_landscape_16_9",
};