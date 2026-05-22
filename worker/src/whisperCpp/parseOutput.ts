// ============================================================
//  Whisper.cpp - Parse JSON Output
//  
//  Transforme le JSON brut produit par whisper-cli (-ojf)
//  en structure WhisperCppResult propre et typée.
//  
//  Filtre les hallucinations connues en français.
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
 * Lit et parse un fichier JSON Whisper.cpp.
 * Filtre automatiquement les hallucinations FR connues.
 * 
 * @param jsonPath Path absolu du fichier .json produit par whisper-cli -ojf
 * @returns Résultat structuré et nettoyé
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
          // Exclut les tokens spéciaux ([_BEG_], [_EOT_], etc.)
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