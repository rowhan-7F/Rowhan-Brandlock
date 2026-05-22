// Diagnostic des words actuels en DB pour wisperCPP
import { supabase } from "../src/config.ts";

async function main() {
  const { data: project } = await supabase
    .from("studio_video_projects")
    .select("id, state_json")
    .eq("title", "wisperCPP")
    .limit(1)
    .single();

  if (!project) { console.error("Projet introuvable"); return; }

  const words: Array<{word: string, start: number, end: number}> = 
    project.state_json?.transcript?.words || [];

  const engine = project.state_json?.transcript?.engine || "unknown";
  console.log(`Engine     : ${engine}`);
  console.log(`Words count: ${words.length}`);
  console.log("");
  console.log("--- Premiers 10 mots avec GAP entre chacun ---");
  
  for (let i = 0; i < Math.min(words.length, 10); i++) {
    const w = words[i];
    const gap = i > 0 ? ((w.start - words[i - 1].end) * 1000).toFixed(0) : "-";
    const gapMark = gap !== "-" && parseInt(gap) >= 250 ? " ⭐ SILENCE >= 250ms" : "";
    console.log(
      `${i + 1}. "${w.word}" [${(w.start * 1000).toFixed(0)}ms → ${(w.end * 1000).toFixed(0)}ms]  gap_with_prev=${gap}ms${gapMark}`
    );
  }
}

main().catch(console.error);