// ============================================================
//  Centralise la lecture du .env + clients Supabase/Infomaniak
// ============================================================

import "dotenv/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================================
//  Vérification des variables critiques
// ============================================================

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`❌ Variable d'environnement manquante: ${name}`);
  }
  return value.trim();
}

function optional(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : defaultValue;
}

// ============================================================
//  CONFIG EXPORT
// ============================================================

export const config = {
  // Supabase
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),

  // Whisper Infomaniak
  infomaniakToken: required("INFOMANIAK_AI_TOKEN"),
  infomaniakProductId: required("INFOMANIAK_AI_PRODUCT_ID"),
  infomaniakBaseUrl: optional("INFOMANIAK_AI_BASE_URL", "https://api.infomaniak.com/1/ai"),

  // Worker
  workerId: optional("WORKER_ID", "worker-local-1"),
  pollIntervalMs: parseInt(optional("POLL_INTERVAL_MS", "5000"), 10),
  whisperPollIntervalMs: parseInt(optional("WHISPER_POLL_INTERVAL_MS", "3000"), 10),
  whisperTimeoutMs: parseInt(optional("WHISPER_TIMEOUT_MS", "600000"), 10),
  tmpDir: optional("TMP_DIR", "./tmp"),
  logLevel: optional("LOG_LEVEL", "info"),
};

// ============================================================
//  CLIENTS
// ============================================================

// Supabase admin (service_role bypass RLS pour les workers)
export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);