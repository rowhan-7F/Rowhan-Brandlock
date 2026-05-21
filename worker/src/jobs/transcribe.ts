// ============================================================
//  Job handler: TRANSCRIBE
//  Orchestre toute la chaîne :
//  download → extract audio → upload audio → Whisper → sanitizer → save
// ============================================================

import path from "node:path";
import { supabase, config } from "../config.js";
import { log } from "../logger.js";
import { downloadFromStorage, cleanupJobTmp } from "../storage/download.js";
import { uploadToStorage } from "../storage/upload.js";
import { extractAudio } from "../ffmpeg/extractAudio.js";
import { submitToWhisper } from "../whisper/client.js";
import { pollWhisper } from "../whisper/poll.js";
import { applySanitizer } from "../sanitizer/apply.js";

type TranscribeJobInput = {
  jobId: string;
  projectId: string;
  payload: Record<string, unknown>;
};

type VideoProject = {
  id: string;
  tenant_id: string;
  title: string;
  source_format: string | null;
  source_video_url: string | null;
  state_json: Record<string, unknown>;
};

export async function processTranscribeJob(input: TranscribeJobInput): Promise<void> {
  const { jobId, projectId } = input;

  try {
    // ====================================
    //  ÉTAPE 1/9 — Charger le projet
    // ====================================
    await updateProgress(jobId, 5, "Récupération du projet...");

    const { data: projectData, error: projectErr } = await supabase
      .from("studio_video_projects")
      .select("id, tenant_id, title, source_format, source_video_url, state_json")
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr || !projectData) {
      throw new Error(`Project ${projectId} not found: ${projectErr?.message || "no data"}`);
    }

    const project = projectData as VideoProject;

    if (!project.source_format) {
      throw new Error(`Project ${projectId} has no source_format (upload incomplet?)`);
    }

    log.project(project.title, project.tenant_id);

    // ====================================
    //  ÉTAPE 2/9 — Download source MP4
    // ====================================
    await updateProgress(jobId, 10, "Téléchargement de la vidéo source...");

    const sourcePath = `${project.tenant_id}/${project.id}/source.${project.source_format}`;
    const { localPath: localVideoPath } = await downloadFromStorage({
      jobId,
      bucket: "video-sources",
      storagePath: sourcePath,
      outputFilename: `source.${project.source_format}`,
    });

    // ====================================
    //  ÉTAPE 3/9 — Extract audio
    // ====================================
    await updateProgress(jobId, 25, "Extraction de la piste audio (FFmpeg)...");

    const jobTmpDir = path.dirname(localVideoPath);
    const { audioPath, sizeBytes: audioSizeBytes } = await extractAudio({
      videoPath: localVideoPath,
      outputDir: jobTmpDir,
    });

    // ====================================
    //  ÉTAPE 4/9 — Upload audio MP3
    // ====================================
    await updateProgress(jobId, 40, "Upload de l'audio extrait...");

    const audioStoragePath = `${project.tenant_id}/${project.id}/audio.mp3`;
    await uploadToStorage({
      localPath: audioPath,
      bucket: "video-sources",
      storagePath: audioStoragePath,
      contentType: "audio/mpeg",
    });

    // Update DB avec l'URL audio
    const audioPublicPath = `${config.supabaseUrl}/storage/v1/object/video-sources/${audioStoragePath}`;
    await supabase
      .from("studio_video_projects")
      .update({ source_audio_url: audioPublicPath })
      .eq("id", projectId);

    // ====================================
    //  ÉTAPE 5/9 — POST Whisper Infomaniak
    // ====================================
    await updateProgress(jobId, 50, "Envoi à Whisper Infomaniak...");

    const { batchId } = await submitToWhisper({
      audioPath,
      language: "fr",
    });

    // ====================================
    //  ÉTAPE 6/9 — Poll Whisper jusqu'à completion
    // ====================================
    await updateProgress(jobId, 55, "Transcription en cours...");

    const whisperResult = await pollWhisper(batchId, async (elapsed) => {
      // Update progress entre 55% et 95% en fonction du temps
      const progressInRange = Math.min(40, (elapsed / 60) * 30);
      const percent = Math.floor(55 + progressInRange);
      await updateProgress(
        jobId,
        percent,
        `Transcription en cours (${Math.floor(elapsed)}s)...`,
        Math.max(0, 120 - elapsed)
      );
    });

    if (!whisperResult.text) {
      throw new Error("Whisper returned empty transcript");
    }

    // ====================================
    //  ÉTAPE 7/9 — Apply sanitizer (lexique tenant)
    // ====================================
    await updateProgress(jobId, 95, "Application du lexique tenant...");

    const { sanitized, appliedReplacements } = await applySanitizer(
      project.tenant_id,
      whisperResult.text
    );

    // ====================================
    //  ÉTAPE 8/9 — Save transcript en DB
    // ====================================
    await updateProgress(jobId, 99, "Sauvegarde du transcript...");
    log.save();

    const updatedStateJson = {
      ...(project.state_json || {}),
      transcript: {
        raw: whisperResult.text,
        edited: sanitized,
        segments: whisperResult.segments || [],
        language: whisperResult.language || "fr",
        duration_seconds: whisperResult.durationSeconds,
        sanitized_at: new Date().toISOString(),
        applied_replacements_count: appliedReplacements,
      },
    };

    const { error: updateErr } = await supabase
      .from("studio_video_projects")
      .update({
        state_json: updatedStateJson,
        status: "transcribed",
        transcribed_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (updateErr) {
      throw new Error(`Failed to save transcript: ${updateErr.message}`);
    }

    // ====================================
    //  ÉTAPE 9/9 — Mark job completed
    // ====================================
    await supabase.rpc("complete_video_job", {
      p_job_id: jobId,
      p_result_data: {
        transcript_length: sanitized.length,
        raw_length: whisperResult.text.length,
        applied_replacements: appliedReplacements,
        segments_count: whisperResult.segments?.length || 0,
        language: whisperResult.language || "fr",
        audio_size_bytes: audioSizeBytes,
      },
    });
  } finally {
    // Cleanup tmp dans tous les cas (succès OU échec)
    await cleanupJobTmp(jobId);
  }
}

// ============================================================
//  Helper — Update progress sans casser le job si update échoue
// ============================================================

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