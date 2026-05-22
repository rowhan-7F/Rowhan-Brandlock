import { parseWhisperCppOutput } from "../src/whisperCpp/parseOutput.ts";

async function main() {
  const r = await parseWhisperCppOutput(
    "./whisper-cpp/samples/source_output.json"
  );

  console.log("Language               :", r.language);
  console.log("Duration               :", r.duration_seconds, "s");
  console.log("Segments               :", r.segments.length);
  console.log("Hallucinations filtered:", r.hallucinations_filtered);
  console.log("");
  console.log("--- First segment ---");
  console.log("Text         :", r.segments[0]?.text);
  console.log("From         :", r.segments[0]?.from_ms, "ms");
  console.log("To           :", r.segments[0]?.to_ms, "ms");
  console.log("Tokens count :", r.segments[0]?.tokens.length);
  console.log("");
  console.log("--- First 3 tokens ---");
  console.log(JSON.stringify(r.segments[0]?.tokens.slice(0, 3), null, 2));
  console.log("");
  console.log("--- Full text (first 300 chars) ---");
  console.log(r.text.slice(0, 300));
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});