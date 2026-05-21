// ============================================================
//  Logger coloré avec emojis pour distinguer les étapes du worker.
// ============================================================

type LogLevel = "info" | "warn" | "error" | "success" | "debug";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function timestamp(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${COLORS.gray}[${hh}:${mm}:${ss}]${COLORS.reset}`;
}

function format(level: LogLevel, emoji: string, msg: string, color: string): string {
  return `${timestamp()} ${color}${emoji}${COLORS.reset} ${msg}`;
}

export const log = {
  info: (msg: string) => console.log(format("info", "ℹ️ ", msg, COLORS.cyan)),
  success: (msg: string) => console.log(format("success", "✅", msg, COLORS.green)),
  warn: (msg: string) => console.log(format("warn", "⚠️ ", msg, COLORS.yellow)),
  error: (msg: string, err?: any) => {
    console.log(format("error", "❌", msg, COLORS.red));
    if (err) console.error(err);
  },
  debug: (msg: string) => console.log(format("debug", "🔍", msg, COLORS.gray)),

  // Spécifiques au flow worker
  poll: () => console.log(format("info", "🔍", "Polling for jobs...", COLORS.dim)),
  claim: (jobId: string, jobType: string, attempts: number) =>
    console.log(format("info", "📦", `Job claimed: ${jobId} (${jobType}, attempt ${attempts}/3)`, COLORS.magenta)),
  project: (title: string, tenant: string) =>
    console.log(format("info", "🎬", `Project: "${title}" (${tenant})`, COLORS.cyan)),
  download: (size: string) =>
    console.log(format("info", "⬇️ ", `Downloading source (${size})...`, COLORS.blue)),
  ffmpeg: (msg: string) =>
    console.log(format("info", "🎵", msg, COLORS.magenta)),
  upload: (size: string) =>
    console.log(format("info", "⬆️ ", `Uploading audio (${size})...`, COLORS.blue)),
  whisper: (msg: string) =>
    console.log(format("info", "🧠", msg, COLORS.magenta)),
  whisperPoll: (elapsed: number) =>
    console.log(format("debug", "⏳", `Polling Whisper... (${elapsed}s elapsed)`, COLORS.gray)),
  sanitize: (replacement: string) =>
    console.log(format("info", "✏️ ", replacement, COLORS.yellow)),
  save: () =>
    console.log(format("info", "💾", "Saving transcript to project state_json...", COLORS.cyan)),
  completed: (durationSec: number) =>
    console.log(format("success", "✅", `Job completed in ${durationSec.toFixed(1)}s`, COLORS.green)),
  cleanup: (jobId: string) =>
    console.log(format("debug", "🧹", `Cleanup worker/tmp/${jobId}/`, COLORS.gray)),
};