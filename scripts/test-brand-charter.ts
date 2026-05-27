/**
 * Test automatique de la validation de charte brand
 * 
 * Verifie que :
 *   1. La charte flag_geneve est valide pour les 9 formats
 *   2. La validation detecte bien les manques
 * 
 * Usage : npx tsx scripts/test-brand-charter.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

import {
  validateBrandCharter,
  validateTenantConfig,
  ALL_FORMAT_KEYS,
  IMAGE_FORMAT_KEYS,
  VIDEO_FORMAT_KEYS,
} from "../src/lib/brandCharterValidation";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Couleurs console
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

async function main() {
  console.log(CYAN + "===================================================" + RESET);
  console.log(CYAN + "  TEST BRAND CHARTER VALIDATION" + RESET);
  console.log(CYAN + "===================================================" + RESET);
  console.log("");

  // Fetch tenant flag_geneve
  const { data: tenant, error } = await supabase
    .from("tenant_configs")
    .select("*")
    .eq("tenant_id", "flag_geneve")
    .single();

  if (error || !tenant) {
    console.error(RED + "ERREUR fetch :" + RESET, error);
    process.exit(1);
  }

  console.log("Tenant       : " + tenant.tenant_id);
  console.log("Nom          : " + tenant.tenant_name);
  console.log("Version      : " + tenant.config_version);
  console.log("Templates DB : " + Object.keys(tenant.config_json.exportTemplates).length);
  console.log("");

  // ============================================================
  // TEST 1 : Valider chaque format individuellement
  // ============================================================

  console.log(CYAN + "=== TEST 1 : Validation par format ===" + RESET);
  console.log("");

  let passCount = 0;
  let failCount = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const formatKey of ALL_FORMAT_KEYS) {
    const result = validateBrandCharter(formatKey, tenant.config_json);
    
    const icon = result.valid ? GREEN + "OK" + RESET : RED + "KO" + RESET;
    const errors = result.errors.length;
    const warnings = result.warnings.length;
    
    console.log("  " + icon + " " + formatKey.padEnd(35) + 
                " errors:" + errors + " warnings:" + warnings);
    
    if (result.valid) passCount++;
    else failCount++;
    
    totalErrors += errors;
    totalWarnings += warnings;

    // Afficher les erreurs (limite 3 par format pour pas spammer)
    if (errors > 0) {
      result.errors.slice(0, 3).forEach((e) => {
        console.log("    " + RED + "ERR:" + RESET + " " + e);
      });
      if (errors > 3) {
        console.log("    " + RED + "... (" + (errors - 3) + " autres erreurs)" + RESET);
      }
    }
    
    // Afficher les warnings (limite 2)
    if (warnings > 0) {
      result.warnings.slice(0, 2).forEach((w) => {
        console.log("    " + YELLOW + "WARN:" + RESET + " " + w);
      });
      if (warnings > 2) {
        console.log("    " + YELLOW + "... (" + (warnings - 2) + " autres warnings)" + RESET);
      }
    }
  }

  console.log("");
  console.log(CYAN + "=== STATISTIQUES ===" + RESET);
  console.log("  Total formats teste : " + ALL_FORMAT_KEYS.length);
  console.log("  Pass : " + GREEN + passCount + RESET);
  console.log("  Fail : " + RED + failCount + RESET);
  console.log("  Total errors : " + totalErrors);
  console.log("  Total warnings : " + totalWarnings);
  console.log("");

  // ============================================================
  // TEST 2 : Validation globale
  // ============================================================

  console.log(CYAN + "=== TEST 2 : Validation globale ===" + RESET);
  console.log("");

  const report = validateTenantConfig("flag_geneve", tenant.config_json);
  console.log("  Tenant valid global : " + (report.globalValid ? GREEN + "OUI" : RED + "NON") + RESET);
  console.log("");

  // ============================================================
  // TEST 3 : Detection de chartes invalides
  // ============================================================

  console.log(CYAN + "=== TEST 3 : Detection de manques ===" + RESET);
  console.log("");

  // Test 3.1 : config vide
  const emptyResult = validateBrandCharter("carrousel_instagram", {});
  console.log("  Charte vide        : " + 
              (emptyResult.errors.length > 0 ? GREEN + "OK detecte (" + emptyResult.errors.length + " errors)" : RED + "KO non detecte") + RESET);

  // Test 3.2 : format inexistant
  const invalidFormatResult = validateBrandCharter("format_qui_nexiste_pas" as any, tenant.config_json);
  console.log("  Format inexistant  : " + 
              (invalidFormatResult.errors.length > 0 ? GREEN + "OK detecte" : RED + "KO non detecte") + RESET);

  // Test 3.3 : config sans brandIdentity
  const noBrandResult = validateBrandCharter("carrousel_instagram", {
    exportTemplates: tenant.config_json.exportTemplates,
  });
  console.log("  Sans brandIdentity : " + 
              (noBrandResult.errors.length > 0 ? GREEN + "OK detecte" : RED + "KO non detecte") + RESET);

  console.log("");

  // ============================================================
  // CONCLUSION
  // ============================================================

  console.log(CYAN + "===================================================" + RESET);
  if (failCount === 0) {
    console.log(GREEN + "  OK TOUS LES TESTS PASSENT" + RESET);
    console.log("  Charte flag_geneve : VALIDE pour " + passCount + "/" + ALL_FORMAT_KEYS.length + " formats");
  } else {
    console.log(RED + "  KO " + failCount + " FORMAT(S) INVALIDE(S)" + RESET);
  }
  console.log(CYAN + "===================================================" + RESET);
}

main().catch((err) => {
  console.error(RED + "ERREUR :" + RESET, err);
  process.exit(1);
});