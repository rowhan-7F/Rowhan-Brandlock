// ============================================================
//  Upload d'un fichier local vers Supabase Storage
// ============================================================

import { promises as fs } from "node:fs";
import path from "node:path";
import { supabase } from "../config.js";
import { log } from "../logger.js";

type UploadInput = {
  localPath: string;
  bucket: string;
  storagePath: string;  // ex: "flag_geneve/abc-123/audio.mp3"
  contentType?: string;  // ex: "audio/mpeg"
};

type UploadResult = {
  publicPath: string;  // = storagePath
  sizeBytes: number;
};

export async function uploadToStorage(input: UploadInput): Promise<UploadResult> {
  const { localPath, bucket, storagePath, contentType = "application/octet-stream" } = input;

  // 1. Lit le fichier local
  const buffer = await fs.readFile(localPath);
  const sizeBytes = buffer.length;
  const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);

  log.upload(`${sizeMb} MB`);

  // 2. Upload (upsert true pour remplacer si déjà présent)
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(
      `Failed to upload to ${bucket}/${storagePath}: ${error.message}`
    );
  }

  return {
    publicPath: data?.path || storagePath,
    sizeBytes,
  };
}