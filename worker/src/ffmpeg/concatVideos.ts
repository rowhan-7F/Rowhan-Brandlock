// ============================================================
//  Concat N vidéos MP4 en 1 seule via concat DEMUXER.
//
//  Avantages vs filter concat :
//    - Pas de re-encoding (juste rebuild du container) → x5-x10 plus rapide
//    - Pas de problème de stream resolution / cover art
//    - Plus robuste
//
//  Pré-requis : toutes les inputs doivent avoir IDENTIQUES specs
//  (résolution, codec, fps, audio). composeBrandAsset() + burnSubs()
//  produisent du H.264 yuv420p 1080x1920@30 + AAC 44.1kHz stereo 128k.
// ============================================================

import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import { log } from "../logger.js";

export type ConcatVideosInput = {
  inputPaths: string[]; // dans l'ordre du concat
  outputDir: string;
  outputFilename: string;
};

export type ConcatVideosResult = {
  outputPath: string;
  sizeBytes: number;
};

export async function concatVideos(
  input: ConcatVideosInput
): Promise<ConcatVideosResult> {
  const { inputPaths, outputDir, outputFilename } = input;

  if (inputPaths.length < 2) {
    throw new Error(
      `concatVideos needs at least 2 inputs, got ${inputPaths.length}`
    );
  }

  const outputPath = path.join(outputDir, outputFilename);
  const listPath = path.join(outputDir, "concat-list.txt");

  // ============================================================
  //  1. Écrire le fichier list.txt
  //     Format demuxer concat : une ligne par fichier, échapper les quotes
  // ============================================================
  const listContent = inputPaths
    .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
    .join("\n");

  await fs.writeFile(listPath, listContent, { encoding: "utf-8" });

  log.info(`[concatVideos] list.txt content:\n${listContent}`);

  // ============================================================
  //  2. FFmpeg concat demuxer avec stream copy
  //     -c copy = juste rebuild container, AUCUN re-encoding
  //     Si specs ne matchent pas exactement, on retry avec re-encode
  // ============================================================
  const argsCopy = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  log.info(
    `[concatVideos] FFmpeg (stream copy) : ${inputPaths.length} inputs → ${outputFilename}`
  );
  log.info(`[concatVideos] cmd: ffmpeg ${argsCopy.join(" ")}`);

  let copySuccess = false;
  let copyStderr = "";

  await new Promise<void>((resolve) => {
    const ffmpeg = spawn("ffmpeg", argsCopy);
    ffmpeg.stderr?.on("data", (d) => {
      copyStderr += d.toString();
    });
    ffmpeg.on("error", () => resolve());
    ffmpeg.on("close", (code) => {
      copySuccess = code === 0;
      resolve();
    });
  });

  // ============================================================
  //  3. Si stream copy échoue → retry avec re-encoding
  // ============================================================
  if (!copySuccess) {
    log.warn(
      `[concatVideos] Stream copy failed, retrying with re-encode. Stderr tail:\n${copyStderr.slice(
        -500
      )}`
    );

    const argsReencode = [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ];

    log.info(`[concatVideos] cmd (re-encode): ffmpeg ${argsReencode.join(" ")}`);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", argsReencode);
      let stderr = "";
      ffmpeg.stderr?.on("data", (d) => {
        stderr += d.toString();
      });
      ffmpeg.on("error", (err) =>
        reject(new Error(`FFmpeg spawn error: ${err.message}`))
      );
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `FFmpeg concatVideos (re-encode) failed (code ${code}). stderr tail:\n${stderr.slice(
                -1500
              )}`
            )
          );
      });
    });
  }

  // ============================================================
  //  4. Cleanup list.txt + verify output
  // ============================================================
  try {
    await fs.unlink(listPath);
  } catch {
    // best-effort cleanup
  }

  const stat = await fs.stat(outputPath);
  if (stat.size === 0) {
    throw new Error(`concatVideos produced empty file: ${outputPath}`);
  }

  log.info(
    `[concatVideos] OK → ${outputFilename} (${(stat.size / 1024 / 1024).toFixed(2)} MB) ${
      copySuccess ? "[stream copy]" : "[re-encoded]"
    }`
  );

  return { outputPath, sizeBytes: stat.size };
}