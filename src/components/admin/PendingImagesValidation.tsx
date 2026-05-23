// ============================================================
//  Génère un fichier .ass (Advanced SubStation Alpha)
//  Stratégie :
//  1. Si word-level timestamps dispo → segments PARFAITEMENT timés
//  2. Sinon → fallback découpage agressif sur segments approximatifs
//
//  Adapté par format vidéo :
//  - 9:16 (vertical)   → font 72, max 26 chars/ligne
//  - 1:1  (carré)      → font 60, max 30 chars/ligne
//  - 16:9 (horizontal) → font 52, max 60 chars/ligne
//  Wrap forcé à 2 lignes max avec split équilibré.
//
//  Optimisations Whisper.cpp (2026-05-22) :
//  - Silence-aware flushing : coupe en cas de pause >= 250ms
//  - Cap subdivision 4.0s (Whisper.cpp donne déjà des segments naturels 3-5s)
//  - mergeOrphanSegments : fusionne les sub-segments < 1.0s ou < 3 mots
//    avec leur voisin, MAIS bloque si frontière de phrase (.!?) ou silence
//    détecté (gap > 250ms).
//  - extendShortSegments : étend les sub trop courts (< 1s) à l'écran
//    sans toucher au start (anti-flash).
//  - wrapToTwoLines : malus si line1 finit sur un mot de liaison FR.
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
  anchors?: Anchor[];
};

type GenerateAssResult = {
  assPath: string;
  segmentCount: number;
};

// ============================================================
//  Config par format vidéo
// ============================================================

type FormatKey = "9_16" | "1_1" | "16_9";

type SubtitleConfig = {
  fontSize: number;
  marginL: number;
  marginR: number;
  marginV: number;
  maxCharsPerLine: number;
  maxCharsPerSegment: number;
};

const FORMAT_SUBTITLE_CONFIGS: Record<FormatKey, SubtitleConfig> = {
  "9_16": {
    fontSize: 72,
    marginL: 50,
    marginR: 50,
    marginV: 230,
    maxCharsPerLine: 26,
    maxCharsPerSegment: 52,
  },
  "1_1": {
    fontSize: 60,
    marginL: 40,
    marginR: 40,
    marginV: 130,
    maxCharsPerLine: 30,
    maxCharsPerSegment: 60,
  },
  "16_9": {
    fontSize: 52,
    marginL: 100,
    marginR: 100,
    marginV: 130,
    maxCharsPerLine: 60,
    maxCharsPerSegment: 80,
  },
};

function detectFormat(width: number, height: number): FormatKey {
  const ratio = width / height;
  if (ratio < 0.95) return "9_16";
  if (ratio > 1.05) return "16_9";
  return "1_1";
}

const MAX_DURATION_PER_SEGMENT = 3.5;
const MAX_REAL_DURATION_PER_SEGMENT = 4.0;

// ============================================================
//  Subdivision des sous-segments trop longs
// ============================================================

function subdivideLongSegments(
  segments: WhisperSegment[],
  maxDuration: number
): WhisperSegment[] {
  const result: WhisperSegment[] = [];

  for (const seg of segments) {
    const duration = seg.end - seg.start;

    if (duration <= maxDuration) {
      result.push(seg);
      continue;
    }

    const words = seg.text.replace(/\\N/g, " ").split(/\s+/).filter((w) => w.length > 0);

    if (words.length <= 1) {
      result.push({ ...seg, end: seg.start + maxDuration });
      continue;
    }

    const nSubs = Math.ceil(duration / maxDuration);
    const wordsPerSub = Math.ceil(words.length / nSubs);
    const subDuration = duration / nSubs;

    for (let i = 0; i < nSubs; i++) {
      const startWord = i * wordsPerSub;
      const endWord = Math.min((i + 1) * wordsPerSub, words.length);
      const subText = words.slice(startWord, endWord).join(" ");

      if (!subText.trim()) continue;

      result.push({
        start: seg.start + i * subDuration,
        end: seg.start + (i + 1) * subDuration,
        text: subText,
      });

      if (endWord >= words.length) break;
    }
  }

  return result;
}

// ============================================================
//  ⭐ Anti-orphelin : merge des sub-segments trop courts
// ============================================================

function mergeOrphanSegments(
  segments: WhisperSegment[],
  minDurationSec: number = 1.0,
  minWords: number = 3,
  maxMergeGapSec: number = 0.25 // Aligné sur SILENCE_FLUSH_THRESHOLD_MS
): WhisperSegment[] {
  if (segments.length === 0) return segments;

  const result: WhisperSegment[] = [];
  let i = 0;

  while (i < segments.length) {
    const seg = segments[i];
    const duration = seg.end - seg.start;
    const wordCount = seg.text.split(/\s+/).filter((w) => w.length > 0).length;
    const isOrphan = duration < minDurationSec || wordCount < minWords;

    if (!isOrphan) {
      result.push({ ...seg });
      i++;
      continue;
    }

    // Tente fusion avec le PRÉCÉDENT (priorité)
    // ⭐ MAIS PAS si prev finit par ponctuation finale (.!?)
    const prev = result[result.length - 1];
    const prevEndsWithSentencePunctuation = prev
      ? /[.!?]\s*$/.test(prev.text)
      : false;
    if (prev && !prevEndsWithSentencePunctuation) {
      const gapPrev = seg.start - prev.end;
      if (gapPrev <= maxMergeGapSec) {
        prev.end = seg.end;
        prev.text = `${prev.text} ${seg.text}`.replace(/\s+/g, " ").trim();
        i++;
        continue;
      }
    }

    // Sinon, tente fusion avec le SUIVANT
    // ⭐ MAIS PAS si l'orphelin finit sur ponctuation finale (.!?)
    const endsWithSentencePunctuation = /[.!?]\s*$/.test(seg.text);
    if (!endsWithSentencePunctuation) {
      const next = segments[i + 1];
      if (next) {
        const gapNext = next.start - seg.end;
        if (gapNext <= maxMergeGapSec) {
          next.start = seg.start;
          next.text = `${seg.text} ${next.text}`.replace(/\s+/g, " ").trim();
          i++;
          continue;
        }
      }
    }

    // Aucune fusion possible : garder tel quel
    result.push({ ...seg });
    i++;
  }

  return result;
}

// ============================================================
//  ⭐ Anti-flash : étend les sub-segments trop courts sans toucher au start
// ============================================================

/**
 * Étend artificiellement la durée d'affichage des sub-segments trop courts
 * pour éviter les flashs visuels.
 *
 * - Le start reste INCHANGÉ (sync sur la voix préservée)
 * - On étend le end vers le sub suivant, sans empiéter dessus
 * - Effet : un sub de 220ms est affiché 1s minimum, "consommant" le silence
 *   qui le suit (où il n'y a pas de voix de toute façon)
 */
function extendShortSegments(
  segments: WhisperSegment[],
  minDurationSec: number = 1.0
): WhisperSegment[] {
  return segments.map((seg, i) => {
    const duration = seg.end - seg.start;
    if (duration >= minDurationSec) return seg;

    const next = segments[i + 1];
    const targetEnd = seg.start + minDurationSec;
    // On ne déborde JAMAIS sur le start du sub-segment suivant
    const maxEnd = next ? next.start : targetEnd;
    const newEnd = Math.min(targetEnd, maxEnd);

    return { ...seg, end: Math.max(newEnd, seg.end) };
  });
}

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
//  ⭐ Wrap 2 lignes — évite mots de liaison en fin de ligne 1
// ============================================================

const FR_LINK_WORDS = new Set([
  "de", "du", "le", "la", "les", "et", "ou", "à", "au", "aux",
  "un", "une", "des", "ce", "ces", "cette", "ses", "son", "sa",
  "que", "qui", "qu'", "d'", "l'", "n'", "m'", "t'", "s'", "j'", "c'",
  "très", "plus", "mais", "pour", "par", "sur", "sous", "dans", "avec",
  "comme", "sans", "vers", "chez", "en", "y",
]);

function endsOnLinkWord(line: string): boolean {
  const words = line.trim().split(/\s+/);
  const lastWord = (words[words.length - 1] || "").toLowerCase().replace(/[.,;:!?]+$/, "");
  return FR_LINK_WORDS.has(lastWord);
}

function wrapToTwoLines(text: string, maxCharsPerLine: number): string {
  if (text.length <= maxCharsPerLine) return text;

  const words = text.split(/\s+/);
  if (words.length <= 1) return text;

  let bestSplitIdx = -1;
  let bestScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    const line1 = words.slice(0, i).join(" ");
    const line2 = words.slice(i).join(" ");

    if (line1.length > maxCharsPerLine || line2.length > maxCharsPerLine) continue;

    let score = Math.abs(line1.length - line2.length);

    if (endsOnLinkWord(line1)) {
      score += 100;
    }

    if (score < bestScore) {
      bestScore = score;
      bestSplitIdx = i;
    }
  }

  if (bestSplitIdx === -1) {
    const midIdx = Math.floor(words.length / 2);
    return words.slice(0, midIdx).join(" ") + "\\N" + words.slice(midIdx).join(" ");
  }

  return words.slice(0, bestSplitIdx).join(" ") + "\\N" + words.slice(bestSplitIdx).join(" ");
}

// ============================================================
//  ⭐ Silence-aware flushing
// ============================================================

const SILENCE_FLUSH_THRESHOLD_MS = 250;

// ============================================================
//  STRATÉGIE 1 : Word-level timestamps (timing parfait)
// ============================================================

function buildSegmentsFromWords(
  words: WhisperWord[],
  maxCharsPerSegment: number
): WhisperSegment[] {
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
    // ⭐ Silence-aware flush : si gap avec prev >= 250ms, flush AVANT
    if (currentWords.length > 0) {
      const prevWord = currentWords[currentWords.length - 1];
      const gapMs = (word.start - prevWord.end) * 1000;
      if (gapMs >= SILENCE_FLUSH_THRESHOLD_MS) {
        flush();
      }
    }

    currentWords.push(word);

    const accumText = currentWords
      .map((w) => w.word)
      .join(" ")
      .replace(/\s+([.,;:!?])/g, "$1");
    const accumDuration = word.end - currentWords[0].start;

    const endsWithPunctuation = /[.!?]$/.test(word.word.trim());
    const tooLong = accumText.length >= maxCharsPerSegment;
    const tooDuration = accumDuration >= MAX_DURATION_PER_SEGMENT;

    if (endsWithPunctuation || tooLong || tooDuration) {
      flush();
    }
  }

  flush();
  return result;
}

// ============================================================
//  STRATÉGIE 2 : Fallback découpage agressif
// ============================================================

function splitSegmentAggressive(
  seg: WhisperSegment,
  maxCharsPerSegment: number
): WhisperSegment[] {
  const text = normalizeUnicode(seg.text);
  const duration = seg.end - seg.start;

  if (duration <= MAX_DURATION_PER_SEGMENT && text.length <= maxCharsPerSegment) {
    return [{ start: seg.start, end: seg.end, text }];
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= maxCharsPerSegment) {
      chunks.push(sentence);
      continue;
    }
    const parts = sentence.split(/,\s+/).map((p, i, arr) =>
      i < arr.length - 1 ? `${p.trim()},` : p.trim()
    );
    let buffer = "";
    for (const part of parts) {
      const candidate = buffer ? `${buffer} ${part}` : part;
      if (candidate.length <= maxCharsPerSegment) {
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
    if (chunk.length <= maxCharsPerSegment) {
      finalChunks.push(chunk);
      continue;
    }
    const words = chunk.split(" ");
    let buffer = "";
    for (const word of words) {
      const candidate = buffer ? `${buffer} ${word}` : word;
      if (candidate.length <= maxCharsPerSegment) {
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

function splitAllSegments(
  segments: WhisperSegment[],
  maxCharsPerSegment: number
): WhisperSegment[] {
  const result: WhisperSegment[] = [];
  for (const seg of segments) {
    result.push(...splitSegmentAggressive(seg, maxCharsPerSegment));
  }
  return result;
}

// ============================================================
//  Anchor interpolation (backup, plus utilisé avec Whisper.cpp)
// ============================================================

function applyAnchorInterpolation(
  segments: WhisperSegment[],
  anchors: Anchor[]
): WhisperSegment[] {
  if (anchors.length < 2) return segments;

  const sortedAnchors = [...anchors].sort((a, b) => a.whisperTime - b.whisperTime);

  const remap = (whisperT: number): number => {
    for (let i = 0; i < sortedAnchors.length - 1; i++) {
      const a = sortedAnchors[i];
      const b = sortedAnchors[i + 1];
      if (whisperT >= a.whisperTime && whisperT <= b.whisperTime) {
        const t = (whisperT - a.whisperTime) / (b.whisperTime - a.whisperTime);
        return a.realTime + t * (b.realTime - a.realTime);
      }
    }
    const last = sortedAnchors[sortedAnchors.length - 1];
    return whisperT + (last.realTime - last.whisperTime);
  };

  console.log(`[generateAss] Anchor interpolation enabled (${sortedAnchors.length} anchors)`);
  for (let i = 0; i < sortedAnchors.length; i++) {
    const a = sortedAnchors[i];
    console.log(
      `  anchor[${i}]: whisperTime=${a.whisperTime.toFixed(2)}s → realTime=${a.realTime.toFixed(2)}s (delta=${(a.realTime - a.whisperTime).toFixed(2)}s) "${a.textSnippet || ""}"`
    );
  }

  return segments.map((seg) => ({
    ...seg,
    start: Math.max(0, remap(seg.start)),
    end: Math.max(0, remap(seg.end)),
  }));
}

// ============================================================
//  Fonction principale
// ============================================================

export async function generateAss(input: GenerateAssInput): Promise<GenerateAssResult> {
  const { segments, outputDir, videoWidth, videoHeight } = input;

  if (!segments || segments.length === 0) {
    throw new Error("No segments provided for ASS generation");
  }

  const formatKey = detectFormat(videoWidth, videoHeight);
  const config = FORMAT_SUBTITLE_CONFIGS[formatKey];

  console.log(
    `[generateAss] Format: ${formatKey} (${videoWidth}×${videoHeight}) → ` +
      `font=${config.fontSize}, maxChars/line=${config.maxCharsPerLine}, maxChars/seg=${config.maxCharsPerSegment}`
  );

  let splitSegments: WhisperSegment[];
  if (input.words && input.words.length > 0) {
    splitSegments = buildSegmentsFromWords(input.words, config.maxCharsPerSegment);
    console.log(
      `[generateAss] Using ${input.words.length} word timestamps -> Output: ${splitSegments.length} sub-segments`
    );
  } else {
    splitSegments = splitAllSegments(segments, config.maxCharsPerSegment);
    console.log(
      `[generateAss] Fallback: ${segments.length} segments -> Output: ${splitSegments.length} sub-segments`
    );
  }

  if (input.anchors && input.anchors.length >= 2) {
    splitSegments = applyAnchorInterpolation(splitSegments, input.anchors);
  } else {
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

  // Subdiviser les sous-segments trop longs (cap = 4.0s)
  const beforeSubdivide = splitSegments.length;
  splitSegments = subdivideLongSegments(splitSegments, MAX_REAL_DURATION_PER_SEGMENT);
  if (splitSegments.length !== beforeSubdivide) {
    console.log(
      `[generateAss] Subdivision: ${beforeSubdivide} → ${splitSegments.length} segments (cap=${MAX_REAL_DURATION_PER_SEGMENT}s)`
    );
  }

  // ⭐ Anti-orphelin : fusionne les sub-segments trop courts avec leurs voisins
  const beforeMerge = splitSegments.length;
  splitSegments = mergeOrphanSegments(splitSegments);
  if (splitSegments.length !== beforeMerge) {
    console.log(
      `[generateAss] Merge orphans: ${beforeMerge} → ${splitSegments.length} segments`
    );
  }

  // ⭐ Anti-flash : étend les sub trop courts sans toucher au start
  splitSegments = extendShortSegments(splitSegments);
  console.log(`[generateAss] Short segments extended to min 1.0s (anti-flash)`);

  // ============================================================
  //  Construction du .ass
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
  lines.push(
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"
  );
  lines.push(
    `Style: Default,Arial,${config.fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,${config.marginL},${config.marginR},${config.marginV},1`
  );
  lines.push("");

  lines.push("[Events]");
  lines.push("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text");

  for (const seg of splitSegments) {
    if (!seg.text || seg.text.trim().length === 0) continue;
    const start = formatAssTime(seg.start);
    const end = formatAssTime(seg.end);
    const escaped = escapeAssText(seg.text);
    const wrapped = wrapToTwoLines(escaped, config.maxCharsPerLine);
    lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${wrapped}`);
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