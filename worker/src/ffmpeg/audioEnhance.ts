// ============================================================
//  Phase 8.B V1 - Audio Enhancement par mode
//
//  PASSTHROUGH POUR TOUS LES MODES :
//  Les filtres FFmpeg agressifs (highpass+lowpass+denoise+compressor)
//  tuaient la voix faible mixee avec de la musique -> 0 segments.
//  On garde l'architecture pour reactivation future avec Demucs/RNNoise.
// ============================================================

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const LEGACY_MAP: Record<string, string> = {
  voice_off: "studio_clean",
  interview: "studio_clean",
  event: "field_event",
};

const FILTERS_BY_MODE: Record<string, string | null> = {
  studio_clean: null,
  voice_music: null,
  field_event: null,
  premium_demux: null,
};

function getActiveMode(mode: string): string {
  if (mode in LEGACY_MAP) return LEGACY_MAP[mode];
  if (mode in FILTERS_BY_MODE) return mode;
  return "studio_clean";
}

export type EnhanceAudioOptions = {
  inputPath: string;
  outputDir: string;
  mode: string;
  onLog?: (msg: string) => void;
};

export type EnhanceAudioResult = {
  enhancedPath: string;
  sizeBytes: number;
  applied: boolean;
  filter: string | null;
  activeMode: string;
};

export async function enhanceAudio(
  options: EnhanceAudioOptions
): Promise<EnhanceAudioResult> {
  const { inputPath, outputDir, mode, onLog } = options;
  const activeMode = getActiveMode(mode);
  const filter = FILTERS_BY_MODE[activeMode] ?? null;

  if (!filter) {
    const stats = await fs.stat(inputPath);
    onLog?.("[enhanceAudio] SKIP - mode=" + mode + " (active=" + activeMode + ") passthrough V1");
    return {
      enhancedPath: inputPath,
      sizeBytes: stats.size,
      applied: false,
      filter: null,
      activeMode,
    };
  }

  // Code mort tant que tous les filtres sont null (Phase 8.B V1)
  // Garde pour reactivation future (Phase 8.C+)
  const enhancedPath = path.join(outputDir, "audio_enhanced.wav");
  onLog?.("[enhanceAudio] mode=" + mode + " (active=" + activeMode + ") filter=" + filter);

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-y",
      "-i", inputPath,
      "-af", filter,
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "pcm_s16le",
      enhancedPath,
    ];
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    ff.stderr.on("data", (d) => { stderr += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("ffmpeg enhanceAudio failed (code=" + code + "): " + stderr.slice(-500)));
    });
  });

  const stats = await fs.stat(enhancedPath);
  onLog?.("[enhanceAudio] OK enhanced=" + (stats.size / 1024).toFixed(0) + "KB");

  return {
    enhancedPath,
    sizeBytes: stats.size,
    applied: true,
    filter,
    activeMode,
  };
}