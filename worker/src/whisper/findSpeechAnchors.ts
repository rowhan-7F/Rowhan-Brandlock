// ============================================================
//  findSpeechAnchors — Détecte les anchor points de la voix
//
//  V2 : Anti-hallucination + résilience aux erreurs Whisper
//  - Filtre les hallucinations Whisper connues ("Sous-titrage FR", etc.)
//  - Catch les erreurs pollWhisper (chunk vide = pas une erreur)
//  - Min duration 2s pour fiabilité
// ============================================================

import { submitToWhisper } from "./client.js";
import { pollWhisper } from "./poll.js";
import { extractClip, deleteClip } from "../ffmpeg/extractClip.js";
import { log } from "../logger.js";

type Anchor = {
  whisperTime: number;
  realTime: number;
  textSnippet: string;
};

type FindSpeechAnchorsInput = {
  audioPath: string;
  outputDir: string;
  audioDurationSeconds: number;
  whisperFullText: string;
  whisperStart: number;
  whisperEnd: number;
  precisionSeconds?: number;
};

type FindSpeechAnchorsResult = {
  anchors: Anchor[];
  totalCallsMade: number;
  totalTimeSeconds: number;
};

// ============================================================
//  Filtre des hallucinations Whisper connues
//  Whisper invente du texte quand il analyse de la musique
//  ou des audios courts sans voix.
// ============================================================
const WHISPER_HALLUCINATION_PATTERNS: RegExp[] = [
  /^sous-titrage\s+fr/i,
  /sous-titres?\s+(réalisés|fr)/i,
  /merci\s+d'avoir\s+regardé/i,
  /thank\s+you\s+(for\s+)?watching/i,
  /thanks?\s+for\s+watching/i,
  /like\s+(and|et)\s+subscribe/i,
  /abonnez-vous/i,
  /youtube\.com/i,
  /^[\.\?\!\s]*$/,
  /^♪+/,
  /^\[musique\]/i,
  /^\[music\]/i,
  /^\(musique\)/i,
  /^\.+$/,
  /^♫/,
  /^transcription\s+(par|by)/i,
  /^by\s+(amara|youtube)/i,
  /amara\.org/i,
  /^générique/i,
  /^silence/i,
];

function isWhisperHallucination(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return true;
  return WHISPER_HALLUCINATION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// ============================================================
//  Transcribe un clip + gestion d'erreurs
// ============================================================
async function transcribeClip(
  audioPath: string,
  outputDir: string,
  startSec: number,
  durationSec: number,
  clipLabel: string
): Promise<{ hasSpeech: boolean; text: string; firstWords: string }> {
  const clipName = `anchor_clip_${clipLabel}_${Date.now()}.mp3`;
  let clipPath: string | null = null;

  try {
    const extractResult = await extractClip({
      audioPath,
      outputDir,
      startSeconds: startSec,
      durationSeconds: durationSec,
      clipName,
    });
    clipPath = extractResult.clipPath;

    try {
      const { batchId } = await submitToWhisper({
        audioPath: clipPath,
        language: "fr",
      });

      const result = await pollWhisper(batchId);
      const text = (result.text || "").trim();

      const isHallucination = isWhisperHallucination(text);
      const hasSpeech = text.length >= 4 && !isHallucination;

      const firstWords = text.split(/\s+/).slice(0, 5).join(" ");

      if (isHallucination && text.length > 0) {
        log.info(`[anchor]   🤯 Hallucination filtrée: "${text.slice(0, 50)}"`);
      }

      return { hasSpeech, text, firstWords };
    } catch (whisperErr) {
      // Whisper a échoué ou résultat vide = traité comme "pas de voix"
      const msg = whisperErr instanceof Error ? whisperErr.message : String(whisperErr);
      log.info(`[anchor]   ✗ Whisper empty/error (treating as no speech)`);
      return { hasSpeech: false, text: "", firstWords: "" };
    }
  } finally {
    if (clipPath) {
      await deleteClip(clipPath);
    }
  }
}

// ============================================================
//  Binary search d'une frontière de speech
// ============================================================
async function binarySearchSpeechBoundary(
  audioPath: string,
  outputDir: string,
  rangeStart: number,
  rangeEnd: number,
  precisionSeconds: number,
  label: string,
  searchDirection: "start" | "end"
): Promise<{ position: number; callsMade: number; textSnippet: string }> {
  let low = rangeStart;
  let high = rangeEnd;
  let callCount = 0;
  let lastFoundText = "";

  const MIN_CLIP_DURATION = 0.5; // ⭐ ABAISSÉ pour précision. Hallucination filter protège.

  while (high - low > precisionSeconds) {
    callCount++;
    const mid = (low + high) / 2;

    let testStart: number;
    let testDuration: number;

    if (searchDirection === "start") {
      testStart = low;
      testDuration = mid - low;
    } else {
      testStart = mid;
      testDuration = high - mid;
    }

    if (testDuration < MIN_CLIP_DURATION) {
      log.info(`[anchor:${label}] Range too small (${testDuration.toFixed(2)}s), stopping`);
      break;
    }

    log.info(`[anchor:${label}] Test ${callCount}: ${testStart.toFixed(2)}s + ${testDuration.toFixed(2)}s`);

    const { hasSpeech, firstWords } = await transcribeClip(
      audioPath,
      outputDir,
      testStart,
      testDuration,
      `${label}_${callCount}`
    );

    if (hasSpeech) {
      lastFoundText = firstWords;
      log.info(`[anchor:${label}]   ✓ Speech: "${firstWords}"`);
      if (searchDirection === "start") {
        high = mid;
      } else {
        low = mid;
      }
    } else {
      log.info(`[anchor:${label}]   ✗ No speech`);
      if (searchDirection === "start") {
        low = mid;
      } else {
        high = mid;
      }
    }
  }

  // ⭐ Quand on break, retourne MIDPOINT du range restant (estimation non biaisée)
  // Plus précis que `high` ou `low` qui sont les bornes max/min
  const position = (low + high) / 2;
  log.info(`[anchor:${label}] Final position: ${position.toFixed(2)}s (range [${low.toFixed(2)}, ${high.toFixed(2)}])`);
  return { position, callsMade: callCount, textSnippet: lastFoundText };
}

// ============================================================
//  Coarse search : chunks de 3s jusqu'au 1er chunk avec voix
// ============================================================
async function findSpeechRange(
  audioPath: string,
  outputDir: string,
  audioDuration: number,
  chunkDurationSec: number = 3.0
): Promise<{ rangeStart: number; rangeEnd: number; callsMade: number }> {
  let callCount = 0;

  for (let startTime = 0; startTime < audioDuration; startTime += chunkDurationSec) {
    callCount++;
    const duration = Math.min(chunkDurationSec, audioDuration - startTime);

    if (duration < 2.0) break;

    log.info(`[anchor:coarse] Chunk ${callCount}: ${startTime.toFixed(1)}s-${(startTime + duration).toFixed(1)}s`);

    const { hasSpeech, firstWords } = await transcribeClip(
      audioPath,
      outputDir,
      startTime,
      duration,
      `coarse_${callCount}`
    );

    if (hasSpeech) {
      log.info(`[anchor:coarse]   ✓ Speech: "${firstWords}"`);
      return {
        rangeStart: startTime,
        rangeEnd: startTime + duration,
        callsMade: callCount,
      };
    } else {
      log.info(`[anchor:coarse]   ✗ No speech (or hallucination filtered)`);
    }
  }

  return { rangeStart: 0, rangeEnd: chunkDurationSec, callsMade: callCount };
}

// ============================================================
//  Fonction principale
// ============================================================
export async function findSpeechAnchors(
  input: FindSpeechAnchorsInput
): Promise<FindSpeechAnchorsResult> {
  const {
    audioPath,
    outputDir,
    audioDurationSeconds,
    whisperStart,
    whisperEnd,
    precisionSeconds = 0.2,
  } = input;

  const startTime = Date.now();
  let totalCalls = 0;

  log.info(`=== START SPEECH ANCHORS DETECTION ===`);
  log.info(`Audio: ${audioDurationSeconds.toFixed(1)}s, Whisper says voice ${whisperStart.toFixed(2)}-${whisperEnd.toFixed(2)}s`);

  // ANCHOR 1 : START
  log.info(`[anchor 1/4] Searching START...`);
  const coarseResult = await findSpeechRange(audioPath, outputDir, audioDurationSeconds, 3.0);
  totalCalls += coarseResult.callsMade;

  log.info(`[anchor 1/4] Coarse range: ${coarseResult.rangeStart}-${coarseResult.rangeEnd}s`);

  const startBinary = await binarySearchSpeechBoundary(
    audioPath,
    outputDir,
    coarseResult.rangeStart,
    coarseResult.rangeEnd,
    precisionSeconds,
    "start",
    "start"
  );
  totalCalls += startBinary.callsMade;

  const realStart = startBinary.position;
  log.info(`[anchor 1/4] ✅ START = ${realStart.toFixed(2)}s (text: "${startBinary.textSnippet}")`);

  // ANCHOR 4 : END
  log.info(`[anchor 4/4] Searching END...`);
  const endSearchLow = Math.max(realStart + 5, whisperEnd - 5);
  const endSearchHigh = audioDurationSeconds;

  const endBinary = await binarySearchSpeechBoundary(
    audioPath,
    outputDir,
    endSearchLow,
    endSearchHigh,
    precisionSeconds,
    "end",
    "end"
  );
  totalCalls += endBinary.callsMade;

  const realEnd = endBinary.position > 0 ? endBinary.position : audioDurationSeconds - 0.5;
  log.info(`[anchor 4/4] ✅ END = ${realEnd.toFixed(2)}s`);

  // ANCHORS 2 & 3 : MIDDLE pour vidéos longues
  const speechDuration = realEnd - realStart;
  const anchors: Anchor[] = [];

  anchors.push({
    whisperTime: whisperStart,
    realTime: realStart,
    textSnippet: startBinary.textSnippet,
  });

  if (speechDuration > 60) {
    log.info(`[anchors 2-3/4] Long video, adding 2 middle anchors...`);

    const mid1Time = realStart + speechDuration / 3;
    const mid1Range = 4.0;
    const mid1Binary = await binarySearchSpeechBoundary(
      audioPath,
      outputDir,
      Math.max(realStart, mid1Time - mid1Range / 2),
      Math.min(realEnd, mid1Time + mid1Range / 2),
      precisionSeconds,
      "mid1",
      "start"
    );
    totalCalls += mid1Binary.callsMade;

    if (mid1Binary.textSnippet) {
      anchors.push({
        whisperTime: whisperStart + (whisperEnd - whisperStart) / 3,
        realTime: mid1Binary.position,
        textSnippet: mid1Binary.textSnippet,
      });
    }

    const mid2Time = realStart + (speechDuration * 2) / 3;
    const mid2Binary = await binarySearchSpeechBoundary(
      audioPath,
      outputDir,
      Math.max(realStart, mid2Time - mid1Range / 2),
      Math.min(realEnd, mid2Time + mid1Range / 2),
      precisionSeconds,
      "mid2",
      "start"
    );
    totalCalls += mid2Binary.callsMade;

    if (mid2Binary.textSnippet) {
      anchors.push({
        whisperTime: whisperStart + ((whisperEnd - whisperStart) * 2) / 3,
        realTime: mid2Binary.position,
        textSnippet: mid2Binary.textSnippet,
      });
    }
  }

  anchors.push({
    whisperTime: whisperEnd,
    realTime: realEnd,
    textSnippet: "[END]",
  });

  const totalTimeSec = (Date.now() - startTime) / 1000;
  log.info(`=== ANCHORS FOUND: ${anchors.length} anchors in ${totalCalls} calls (${totalTimeSec.toFixed(1)}s) ===`);

  return {
    anchors,
    totalCallsMade: totalCalls,
    totalTimeSeconds: totalTimeSec,
  };
}