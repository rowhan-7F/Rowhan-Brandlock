// ============================================================
//  Job handler: RENDER_FINAL (burned subs version)
//  Pipeline : download MP4 + ASS gen + FFmpeg burn + upload
// ============================================================

import path from "node:path";
import { supabase, config } from "../config.js";
import { log } from "../logger.js";
import { downloadFromStorage, cleanupJobTmp } from "../storage/download.js";
import { uploadToStorage } from "../storage/upload.js";
import { generateAss } from "../subs/generateAss.js";
import { burnSubs } from "../ffmpeg/burnSubs.js";

type RenderJobInput = {
  jobId: string;
  projectId: string;
  payload: Record<string, unknown>;
};

type VideoProjectForRender = {
  id: string;
  tenant_id: string;
  title: string;
  source_format: string | null;
  source_video_url: string | null;
  format: string;
  state_json: Record<string, any>;
  source_dimensions: { width: number; height: number } | null;
};

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9_16": { width: 1080, height: 1920 },
  "1_1": { width: 1080, height: 1080 },
  "16_9": { width: 1920, height: 1080 },
};

export async function processRenderJob(input: RenderJobInput): Promise<void> {
  const { jobId, projectId } = input;

  try {
    // ====================================
    //  ÉTAPE 1 — Load project
    // ====================================
    await updateProgress(jobId, 5, "Récupération du projet...");

    const { data: projectData, error: projectErr } = await supabase
      .from("studio_video_projects")
      .select("id, tenant_id, title, source_format, source_video_url, format, state_json, source_dimensions")
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr || !projectData) {
      throw new Error(`Project ${projectId} not found: ${projectErr?.message || "no data"}`);
    }

    const project = projectData as VideoProjectForRender;

    if (!project.source_format) {
      throw new Error(`Project ${projectId} has no source_format`);
    }

    const transcript = project.state_json?.transcript;
    if (!transcript || !transcript.segments || transcript.segments.length === 0) {
      throw new Error(
        `Project ${projectId} has no transcript segments. Transcribe first.`
      );
    }

    log.project(project.title, project.tenant_id);
    log.info(`Found ${transcript.segments.length} subtitle segments`);

    // ====================================
    //  ÉTAPE 2 — Download source MP4
    // ====================================
    await updateProgress(jobId, 10, "Téléchargement de la vidéo source...");

    const sourcePath = `${project.tenant_id}/${project.id}/source.${project.source_format}`;
    const { localPath: localVideoPath } = await downloadFromStorage({
      jobId,
      bucket: "video-sources",
      storagePath: sourcePath,
      outputFilename: `source.${project.source_format}`,
    });

    const jobTmpDir = path.dirname(localVideoPath);

    // ====================================
    //  ÉTAPE 3 — Generate .ass file
    // ====================================
    await updateProgress(jobId, 20, "Génération des sous-titres .ass...");

    // Détermine les dimensions cibles
    const targetDims = FORMAT_DIMENSIONS[project.format] || { width: 1080, height: 1920 };

    // ⭐ Sync sur la durée audio réelle pour corriger les drifts Whisper
    // On étire les timecodes pour couvrir la durée totale de la vidéo
    const videoDuration = project.state_json?.transcript?.duration_seconds || null;

    // ⭐ Offset auto (détecté par anchors binary search)
    const autoOffset = typeof project.state_json?.auto_subtitle_offset_seconds === "number"
      ? project.state_json.auto_subtitle_offset_seconds
      : 0;

    // ⭐ Manual offset (slider)
    const manualOffset = typeof project.state_json?.subtitle_offset_seconds === "number"
      ? project.state_json.subtitle_offset_seconds
      : 0;

    // ⭐ Anchors pour interpolation précise
    const anchors = Array.isArray(project.state_json?.speech_anchors)
      ? project.state_json.speech_anchors
      : [];

    const subtitleOffset = autoOffset + manualOffset;

    log.info(
      `Offset: auto=${autoOffset.toFixed(2)}s + manual=${manualOffset.toFixed(2)}s = total=${subtitleOffset.toFixed(2)}s, anchors=${anchors.length}`
    );

    const { assPath, segmentCount } = await generateAss({
      segments: transcript.segments,
      words: transcript.words,
      outputDir: jobTmpDir,
      videoWidth: targetDims.width,
      videoHeight: targetDims.height,
      videoDurationSeconds: videoDuration,
      offsetSeconds: subtitleOffset,
      anchors,  // ⭐ NEW : pour interpolation multi-points
    });

    log.info(`Generated .ass with ${segmentCount} segments`);

    // ====================================
    //  ÉTAPE 4 — Burn subs with FFmpeg
    // ====================================
    await updateProgress(jobId, 30, "Burn des sous-titres (FFmpeg)...");

    const startBurn = Date.now();

    // Update progress périodiquement pendant FFmpeg (longue tâche)
    const progressTicker = setInterval(async () => {
      const elapsed = (Date.now() - startBurn) / 1000;
      const estimatedPercent = Math.min(85, 30 + Math.floor(elapsed * 3));
      await updateProgress(
        jobId,
        estimatedPercent,
        `Burn en cours (${Math.floor(elapsed)}s)...`
      );
    }, 3000);

    const { outputPath, sizeBytes: outputSize } = await burnSubs({
      videoPath: localVideoPath,
      assPath,
      outputDir: jobTmpDir,
    });

    clearInterval(progressTicker);

    // ====================================
    //  ÉTAPE 5 — Upload final video
    // ====================================
    await updateProgress(jobId, 90, "Upload de la vidéo finale...");

    const finalStoragePath = `${project.tenant_id}/${project.id}/final.mp4`;
    await uploadToStorage({
      localPath: outputPath,
      bucket: "video-exports",
      storagePath: finalStoragePath,
      contentType: "video/mp4",
    });

    // ====================================
    //  ÉTAPE 6 — Update DB
    // ====================================
    await updateProgress(jobId, 95, "Finalisation...");

    const finalUrl = `${config.supabaseUrl}/storage/v1/object/video-exports/${finalStoragePath}`;

    const { error: updateErr } = await supabase
      .from("studio_video_projects")
      .update({
        status: "completed",
        rendered_at: new Date().toISOString(),
        final_video_url: finalUrl,
        render_settings: {
          render_type: "subs_burned",
          segments_count: segmentCount,
          output_size_bytes: outputSize,
          subtitle_style: "luxury_helvetica_bold",
          format: project.format,
        },
      })
      .eq("id", projectId);

    if (updateErr) {
      throw new Error(`Failed to save final URL: ${updateErr.message}`);
    }

    // ====================================
    //  ÉTAPE 7 — Mark job completed
    // ====================================
    await supabase.rpc("complete_video_job", {
      p_job_id: jobId,
      p_result_data: {
        render_type: "subs_burned",
        segments_count: segmentCount,
        output_size_bytes: outputSize,
        output_path: finalStoragePath,
      },
    });
  } finally {
    await cleanupJobTmp(jobId);
  }
}

async function updateProgress(
  jobId: string,
  percent: number,
  message: string,
  estimatedSeconds?: number
): Promise<void> {
  try {
    await supabase.rpc("update_video_job_progress", {
      p_job_id: jobId,
      p_progress_percent: percent,
      p_progress_message: message,
      p_estimated_seconds_remaining: estimatedSeconds ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Progress update failed (non-fatal): ${msg}`);
  }
}