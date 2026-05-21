// ============================================================
//  Download d'un fichier depuis Supabase Storage
//  Génère une signed URL, fetch en streaming dans /tmp
// ============================================================

import { promises as fs } from "node:fs";
import path from "node:path";
import { supabase, config } from "../config.js";
import { log } from "../logger.js";

type DownloadInput = {
  jobId: string;
  bucket: string;
  storagePath: string;  // ex: "flag_geneve/abc-123/source.mp4"
  outputFilename: string;  // ex: "source.mp4"
};

type DownloadResult = {
  localPath: string;  // chemin absolu du fichier téléchargé
  sizeBytes: number;
};

export async function downloadFromStorage(input: DownloadInput): Promise<DownloadResult> {
  const { jobId, bucket, storagePath, outputFilename } = input;

  // 1. Crée le dossier tmp/{jobId}/
  const jobTmpDir = path.resolve(config.tmpDir, jobId);
  await fs.mkdir(jobTmpDir, { recursive: true });

  const localPath = path.join(jobTmpDir, outputFilename);

  // 2. Génère une signed URL (10 min suffit pour le download)
  const { data: signedData, error: signedErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 600);

  if (signedErr || !signedData?.signedUrl) {
    throw new Error(
      `Failed to generate signed URL for ${bucket}/${storagePath}: ${signedErr?.message || "unknown error"}`
    );
  }

  // 3. Fetch + stream to disk
  const response = await fetch(signedData.signedUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${bucket}/${storagePath}: HTTP ${response.status} ${response.statusText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(localPath, buffer);

  const sizeBytes = buffer.length;
  const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);
  log.download(`${sizeMb} MB`);

  return { localPath, sizeBytes };
}

// ============================================================
//  Cleanup tmp dir
// ============================================================

export async function cleanupJobTmp(jobId: string): Promise<void> {
  const jobTmpDir = path.resolve(config.tmpDir, jobId);
  try {
    await fs.rm(jobTmpDir, { recursive: true, force: true });
    log.cleanup(jobId);
  } catch (err: any) {
    log.warn(`Cleanup failed for ${jobId}: ${err.message}`);
  }
}