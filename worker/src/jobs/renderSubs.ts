// ============================================================
//  Job handler: RENDER_FINAL (burned subs + voice-off + b-rolls)
// ============================================================

import path from "node:path";
import { supabase, config } from "../config.js";
import { log } from "../logger.js";
import { downloadFromStorage, cleanupJobTmp } from "../storage/download.js";
import { uploadToStorage } from "../storage/upload.js";
import { generateAss } from "../subs/generateAss.js";
import { burnSubs } from "../ffmpeg/burnSubs.js";
import { composeBrandAsset, BrandAssetOverlayFormat, BrandAssetBgKind } from "../ffmpeg/composeBrandAsset.js";
import { concatVideos } from "../ffmpeg/concatVideos.js";

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
  source_duration_seconds: number | null;
};

type BurnSubsBroll = {
  localPath: string;
  type: "video" | "image";
  start_time: number;
  end_time: number;
  position:
    | "fullscreen"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center";
  scale: number;
  duration_seconds: number;
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
      .select(
        "id, tenant_id, title, source_format, source_video_url, format, state_json, source_dimensions, source_duration_seconds"
      )
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr || !projectData) {
      throw new Error(
        `Project ${projectId} not found: ${projectErr?.message || "no data"}`
      );
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
    //  ÉTAPE 2.5 — Voice-off (optionnel)
    // ====================================
    let localVoiceoverPath: string | undefined;
    let audioMix:
      | { main_volume: number; voiceover_volume: number }
      | undefined;

    const voiceoverAudio = project.state_json?.voiceover_audio;
    const audioMixState = project.state_json?.audio_mix;

    if (voiceoverAudio?.url) {
      await updateProgress(jobId, 16, "Téléchargement de la voice-off...");

      const urlMatch = voiceoverAudio.url.match(
        /\/storage\/v1\/object\/public\/video-voiceovers\/(.+)$/
      );

      if (urlMatch) {
        const voiceoverStoragePath = urlMatch[1];
        const ext = voiceoverAudio.filename.split(".").pop() || "mp3";

        const { localPath: voicePath } = await downloadFromStorage({
          jobId,
          bucket: "video-voiceovers",
          storagePath: voiceoverStoragePath,
          outputFilename: `voiceover.${ext}`,
        });

        localVoiceoverPath = voicePath;
        audioMix = {
          main_volume: audioMixState?.main_volume ?? 0.25,
          voiceover_volume: audioMixState?.voiceover_volume ?? 1.0,
        };

        log.info(
          `Voice-off loaded: ${voiceoverAudio.filename} (main=${audioMix.main_volume}, vo=${audioMix.voiceover_volume})`
        );
      } else {
        log.warn(
          `Voice-off URL invalid format, skipping: ${voiceoverAudio.url}`
        );
      }
    }

    // ====================================
    //  ÉTAPE 2.6 — B-rolls (optionnel, plusieurs possibles)
    // ====================================
    const stateBrolls = project.state_json?.brolls;
    const localBrolls: BurnSubsBroll[] = [];

    if (Array.isArray(stateBrolls) && stateBrolls.length > 0) {
      await updateProgress(
        jobId,
        20,
        `Téléchargement de ${stateBrolls.length} b-roll${
          stateBrolls.length > 1 ? "s" : ""
        }...`
      );

      for (let i = 0; i < stateBrolls.length; i++) {
        const broll = stateBrolls[i];

        const urlMatch = broll.url.match(
          /\/storage\/v1\/object\/public\/video-brolls\/(.+)$/
        );
        if (!urlMatch) {
          log.warn(`B-roll ${broll.filename}: URL invalid, skipping`);
          continue;
        }

        const storagePath = urlMatch[1];
        const ext =
          broll.filename.split(".").pop() ||
          (broll.type === "video" ? "mp4" : "png");

        try {
          const { localPath } = await downloadFromStorage({
            jobId,
            bucket: "video-brolls",
            storagePath,
            outputFilename: `broll-${i}.${ext}`,
          });

          localBrolls.push({
            localPath,
            type: broll.type,
            start_time: broll.start_time,
            end_time: broll.end_time,
            position: broll.position,
            scale: broll.scale,
            duration_seconds: broll.duration_seconds,
          });

          log.info(
            `B-roll ${i + 1}/${stateBrolls.length} loaded: ${broll.filename} (${broll.type}, ${broll.position}, ${broll.start_time}-${broll.end_time}s)`
          );
        } catch (err: any) {
          log.warn(`B-roll ${broll.filename} download failed: ${err.message}`);
        }
      }
    }

    // ====================================
    //  ÉTAPE 3 — Generate .ass file
    // ====================================
    await updateProgress(jobId, 25, "Génération des sous-titres .ass...");

    const targetDims =
      FORMAT_DIMENSIONS[project.format] || { width: 1080, height: 1920 };

    const videoDuration =
      project.state_json?.transcript?.duration_seconds || null;

    const autoOffset =
      typeof project.state_json?.auto_subtitle_offset_seconds === "number"
        ? project.state_json.auto_subtitle_offset_seconds
        : 0;

    const manualOffset =
      typeof project.state_json?.subtitle_offset_seconds === "number"
        ? project.state_json.subtitle_offset_seconds
        : 0;

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
      anchors,
    });

    log.info(`Generated .ass with ${segmentCount} segments`);

    // ====================================
    //  ÉTAPE 4 — Burn subs + audio mix + overlays
    // ====================================
    const features: string[] = ["subs"];
    if (localVoiceoverPath) features.push("voice-off");
    if (localBrolls.length > 0) features.push(`${localBrolls.length} b-roll(s)`);
    const burnLabel = `Render FFmpeg (${features.join(" + ")})...`;
    await updateProgress(jobId, 30, burnLabel);

    const startBurn = Date.now();

    const progressTicker = setInterval(async () => {
      const elapsed = (Date.now() - startBurn) / 1000;
      const estimatedPercent = Math.min(85, 30 + Math.floor(elapsed * 3));
      await updateProgress(
        jobId,
        estimatedPercent,
        `${burnLabel.replace("...", "")} (${Math.floor(elapsed)}s)...`
      );
    }, 3000);

    const { outputPath, sizeBytes: outputSize } = await burnSubs({
      videoPath: localVideoPath,
      assPath,
      outputDir: jobTmpDir,
      videoWidth: targetDims.width,
      videoHeight: targetDims.height,
      voiceoverPath: localVoiceoverPath,
      audioMix,
      brolls: localBrolls,
    });

    clearInterval(progressTicker);

    // ====================================
    //  ⭐ ÉTAPE 4.5 — Brand Assets compose + concat (Phase 7.6)
    // ====================================
    let finalRenderPath = outputPath;
    let finalSize = outputSize;

    const introId = project.state_json?.intro_id as string | undefined;
    const introBgId = project.state_json?.intro_background_id as
      | string
      | undefined;
    const outroId = project.state_json?.outro_id as string | undefined;
    const outroBgId = project.state_json?.outro_background_id as
      | string
      | undefined;

    if (introId || outroId) {
      await updateProgress(jobId, 86, "Composition intro/outro...");

      const assetIds = [introId, outroId].filter(Boolean) as string[];
      const { data: assets, error: assetsErr } = await supabase
        .from("brand_video_assets")
        .select(
          `id, asset_type, name, overlay_url, overlay_format,
           overlay_width, overlay_height, duration_seconds,
           default_bg_url, default_bg_kind,
           position_x, position_y,
           backgrounds:brand_video_asset_backgrounds (
             id, bg_url, bg_kind, is_approved
           )`
        )
        .in("id", assetIds)
        .eq("is_active", true);

      if (assetsErr) {
        log.warn(
          `[brand-assets] DB error fetching assets: ${assetsErr.message}. Skipping intro/outro.`
        );
      } else {
        const introAsset = assets?.find((a) => a.id === introId);
        const outroAsset = assets?.find((a) => a.id === outroId);

        const composedClips: { type: "intro" | "outro"; path: string }[] = [];

        // Helper : download overlay + bg + compose 1 clip
        const composeOne = async (
          asset: any,
          bgVariantId: string | undefined,
          assetType: "intro" | "outro"
        ): Promise<string | null> => {
          // Pick BG : variant approuvée OU default
          let bgUrl: string | null = null;
          let bgKind: BrandAssetBgKind | null = null;

          if (bgVariantId) {
            const bgVariant = (asset.backgrounds || []).find(
              (b: any) => b.id === bgVariantId && b.is_approved
            );
            if (bgVariant) {
              bgUrl = bgVariant.bg_url;
              bgKind = bgVariant.bg_kind;
            }
          }
          if (!bgUrl && asset.default_bg_url) {
            bgUrl = asset.default_bg_url;
            bgKind = asset.default_bg_kind;
          }
          if (!bgUrl || !bgKind) {
            log.warn(
              `[brand-assets] ${assetType} "${asset.name}": no BG available. Skipping.`
            );
            return null;
          }

          // Download overlay
          const overlayUrlMatch = (asset.overlay_url as string).match(
            /\/storage\/v1\/object\/public\/brand-video-overlays\/(.+)$/
          );
          if (!overlayUrlMatch) {
            log.warn(
              `[brand-assets] ${assetType}: overlay URL invalid format, skipping.`
            );
            return null;
          }

          const overlayExt = asset.overlay_format as BrandAssetOverlayFormat;
          const { localPath: overlayLocalPath } = await downloadFromStorage({
            jobId,
            bucket: "brand-video-overlays",
            storagePath: overlayUrlMatch[1],
            outputFilename: `${assetType}-overlay.${overlayExt}`,
          });

          // Download BG
          const bgUrlMatch = (bgUrl as string).match(
            /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/
          );
          if (!bgUrlMatch) {
            log.warn(
              `[brand-assets] ${assetType}: BG URL invalid format, skipping.`
            );
            return null;
          }
          const bgBucket = bgUrlMatch[1];
          const bgStoragePath = bgUrlMatch[2];
          const bgExt = bgStoragePath.split(".").pop() || "mp4";

          const { localPath: bgLocalPath } = await downloadFromStorage({
            jobId,
            bucket: bgBucket,
            storagePath: bgStoragePath,
            outputFilename: `${assetType}-bg.${bgExt}`,
          });

          // Compose
          const { outputPath: composedPath } = await composeBrandAsset({
            overlayPath: overlayLocalPath,
            overlayFormat: overlayExt,
            bgPath: bgLocalPath,
            bgKind,
            durationSeconds: Number(asset.duration_seconds),
            videoWidth: targetDims.width,
            videoHeight: targetDims.height,
            positionX: Number(asset.position_x ?? 0),
            positionY: Number(asset.position_y ?? 0),
            outputDir: jobTmpDir,
            outputFilename: `${assetType}.mp4`,
          });

          log.info(
            `[brand-assets] ${assetType} composed: ${asset.name} (${asset.duration_seconds}s)`
          );

          return composedPath;
        };

        if (introAsset) {
          const p = await composeOne(introAsset, introBgId, "intro");
          if (p) composedClips.push({ type: "intro", path: p });
        }
        if (outroAsset) {
          const p = await composeOne(outroAsset, outroBgId, "outro");
          if (p) composedClips.push({ type: "outro", path: p });
        }

        // Concat si au moins 1 clip à ajouter
        if (composedClips.length > 0) {
          await updateProgress(
            jobId,
            88,
            `Concat ${composedClips.length} clip(s) brand + main...`
          );

          const introPath = composedClips.find((c) => c.type === "intro")?.path;
          const outroPath = composedClips.find((c) => c.type === "outro")?.path;

          const concatList: string[] = [];
          if (introPath) concatList.push(introPath);
          concatList.push(outputPath); // main (subs + voice-off + b-rolls)
          if (outroPath) concatList.push(outroPath);

          const { outputPath: concatedPath, sizeBytes: concatedSize } =
            await concatVideos({
              inputPaths: concatList,
              outputDir: jobTmpDir,
              outputFilename: "final-with-brand.mp4",
            });

          finalRenderPath = concatedPath;
          finalSize = concatedSize;

          log.info(
            `[brand-assets] Final concated: ${concatList.length} segments → ${(
              concatedSize /
              1024 /
              1024
            ).toFixed(1)} MB`
          );
        }
      }
    }

    // ====================================
    //  ÉTAPE 5 — Upload final video
    // ====================================
    await updateProgress(jobId, 90, "Upload de la vidéo finale...");

    const finalStoragePath = `${project.tenant_id}/${project.id}/final.mp4`;
    await uploadToStorage({
      localPath: finalRenderPath,
      bucket: "video-exports",
      storagePath: finalStoragePath,
      contentType: "video/mp4",
    });

    // ====================================
    //  ÉTAPE 6 — Update DB
    // ====================================
    await updateProgress(jobId, 95, "Finalisation...");

    const finalUrl = `${config.supabaseUrl}/storage/v1/object/video-exports/${finalStoragePath}`;

    const renderSettings: Record<string, any> = {
      render_type: "subs_burned",
      segments_count: segmentCount,
      output_size_bytes: finalSize,
      subtitle_style: "luxury_helvetica_bold",
      format: project.format,
      has_voiceover: !!localVoiceoverPath,
      brolls_count: localBrolls.length,
    };

    if (localVoiceoverPath && audioMix) {
      renderSettings.voiceover = {
        filename: voiceoverAudio?.filename,
        duration_seconds: voiceoverAudio?.duration_seconds,
        main_volume: audioMix.main_volume,
        voiceover_volume: audioMix.voiceover_volume,
      };
    }

    if (localBrolls.length > 0) {
      renderSettings.brolls = localBrolls.map((b) => ({
        type: b.type,
        position: b.position,
        start_time: b.start_time,
        end_time: b.end_time,
        scale: b.scale,
      }));
    }

    const { error: updateErr } = await supabase
      .from("studio_video_projects")
      .update({
        status: "completed",
        rendered_at: new Date().toISOString(),
        final_video_url: finalUrl,
        render_settings: renderSettings,
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
        output_size_bytes: finalSize,
        output_path: finalStoragePath,
        has_voiceover: !!localVoiceoverPath,
        brolls_count: localBrolls.length,
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