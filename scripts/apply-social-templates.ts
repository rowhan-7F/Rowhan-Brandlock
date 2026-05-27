/**
 * Sprint 1 - Application des templates multi-format via Supabase API
 *
 * Lit scripts/social-templates-output.json et applique au tenant flag_geneve
 * via supabase-js (evite les problemes de parsing SQL).
 *
 * Usage : npx tsx scripts/apply-social-templates.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Variables d environnement
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERREUR : Variables d environnement manquantes");
  console.error("NEXT_PUBLIC_SUPABASE_URL :", SUPABASE_URL ? "OK" : "MANQUANT");
  console.error("SUPABASE_SERVICE_ROLE_KEY :", SUPABASE_SERVICE_KEY ? "OK" : "MANQUANT");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log("Application des templates multi-format...");
  console.log("");

  // 1. Lire le JSON des nouveaux templates
  const jsonPath = path.join(__dirname, "social-templates-output.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("ERREUR : scripts/social-templates-output.json introuvable");
    console.error("Lance d abord : npx tsx scripts/generate-social-templates.ts");
    process.exit(1);
  }

  const newTemplates = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log("Templates a ajouter :", Object.keys(newTemplates));
  console.log("");

  // 2. Fetch le tenant_configs actuel
  console.log("Fetch tenant_configs (flag_geneve)...");
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
  console.log("Version actuelle :", tenant.config_version);
  console.log("");

  // 3. Merge les nouveaux templates
  const updatedConfig = {
    ...tenant.config_json,
    exportTemplates: {
      ...tenant.config_json.exportTemplates,
      ...newTemplates,
    },
  };

  const finalTemplates = Object.keys(updatedConfig.exportTemplates);
  console.log("Templates apres merge :", finalTemplates);
  console.log("");

  // 4. UPDATE en DB
  console.log("Update tenant_configs...");
  const { error: updateError } = await supabase
    .from("tenant_configs")
    .update({
      config_json: updatedConfig,
      config_version: "1.1.0",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", "flag_geneve");

  if (updateError) {
    console.error("ERREUR update :", updateError);
    process.exit(1);
  }

  console.log("OK Update reussi !");
  console.log("");

  // 5. Verification
  console.log("Verification...");
  const { data: verify } = await supabase
    .from("tenant_configs")
    .select("config_version, config_json")
    .eq("tenant_id", "flag_geneve")
    .single();

  if (verify) {
    const verifiedTemplates = Object.keys(verify.config_json.exportTemplates);
    console.log("Version finale :", verify.config_version);
    console.log("Templates finaux (" + verifiedTemplates.length + ") :");
    verifiedTemplates.sort().forEach(t => {
      const dims = verify.config_json.exportTemplates[t].dimensions;
      console.log("  - " + t + " (" + dims.width + "x" + dims.height + ")");
    });
  }

  console.log("");
  console.log("OK Sprint 1 - Templates multi-format applique !");
}

main().catch(err => {
  console.error("ERREUR :", err);
  process.exit(1);
});