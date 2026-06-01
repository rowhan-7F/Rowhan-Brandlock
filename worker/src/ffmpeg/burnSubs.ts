// ============================================================
//  Burn subs + (optionnel) mix voice-off + musique + overlay b-rolls
//  Output : MP4 H.264 / AAC en 1 passage FFmpeg complex filter
//  Ordre du filter_complex :
//    1. Audio mix (voice-off et/ou musique)
//    2. B-rolls overlays chaines sur la video brute
//    3. Subs burnes EN DERNIER -> toujours au-dessus de tout
// ============================================================

import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import { log } from "../logger.js";

type BRollPosition =
  | "fullscreen"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

type BurnSubsBroll = {
  localPath: string;
  type: "video" | "image";
  start_time: number;
  end_time: number;
  position: BRollPosition;
  scale: number;
  duration_seconds: number;
};

type BurnSubsInput = {
  videoPath: string;
  assPath: string;
  outputDir: string;
  videoWidth: number;
  videoHeight: number;
  voiceoverPath?: string;
  audioMix?: { main_volume: number; voiceover_volume: number };
  brolls?: BurnSubsBroll[];
  musicPath?: string;
  musicVolume?: number;
};

type BurnSubsResult = {
  outputPath: string;
  sizeBytes: number;
  durationSeconds?: number;
};

const MAX_OUTPUT_SIZE_BYTES = 500 * 1024 * 1024;
const OVERLAY_PADDING = 30;

function buildOverlayPosition(position: BRollPosition): { x: string; y: string } {
  switch (position) {
    case "fullscreen":
      return { x: "0", y: "0" };
    case "top-left":
      return { x: `${OVERLAY_PADDING}`, y: `${OVERLAY_PADDING}` };
    case "top-right":
      return { x: `main_w-w-${OVERLAY_PADDING}`, y: `${OVERLAY_PADDING}` };
    case "bottom-left":
      return { x: `${OVERLAY_PADDING}`, y: `main_h-h-${OVERLAY_PADDING}` };
    case "bottom-right":
      return { x: `main_w-w-${OVERLAY_PADDING}`, y: `main_h-h-${OVERLAY_PADDING}` };
    case "center":
      return { x: `(main_w-w)/2`, y: `(main_h-h)/2` };
  }
}

function buildScaleFilter(broll: BurnSubsBroll, videoWidth: number, videoHeight: number): string {
  if (broll.position === "fullscreen") {
    return `scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase,crop=${videoWidth}:${videoHeight}`;
  }
  const targetW = Math.round(videoWidth * broll.scale);
  return `scale=${targetW}:-2`;
}

export async function burnSubs(input: BurnSubsInput): Promise<BurnSubsResult> {
  const {
    videoPath,
    assPath,
    outputDir,
    videoWidth,
    videoHeight,
    voiceoverPath,
    audioMix,
    brolls = [],
    musicPath,
    musicVolume,
  } = input;

  const outputPath = path.join(outputDir, "final.mp4");
  const hasVoiceover = !!(voiceoverPath && audioMix);
  const hasBrolls = brolls.length > 0;
  const hasMusic = !!(musicPath && typeof musicVolume === "number");
  const useComplexFilter = hasVoiceover || hasBrolls || hasMusic;

  const featuresLog: string[] = [];
  if (hasBrolls) featuresLog.push(`${brolls.length} b-roll${brolls.length > 1 ? "s" : ""}`);
  if (hasVoiceover) featuresLog.push(`voice-off (main=${audioMix!.main_volume}, vo=${audioMix!.voiceover_volume})`);
  if (hasMusic) featuresLog.push(`musique (vol=${musicVolume})`);
  log.ffmpeg(featuresLog.length > 0 ? `Burn subs + ${featuresLog.join(" + ")}...` : "Burn subtitles into video...");

  const assBasename = path.basename(assPath);
  let args: string[] = [];

  if (!useComplexFilter) {
    args = [
      "-i", videoPath,
      "-vf", `scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase,crop=${videoWidth}:${videoHeight},subtitles='${assBasename}'`,
      "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-movflags", "+faststart", "-y", outputPath,
    ];
  } else {
    args.push("-i", videoPath); // Input 0 : main video
    if (voiceoverPath) {
      args.push("-i", voiceoverPath); // Input 1
    }

    const brollStartIdx = voiceoverPath ? 2 : 1;
    for (const broll of brolls) {
      if (broll.type === "image") {
        const dur = Math.max(1, broll.end_time - broll.start_time);
        args.push("-loop", "1", "-t", dur.toFixed(2), "-i", broll.localPath);
      } else {
        args.push("-i", broll.localPath);
      }
    }

    // Dernier input : musique de fond (bouclee pour couvrir toute la duree)
    const musicInputIdx = brollStartIdx + brolls.length;
    if (hasMusic) {
      args.push("-stream_loop", "-1", "-i", musicPath!);
    }

    const filterParts: string[] = [];

    // Scale + pad la video source pour matcher le format cible
    filterParts.push(`[0:v]scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase,crop=${videoWidth}:${videoHeight}[v_base]`);

    // 1. Audio mix (voice-off et/ou musique)
    const audioLabels: string[] = [];
    if (hasVoiceover) {
      filterParts.push(`[0:a]volume=${audioMix!.main_volume}[a_main]`);
      filterParts.push(`[1:a]volume=${audioMix!.voiceover_volume}[a_vo]`);
      audioLabels.push("[a_main]", "[a_vo]");
    } else if (hasMusic) {
      filterParts.push(`[0:a]volume=1.0[a_main]`);
      audioLabels.push("[a_main]");
    }
    if (hasMusic) {
      filterParts.push(`[${musicInputIdx}:a]volume=${musicVolume}[a_music]`);
      audioLabels.push("[a_music]");
    }
    const hasAudioOut = audioLabels.length > 0;
    if (hasAudioOut) {
      filterParts.push(`${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=first:dropout_transition=0[a_out]`);
    }

    // 2. Chain b-rolls overlays sur video brute
    let lastVideoLabel = "v_base";
    for (let i = 0; i < brolls.length; i++) {
      const broll = brolls[i];
      const inputIdx = brollStartIdx + i;
      const labelScaled = `v_b${i}`;
      const labelOverlay = `v_o${i}`;
      const scaleFilter = buildScaleFilter(broll, videoWidth, videoHeight);
      filterParts.push(`[${inputIdx}:v]${scaleFilter}[${labelScaled}]`);
      const pos = buildOverlayPosition(broll.position);
      filterParts.push(`[${lastVideoLabel}][${labelScaled}]overlay=enable='between(t,${broll.start_time.toFixed(2)},${broll.end_time.toFixed(2)})':x=${pos.x}:y=${pos.y}[${labelOverlay}]`);
      lastVideoLabel = labelOverlay;
    }

    // 3. Burn subs EN DERNIER
    filterParts.push(`[${lastVideoLabel}]subtitles='${assBasename}'[v_out]`);

    args.push("-filter_complex", filterParts.join(";"), "-map", "[v_out]");

    if (hasAudioOut) {
      args.push("-map", "[a_out]");
    } else {
      args.push("-map", "0:a?");
    }

    args.push(
      "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-movflags", "+faststart", "-y", outputPath
    );
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args, { cwd: outputDir });
    let stderr = "";
    ffmpeg.stderr.on("data", (data) => { stderr += data.toString(); });
    ffmpeg.on("error", (err) => { reject(new Error(`FFmpeg spawn error: ${err.message}`)); });
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
        const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        let durationSeconds: number | undefined;
        if (durationMatch) {
          const [, hh, mm, ss] = durationMatch;
          durationSeconds = parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseFloat(ss);
        }
        const features: string[] = [];
        if (hasBrolls) features.push(`${brolls.length} b-roll(s)`);
        if (hasVoiceover) features.push("voice-off mix");
        if (hasMusic) features.push("musique");
        features.push("subs on top");
        log.ffmpeg(`Video rendered: ${sizeMb} MB${durationSeconds ? ` (${durationSeconds.toFixed(1)}s)` : ""} [${features.join(", ")}]`);
        resolve({ outputPath, sizeBytes, durationSeconds });
      } catch (err: any) {
        reject(new Error(`Failed to stat output file: ${err.message}`));
      }
    });
  });
}