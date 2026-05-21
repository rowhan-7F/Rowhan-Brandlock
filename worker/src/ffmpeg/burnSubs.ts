// ============================================================
//  Burn les sous-titres .ass sur la vidéo source avec FFmpeg
//  Output : MP4 H.264 / AAC, qualité broadcast
// ============================================================

import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import { log } from "../logger.js";

type BurnSubsInput = {
  videoPath: string;     // input MP4
  assPath: string;       // input subtitles.ass
  outputDir: string;     // output dir for final.mp4
};

type BurnSubsResult = {
  outputPath: string;
  sizeBytes: number;
  durationSeconds?: number;
};

const MAX_OUTPUT_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB safety limit

export async function burnSubs(input: BurnSubsInput): Promise<BurnSubsResult> {
  const { videoPath, assPath, outputDir } = input;
  const outputPath = path.join(outputDir, "final.mp4");

  log.ffmpeg("Burning subtitles into video with FFmpeg + libass...");

  // ============================================================
  //  Arguments FFmpeg
  // ============================================================
  //
  //  -i input.mp4              : input vidéo
  //  -vf "subtitles=..."       : filter video pour burn les .ass
  //  -c:v libx264              : codec vidéo H.264 (compatible partout)
  //  -preset medium            : compromis vitesse/qualité
  //  -crf 20                   : qualité (18 = visuellement lossless, 23 = défaut)
  //  -c:a aac                  : codec audio AAC
  //  -b:a 128k                 : bitrate audio
  //  -movflags +faststart      : metadata au début pour streaming web
  //  -y                        : overwrite si existe

  // Le path du .ass doit être escapé pour le filter graph FFmpeg
  // (les ':' et '\' posent problème). Solution : on passe un path
  // relatif depuis le cwd FFmpeg.
  const assBasename = path.basename(assPath);

  const args = [
    "-i", videoPath,
    "-vf", `subtitles='${assBasename}'`,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    // Lance FFmpeg avec cwd = outputDir pour que subtitles='subtitles.ass' marche
    const ffmpeg = spawn("ffmpeg", args, { cwd: outputDir });

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });

    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg burnSubs exited with code ${code}\nstderr:\n${stderr.slice(-3000)}`));
        return;
      }

      try {
        const stats = await fs.stat(outputPath);
        const sizeBytes = stats.size;
        const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);

        if (sizeBytes > MAX_OUTPUT_SIZE_BYTES) {
          reject(new Error(`Output too large: ${sizeMb} MB > 500 MB safety limit`));
          return;
        }

        // Parse durée
        const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        let durationSeconds: number | undefined;
        if (durationMatch) {
          const [, hh, mm, ss] = durationMatch;
          durationSeconds = parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseFloat(ss);
        }

        log.ffmpeg(`Video rendered: ${sizeMb} MB${durationSeconds ? ` (${durationSeconds.toFixed(1)}s)` : ""}`);

        resolve({ outputPath, sizeBytes, durationSeconds });
      } catch (err: any) {
        reject(new Error(`Failed to stat output file: ${err.message}`));
      }
    });
  });
}