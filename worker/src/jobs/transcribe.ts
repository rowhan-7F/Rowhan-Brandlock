// ============================================================
//  Job handler: TRANSCRIBE
//  Pipeline 100% local + souverain Suisse avec Whisper.cpp :
//  download -> extract WAV -> upload -> Whisper.cpp -> sanitizer -> save
//
//  Migration 2026-05-22 : Infomaniak Whisper -> Whisper.cpp self-hosted
//  BÃ©nÃ©fices :
//  - SouverainetÃ© Suisse maximale (zÃ©ro cloud externe)
//  - Token-level timestamps natifs (filtre hallucinations FR)
//  - Plus de drift sur vidÃ©os longues (>60s)
//  - Suppression VAD + anchors binary search (devenus inutiles)
//  - ~50% moins de code, ~10x plus maintenable
// ============================================================

import path from "node:path";
import { supabase, config } from "../config.js";
import { log } from "../logger.js";
import { downloadFromStorage, cleanupJobTmp } from "../storage/download.js";
import { uploadToStorage } from "../storage/upload.js";
import { extractAudio } from "../ffmpeg/extractAudio.js";
import { enhanceAudio } from "../ffmpeg/audioEnhance.js";
import { runWhisperCpp, reconstructWordsFromTokens } from "../whisperCpp/index.js";
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
  mode: string;
  source_format: string | null;
  source_video_url: string | null;
  state_json: Record<string, unknown>;
};

export async function processTranscribeJob(input: TranscribeJobInput): Promise<void> {
  const { jobId, projectId } = input;

  try {
    // ====================================
    //  Ã‰TAPE 1/8 â€” Charger le projet
    // ====================================
    await updateProgress(jobId, 5, "RÃ©cupÃ©ration du projet...");

    const { data: projectData, error: projectErr } = await supabase
      .from("studio_video_projects")
      .select("id, tenant_id, title, mode, source_format, source_video_url, state_json")
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
    //  Ã‰TAPE 2/8 â€” Download media source
    //  â­ Phase X1 : PrioritÃ© au voice-off si prÃ©sent
    //  Le voice-off est plus propre que l'audio source (pas de bruit ambiant,
    //  pas de musique, Ã©locution claire) â†’ transcription mieux synchronisÃ©e
    //  avec ce que l'utilisateur entendra dans la vidÃ©o finale.
    // ====================================
    const voiceoverAudio = project.state_json?.voiceover_audio as
      | { url?: string; filename?: string }
      | undefined;

    const voUrlMatch = voiceoverAudio?.url
      ? voiceoverAudio.url.match(
          /\/storage\/v1\/object\/public\/video-voiceovers\/(.+)$/
        )
      : null;

    let localVideoPath: string;
    let transcribedFrom: "voiceover" | "video";

    if (voUrlMatch) {
      // â­ Voice-off dÃ©tectÃ© â†’ on transcribe le voice-off
      await updateProgress(jobId, 10, "TÃ©lÃ©chargement de la voice-off (prioritaire)...");

      const voiceoverStoragePath = voUrlMatch[1];
      const ext = voiceoverAudio?.filename?.split(".").pop() || "mp3";

      const { localPath } = await downloadFromStorage({
        jobId,
        bucket: "video-voiceovers",
        storagePath: voiceoverStoragePath,
        outputFilename: `voiceover.${ext}`,
      });

      localVideoPath = localPath;
      transcribedFrom = "voiceover";
      log.info(`[transcribe] Phase X1 â€” Voice-off detected, transcribing voice-off audio`);
    } else {
      // Pas de voice-off â†’ vidÃ©o source (comportement par dÃ©faut)
      await updateProgress(jobId, 10, "TÃ©lÃ©chargement de la vidÃ©o source...");

      // Fix path : extraire depuis source_video_url si disponible (sinon fallback)
      let sourcePath: string;
      if (project.source_video_url) {
        const urlMatch = project.source_video_url.match(/video-sources\/(.+?)(\?|$)/);
        sourcePath = urlMatch?.[1] ?? `${project.tenant_id}/${project.id}/source.${project.source_format}`;
      } else {
        sourcePath = `${project.tenant_id}/${project.id}/source.${project.source_format}`;
      }
      const { localPath } = await downloadFromStorage({
        jobId,
        bucket: "video-sources",
        storagePath: sourcePath,
        outputFilename: `source.${project.source_format}`,
      });

      localVideoPath = localPath;
      transcribedFrom = "video";
    }

    // ====================================
    //  Ã‰TAPE 3/8 â€” Extract audio WAV 16kHz mono
    // ====================================
    await updateProgress(
        jobId,
        25,
        transcribedFrom === "voiceover"
          ? "Conversion voice-off â†’ WAV 16kHz..."
          : "Extraction de la piste audio (FFmpeg)..."
      );

    const jobTmpDir = path.dirname(localVideoPath);
    const { audioPath, sizeBytes: audioSizeBytes } = await extractAudio({
      videoPath: localVideoPath,
      outputDir: jobTmpDir,
    });

    // ====================================
    //  ETAPE 4.5/8 â€” Audio Enhancement (Phase 8.B)
    //  Applique un filtre FFmpeg selon project.mode :
    //  - studio_clean   : passthrough
    //  - voice_music    : highpass + denoise leger
    //  - field_event    : highpass + lowpass + denoise fort + dynaudnorm
    //  - premium_demux  : event + compression dynamique
    // ====================================
    await updateProgress(jobId, 35, "Optimisation audio (mode " + project.mode + ")...");

    const { enhancedPath: whisperAudioPath, applied: enhanceApplied, activeMode: enhanceActiveMode } = await enhanceAudio({
      inputPath: audioPath,
      outputDir: jobTmpDir,
      mode: project.mode,
      onLog: (msg) => log.info(msg),
    });

    log.info("Audio enhancement: applied=" + enhanceApplied + " (mode=" + project.mode + " -> active=" + enhanceActiveMode + ")");

    // ====================================
    //  Ã‰TAPE 4/8 â€” Upload audio.wav vers Supabase Storage
    // ====================================
    await updateProgress(jobId, 35, "Upload de l'audio extrait...");

    const audioStoragePath = `${project.tenant_id}/${project.id}/audio.wav`;
    await uploadToStorage({
      localPath: audioPath,
      bucket: "video-sources",
      storagePath: audioStoragePath,
      contentType: "audio/wav",
    });

    const audioPublicPath = `${config.supabaseUrl}/storage/v1/object/video-sources/${audioStoragePath}`;
    await supabase
      .from("studio_video_projects")
      .update({ source_audio_url: audioPublicPath })
      .eq("id", projectId);

    // ====================================
    //  â­ Ã‰TAPE 5/8 â€” Whisper.cpp (transcription locale souveraine)
    // ====================================
    await updateProgress(jobId, 40, "Transcription Whisper.cpp en cours...");

    const whisperStart = Date.now();

    const whisperResult = await runWhisperCpp({
      audioPath: whisperAudioPath,
      language: "fr",
      threads: 16,
      outputDir: jobTmpDir,
      outputBasename: "whisper_output",
      onProgress: async (percent) => {
        // Map 0-100% Whisper -> 40-90% du job global
        const jobPercent = Math.floor(40 + (percent / 100) * 50);
        await updateProgress(
          jobId,
          jobPercent,
          `Transcription en cours (${percent}%)...`
        );
      },
    });

    const whisperElapsed = ((Date.now() - whisperStart) / 1000).toFixed(1);
    log.info(
      `Whisper.cpp: ${whisperResult.segments.length} segments, ` +
      `${whisperResult.hallucinations_filtered} hallucinations filtered, ` +
      `total ${whisperElapsed}s`
    );

    if (whisperResult.segments.length === 0) {
      log.warn("[transcribe] No speech detected after filter - saving empty transcript");
      const emptyStateJson = {
        ...(project.state_json || {}),
        transcript: {
          raw: whisperResult.text || "",
          edited: "",
          segments: [],
          words: [],
          language: whisperResult.language || "fr",
          duration_seconds: whisperResult.duration_seconds,
          sanitized_at: new Date().toISOString(),
          applied_replacements_count: 0,
          engine: "whisper.cpp-large-v3",
          hallucinations_filtered: whisperResult.hallucinations_filtered,
          no_speech_detected: true,
        },
      };
      await supabase
        .from("studio_video_projects")
        .update({
          state_json: emptyStateJson,
          status: "transcribed",
          transcribed_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      log.info("[transcribe] Empty transcript saved (no speech detected)");
      return;
    }

    // ====================================
    //  Ã‰TAPE 6/8 â€” Apply sanitizer (lexique tenant)
    // ====================================
    await updateProgress(jobId, 92, "Application du lexique tenant...");

    const { sanitized, appliedReplacements } = await applySanitizer(
      project.tenant_id,
      whisperResult.text
    );

    // ====================================
    //  Ã‰TAPE 7/8 â€” Save transcript en DB
    // ====================================
    await updateProgress(jobId, 97, "Sauvegarde du transcript...");
    log.save();

    // Reconstruction des VRAIS mots depuis les sub-tokens BPE Whisper.
    // Sans Ã§a, "Fabien" reste dÃ©coupÃ© en " Fab" + "ien" dans les subs.
    // On reconstruit segment par segment pour prÃ©server les frontiÃ¨res naturelles.
    const segmentsWithRealWords = whisperResult.segments.map((seg) => ({
        raw: seg,
        words: reconstructWordsFromTokens(seg.tokens),
      }));
  
      // Conversion ms -> secondes pour generateAss.ts.
      // â­ FIX TIMING : on resserre start/end sur le PREMIER et DERNIER mot rÃ©el,
      //    pas sur les frontiÃ¨res du segment Whisper (qui incluent les silences).
      //    Ã‰vite que les subs apparaissent pendant les pauses.
      const legacySegments = segmentsWithRealWords.map(({ raw, words }) => {
        if (words.length === 0) {
          // Fallback rare : segment sans mots reconstituÃ©s (devrait pas arriver)
          return {
            start: raw.from_ms / 1000,
            end: raw.to_ms / 1000,
            text: raw.text,
          };
        }
        const firstWord = words[0];
        const lastWord = words[words.length - 1];
        return {
          start: firstWord.start_ms / 1000,
          end: lastWord.end_ms / 1000,
          text: raw.text,
        };
      });
  
      // Flatten en liste plate pour generateAss (compat words)
      const reconstructedWords = segmentsWithRealWords.flatMap((s) => s.words);
  
      // Convertit en format "words" attendu par generateAss.ts (start/end en secondes)
      const legacyWords = reconstructedWords.map((w) => ({
        word: w.word,
        start: w.start_ms / 1000,
        end: w.end_ms / 1000,
        confidence: w.confidence,
      }));

    const chunkedSegments =
      reconstructedWords.length > 0
        ? chunkWordsIntoCues(reconstructedWords, MAX_CUE_CHARS)
        : legacySegments;

    const updatedStateJson = {
      ...(project.state_json || {}),
      transcript: {
        raw: whisperResult.text,
        edited: sanitized,
        segments: chunkedSegments,
        words: legacyWords,
        language: whisperResult.language || "fr",
        duration_seconds: whisperResult.duration_seconds,
        sanitized_at: new Date().toISOString(),
        applied_replacements_count: appliedReplacements,
        engine: "whisper.cpp-large-v3",
        hallucinations_filtered: whisperResult.hallucinations_filtered,
        source: transcribedFrom, // â­ Phase X1 : "voiceover" ou "video"
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
    //  Ã‰TAPE 8/8 â€” Mark job completed
    // ====================================
    await supabase.rpc("complete_video_job", {
      p_job_id: jobId,
      p_result_data: {
        transcript_length: sanitized.length,
        raw_length: whisperResult.text.length,
        applied_replacements: appliedReplacements,
        segments_count: whisperResult.segments.length,
        words_count: legacyWords.length,
        language: whisperResult.language || "fr",
        audio_size_bytes: audioSizeBytes,
        hallucinations_filtered: whisperResult.hallucinations_filtered,
        engine: "whisper.cpp-large-v3",
        whisper_load_ms: whisperResult.timings_ms?.load,
        whisper_total_ms: whisperResult.timings_ms?.total,
      },
    });
  } finally {
    await cleanupJobTmp(jobId);
  }
}

// ============================================================
//  Helper â€” Update progress sans casser le job si update Ã©choue
// ============================================================

// Cible de longueur d'un cue (caracteres). Plus petit = cues plus courts / plus de segments.
const MAX_CUE_CHARS = 68;

type CueWord = { word: string; start_ms: number; end_ms: number };

function buildCue(ws: CueWord[]): { start: number; end: number; text: string } {
  const text = ws.map((w) => w.word).join(" ").replace(/\s+/g, " ").trim();
  return { start: ws[0].start_ms / 1000, end: ws[ws.length - 1].end_ms / 1000, text };
}

function chunkWordsIntoCues(words: CueWord[], maxChars: number): { start: number; end: number; text: string }[] {
  const cues: { start: number; end: number; text: string }[] = [];
  let cur: CueWord[] = [];
  let curLen = 0;
  for (const w of words) {
    const wl = (w.word || "").trim();
    if (!wl) continue;
    const piece: CueWord = { word: wl, start_ms: w.start_ms, end_ms: w.end_ms };
    const addLen = curLen === 0 ? wl.length : curLen + 1 + wl.length;
    if (curLen > 0 && addLen > maxChars) {
      cues.push(buildCue(cur));
      cur = [piece];
      curLen = wl.length;
    } else {
      cur.push(piece);
      curLen = addLen;
    }
    if (/[.!?]$/.test(wl) && curLen >= maxChars * 0.5) {
      cues.push(buildCue(cur));
      cur = [];
      curLen = 0;
    }
  }
  if (cur.length > 0) cues.push(buildCue(cur));
  return cues;
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
