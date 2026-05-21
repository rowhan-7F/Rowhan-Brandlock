// ============================================================
//  Détection automatique du DÉBUT DE LA VOIX dans l'audio (VAD)
//
//  Stratégie améliorée :
//  1. Applique un filtre passe-bande sur la BANDE VOCALE (200-3400 Hz)
//     → Filtre la musique d'intro (basses + aigus)
//  2. silencedetect sur l'audio filtré → ne détecte QUE quand la voix démarre
//  3. Retourne le 1er silence_end qui matche les contraintes
// ============================================================

import { spawn } from "node:child_process";
import { log } from "../logger.js";

type DetectSpeechStartInput = {
  audioPath: string;
  noiseThresholdDb?: number;
  minSilenceDuration?: number;
};

type DetectSpeechStartResult = {
  speechStartSeconds: number;
  detectedSilences: Array<{ start: number; end: number; duration: number }>;
};

export async function detectSpeechStart(
  input: DetectSpeechStartInput
): Promise<DetectSpeechStartResult> {
  const {
    audioPath,
    noiseThresholdDb = -25,         // ⭐ Plus aggressif (-25 au lieu de -35)
    minSilenceDuration = 0.3,
  } = input;

  return new Promise((resolve, reject) => {
    // ⭐ Bandpass voix 200-3400 Hz + silencedetect
    const audioFilter = [
      "highpass=f=200",                                           // Coupe les basses (musique)
      "lowpass=f=3400",                                           // Coupe les aigus (cymbales)
      `silencedetect=noise=${noiseThresholdDb}dB:d=${minSilenceDuration}`,
    ].join(",");

    const args = [
      "-i", audioPath,
      "-af", audioFilter,
      "-f", "null",
      "-",
    ];

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0 && code !== null) {
        return reject(new Error(`FFmpeg silencedetect exited with code ${code}`));
      }

      // Parse silence_start et silence_end depuis stderr
      const silenceStartRegex = /silence_start:\s*(-?[\d.]+)/g;
      const silenceEndRegex = /silence_end:\s*([\d.]+)/g;

      const silenceStarts: number[] = [];
      const silenceEnds: number[] = [];

      let match;
      while ((match = silenceStartRegex.exec(stderr)) !== null) {
        silenceStarts.push(parseFloat(match[1]));
      }
      while ((match = silenceEndRegex.exec(stderr)) !== null) {
        silenceEnds.push(parseFloat(match[1]));
      }

      // Reconstruit les silences détectés
      const detectedSilences: Array<{ start: number; end: number; duration: number }> = [];
      for (let i = 0; i < silenceEnds.length; i++) {
        const start = Math.max(0, silenceStarts[i] ?? 0);
        const end = silenceEnds[i];
        detectedSilences.push({
          start,
          end,
          duration: end - start,
        });
      }

      // ⭐ Logique de détection améliorée :
      // Le 1er silence doit COMMENCER près du début (≤0.3s)
      // ET se TERMINER au moins 0.2s plus tard
      let speechStartSeconds = 0;
      if (detectedSilences.length > 0) {
        const firstSilence = detectedSilences[0];
        if (firstSilence.start <= 0.3 && firstSilence.end >= 0.2) {
          speechStartSeconds = firstSilence.end;
        }
      }

      log.info(
        `VAD: ${detectedSilences.length} silences détectés, voix démarre à ${speechStartSeconds.toFixed(2)}s`
      );

      // Debug : affiche les 3 premiers silences détectés
      if (detectedSilences.length > 0) {
        const preview = detectedSilences
          .slice(0, 3)
          .map((s) => `${s.start.toFixed(2)}→${s.end.toFixed(2)}s`)
          .join(", ");
        log.info(`VAD silences: ${preview}`);
      }

      resolve({
        speechStartSeconds,
        detectedSilences,
      });
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}