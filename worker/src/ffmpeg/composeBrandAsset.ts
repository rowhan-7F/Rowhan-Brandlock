// ============================================================
//  Compose 1 brand asset (intro OU outro) en MP4 court.
//
//  Entrée :
//    - overlayPath  : PNG / GIF / MOV-α / WebM-α
//    - bgPath       : MP4 (vidéo) OU PNG/JPG/WEBP (image)
//    - duration     : durée du clip en secondes
//    - dimensions   : taille du clip output (matche la vidéo principale)
//    - position_x/y : offset overlay depuis (0,0). Si 0,0 → centré
//
//  Sortie : <outputDir>/<filename>.mp4 H.264 yuv420p + AAC silence
// ============================================================

import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import { log } from "../logger.js";

export type BrandAssetOverlayFormat = "png" | "gif" | "mov" | "webm";
export type BrandAssetBgKind = "video" | "image";

export type ComposeBrandAssetInput = {
  overlayPath: string;
  overlayFormat: BrandAssetOverlayFormat;
  bgPath: string;
  bgKind: BrandAssetBgKind;
  durationSeconds: number;
  videoWidth: number;
  videoHeight: number;
  positionX: number;
  positionY: number;
  outputDir: string;
  outputFilename: string;
};

export type ComposeBrandAssetResult = {
  outputPath: string;
  sizeBytes: number;
};

export async function composeBrandAsset(
  input: ComposeBrandAssetInput
): Promise<ComposeBrandAssetResult> {
  const {
    overlayPath,
    overlayFormat,
    bgPath,
    bgKind,
    durationSeconds,
    videoWidth,
    videoHeight,
    positionX,
    positionY,
    outputDir,
    outputFilename,
  } = input;

  const outputPath = path.join(outputDir, outputFilename);

  // ============================================================
  //  Build FFmpeg args
  // ============================================================
  const args: string[] = ["-hide_banner", "-loglevel", "warning", "-y"];

  // Input 0 : BG
  if (bgKind === "image") {
    args.push("-loop", "1", "-t", durationSeconds.toFixed(3), "-i", bgPath);
  } else {
    args.push("-stream_loop", "-1", "-t", durationSeconds.toFixed(3), "-i", bgPath);
  }

  // Input 1 : Overlay
  if (overlayFormat === "gif") {
    args.push("-ignore_loop", "0", "-i", overlayPath);
  } else {
    args.push("-i", overlayPath);
  }

  // Input 2 : Silence audio
  args.push(
    "-f", "lavfi",
    "-t", durationSeconds.toFixed(3),
    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"
  );

  // ============================================================
  //  Filter complex — SIMPLIFIÉ (pas de quotes, pas de min)
  //   1. BG : scale to fill target + crop + format yuv420p
  //   2. OV : scale max 90% du target en gardant aspect ratio
  //   3. MIX : overlay
  //   4. FINAL : scale forcé + yuv420p + fps 30 (garantie concat)
  // ============================================================
  const overlayMaxW = Math.floor(videoWidth * 0.9);
  const overlayMaxH = Math.floor(videoHeight * 0.9);

  const overlayX = positionX === 0 && positionY === 0 ? "(main_w-w)/2" : `${positionX}`;
  const overlayY = positionX === 0 && positionY === 0 ? "(main_h-h)/2" : `${positionY}`;

  const filterComplex = [
    `[0:v]scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase,crop=${videoWidth}:${videoHeight},setsar=1,format=yuv420p[bg]`,
    `[1:v]scale=${overlayMaxW}:${overlayMaxH}:force_original_aspect_ratio=decrease,setsar=1[ov]`,
    `[bg][ov]overlay=${overlayX}:${overlayY}:shortest=0[mixed]`,
    `[mixed]scale=${videoWidth}:${videoHeight},setsar=1,fps=30,format=yuv420p[v]`,
  ].join("; ");

  args.push("-filter_complex", filterComplex);

  // Maps + encodage + FORCE OUTPUT SIZE
  args.push(
    "-map", "[v]",
    "-map", "2:a",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "veryfast",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
    "-t", durationSeconds.toFixed(3),
    "-s", `${videoWidth}x${videoHeight}`,  // ⭐ FORCE OUTPUT RESOLUTION
    "-r", "30",                             // ⭐ FORCE OUTPUT FPS
    "-movflags", "+faststart",
    outputPath
  );

  log.info(
    `[composeBrandAsset] FFmpeg : overlay=${overlayFormat} bg=${bgKind} dur=${durationSeconds}s target=${videoWidth}x${videoHeight} → ${outputFilename}`
  );
  log.info(`[composeBrandAsset] cmd: ffmpeg ${args.join(" ")}`);

  // ============================================================
  //  Spawn FFmpeg
  // ============================================================
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);

    let stderrBuf = "";
    ffmpeg.stderr?.on("data", (d) => {
      stderrBuf += d.toString();
    });

    ffmpeg.on("error", (err) =>
      reject(new Error(`FFmpeg spawn error: ${err.message}`))
    );

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg composeBrandAsset failed (code ${code}). stderr tail:\n${stderrBuf.slice(-1500)}`
          )
        );
      }
    });
  });

  // ============================================================
  //  Verify output (size + dimensions via ffprobe)
  // ============================================================
  const stat = await fs.stat(outputPath);
  if (stat.size === 0) {
    throw new Error(`composeBrandAsset produced empty file: ${outputPath}`);
  }

  // Quick ffprobe to confirm dimensions
  const probeArgs = [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0",
    outputPath,
  ];

  let probedDims = "";
  await new Promise<void>((resolve) => {
    const probe = spawn("ffprobe", probeArgs);
    probe.stdout?.on("data", (d) => { probedDims += d.toString(); });
    probe.on("close", () => resolve());
    probe.on("error", () => resolve());
  });

  log.info(
    `[composeBrandAsset] OK → ${outputFilename} (${(stat.size / 1024).toFixed(1)} KB) actual dims: ${probedDims.trim()}`
  );

  return { outputPath, sizeBytes: stat.size };
}