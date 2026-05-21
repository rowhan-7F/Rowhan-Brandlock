// ============================================================
//  Types TypeScript pour le module vidéo BrandLock.
//  Mirrors la structure des tables Supabase.
// ============================================================

// ============================================================
//  ENUMS (matches les types Postgres)
// ============================================================

export type VideoMode = "voice_off" | "interview" | "event";

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
  };

  slides?: VoiceOffSlide[];

  framing?: {
    x_offset?: number;
    y_offset?: number;
    scale?: number;
  };

  intro_id?: string;
  outro_id?: string;
  background_music_id?: string;
  color_grading_lut_id?: string;

  subtitle_overrides?: Partial<SubtitleStyle>;
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
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

export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
export const MAX_VIDEO_DURATION_SECONDS = 300; // 5 min

export const ACCEPTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
] as const;

export const ACCEPTED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/x-m4a",
] as const;

export const VIDEO_FORMAT_DIMENSIONS: Record<VideoFormat, { width: number; height: number; label: string }> = {
  "9_16": { width: 1080, height: 1920, label: "Vertical (Reels, Stories)" },
  "1_1": { width: 1080, height: 1080, label: "Carré (Posts Insta)" },
  "16_9": { width: 1920, height: 1080, label: "Horizontal (YouTube, LinkedIn)" },
};

export const VIDEO_MODE_INFO: Record<VideoMode, { label: string; description: string; icon: string }> = {
  voice_off: {
    label: "Voice-Off",
    description: "Audio + b-rolls assemblés",
    icon: "🎙",
  },
  interview: {
    label: "Interview",
    description: "Vidéo d'une personne qui parle",
    icon: "🎤",
  },
  event: {
    label: "Event",
    description: "Vidéo d'événement, sans paroles",
    icon: "🎥",
  },
};

export const TEMPLATE_KEY_BY_FORMAT: Record<VideoFormat, string> = {
  "9_16": "video_story_9_16",
  "1_1": "video_square_1_1",
  "16_9": "video_landscape_16_9",
};