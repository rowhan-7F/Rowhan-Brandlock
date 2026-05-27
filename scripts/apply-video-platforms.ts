/**
 * Sprint 2.5 - Application des templates video plateformes
 *
 * 1. Ajoute les 6 nouveaux templates video_<platform>
 * 2. SUPPRIME les 3 anciens templates video (square_1_1, story_9_16, landscape_16_9)
 * 3. Migration : si projets existants utilisaient les anciens templates,
 *    les router vers le nouveau (defaut par format)
 *
 * Usage : npx tsx scripts/apply-video-platforms.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERREUR : Variables d environnement manquantes");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log("Application des templates video plateformes...");
  console.log("");

  // 1. Lire le JSON
  const jsonPath = path.join(__dirname, "video-platforms-output.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("ERREUR : video-platforms-output.json introuvable");
    console.error("Lance d abord : npx tsx scripts/generate-video-platforms.ts");
    process.exit(1);
  }

  const newTemplates = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log("Templates a ajouter :", Object.keys(newTemplates));
  console.log("");

  // 2. Fetch le tenant
  const { data: tenant, error: fetchError } = await supabase
    .from("tenant_configs")
    .select("*")
    .eq("tenant_id", "flag_geneve")
    .single();

  if (fetchError || !tenant) {
    console.error("ERREUR fetch :", fetchError);
    process.exit(1);
  }

  console.log("Templates actuels :", Object.keys(tenant.config_json.exportTemplates));
  console.log("");

  // 3. Merge : ajouter nouveaux + supprimer anciens
  const oldVideoTemplates = ["video_square_1_1", "video_story_9_16", "video_landscape_16_9"];
  
  const updatedExportTemplates: Record<string, any> = {};
  
  // Garder tout sauf les anciens video
  for (const [key, value] of Object.entries(tenant.config_json.exportTemplates)) {
    if (!oldVideoTemplates.includes(key)) {
      updatedExportTemplates[key] = value;
    }
  }
  
  // Ajouter les nouveaux
  for (const [key, value] of Object.entries(newTemplates)) {
    updatedExportTemplates[key] = value;
  }

  const updatedConfig = {
    ...tenant.config_json,
    exportTemplates: updatedExportTemplates,
  };

  const finalTemplates = Object.keys(updatedConfig.exportTemplates).sort();
  console.log("Templates apres merge (" + finalTemplates.length + ") :");
  finalTemplates.forEach(t => console.log("  - " + t));
  console.log("");

  // 4. UPDATE
  console.log("Update tenant_configs...");
  const { error: updateError } = await supabase
    .from("tenant_configs")
    .update({
      config_json: updatedConfig,
      config_version: "1.2.0",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", "flag_geneve");

  if (updateError) {
    console.error("ERREUR update :", updateError);
    process.exit(1);
  }

  console.log("OK Update reussi !");
  console.log("");

  // 5. Migration des projets video existants
  console.log("Migration des projets video existants...");
  
  const FORMAT_TO_DEFAULT_PLATFORM: Record<string, string> = {
    "9_16": "instagram_reel",
    "1_1": "instagram_square",
    "16_9": "youtube",
  };
  
  const { data: existingProjects } = await supabase
    .from("studio_video_projects")
    .select("id, format")
    .eq("tenant_id", "flag_geneve");
  
  console.log("Projets video existants :", existingProjects?.length || 0);
  
  if (existingProjects && existingProjects.length > 0) {
    for (const proj of existingProjects) {
      const defaultPlatform = FORMAT_TO_DEFAULT_PLATFORM[proj.format];
      console.log("  - Projet " + proj.id + " (format=" + proj.format + ") -> platform=" + defaultPlatform);
    }
    console.log("");
    console.log("NOTE : la colonne 'platform' sera ajoutee a la table dans le SQL suivant.");
    console.log("       La migration est faite a ce moment-la.");
  }

  console.log("");
  console.log("OK Sprint 2.5 - Templates video plateformes appliques !");
  console.log("");
  console.log("PROCHAINE ETAPE : lance le SQL suivant pour ajouter la colonne platform.");
}

main().catch(err => {
  console.error("ERREUR :", err);
  process.exit(1);
});