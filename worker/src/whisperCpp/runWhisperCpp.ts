// ============================================================
//  Whisper.cpp - Spawn engine
//  
//  Lance le binaire whisper-cli.exe avec les bons flags,
//  capture stdout/stderr, track la progression, et parse le
//  JSON produit en utilisant parseWhisperCppOutput.
//  
//  Choix techniques :
//  - Sans DTW (-nfa pas nécessaire) → conserve flash_attn 
//    pour vitesse + futur GPU
//  - Output JSON FULL (-ojf) → tous les tokens + offsets
//  - Multi-threads configurable (défaut: 16)
//  - Progress tracking via regex sur stderr
// ============================================================

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  WHISPER_CPP_BINARY_PATH,
  WHISPER_CPP_MODEL_PATH,
  WHISPER_CPP_DEFAULTS,
} from "./config.js";
import { parseWhisperCppOutput } from "./parseOutput.js";
import type { WhisperCppResult, WhisperCppRunOptions } from "./types.js";

/**
 * Lance une transcription Whisper.cpp et retourne le résultat structuré.
 * 
 * @param options - Configuration de l'exécution
 * @returns Résultat de transcription nettoyé (hallucinations filtrées)
 * 
 * @throws Si le binaire/modèle/audio n'existent pas
 * @throws Si whisper-cli exit avec un code != 0
 * @throws Si le JSON produit est invalide
 */
export async function runWhisperCpp(
  options: WhisperCppRunOptions
): Promise<WhisperCppResult> {
  const {
    audioPath,
    language = WHISPER_CPP_DEFAULTS.language,
    threads = WHISPER_CPP_DEFAULTS.threads,
    outputDir,
    outputBasename,
    onProgress,
  } = options;

  // ============================================================
  //  Validation des paths
  // ============================================================
  await assertFileExists(WHISPER_CPP_BINARY_PATH, "Whisper.cpp binary");
  await assertFileExists(WHISPER_CPP_MODEL_PATH, "Whisper.cpp model");
  await assertFileExists(audioPath, "Audio input file");
  await fs.mkdir(outputDir, { recursive: true });

  // ============================================================
  //  Préparation des paths output
  // ============================================================
  const audioBasename = path.basename(audioPath, path.extname(audioPath));
  const finalOutputBasename = outputBasename || audioBasename;
  const outputPathNoExt = path.join(outputDir, finalOutputBasename);
  const outputJsonPath = `${outputPathNoExt}.json`;

  // Cleanup d'un éventuel JSON précédent pour éviter de parser un vieux résultat
  try {
    await fs.unlink(outputJsonPath);
  } catch {
    // OK si pas existant
  }

  // ============================================================
  //  Arguments whisper-cli
  // ============================================================
  const args = [
    "-m", WHISPER_CPP_MODEL_PATH,
    "-f", audioPath,
    "-l", language,
    "-ojf", // JSON full output
    "-of", outputPathNoExt, // output basename (sans extension)
    "-pp", // print progress
    "-t", String(threads),
  ];

  if (WHISPER_CPP_DEFAULTS.noGpu) {
    args.push("-ng"); // no GPU
  }

  // ============================================================
  //  Spawn process + capture
  // ============================================================
  return new Promise((resolve, reject) => {
    const whisperProcess = spawn(WHISPER_CPP_BINARY_PATH, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderrBuffer = "";
    let lastProgress = -1;

    whisperProcess.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderrBuffer += text;

      // Parse "progress = X%" pour appeler onProgress (déduplique)
      if (onProgress) {
        const matches = text.matchAll(/progress\s*=\s*(\d+)%/g);
        for (const m of matches) {
          const percent = parseInt(m[1], 10);
          if (percent !== lastProgress) {
            lastProgress = percent;
            onProgress(percent);
          }
        }
      }
    });

    whisperProcess.on("error", (err) => {
      reject(
        new Error(
          `Failed to spawn whisper-cli at ${WHISPER_CPP_BINARY_PATH}: ${err.message}`
        )
      );
    });

    whisperProcess.on("close", async (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `whisper-cli exited with code ${code}.\n` +
              `stderr (last 1000 chars):\n${stderrBuffer.slice(-1000)}`
          )
        );
        return;
      }

      try {
        // Parse le JSON produit (avec filter hallucinations)
        const result = await parseWhisperCppOutput(outputJsonPath);

        // Enrichit avec les timings extraits du stderr
        const totalTimeMatch = stderrBuffer.match(
          /total time\s*=\s*([\d.]+)\s*ms/
        );
        const loadTimeMatch = stderrBuffer.match(
          /load time\s*=\s*([\d.]+)\s*ms/
        );

        if (totalTimeMatch) {
          result.timings_ms = {
            total: parseFloat(totalTimeMatch[1]),
            load: loadTimeMatch ? parseFloat(loadTimeMatch[1]) : 0,
          };
        }

        resolve(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        reject(new Error(`Failed to parse Whisper.cpp output: ${msg}`));
      }
    });
  });
}

// ============================================================
//  Helpers
// ============================================================

async function assertFileExists(
  filePath: string,
  label: string
): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} not found at: ${filePath}`);
  }
}