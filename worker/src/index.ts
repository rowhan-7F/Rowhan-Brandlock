// ============================================================
//  ENTRY POINT du Worker BrandLock
//  - Initialise config + clients
//  - Lance la poll loop
//  - Gère l'arrêt propre (Ctrl+C)
// ============================================================

import { config, supabase } from "./config.js";
import { log } from "./logger.js";
import { processTranscribeJob } from "./jobs/transcribe.js";
import { processRenderJob } from "./jobs/renderSubs.js";

let isRunning = true;
let activeJobId: string | null = null;

// ============================================================
//  POLL LOOP
// ============================================================

async function pollLoop() {
  log.success("BrandLock Worker started");
  log.info(`Worker ID: ${config.workerId}`);
  log.info(`Supabase: ${config.supabaseUrl}`);
  log.info(`Whisper: Whisper.cpp local (model large-v3, CPU 16 threads + BLAS)`);
  log.info(`Poll interval: ${config.pollIntervalMs}ms`);
  console.log("");

  while (isRunning) {
    try {
      // Claim le prochain job dispo
      const { data: jobs, error } = await supabase.rpc("claim_video_job", {
        p_worker_id: config.workerId,
        p_job_types: ["transcribe", "render_final"],
        p_lock_minutes: 30,
      });

      if (error) {
        log.error("Failed to claim job", error);
        await sleep(config.pollIntervalMs);
        continue;
      }

      if (!jobs || jobs.length === 0) {
        // Pas de job dispo, log discret en mode debug
        if (config.logLevel === "debug") {
          log.poll();
        }
        await sleep(config.pollIntervalMs);
        continue;
      }

      // On a un job ! Process it
      const job = jobs[0];
      activeJobId = job.job_id;

      log.claim(job.job_id, job.job_type, job.attempts);

      const startTime = Date.now();

      try {
        if (job.job_type === "transcribe") {
          await processTranscribeJob({
            jobId: job.job_id,
            projectId: job.project_id,
            payload: job.payload,
          });
        } else if (job.job_type === "render_final") {
          await processRenderJob({
            jobId: job.job_id,
            projectId: job.project_id,
            payload: job.payload,
          });
        } else {
          log.warn(`Unknown job type: ${job.job_type}`);
          await supabase.rpc("fail_video_job", {
            p_job_id: job.job_id,
            p_error_message: `Unknown job type: ${job.job_type}`,
            p_should_retry: false,
          });
        }

        const durationSec = (Date.now() - startTime) / 1000;
        log.completed(durationSec);
      } catch (err: any) {
        log.error(`Job ${job.job_id} failed`, err);
        await supabase.rpc("fail_video_job", {
          p_job_id: job.job_id,
          p_error_message: err.message || String(err),
          p_should_retry: true,
        });
      } finally {
        activeJobId = null;
      }

      console.log(""); // Ligne vide entre les jobs
    } catch (err: any) {
      log.error("Poll loop error", err);
      await sleep(config.pollIntervalMs);
    }
  }

  log.info("Worker stopped gracefully");
  process.exit(0);
}

// ============================================================
//  UTILITAIRES
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
//  GRACEFUL SHUTDOWN (Ctrl+C)
// ============================================================

process.on("SIGINT", () => {
  console.log("");
  log.warn("Received SIGINT, finishing current job before exiting...");
  isRunning = false;

  if (!activeJobId) {
    log.info("No active job, exiting now");
    process.exit(0);
  } else {
    log.info(`Waiting for active job ${activeJobId} to finish...`);
    // Le job en cours va finir naturellement et la boucle s'arrêtera
  }
});

process.on("SIGTERM", () => {
  isRunning = false;
});

process.on("uncaughtException", (err) => {
  log.error("Uncaught exception", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  log.error("Unhandled promise rejection", err);
  process.exit(1);
});

// ============================================================
//  START
// ============================================================

pollLoop().catch((err) => {
  log.error("Fatal error in poll loop", err);
  process.exit(1);
});