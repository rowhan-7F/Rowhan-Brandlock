// ============================================================
//  Extraction audio WAV depuis une video source via FFmpeg
//  Optimise pour Whisper.cpp :
//  - Format WAV PCM 16-bit (lecture native, pas de re-decode)
//  - 16 kHz mono (sample rate optimal pour Whisper)
//  - Non compresse (qualite parfaite pour transcription)
//
//  Migration 2026-05-22 : MP3 64kbps -> WAV 16kHz PCM
//  Suite au switch Infomaniak -> Whisper.cpp self-hosted (souverain Suisse).
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
  audioPath: string;          // chemin du audio.wav genere
  sizeBytes: number;
  durationSeconds?: number;
};

// 500 MB = couvre ~4h de video (WAV 16kHz mono ~= 32 KB/s)
// Avant : 25 MB (limite Whisper Infomaniak)
const MAX_AUDIO_SIZE_BYTES = 500 * 1024 * 1024;

export async function extractAudio(input: ExtractAudioInput): Promise<ExtractAudioResult> {
  const { videoPath, outputDir } = input;
  const audioPath = path.join(outputDir, "audio.wav");

  log.ffmpeg("Extracting audio with FFmpeg (WAV 16kHz mono 16-bit PCM)...");

  // Arguments FFmpeg optimises pour Whisper.cpp :
  // -vn        : pas de video
  // -ar 16000  : sample rate 16 kHz (optimal pour Whisper)
  // -ac 1      : mono (Whisper traite mono)
  // -c:a pcm_s16le : codec audio 16-bit PCM little-endian (WAV standard)
  // -y         : overwrite output
  const args = [
    "-i", videoPath,
    "-vn",
    "-ar", "16000",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    "-y",
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

        // Verifie la taille
        if (sizeBytes > MAX_AUDIO_SIZE_BYTES) {
          reject(new Error(
            `Audio too large: ${sizeMb} MB > 500 MB safety limit. ` +
            `Video source trop longue (>4h equivalent).`
          ));
          return;
        }

        // Parse la duree depuis stderr (FFmpeg log "Duration: 00:00:29.12")
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