import path from "node:path";
import { runWhisperCpp } from "../src/whisperCpp/index.ts";

async function main() {
  const audioPath = path.resolve("./whisper-cpp/samples/source.wav");
  const outputDir = path.resolve("./whisper-cpp/samples");

  console.log("🧠 Launching Whisper.cpp from Node wrapper...");
  console.log("   Audio :", audioPath);
  console.log("");

  const startTime = Date.now();

  const result = await runWhisperCpp({
    audioPath,
    language: "fr",
    threads: 16,
    outputDir,
    outputBasename: "source_via_wrapper",
    onProgress: (percent) => {
      process.stdout.write(`\r   Progress: ${percent}%   `);
    },
  });

  const elapsed = (Date.now() - startTime) / 1000;

  console.log("");
  console.log("");
  console.log("✅ TRANSCRIPTION COMPLETE in", elapsed.toFixed(1), "s");
  console.log("");
  console.log("Language               :", result.language);
  console.log("Duration               :", result.duration_seconds, "s");
  console.log("Segments               :", result.segments.length);
  console.log("Hallucinations filtered:", result.hallucinations_filtered);
  console.log("Whisper load time      :", result.timings_ms?.load.toFixed(0), "ms");
  console.log("Whisper total time     :", result.timings_ms?.total.toFixed(0), "ms");
  console.log("");
  console.log("--- First 3 segments ---");
  result.segments.slice(0, 3).forEach((seg, i) => {
    console.log(`${i + 1}. [${seg.from_ms}ms -> ${seg.to_ms}ms] ${seg.text}`);
  });
  console.log("");
  console.log("--- Last 3 segments ---");
  result.segments.slice(-3).forEach((seg, i) => {
    console.log(`${result.segments.length - 2 + i}. [${seg.from_ms}ms -> ${seg.to_ms}ms] ${seg.text}`);
  });
}

main().catch((err) => {
  console.error("\nERROR:", err);
  process.exit(1);
});