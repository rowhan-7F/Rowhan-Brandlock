/**
 * Validation de la charte graphique tenant
 * 
 * Verifie qu'un tenant_configs.config_json contient bien tous les elements
 * necessaires pour generer du contenu dans un format donne.
 * 
 * Usage :
 *   import { validateBrandCharter, ALL_FORMAT_KEYS } from "@/lib/brandCharterValidation";
 *   const result = validateBrandCharter("carrousel_instagram_square", tenantConfig);
 *   if (!result.valid) console.error(result.errors);
 */

// ============================================================
// TYPES
// ============================================================

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type FormatKey =
  // Carousels (images statiques)
  | "carrousel_instagram"
  | "carrousel_instagram_square"
  | "carrousel_linkedin_square"
  | "carrousel_facebook"
  // Videos par plateforme (Sprint 2.5)
  | "video_instagram_reel"
  | "video_tiktok"
  | "video_youtube_shorts"
  | "video_instagram_square"
  | "video_linkedin_square"
  | "video_youtube";

// ============================================================
// CONSTANTES
// ============================================================

export const ALL_FORMAT_KEYS: FormatKey[] = [
  // Carousels
  "carrousel_instagram",
  "carrousel_instagram_square",
  "carrousel_linkedin_square",
  "carrousel_facebook",
  // Videos par plateforme (Sprint 2.5)
  "video_instagram_reel",
  "video_tiktok",
  "video_youtube_shorts",
  "video_instagram_square",
  "video_linkedin_square",
  "video_youtube",
];

export const IMAGE_FORMAT_KEYS: FormatKey[] = [
  "carrousel_instagram",
  "carrousel_instagram_square",
  "carrousel_linkedin_square",
  "carrousel_facebook",
];

export const VIDEO_FORMAT_KEYS: FormatKey[] = [
  // Videos par plateforme (Sprint 2.5)
  "video_instagram_reel",
  "video_tiktok",
  "video_youtube_shorts",
  "video_instagram_square",
  "video_linkedin_square",
  "video_youtube",
];

const REQUIRED_IMAGE_VARIANTS = ["intro", "content", "outro"] as const;
const REQUIRED_BRAND_COLORS = ["brandPrimary", "textLight"] as const;
const REQUIRED_BRAND_FONTS = ["titleFont", "bodyFont"] as const;

// ============================================================
// VALIDATION PRINCIPALE
// ============================================================

/**
 * Valide qu une charte tenant est complete pour un format donne
 */
export function validateBrandCharter(
  formatKey: FormatKey | string,
  tenantConfig: any
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Verifier que la config existe
  if (!tenantConfig || typeof tenantConfig !== "object") {
    return {
      valid: false,
      errors: ["Configuration tenant manquante ou invalide"],
      warnings: [],
    };
  }

  // 2. Verifier brandIdentity
  validateBrandIdentity(tenantConfig, errors, warnings);

  // 3. Verifier que le template existe
  const template = tenantConfig?.exportTemplates?.[formatKey];
  if (!template) {
    errors.push(`Template "${formatKey}" introuvable dans exportTemplates`);
    return { valid: errors.length === 0, errors, warnings };
  }

  // 4. Verifier dimensions
  if (!template.dimensions?.width || !template.dimensions?.height) {
    errors.push(`Dimensions manquantes pour "${formatKey}"`);
  }

  // 5. Si format image : verifier slideVariants
  if (IMAGE_FORMAT_KEYS.includes(formatKey as FormatKey)) {
    validateSlideVariants(template, formatKey, errors, warnings);
  }

  // 6. Si format video : verifier subtitleStyle, allowedModes
  if (VIDEO_FORMAT_KEYS.includes(formatKey as FormatKey)) {
    validateVideoTemplate(template, formatKey, errors, warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// VALIDATEURS INTERNES
// ============================================================

function validateBrandIdentity(
  tenantConfig: any,
  errors: string[],
  warnings: string[]
): void {
  const brand = tenantConfig?.brandIdentity;
  if (!brand) {
    errors.push("brandIdentity manquante");
    return;
  }

  // Couleurs requises
  const colors = brand?.colors || {};
  for (const colorKey of REQUIRED_BRAND_COLORS) {
    if (!colors[colorKey]) {
      errors.push(`Couleur "${colorKey}" manquante dans brandIdentity.colors`);
    }
  }

  // Polices requises
  const fonts = brand?.fonts || {};
  for (const fontKey of REQUIRED_BRAND_FONTS) {
    if (!fonts[fontKey]?.family) {
      errors.push(`Police "${fontKey}" manquante dans brandIdentity.fonts`);
    }
    if (fonts[fontKey] && !fonts[fontKey]?.url) {
      warnings.push(`Police "${fontKey}" n a pas d URL (fallback systeme)`);
    }
  }

  // Logos (warnings, pas errors)
  const assets = brand?.assets || {};
  if (!assets.logoColor && !assets.logoWhite) {
    warnings.push("Aucun logo defini dans brandIdentity.assets");
  }
}

function validateSlideVariants(
  template: any,
  formatKey: string,
  errors: string[],
  warnings: string[]
): void {
  const variants = template?.slideVariants || {};

  // Verifier variants requis
  for (const variantKey of REQUIRED_IMAGE_VARIANTS) {
    if (!variants[variantKey]) {
      errors.push(`Variant "${variantKey}" manquant dans "${formatKey}"`);
      continue;
    }

    const subVariants = variants[variantKey]?.subVariants || {};
    if (Object.keys(subVariants).length === 0) {
      errors.push(
        `Aucun subVariant defini pour "${variantKey}" dans "${formatKey}"`
      );
      continue;
    }

    // Verifier chaque subVariant
    for (const [subKey, subVariant] of Object.entries(subVariants)) {
      validateSubVariant(
        subVariant as any,
        `${formatKey}.${variantKey}.${subKey}`,
        errors,
        warnings
      );
    }
  }

  // Verifier carouselRules (warning si manquant)
  if (!template.carouselRules) {
    warnings.push(`carouselRules manquantes pour "${formatKey}"`);
  } else {
    const rules = template.carouselRules;
    if (typeof rules.maxSlides !== "number" || rules.maxSlides < 1) {
      warnings.push(`maxSlides invalide pour "${formatKey}"`);
    }
  }
}

function validateSubVariant(
  subVariant: any,
  path: string,
  errors: string[],
  warnings: string[]
): void {
  // Verifier inputs
  if (!Array.isArray(subVariant?.inputs) || subVariant.inputs.length === 0) {
    errors.push(`Inputs manquants : ${path}`);
  }

  // Verifier components
  if (!subVariant?.components || typeof subVariant.components !== "object") {
    errors.push(`Components manquants : ${path}`);
  } else {
    const componentCount = Object.keys(subVariant.components).length;
    if (componentCount === 0) {
      errors.push(`Aucun component defini : ${path}`);
    }
  }

  // Verifier safeZones
  if (!subVariant?.layoutRules?.safeZonesPx) {
    warnings.push(`safeZonesPx manquantes : ${path}`);
  } else {
    const sz = subVariant.layoutRules.safeZonesPx;
    const requiredKeys = ["top", "right", "bottom", "left"];
    for (const key of requiredKeys) {
      if (typeof sz[key] !== "number") {
        warnings.push(`safeZonesPx.${key} manquant ou invalide : ${path}`);
      }
    }
  }
}

function validateVideoTemplate(
  template: any,
  formatKey: string,
  errors: string[],
  warnings: string[]
): void {
  // Dimensions
  if (!template.dimensions?.width || !template.dimensions?.height) {
    errors.push(`Dimensions manquantes : ${formatKey}`);
  }

  // FPS (warning si absent)
  if (!template.fps) {
    warnings.push(`FPS non defini : ${formatKey}`);
  }

  // allowedModes
  if (!Array.isArray(template.allowedModes) || template.allowedModes.length === 0) {
    warnings.push(`allowedModes manquant : ${formatKey}`);
  }

  // subtitleStyle
  if (!template.subtitleStyle) {
    warnings.push(`subtitleStyle manquant : ${formatKey}`);
  }
}

// ============================================================
// VALIDATION GLOBALE D UN TENANT
// ============================================================

export type TenantValidationReport = {
  tenantId: string;
  globalValid: boolean;
  formats: Array<{
    formatKey: FormatKey;
    result: ValidationResult;
  }>;
};

/**
 * Valide TOUS les formats d un tenant
 * Utile pour le super admin qui veut un apercu complet
 */
export function validateTenantConfig(
  tenantId: string,
  tenantConfig: any,
  formatsToCheck: FormatKey[] = ALL_FORMAT_KEYS
): TenantValidationReport {
  const formats = formatsToCheck.map((formatKey) => ({
    formatKey,
    result: validateBrandCharter(formatKey, tenantConfig),
  }));

  const globalValid = formats.every((f) => f.result.valid);

  return {
    tenantId,
    globalValid,
    formats,
  };
}