// Re-déclenche un job transcribe pour un projet existant
// Usage: npx tsx scripts/trigger-retranscribe.ts <project_title>

import { supabase } from "../src/config.ts";

const projectName = process.argv[2] || "wisperCPP";

async function main() {
  console.log(`🔍 Recherche du projet "${projectName}"...`);

  const { data: projects, error: projectErr } = await supabase
    .from("studio_video_projects")
    .select("id, title, tenant_id")
    .eq("title", projectName)
    .limit(1);

  if (projectErr) {
    console.error("❌ Erreur Supabase:", projectErr);
    process.exit(1);
  }

  if (!projects || projects.length === 0) {
    console.error(`❌ Projet "${projectName}" introuvable`);
    process.exit(1);
  }

  const project = projects[0];
  console.log(`✅ Projet trouvé: ${project.title}`);
  console.log(`   ID     : ${project.id}`);
  console.log(`   Tenant : ${project.tenant_id}`);
  console.log("");
  console.log("🚀 Création du job transcribe...");

  // Insert minimal : project_id + job_type suffisent
  // (tenant_id est déduit via project, status/attempts ont des defaults)
  const { data: job, error: jobErr } = await supabase
    .from("studio_video_render_jobs")
    .insert({
      project_id: project.id,
      job_type: "transcribe",
      status: "queued",
      payload: {},
    })
    .select()
    .single();

  if (jobErr) {
    console.error("❌ Échec création job:", jobErr);
    process.exit(1);
  }

  console.log(`✅ Job transcribe créé (id=${job.id}, status=queued)`);
  console.log("");
  console.log("👀 Regarde Terminal 2 — le worker va le claim dans ~5s.");
  console.log("   ~150s pour Whisper.cpp + ~25s render auto = ~3 min total");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});