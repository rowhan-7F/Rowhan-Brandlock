// ============================================================
//  Whisper.cpp - Configuration
//  
//  Paths du binaire et du modèle, lus depuis les variables
//  d'environnement avec des valeurs par défaut sensées.
//  
//  En dev local Windows : pointent vers worker/whisper-cpp/
//  En prod VPS Linux : à override via worker/.env
// ============================================================

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Racine du worker (worker/) — 2 niveaux au-dessus de src/whisperCpp/
const WORKER_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Path absolu du binaire whisper-cli.
 * 
 * Windows dev : worker/whisper-cpp/bin/whisper-cli.exe
 * Linux prod  : worker/whisper-cpp/bin/whisper-cli  (sans extension)
 */
export const WHISPER_CPP_BINARY_PATH =
  process.env.WHISPER_CPP_BINARY_PATH ||
  path.join(
    WORKER_ROOT,
    "whisper-cpp",
    "bin",
    process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli"
  );

/**
 * Path absolu du modèle ggml.
 * 
 * On utilise large-v3 (3 GB) pour qualité FR maximale.
 */
export const WHISPER_CPP_MODEL_PATH =
  process.env.WHISPER_CPP_MODEL_PATH ||
  path.join(WORKER_ROOT, "whisper-cpp", "models", "ggml-large-v3.bin");

/**
 * Configuration par défaut des paramètres d'inférence.
 * 
 * Ces valeurs sont le résultat de nos tests luxury C2 (sans DTW)
 * sur des vidéos FR de 30-100s. Validées 2026-05-22.
 */
export const WHISPER_CPP_DEFAULTS = {
  /** Nombre de threads CPU (sweet spot pour CPU 16-20 cores). */
  threads: 16,
  /** Langue par défaut (auto-détection si "auto"). */
  language: "fr",
  /** Beam size (qualité décodage). */
  beamSize: 5,
  /** Force CPU mode (pas de GPU pour l'instant). */
  noGpu: true,
} as const;

/**
 * Patterns d'hallucinations Whisper connues en français.
 * Ces lignes apparaissent souvent en fin de fichier à cause des données
 * d'entraînement (sous-titres TV, vidéos YouTube génériques).
 * 
 * Toute ligne matchant un de ces patterns sera filtrée du résultat final.
 */
export const KNOWN_HALLUCINATIONS_FR: RegExp[] = [
  /sous-titrage\s+(soci[eé]t[eé]\s+)?radio-canada/i,
  /sous-titres\s+r[eé]alis[eé]s\s+par/i,
  /sous-titres\s+(faits|produits)\s+par/i,
  /amara\.org/i,
  /merci\s+(d'avoir\s+regard[eé]|de\s+(votre\s+)?attention)/i,
  /n['']oubliez\s+pas\s+de\s+(vous\s+)?(abonner|liker)/i,
  /like\s+et\s+(abonn|s'abonner)/i,
  /clique[zr]?\s+sur\s+la\s+cloche/i,
];