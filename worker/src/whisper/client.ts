import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { log } from "../logger.js";

type WhisperSubmitInput = {
  audioPath: string;
  language?: string;
};

type WhisperSubmitResult = {
  batchId: string;
};

type WhisperSubmitResponse = {
  batch_id?: string;
  text?: string;
  segments?: unknown[];
  language?: string;
  duration?: number;
};

export async function submitToWhisper(input: WhisperSubmitInput): Promise<WhisperSubmitResult> {
  const { audioPath, language = "fr" } = input;

  log.whisper("Sending audio to Whisper Infomaniak...");

  const audioBuffer = await fs.readFile(audioPath);
  const audioFilename = path.basename(audioPath);

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" });
  formData.append("file", blob, audioFilename);
  formData.append("model", "whisper");
  formData.append("language", language);
  formData.append("response_format", "verbose_json");
  formData.append("temperature", "0");

  const url = `${config.infomaniakBaseUrl}/${config.infomaniakProductId}/openai/audio/transcriptions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.infomaniakToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Whisper submit failed: HTTP ${response.status} ${response.statusText}\n${errorText.slice(0, 500)}`
    );
  }

  const result = (await response.json()) as WhisperSubmitResponse;

  if (result.batch_id) {
    log.whisper(`Whisper batch_id: ${result.batch_id}`);
    return { batchId: result.batch_id };
  }

  if (result.text) {
    log.whisper("Whisper returned instant result (no batch)");
    return { batchId: `instant:${JSON.stringify(result)}` };
  }

  throw new Error(
    `Whisper response missing batch_id or text: ${JSON.stringify(result).slice(0, 300)}`
  );
}