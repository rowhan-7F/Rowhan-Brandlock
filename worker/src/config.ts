// ============================================================
//  Centralise la lecture du .env + clients Supabase
//  Note : Whisper est désormais local (Whisper.cpp), pas d'API externe
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

// Whisper : local via worker/whisper-cpp/ (binary + model large-v3)

  // Worker
  workerId: optional("WORKER_ID", "worker-local-1"),
  pollIntervalMs: parseInt(optional("POLL_INTERVAL_MS", "5000"), 10),
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