// ============================================================
//  Whisper.cpp - Public API
//  
//  Point d'entrée unique du module.
//  Importer depuis "./whisperCpp" plutôt que de chaque fichier.
// ============================================================

export { runWhisperCpp } from "./runWhisperCpp.js";
export { parseWhisperCppOutput, reconstructWordsFromTokens } from "./parseOutput.js";
export type { ReconstructedWord } from "./parseOutput.js";

export {
  WHISPER_CPP_BINARY_PATH,
  WHISPER_CPP_MODEL_PATH,
  WHISPER_CPP_DEFAULTS,
  KNOWN_HALLUCINATIONS_FR,
} from "./config.js";

export type {
  WhisperCppResult,
  WhisperCppSegment,
  WhisperCppToken,
  WhisperCppRunOptions,
} from "./types.js";