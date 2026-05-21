// ============================================================
//  Extrait un CLIP audio depuis un fichier source
//  Utilisé par le système d'anchors pour le calibrage word-level
// ============================================================

import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import { log } from "../logger.js";

type ExtractClipInput = {
  audioPath: string;
  outputDir: string;
  startSeconds: number;
  durationSeconds: number;
  clipName: string;  // ex: "anchor_start_1.mp3"
};

type ExtractClipResult = {
  clipPath: string;
  actualDuration: number;
};

export async function extractClip(input: ExtractClipInput): Promise<ExtractClipResult> {
  const { audioPath, outputDir, startSeconds, durationSeconds, clipName } = input;
  const clipPath = path.join(outputDir, clipName);

  return new Promise((resolve, reject) => {
    const args = [
      "-ss", startSeconds.toString(),       // Position de départ
      "-t", durationSeconds.toString(),     // Durée
      "-i", audioPath,
      "-c:a", "libmp3lame",                 // Re-encode pour garantir clip propre
      "-b:a", "64k",
      "-y",                                 // Overwrite si existe
      clipPath,
    ];

    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        return reject(new Error(`FFmpeg extractClip failed (code ${code}): ${stderr.slice(-300)}`));
      }

      try {
        const stats = await fs.stat(clipPath);
        if (stats.size < 1000) {
          return reject(new Error(`Clip too small (${stats.size} bytes)`));
        }
        resolve({
          clipPath,
          actualDuration: durationSeconds,
        });
      } catch (err) {
        reject(err);
      }
    });

    ffmpeg.on("error", reject);
  });
}

/**
 * Helper : supprime un clip (cleanup)
 */
export async function deleteClip(clipPath: string): Promise<void> {
  try {
    await fs.unlink(clipPath);
  } catch {
    // Silently ignore
  }
}
