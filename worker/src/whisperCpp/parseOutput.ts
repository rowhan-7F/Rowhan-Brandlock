// ============================================================
//  Whisper.cpp - Parse JSON Output + Reconstruct Words
//
//  Transforme le JSON brut produit par whisper-cli (-ojf)
//  en structure WhisperCppResult propre et typée.
//
//  Filtre les hallucinations connues en français.
//  Reconstitue les mots entiers depuis les sub-tokens BPE.
//
//  Fix 2026-05-22 : la ponctuation isolée (","/"."/"!"/"?")
//  a un timestamp synthétique qui mange les silences réels.
//  On ignore donc ces tokens pour le calcul du end_ms du mot.
// ============================================================

import { promises as fs } from "node:fs";
import { KNOWN_HALLUCINATIONS_FR } from "./config.js";
import type {
  WhisperCppRawJson,
  WhisperCppResult,
  WhisperCppSegment,
  WhisperCppToken,
} from "./types.js";

/**
 * Type d'un mot reconstitué depuis les sub-tokens BPE Whisper.
 */
export type ReconstructedWord = {
  word: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
};

/**
 * Lit et parse un fichier JSON Whisper.cpp.
 * Filtre automatiquement les hallucinations FR connues.
 */
export async function parseWhisperCppOutput(
  jsonPath: string
): Promise<WhisperCppResult> {
  const rawContent = await fs.readFile(jsonPath, "utf8");
  const raw = JSON.parse(rawContent) as WhisperCppRawJson;

  if (!raw.transcription || !Array.isArray(raw.transcription)) {
    throw new Error(
      `Invalid Whisper.cpp JSON : 'transcription' array missing in ${jsonPath}`
    );
  }

  // ============================================================
  //  Étape 1 : Parse tous les segments en structure interne
  // ============================================================
  const allSegments: WhisperCppSegment[] = raw.transcription
    .filter((seg) => seg.text && seg.text.trim().length > 0)
    .map((seg) => {
      const tokens: WhisperCppToken[] = (seg.tokens || [])
        .filter((tok) => {
          const text = tok.text || "";
          return !text.startsWith("[_") && text.trim().length > 0;
        })
        .map((tok) => ({
          text: tok.text,
          from_ms: tok.offsets.from,
          to_ms: tok.offsets.to,
          confidence: tok.p,
        }));

      return {
        from_ms: seg.offsets.from,
        to_ms: seg.offsets.to,
        text: seg.text.trim(),
        tokens,
      };
    });

  // ============================================================
  //  Étape 2 : Filtre les hallucinations connues
  // ============================================================
  const cleanedSegments: WhisperCppSegment[] = [];
  let hallucinationsFiltered = 0;

  for (const seg of allSegments) {
    const isHallucination = KNOWN_HALLUCINATIONS_FR.some((pattern) =>
      pattern.test(seg.text)
    );

    if (isHallucination) {
      hallucinationsFiltered++;
      continue;
    }
    cleanedSegments.push(seg);
  }

  // ============================================================
  //  Étape 3 : Compose le résultat final
  // ============================================================
  const text = cleanedSegments.map((s) => s.text).join(" ").trim();
  const lastSegment = cleanedSegments[cleanedSegments.length - 1];
  const duration_seconds = lastSegment ? lastSegment.to_ms / 1000 : 0;

  return {
    language: raw.result?.language || raw.params?.language || "unknown",
    duration_seconds,
    text,
    segments: cleanedSegments,
    hallucinations_filtered: hallucinationsFiltered,
  };
}

// ============================================================
//  Reconstruction des vrais mots depuis les sub-tokens BPE
//
//  Whisper.cpp tokenize en BPE : "Fabien" -> [" Fab", "ien"].
//  Règle : un token commençant par ESPACE = nouveau mot.
//          Les autres = suite du mot précédent.
//
//  ⭐ Fix ponctuation : les tokens "," "." "!" "?" ":" ";" '"' ont
//     un timestamp synthétique posé par Whisper bien APRÈS la fin
//     du mot prononcé (parfois 400-500ms plus tard). On les attache
//     textuellement au mot précédent SANS update end_ms, pour
//     préserver le vrai timing de fin de prononciation.
// ============================================================

const PUNCTUATION_ONLY_REGEX = /^[.,;:!?"]+$/;

export function reconstructWordsFromTokens(
  tokens: WhisperCppToken[]
): ReconstructedWord[] {
  const words: ReconstructedWord[] = [];
  let current: {
    parts: string[];
    start_ms: number;
    end_ms: number;
    confidences: number[];
  } | null = null;

  for (const tok of tokens) {
    if (!tok.text || tok.text.length === 0) continue;

    const isNewWord = tok.text.startsWith(" ") || current === null;

    if (isNewWord) {
      if (current !== null) {
        words.push({
          word: current.parts.join("").trim(),
          start_ms: current.start_ms,
          end_ms: current.end_ms,
          confidence:
            current.confidences.reduce((a, b) => a + b, 0) /
            current.confidences.length,
        });
      }
      current = {
        parts: [tok.text.trimStart()],
        start_ms: tok.from_ms,
        end_ms: tok.to_ms,
        confidences: [tok.confidence],
      };
    } else {
      // Continue le mot courant (sub-token ou ponctuation)
      if (!current) continue;
      current.parts.push(tok.text);

      // ⭐ NE PAS update end_ms si c'est juste de la ponctuation isolée
      //    (la ponctuation a un timestamp synthétique qui mange les silences)
      const trimmed = tok.text.trim();
      const isPunctuationOnly = PUNCTUATION_ONLY_REGEX.test(trimmed);
      if (!isPunctuationOnly) {
        current.end_ms = tok.to_ms;
      }

      current.confidences.push(tok.confidence);
    }
  }

  if (current !== null) {
    words.push({
      word: current.parts.join("").trim(),
      start_ms: current.start_ms,
      end_ms: current.end_ms,
      confidence:
        current.confidences.reduce((a, b) => a + b, 0) /
        current.confidences.length,
    });
  }

  return words.filter((w) => w.word.length > 0);
}