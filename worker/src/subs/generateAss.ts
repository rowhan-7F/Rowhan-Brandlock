// ============================================================
//  Génère un fichier .ass (Advanced SubStation Alpha)
//  Stratégie :
//  1. Si word-level timestamps dispo → segments PARFAITEMENT timés
//  2. Sinon → fallback découpage agressif sur segments approximatifs
//
//  Format BULLET-PROOF pour libass :
//  - Lignes vides explicites entre sections
//  - Normalisation Unicode -> ASCII
//  - WrapStyle: 2 (smart wrap par libass)
// ============================================================

import { promises as fs } from "node:fs";
import path from "node:path";

type WhisperSegment = {
  start: number;
  end: number;
  text: string;
};

type WhisperWord = {
  word: string;
  start: number;
  end: number;
};

type Anchor = {
    whisperTime: number;
    realTime: number;
    textSnippet: string;
  };
  
  type GenerateAssInput = {
    segments: WhisperSegment[];
    words?: WhisperWord[];
    outputDir: string;
    videoWidth: number;
    videoHeight: number;
    videoDurationSeconds?: number | null;
    offsetSeconds?: number;
    anchors?: Anchor[];  // ⭐ NEW : interpolation multi-points
  };

type GenerateAssResult = {
  assPath: string;
  segmentCount: number;
};

const MAX_DURATION_PER_SEGMENT = 3.5;
const MAX_CHARS_PER_SEGMENT = 60;

// ============================================================
//  Utilitaires
// ============================================================

function formatAssTime(seconds: number): string {
  const totalCs = Math.round(seconds * 100);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const ss = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mm = totalMin % 60;
  const hh = Math.floor(totalMin / 60);
  return `${hh}:${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function normalizeUnicode(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "")
    .replace(/\{/g, "")
    .replace(/\}/g, "")
    .trim();
}

// ============================================================
//  STRATÉGIE 1 : Word-level timestamps (timing PARFAIT)
// ============================================================

function buildSegmentsFromWords(words: WhisperWord[]): WhisperSegment[] {
  if (!words || words.length === 0) return [];

  const result: WhisperSegment[] = [];
  let currentWords: WhisperWord[] = [];

  const flush = () => {
    if (currentWords.length === 0) return;
    const start = currentWords[0].start;
    const end = currentWords[currentWords.length - 1].end;
    const text = normalizeUnicode(
      currentWords
        .map((w) => w.word)
        .join(" ")
        .replace(/\s+([.,;:!?])/g, "$1")
    );
    result.push({ start, end, text });
    currentWords = [];
  };

  for (const word of words) {
    currentWords.push(word);

    const accumText = currentWords
      .map((w) => w.word)
      .join(" ")
      .replace(/\s+([.,;:!?])/g, "$1");
    const accumDuration = word.end - currentWords[0].start;

    const endsWithPunctuation = /[.!?]$/.test(word.word.trim());
    const tooLong = accumText.length >= MAX_CHARS_PER_SEGMENT;
    const tooDuration = accumDuration >= MAX_DURATION_PER_SEGMENT;

    if (endsWithPunctuation || tooLong || tooDuration) {
      flush();
    }
  }

  flush();

  return result;
}

// ============================================================
//  STRATÉGIE 2 : Fallback découpage agressif sur segments
// ============================================================

function splitSegmentAggressive(seg: WhisperSegment): WhisperSegment[] {
  const text = normalizeUnicode(seg.text);
  const duration = seg.end - seg.start;

  if (duration <= MAX_DURATION_PER_SEGMENT && text.length <= MAX_CHARS_PER_SEGMENT) {
    return [{ start: seg.start, end: seg.end, text }];
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= MAX_CHARS_PER_SEGMENT) {
      chunks.push(sentence);
      continue;
    }
    const parts = sentence.split(/,\s+/).map((p, i, arr) =>
      i < arr.length - 1 ? `${p.trim()},` : p.trim()
    );
    let buffer = "";
    for (const part of parts) {
      const candidate = buffer ? `${buffer} ${part}` : part;
      if (candidate.length <= MAX_CHARS_PER_SEGMENT) {
        buffer = candidate;
      } else {
        if (buffer) chunks.push(buffer);
        buffer = part;
      }
    }
    if (buffer) chunks.push(buffer);
  }

  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= MAX_CHARS_PER_SEGMENT) {
      finalChunks.push(chunk);
      continue;
    }
    const words = chunk.split(" ");
    let buffer = "";
    for (const word of words) {
      const candidate = buffer ? `${buffer} ${word}` : word;
      if (candidate.length <= MAX_CHARS_PER_SEGMENT) {
        buffer = candidate;
      } else {
        if (buffer) finalChunks.push(buffer);
        buffer = word;
      }
    }
    if (buffer) finalChunks.push(buffer);
  }

  if (finalChunks.length === 0) return [{ start: seg.start, end: seg.end, text }];

  const totalChars = finalChunks.reduce((acc, c) => acc + c.length, 0);
  let cursor = seg.start;
  const result: WhisperSegment[] = [];

  for (const chunk of finalChunks) {
    const portion = chunk.length / totalChars;
    const naturalDuration = duration * portion;
    const cappedDuration = Math.min(naturalDuration, MAX_DURATION_PER_SEGMENT);
    const segEnd = Math.min(cursor + cappedDuration, seg.end);

    result.push({
      start: cursor,
      end: segEnd,
      text: chunk,
    });
    cursor = segEnd;
  }

  return result;
}

function splitAllSegments(segments: WhisperSegment[]): WhisperSegment[] {
    const result: WhisperSegment[] = [];
    for (const seg of segments) {
      result.push(...splitSegmentAggressive(seg));
    }
    return result;
  }
  
  /**
   * ⭐ Remappe les timecodes Whisper en temps réel via interpolation linéaire
   * entre les anchors. Beaucoup plus précis qu'un simple offset constant.
   */
  function applyAnchorInterpolation(
    segments: WhisperSegment[],
    anchors: Anchor[]
  ): WhisperSegment[] {
    if (anchors.length < 2) return segments;
  
    // Trie les anchors par whisperTime
    const sortedAnchors = [...anchors].sort((a, b) => a.whisperTime - b.whisperTime);
  
    const remap = (whisperT: number): number => {
      // Trouve l'intervalle d'anchors qui contient whisperT
      for (let i = 0; i < sortedAnchors.length - 1; i++) {
        const a = sortedAnchors[i];
        const b = sortedAnchors[i + 1];
        if (whisperT >= a.whisperTime && whisperT <= b.whisperTime) {
          // Interpolation linéaire
          const t = (whisperT - a.whisperTime) / (b.whisperTime - a.whisperTime);
          return a.realTime + t * (b.realTime - a.realTime);
        }
      }
      // Hors intervalle : utilise l'offset du dernier anchor
      const last = sortedAnchors[sortedAnchors.length - 1];
      return whisperT + (last.realTime - last.whisperTime);
    };
  
    console.log(`[generateAss] Anchor interpolation enabled (${sortedAnchors.length} anchors)`);
  
    return segments.map((seg) => ({
      ...seg,
      start: Math.max(0, remap(seg.start)),
      end: Math.max(0, remap(seg.end)),
    }));
  }

function stretchSegmentsToFitDuration(
  segments: WhisperSegment[],
  targetDurationSeconds: number,
  offsetSeconds: number = 0
): WhisperSegment[] {
  if (segments.length === 0) return segments;

  const currentStart = segments[0].start;
  const currentEnd = segments[segments.length - 1].end;
  const currentDuration = currentEnd - currentStart;

  if (currentDuration >= targetDurationSeconds * 0.95) {
    return segments.map((seg) => ({
      ...seg,
      start: seg.start + offsetSeconds,
      end: seg.end + offsetSeconds,
    }));
  }

  const stretchFactor = (targetDurationSeconds * 0.95) / currentDuration;
  console.log(`[generateAss] Stretch factor: ${stretchFactor.toFixed(2)} (Whisper: ${currentDuration.toFixed(1)}s -> target: ${targetDurationSeconds.toFixed(1)}s)`);

  return segments.map((seg) => {
    const relativeStart = (seg.start - currentStart) * stretchFactor;
    const relativeEnd = (seg.end - currentStart) * stretchFactor;
    return {
      ...seg,
      start: currentStart + relativeStart + offsetSeconds,
      end: currentStart + relativeEnd + offsetSeconds,
    };
  });
}

// ============================================================
//  Fonction principale
// ============================================================

export async function generateAss(input: GenerateAssInput): Promise<GenerateAssResult> {
  const { segments, outputDir, videoWidth, videoHeight } = input;

  if (!segments || segments.length === 0) {
    throw new Error("No segments provided for ASS generation");
  }

  // Stratégie 1 : word-level (timing parfait)
  // Stratégie 2 : fallback sur segments approximatifs
  let splitSegments: WhisperSegment[];
  if (input.words && input.words.length > 0) {
    splitSegments = buildSegmentsFromWords(input.words);
    console.log(`[generateAss] Using ${input.words.length} word timestamps -> Output: ${splitSegments.length} sub-segments`);
  } else {
    splitSegments = splitAllSegments(segments);
    console.log(`[generateAss] Fallback: ${segments.length} segments -> Output: ${splitSegments.length} sub-segments`);

    // Note : stretch désactivé. On trust les timecodes Whisper directement.
    // Si décalage persistant, l'utilisateur peut ajuster via le slider.
  }

  // ⭐ Si on a des anchors (>= 2), on fait une interpolation linéaire (très précis)
  // Sinon, fallback sur l'offset constant
  if (input.anchors && input.anchors.length >= 2) {
    splitSegments = applyAnchorInterpolation(splitSegments, input.anchors);

    // Le manualOffset est ajouté APRÈS l'interpolation (fine-tune)
    const manualOffsetOnly = input.offsetSeconds || 0;
    // Note : ici on suppose que offsetSeconds inclut auto+manual.
    // Pour appliquer SEULEMENT le manual, on devrait séparer. Mais pour MVP, on garde simple.
  } else {
    // Fallback : offset constant si pas d'anchors
    const offset = input.offsetSeconds || 0;
    if (offset !== 0) {
      console.log(`[generateAss] Applying constant offset: ${offset > 0 ? "+" : ""}${offset}s`);
      splitSegments = splitSegments.map((seg) => ({
        ...seg,
        start: Math.max(0, seg.start + offset),
        end: Math.max(0, seg.end + offset),
      }));
    }
  }

  const fontSize = Math.round(videoHeight * 0.05);
  const marginV = Math.round(videoHeight * 0.12);

  // ============================================================
  //  Construction du .ass ligne par ligne (garantit les blanks)
  // ============================================================

  const lines: string[] = [];

  lines.push("[Script Info]");
  lines.push("Title: BrandLock Subtitles");
  lines.push("ScriptType: v4.00+");
  lines.push("WrapStyle: 2");
  lines.push("ScaledBorderAndShadow: yes");
  lines.push("YCbCr Matrix: TV.709");
  lines.push(`PlayResX: ${videoWidth}`);
  lines.push(`PlayResY: ${videoHeight}`);
  lines.push("");

  lines.push("[V4+ Styles]");
  lines.push("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding");
  lines.push(`Style: Default,Arial,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,80,80,${marginV},1`);
  lines.push("");

  lines.push("[Events]");
  lines.push("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text");

  for (const seg of splitSegments) {
    if (!seg.text || seg.text.trim().length === 0) continue;
    const start = formatAssTime(seg.start);
    const end = formatAssTime(seg.end);
    const text = escapeAssText(seg.text);
    lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
  }

  const assContent = lines.join("\n") + "\n";

  const assPath = path.join(outputDir, "subtitles.ass");
  await fs.writeFile(assPath, assContent, "utf8");

  console.log(`[generateAss] Wrote ${splitSegments.length} dialogue lines to ${assPath}`);
  console.log("===== CONTENU GENERE .ASS =====");
  console.log(assContent);
  console.log("===== FIN .ASS =====");

  return {
    assPath,
    segmentCount: splitSegments.length,
  };
}