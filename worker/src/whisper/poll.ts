import { config } from "../config.js";
import { log } from "../logger.js";

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

type WhisperPollResult = {
    text: string;
    segments?: WhisperSegment[];
    words?: WhisperWord[];
    language?: string;
    durationSeconds?: number;
  };

type WhisperPollResponse = {
  result?: string;
  status?: string;
  data?: string | WhisperResultData;
  error?: string;
};

type WhisperResultData = {
    text?: string;
    transcript?: string;
    segments?: WhisperSegment[];
    words?: WhisperWord[];
    language?: string;
    duration?: number;
  };

type ProgressCallback = (elapsedSeconds: number) => Promise<void>;

export async function pollWhisper(
  batchId: string,
  onProgress?: ProgressCallback
): Promise<WhisperPollResult> {
  if (batchId.startsWith("instant:")) {
    const result = JSON.parse(batchId.slice("instant:".length)) as WhisperResultData;
    return {
        text: result.text || "",
        segments: result.segments,
        words: result.words,
        language: result.language,
        durationSeconds: result.duration,
      };
  }

  const startTime = Date.now();
  const url = `${config.infomaniakBaseUrl}/${config.infomaniakProductId}/results/${batchId}`;

  while (true) {
    const elapsed = (Date.now() - startTime) / 1000;

    if (elapsed * 1000 > config.whisperTimeoutMs) {
      throw new Error(
        `Whisper timeout apres ${elapsed.toFixed(0)}s (limite: ${config.whisperTimeoutMs / 1000}s)`
      );
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.infomaniakToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Whisper poll failed: HTTP ${response.status} ${response.statusText}\n${errorText.slice(0, 300)}`
      );
    }

    const result = (await response.json()) as WhisperPollResponse;

    const status = result.result || result.status;

    if (status === "success" || status === "completed") {
      let parsed: WhisperResultData;
      if (typeof result.data === "string") {
        try {
          parsed = JSON.parse(result.data) as WhisperResultData;
        } catch {
          parsed = { text: result.data };
        }
      } else if (result.data && typeof result.data === "object") {
        parsed = result.data;
      } else {
        parsed = result as unknown as WhisperResultData;
      }

      const text = parsed.text || parsed.transcript || "";
      if (!text) {
        throw new Error(`Whisper result vide: ${JSON.stringify(result).slice(0, 300)}`);
      }

      const wordsCount = parsed.words?.length || 0;
      log.whisper(`Transcript received (${text.length} chars, ${wordsCount} words)`);
      return {
        text,
        segments: parsed.segments,
        words: parsed.words,
        language: parsed.language,
        durationSeconds: parsed.duration,
      };
    }

    if (status === "error" || status === "failed") {
      throw new Error(
        `Whisper failed: ${result.error || result.data || JSON.stringify(result).slice(0, 300)}`
      );
    }

    log.whisperPoll(Math.floor(elapsed));

    if (onProgress) {
      await onProgress(elapsed);
    }

    await sleep(config.whisperPollIntervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}