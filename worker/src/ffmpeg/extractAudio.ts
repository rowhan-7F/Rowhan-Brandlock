// ============================================================
//  Extraction audio MP3 depuis une vidéo source via FFmpeg
//  Optimisé pour Whisper Infomaniak :
//  - Bitrate 64 kbps (suffisant pour la parole)
//  - Mono (Whisper sample mieux)
//  - 16 kHz (sample rate optimal pour modèles speech)
// ============================================================

import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import { log } from "../logger.js";

type ExtractAudioInput = {
  videoPath: string;  // input MP4
  outputDir: string;  // tmp/{jobId}/
};

type ExtractAudioResult = {
  audioPath: string;  // chemin de l'audio.mp3 généré
  sizeBytes: number;
  durationSeconds?: number;
};

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB - limite Whisper Infomaniak

export async function extractAudio(input: ExtractAudioInput): Promise<ExtractAudioResult> {
  const { videoPath, outputDir } = input;
  const audioPath = path.join(outputDir, "audio.mp3");

  log.ffmpeg("Extracting audio with FFmpeg (mono, 16kHz, 64kbps MP3)...");

  // Arguments FFmpeg optimisés pour la parole
  const args = [
    "-i", videoPath,
    "-vn",                // no video
    "-acodec", "libmp3lame",
    "-ar", "16000",       // 16 kHz sample rate
    "-ac", "1",           // mono
    "-b:a", "64k",        // 64 kbps bitrate
    "-y",                 // overwrite
    audioPath,
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}. Is FFmpeg installed and in PATH?`));
    });

    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}\nstderr:\n${stderr.slice(-2000)}`));
        return;
      }

      try {
        const stats = await fs.stat(audioPath);
        const sizeBytes = stats.size;
        const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);

        // Vérifie la taille
        if (sizeBytes > MAX_AUDIO_SIZE_BYTES) {
          reject(new Error(
            `Audio too large: ${sizeMb} MB > 25 MB limit (Whisper Infomaniak). ` +
            `Vidéo source trop longue. Phase 2b ajoutera le chunking.`
          ));
          return;
        }

        // Parse la durée depuis stderr (FFmpeg log "Duration: 00:00:29.12")
        const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        let durationSeconds: number | undefined;
        if (durationMatch) {
          const [, hh, mm, ss] = durationMatch;
          durationSeconds = parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseFloat(ss);
        }

        log.ffmpeg(`Audio extracted: ${sizeMb} MB${durationSeconds ? ` (${durationSeconds.toFixed(1)}s)` : ""}`);

        resolve({ audioPath, sizeBytes, durationSeconds });
      } catch (err: any) {
        reject(new Error(`Failed to stat audio file: ${err.message}`));
      }
    });
  });
}