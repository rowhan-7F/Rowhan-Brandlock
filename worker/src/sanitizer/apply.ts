// ============================================================
//  Sanitizer du transcript — applique le lexique tenant
//  Lit tenant_configs.config_json.transcription.replacements
//  Applique des replacements avec word boundaries pour éviter
//  les remplacements partiels (genre "rohan" dans "rohaine")
// ============================================================

import { supabase } from "../config.js";
import { log } from "../logger.js";

type SanitizerReplacement = {
  from: string;
  to: string;
  caseSensitive?: boolean;
};

type SanitizerResult = {
  sanitized: string;
  appliedReplacements: number;
};

export async function applySanitizer(
  tenantId: string,
  rawTranscript: string
): Promise<SanitizerResult> {
  // 1. Récupère le lexique tenant
  const { data: tenantData, error } = await supabase
    .from("tenant_configs")
    .select("config_json")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load tenant config: ${error.message}`);
  }

  if (!tenantData) {
    log.warn(`Tenant config not found for ${tenantId}, returning raw transcript`);
    return { sanitized: rawTranscript, appliedReplacements: 0 };
  }

  const replacements: SanitizerReplacement[] =
    tenantData.config_json?.transcription?.replacements || [];

  if (replacements.length === 0) {
    log.info("No replacements configured for this tenant");
    return { sanitized: rawTranscript, appliedReplacements: 0 };
  }

  // 2. Applique les replacements avec word boundaries
  let sanitized = rawTranscript;
  let totalApplied = 0;

  for (const rep of replacements) {
    if (!rep.from || rep.to === undefined) continue;

    // Échappe les caractères spéciaux regex dans `from`
    const escapedFrom = escapeRegex(rep.from);

    // Word boundaries `\b` pour éviter les remplacements partiels
    // (mais on garde la possibilité de cibler des expressions multi-mots)
    const flags = rep.caseSensitive ? "g" : "gi";
    const pattern = new RegExp(`\\b${escapedFrom}\\b`, flags);

    const beforeCount = (sanitized.match(pattern) || []).length;
    if (beforeCount > 0) {
      sanitized = sanitized.replace(pattern, rep.to);
      totalApplied += beforeCount;
      log.sanitize(`Replaced: "${rep.from}" → "${rep.to}" (${beforeCount} occurrence${beforeCount > 1 ? "s" : ""})`);
    }
  }

  if (totalApplied === 0) {
    log.info(`Sanitizer: no replacements applied (${replacements.length} rules checked)`);
  } else {
    log.success(`Sanitizer applied ${totalApplied} total replacement${totalApplied > 1 ? "s" : ""}`);
  }

  return { sanitized, appliedReplacements: totalApplied };
}

// Échappe les caractères regex spéciaux
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}