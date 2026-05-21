// ============================================================
//  Job handler: TRANSCRIBE
//  Pipeline complet :
//  download → extract audio → VAD → upload → Whisper → sanitizer
//  → ANCHORS BINARY SEARCH → save
// ============================================================

import path from "node:path";
import { supabase, config } from "../config.js";
import { log } from "../logger.js";
import { downloadFromStorage, cleanupJobTmp } from "../storage/download.js";
import { uploadToStorage } from "../storage/upload.js";
import { extractAudio } from "../ffmpeg/extractAudio.js";
import { detectSpeechStart } from "../ffmpeg/detectSpeechStart.js";
import { findSpeechAnchors } from "../whisper/findSpeechAnchors.js";
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
    //  ÉTAPE 1/10 — Charger le projet
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
    //  ÉTAPE 2/10 — Download source MP4
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
    //  ÉTAPE 3/10 — Extract audio
    // ====================================
    await updateProgress(jobId, 25, "Extraction de la piste audio (FFmpeg)...");

    const jobTmpDir = path.dirname(localVideoPath);
    const { audioPath, sizeBytes: audioSizeBytes } = await extractAudio({
      videoPath: localVideoPath,
      outputDir: jobTmpDir,
    });

    // ====================================
    //  ⭐ ÉTAPE 4/10 — VAD (fallback rapide, info seulement)
    // ====================================
    await updateProgress(jobId, 30, "Pré-analyse audio...");

    let vadSpeechStart = 0;
    try {
      const vadResult = await detectSpeechStart({ audioPath });
      vadSpeechStart = vadResult.speechStartSeconds;
      log.info(`VAD (fallback): voix à ${vadSpeechStart.toFixed(2)}s`);
    } catch (vadErr) {
      const msg = vadErr instanceof Error ? vadErr.message : String(vadErr);
      log.warn(`VAD failed (non-fatal): ${msg}`);
    }

    // ====================================
    //  ÉTAPE 5/10 — Upload audio MP3
    // ====================================
    await updateProgress(jobId, 40, "Upload de l'audio extrait...");

    const audioStoragePath = `${project.tenant_id}/${project.id}/audio.mp3`;
    await uploadToStorage({
      localPath: audioPath,
      bucket: "video-sources",
      storagePath: audioStoragePath,
      contentType: "audio/mpeg",
    });

    const audioPublicPath = `${config.supabaseUrl}/storage/v1/object/video-sources/${audioStoragePath}`;
    await supabase
      .from("studio_video_projects")
      .update({ source_audio_url: audioPublicPath })
      .eq("id", projectId);

    // ====================================
    //  ÉTAPE 6/10 — POST Whisper Infomaniak
    // ====================================
    await updateProgress(jobId, 50, "Envoi à Whisper Infomaniak...");

    const { batchId } = await submitToWhisper({
      audioPath,
      language: "fr",
    });

    // ====================================
    //  ÉTAPE 7/10 — Poll Whisper jusqu'à completion
    // ====================================
    await updateProgress(jobId, 55, "Transcription en cours...");

    const whisperResult = await pollWhisper(batchId, async (elapsed) => {
      const progressInRange = Math.min(25, (elapsed / 60) * 20);
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
    //  ÉTAPE 8/10 — Apply sanitizer (lexique tenant)
    // ====================================
    await updateProgress(jobId, 80, "Application du lexique tenant...");

    const { sanitized, appliedReplacements } = await applySanitizer(
      project.tenant_id,
      whisperResult.text
    );

    // ====================================
    //  ⭐ ÉTAPE 8.5/10 — ANCHORS BINARY SEARCH (cerveau précision)
    //  Détecte le timing EXACT de la voix via Whisper sur des chunks
    // ====================================
    await updateProgress(jobId, 85, "Calibration précise des sous-titres...");

    const whisperStart = whisperResult.segments?.[0]?.start || 0;
    const whisperEnd = whisperResult.segments?.[0]?.end
                       || whisperResult.durationSeconds
                       || 30;

    let speechAnchors: Array<{ whisperTime: number; realTime: number; textSnippet: string }> = [];
    let computedOffset = 0;

    try {
      const anchorResult = await findSpeechAnchors({
        audioPath,
        outputDir: jobTmpDir,
        audioDurationSeconds: whisperResult.durationSeconds || 30,
        whisperFullText: whisperResult.text,
        whisperStart,
        whisperEnd,
        precisionSeconds: 0.2,
      });

      speechAnchors = anchorResult.anchors;

      if (speechAnchors.length > 0) {
        const startAnchor = speechAnchors[0];
        computedOffset = startAnchor.realTime - startAnchor.whisperTime;
        log.info(
          `Anchors: ${anchorResult.totalCallsMade} appels en ${anchorResult.totalTimeSeconds.toFixed(1)}s, offset_start=${computedOffset.toFixed(2)}s`
        );
      }
    } catch (anchorErr) {
      const msg = anchorErr instanceof Error ? anchorErr.message : String(anchorErr);
      log.warn(`Anchors failed (using VAD fallback): ${msg}`);

      // Fallback sur VAD si anchors plantent
      computedOffset = vadSpeechStart > 0
        ? Math.max(0, vadSpeechStart - whisperStart)
        : 0;
    }

    // ====================================
    //  ÉTAPE 9/10 — Save transcript en DB
    // ====================================
    await updateProgress(jobId, 95, "Sauvegarde du transcript...");
    log.save();

    const updatedStateJson = {
      ...(project.state_json || {}),
      auto_subtitle_offset_seconds: computedOffset,
      speech_anchors: speechAnchors,
      transcript: {
        raw: whisperResult.text,
        edited: sanitized,
        segments: whisperResult.segments || [],
        words: whisperResult.words || [],
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
    //  ÉTAPE 10/10 — Mark job completed
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
        auto_subtitle_offset_seconds: computedOffset,
        speech_anchors_count: speechAnchors.length,
      },
    });
  } finally {
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