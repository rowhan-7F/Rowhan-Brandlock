/**
 * Sprint 3+4 - Format Overrides Engine
 * 
 * Logique de merge intelligent entre :
 *   - BASE (slide.inputs partage entre formats)
 *   - AUTO-ADAPTATION (ratios par format - Sprint 1 logic)
 *   - MANUAL OVERRIDES (formatOverrides granulaire)
 * 
 * Pattern luxury Stripe : "Smart merge, locked properties preserved."
 */

import type {
  SlideState,
  SlideFormatOverride,
  OverrideEntry,
  SlideInputValue,
  OverrideSource,
} from "./useStudioProject";

// ============================================================
//  CONSTANTES
// ============================================================

/** Format de reference pour l adaptation auto (Sprint 1 base) */
export const REFERENCE_FORMAT_KEY = "carrousel_instagram";
export const REFERENCE_DIMENSIONS = { width: 1080, height: 1350 };

// ============================================================
//  HELPER : Cree un OverrideEntry
// ============================================================

export function createOverrideEntry<T>(
  value: T,
  source: OverrideSource = "manual",
  previousValue?: T
): OverrideEntry<T> {
  return {
    value,
    source,
    lockedAt: new Date().toISOString(),
    previousValue,
  };
}

// ============================================================
//  HELPER : Obtenir la valeur finale d un input pour un format
// ============================================================

/**
 * Retourne la valeur finale d un input pour un format donne :
 *   1. Si override manuel existe -> retourne override.value
 *   2. Sinon -> retourne base value
 */
export function getInputFinalValue(
  slide: SlideState,
  inputKey: string,
  formatKey: string
): SlideInputValue | undefined {
  const override = slide.formatOverrides?.[formatKey]?.inputs?.[inputKey];
  if (override) {
    return override.value;
  }
  return slide.inputs[inputKey];
}
// ============================================================
//  HELPER : Resolver complet des inputs pour un format
//  (combine slide.inputs + slide.formatOverrides[format].inputs)
// ============================================================

/**
 * Retourne TOUS les inputs resolus pour un format :
 *   - Base : slide.inputs
 *   - + Overrides : slide.formatOverrides[format].inputs (value)
 * 
 * Usage : passer le resultat a SlideRenderer.inputValues
 */
export function getResolvedInputs(
  slide: SlideState | null | undefined,
  formatKey: string
): Record<string, SlideInputValue> {
  if (!slide) return {};
  
  const result: Record<string, SlideInputValue> = { ...slide.inputs };
  
  const overrides = slide.formatOverrides?.[formatKey]?.inputs;
  if (overrides) {
    for (const [key, entry] of Object.entries(overrides)) {
      result[key] = entry.value;
    }
  }
  
  return result;
}


// ============================================================
//  HELPER : Obtenir la valeur finale d une propriete component
// ============================================================

/**
 * Retourne la valeur finale d une propriete component :
 *   1. Si override manuel existe -> retourne override.value (lock)
 *   2. Sinon -> retourne autoValue (calcul auto via ratios)
 */
export function getComponentPropFinalValue(
  slide: SlideState,
  componentKey: string,
  propName: string,
  formatKey: string,
  autoValue: any
): any {
  const override = slide.formatOverrides?.[formatKey]?.components?.[componentKey]?.[propName];
  if (override) {
    return override.value;
  }
  return autoValue;
}

// ============================================================
//  HELPER : Marquer un input comme overriden
// ============================================================

export function setInputOverride(
  slide: SlideState,
  formatKey: string,
  inputKey: string,
  newValue: SlideInputValue,
  source: OverrideSource = "manual"
): SlideState {
  const oldValue = getInputFinalValue(slide, inputKey, formatKey);
  
  const newOverrides = { ...(slide.formatOverrides || {}) };
  const formatOverride: SlideFormatOverride = {
    ...(newOverrides[formatKey] || {}),
    inputs: {
      ...(newOverrides[formatKey]?.inputs || {}),
      [inputKey]: createOverrideEntry(newValue, source, oldValue),
    },
  };
  newOverrides[formatKey] = formatOverride;
  
  return {
    ...slide,
    formatOverrides: newOverrides,
  };
}

// ============================================================
//  HELPER : Marquer une propriete component comme overriden
// ============================================================

export function setComponentPropOverride(
  slide: SlideState,
  formatKey: string,
  componentKey: string,
  propName: string,
  newValue: any,
  source: OverrideSource = "manual",
  oldValue?: any
): SlideState {
  const newOverrides = { ...(slide.formatOverrides || {}) };
  const formatOverride: SlideFormatOverride = {
    ...(newOverrides[formatKey] || {}),
    components: {
      ...(newOverrides[formatKey]?.components || {}),
      [componentKey]: {
        ...(newOverrides[formatKey]?.components?.[componentKey] || {}),
        [propName]: createOverrideEntry(newValue, source, oldValue),
      },
    },
  };
  newOverrides[formatKey] = formatOverride;
  
  return {
    ...slide,
    formatOverrides: newOverrides,
  };
}

// ============================================================
//  HELPER : Reset un override (retour a l auto-adaptation)
// ============================================================

export function resetInputOverride(
  slide: SlideState,
  formatKey: string,
  inputKey: string
): SlideState {
  const inputs = slide.formatOverrides?.[formatKey]?.inputs;
  if (!inputs?.[inputKey]) return slide;
  
  const newInputs = { ...inputs };
  delete newInputs[inputKey];
  
  const newOverrides = { ...(slide.formatOverrides || {}) };
  newOverrides[formatKey] = {
    ...newOverrides[formatKey],
    inputs: Object.keys(newInputs).length > 0 ? newInputs : undefined,
  };
  
  return {
    ...slide,
    formatOverrides: newOverrides,
  };
}

export function resetComponentPropOverride(
  slide: SlideState,
  formatKey: string,
  componentKey: string,
  propName: string
): SlideState {
  const components = slide.formatOverrides?.[formatKey]?.components;
  const compOverride = components?.[componentKey];
  if (!compOverride?.[propName]) return slide;
  
  const newCompOverride = { ...compOverride };
  delete newCompOverride[propName];
  
  const newComponents = { ...(components || {}) };
  if (Object.keys(newCompOverride).length > 0) {
    newComponents[componentKey] = newCompOverride;
  } else {
    delete newComponents[componentKey];
  }
  
  const newOverrides = { ...(slide.formatOverrides || {}) };
  newOverrides[formatKey] = {
    ...newOverrides[formatKey],
    components: Object.keys(newComponents).length > 0 ? newComponents : undefined,
  };
  
  return {
    ...slide,
    formatOverrides: newOverrides,
  };
}

// ============================================================
//  HELPER : Undo un override (utilise previousValue)
// ============================================================

export function undoInputOverride(
  slide: SlideState,
  formatKey: string,
  inputKey: string
): SlideState {
  const override = slide.formatOverrides?.[formatKey]?.inputs?.[inputKey];
  if (!override || !override.previousValue) {
    return resetInputOverride(slide, formatKey, inputKey);
  }
  
  return setInputOverride(
    slide,
    formatKey,
    inputKey,
    override.previousValue,
    "manual"
  );
}

// ============================================================
//  HELPER : Compter les overrides manuels pour un format
//  (utilise pour le badge UI : "3 modifies pour LinkedIn")
// ============================================================

export function countManualOverrides(
  slide: SlideState,
  formatKey: string
): number {
  const formatOverride = slide.formatOverrides?.[formatKey];
  if (!formatOverride) return 0;
  
  let count = 0;
  
  // Inputs overrides
  if (formatOverride.inputs) {
    count += Object.values(formatOverride.inputs).filter(
      (entry) => entry.source === "manual"
    ).length;
  }
  
  // Component prop overrides
  if (formatOverride.components) {
    for (const compOverride of Object.values(formatOverride.components)) {
      count += Object.values(compOverride).filter(
        (entry) => entry.source === "manual"
      ).length;
    }
  }
  
  return count;
}

/** Compte les overrides pour TOUT un projet (toutes slides confondues) */
export function countProjectManualOverrides(
  slides: SlideState[],
  formatKey: string
): number {
  return slides.reduce((sum, slide) => sum + countManualOverrides(slide, formatKey), 0);
}

// ============================================================
//  HELPER : Detecter si une slide a des overrides pour un format
// ============================================================

export function hasOverridesForFormat(
  slide: SlideState,
  formatKey: string
): boolean {
  return countManualOverrides(slide, formatKey) > 0;
}

// ============================================================
//  HELPER : Liste des proprietes overridees pour un component
//  (utile pour l UI lock indicator)
// ============================================================

export function getOverriddenPropsForComponent(
  slide: SlideState,
  componentKey: string,
  formatKey: string
): string[] {
  const compOverride = slide.formatOverrides?.[formatKey]?.components?.[componentKey];
  if (!compOverride) return [];
  
  return Object.entries(compOverride)
    .filter(([_, entry]) => entry.source === "manual")
    .map(([propName]) => propName);
}

// ============================================================
//  HELPER : Adaptation auto par ratio (Sprint 1 logic)
//  Utilise quand pas d override manuel
// ============================================================

export function adaptValueByRatio(
  value: number,
  baseDimension: number,
  targetDimension: number
): number {
  const ratio = targetDimension / baseDimension;
  return Math.round(value * ratio);
}

export function adaptFontSizeByRatio(
  fontSizePx: string,
  baseWidth: number,
  baseHeight: number,
  targetWidth: number,
  targetHeight: number
): string {
  const px = parseInt(fontSizePx.replace("px", ""), 10);
  if (isNaN(px)) return fontSizePx;
  
  const ratioX = targetWidth / baseWidth;
  const ratioY = targetHeight / baseHeight;
  const ratioAvg = (ratioX + ratioY) / 2;
  
  return `${Math.round(px * ratioAvg)}px`;
}

// ============================================================
//  HELPER : Compute les valeurs finales d un component
//  Combine : base config + auto-adaptation + manual overrides
// ============================================================

export function computeFinalComponent(
  baseComponent: any,
  slide: SlideState,
  componentKey: string,
  formatKey: string,
  formatDimensions: { width: number; height: number }
): any {
  if (!baseComponent) return baseComponent;
  
  // 1. Adaptation auto par ratio (depuis le format de reference)
  const adapted = adaptComponentByRatio(
    baseComponent,
    REFERENCE_DIMENSIONS.width,
    REFERENCE_DIMENSIONS.height,
    formatDimensions.width,
    formatDimensions.height
  );
  
  // 2. Applique les overrides manuels (par-dessus l auto)
  const overrides = slide.formatOverrides?.[formatKey]?.components?.[componentKey];
  if (!overrides) return adapted;
  
  const result = { ...adapted };
  for (const [propName, entry] of Object.entries(overrides)) {
    if (entry.source === "manual") {
      result[propName] = entry.value;
    }
  }
  
  return result;
}

/** Adapte tous les props numeriques + fontSize d un component */
function adaptComponentByRatio(
  component: any,
  baseW: number,
  baseH: number,
  targetW: number,
  targetH: number
): any {
  if (!component || typeof component !== "object") return component;
  
  const result = { ...component };
  const ratioX = targetW / baseW;
  const ratioY = targetH / baseH;
  
  // Props verticales
  for (const prop of ["topPx", "bottomPx", "heightPx", "chartHeight"]) {
    if (typeof result[prop] === "number") {
      result[prop] = Math.round(result[prop] * ratioY);
    }
  }
  
  // Props horizontales
  for (const prop of ["leftPx", "rightPx", "widthPx"]) {
    if (typeof result[prop] === "number") {
      result[prop] = Math.round(result[prop] * ratioX);
    }
  }
  
  // FontSize (moyenne des 2 ratios)
  if (typeof result.fontSize === "string" && result.fontSize.endsWith("px")) {
    result.fontSize = adaptFontSizeByRatio(
      result.fontSize,
      baseW,
      baseH,
      targetW,
      targetH
    );
  }
  
  return result;
}