import {
  parseWhisperCppOutput,
  reconstructWordsFromTokens,
} from "../src/whisperCpp/index.ts";

async function main() {
  const r = await parseWhisperCppOutput(
    "./whisper-cpp/samples/source_output.json"
  );

  console.log("--- BEFORE (raw sub-tokens) ---");
  const rawTokens = r.segments[0]?.tokens.slice(0, 20) ?? [];
  console.log(rawTokens.map((t) => t.text).join("|"));

  console.log("");
  console.log("--- AFTER (real words reconstructed) ---");
  const words = reconstructWordsFromTokens(r.segments[0]?.tokens ?? []);
  console.log(words.slice(0, 10).map((w) => w.word).join(" | "));

  console.log("");
  console.log("--- Detailed first 5 words ---");
  words.slice(0, 5).forEach((w, i) => {
    console.log(
      `${i + 1}. "${w.word}" [${w.start_ms}-${w.end_ms}ms] conf=${w.confidence.toFixed(3)}`
    );
  });
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});