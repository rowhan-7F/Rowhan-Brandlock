// ============================================================
//  Whisper.cpp - Types TypeScript stricts
//  
//  Reflète la structure du JSON output produit par whisper-cli.exe
//  avec les flags -ojf (json full) + tokens + offsets.
//  
//  Source d'inspiration : worker/whisper-cpp/samples/source_output.json
// ============================================================

/**
 * Un token = unité atomique de transcription (souvent un mot ou un sub-mot)
 * Le timing en millisecondes est dans offsets.from / offsets.to.
 * 
 * Note : t_dtw n'est rempli QUE si on lance avec --dtw large.v3 + -nfa.
 * Comme on n'utilise pas DTW, ce champ sera toujours -1.
 */
export type WhisperCppToken = {
    /** Texte du token, peut être un mot complet ou un sub-mot. */
    text: string;
    /** Début du token en ms depuis le début de l'audio. */
    from_ms: number;
    /** Fin du token en ms depuis le début de l'audio. */
    to_ms: number;
    /** Score de confiance entre 0 et 1 (1 = parfaitement confiant). */
    confidence: number;
  };
  
  /**
   * Un segment = phrase ou groupe de tokens consécutifs (typiquement 3-8s).
   * Aligné avec ce que Whisper.cpp considère comme une "phrase".
   */
  export type WhisperCppSegment = {
    /** Début du segment en ms. */
    from_ms: number;
    /** Fin du segment en ms. */
    to_ms: number;
    /** Texte complet du segment (concaténation des tokens). */
    text: string;
    /** Tokens individuels avec leur timing précis. */
    tokens: WhisperCppToken[];
  };
  
  /**
   * Résultat complet d'une transcription Whisper.cpp.
   * Structuré pour être directement consommable par notre pipeline (generateAss, etc).
   */
  export type WhisperCppResult = {
    /** Langue détectée ou imposée (typiquement "fr"). */
    language: string;
    /** Durée audio totale en secondes (parsée du JSON). */
    duration_seconds: number;
    /** Texte complet concaténé (tous les segments). */
    text: string;
    /** Tableau des segments timecodés. */
    segments: WhisperCppSegment[];
    /** Indique si le résultat a été nettoyé (hallucinations filtrées). */
    hallucinations_filtered: number;
    /** Timing d'exécution en millisecondes (depuis whisper_print_timings). */
    timings_ms?: {
      load: number;
      total: number;
    };
  };
  
  /**
   * Options pour lancer Whisper.cpp.
   * Définit les paramètres du binaire spawn.
   */
  export type WhisperCppRunOptions = {
    /** Path absolu du fichier audio (WAV 16kHz mono recommandé, MP3 accepté). */
    audioPath: string;
    /** Langue ISO (ex: "fr", "en", "auto" pour auto-détection). */
    language?: string;
    /** Nombre de threads CPU (défaut: 16). */
    threads?: number;
    /** Dossier où écrire le JSON output (et le récupérer ensuite). */
    outputDir: string;
    /** Préfixe du fichier output (défaut: nom de l'audio sans extension). */
    outputBasename?: string;
    /** Callback de progression (appelé sur "progress = X%"). */
    onProgress?: (percent: number) => void;
  };
  
  /**
   * Structure brute du JSON Whisper.cpp -ojf.
   * Utilisé en interne par parseOutput.ts uniquement.
   * Ne pas exposer en dehors du module whisperCpp.
   */
  export type WhisperCppRawJson = {
    systeminfo: string;
    model: {
      type: string;
      multilingual: boolean;
    };
    params: {
      model: string;
      language: string;
    };
    result: {
      language: string;
    };
    transcription: Array<{
      timestamps: { from: string; to: string };
      offsets: { from: number; to: number };
      text: string;
      tokens: Array<{
        text: string;
        timestamps: { from: string; to: string };
        offsets: { from: number; to: number };
        id: number;
        p: number;
        t_dtw: number;
      }>;
    }>;
  };