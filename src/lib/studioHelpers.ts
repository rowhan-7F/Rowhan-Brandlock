// ============================================================
//  studioHelpers - Phase 9.4.1
//  Helpers purs extraits de studio/[projectId]/page.tsx
//  (variants, sous-variants, creation de slides)
// ============================================================
import { SlideState } from "./useStudioProject";

export function generateId(): string {
  return `slide_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
export function getAvailableVariants(config: any): Array<{ key: string; label?: string; description?: string }> {
  const variants = config?.exportTemplates?.carrousel_instagram?.slideVariants || {};
  // Phase 9.3.16 : Ordre logique narratif (intro -> contenu -> citation -> stats -> fin)
  const VARIANT_ORDER = ["intro", "content", "quote", "stat", "outro"];
  return Object.entries(variants)
    .map(([key, v]: [string, any]) => ({
      key, label: v.label || key, description: v.description,
    }))
    .sort((a, b) => {
      const ai = VARIANT_ORDER.indexOf(a.key);
      const bi = VARIANT_ORDER.indexOf(b.key);
      const aOrder = ai === -1 ? 999 : ai;
      const bOrder = bi === -1 ? 999 : bi;
      return aOrder - bOrder;
    });
}

export function getSubVariants(config: any, variantKey: string): Array<{ key: string; label: string; description: string }> {
  const variant = config?.exportTemplates?.carrousel_instagram?.slideVariants?.[variantKey];
  if (!variant?.subVariants) return [];
  return Object.entries(variant.subVariants).map(([key, sv]: [string, any]) => ({
    key, label: sv.label || key, description: sv.description || "",
  }));
}

export function getDefaultSubVariant(config: any, variantKey: string): string {
  const subs = getSubVariants(config, variantKey);
  return subs[0]?.key || "default";
}

export function getSubVariantConfig(config: any, variantKey: string, subVariantKey: string): any {
  return config?.exportTemplates?.carrousel_instagram?.slideVariants?.[variantKey]?.subVariants?.[subVariantKey];
}

export function variantLabel(config: any, variantKey: string): string {
  const variant = config?.exportTemplates?.carrousel_instagram?.slideVariants?.[variantKey];
  return variant?.label || variantKey.charAt(0).toUpperCase() + variantKey.slice(1);
}

export function createDefaultSlide(config: any): SlideState {
  const variants = getAvailableVariants(config);
  const introVariant = variants.find((v) => v.key === "intro") || variants[0];
  const variantKey = introVariant?.key || "intro";
  const subVariantKey = getDefaultSubVariant(config, variantKey);
  return createEmptySlide(variantKey, subVariantKey, config);
}

export function createEmptySlide(variantKey: string, subVariantKey: string, config: any): SlideState {
  const subConfig = getSubVariantConfig(config, variantKey, subVariantKey);
  const inputs: Record<string, any> = {};

  (subConfig?.inputs || []).forEach((input: any) => {
    const t = input.type || "text";
    if (t === "select") inputs[input.key] = { kind: "select", value: "" };
    else if (t === "image") inputs[input.key] = { kind: "image", value: null };
    else if (t === "richText") inputs[input.key] = { kind: "richText", value: "" };
    else inputs[input.key] = { kind: "text", value: "" };
  });

  return {
    id: generateId(), variant: variantKey, subVariant: subVariantKey, inputs,
  } as any;
}

export function createSlideWithVariant(slideId: string, variantKey: string, subVariantKey: string, config: any, oldSlide?: any): SlideState {
  const fresh = createEmptySlide(variantKey, subVariantKey, config);
  // Phase 12 peaufinage #5 : preserver les inputs communs entre ancienne et nouvelle variante
  if (oldSlide && oldSlide.inputs) {
    const newSubConfig = getSubVariantConfig(config, variantKey, subVariantKey);
    const newInputKeys: string[] = (newSubConfig?.inputs || []).map((i: any) => i.key);
    const preservedInputs: Record<string, any> = { ...fresh.inputs };
    newInputKeys.forEach((key: string) => {
      const oldValue = oldSlide.inputs[key];
      if (oldValue === undefined || oldValue === null) return;
      if (typeof oldValue === "object" && oldValue !== null) {
        const hasContent = oldValue.value !== undefined && oldValue.value !== null && oldValue.value !== "";
        if (hasContent) preservedInputs[key] = oldValue;
      } else if (oldValue !== "") {
        preservedInputs[key] = oldValue;
      }
    });
    return { ...fresh, id: slideId, inputs: preservedInputs };
  }
  return { ...fresh, id: slideId };
}

export function countFilledInputs(slide: SlideState, inputs: any[]): number {
  let count = 0;
  inputs.forEach((input) => {
    const v = slide.inputs[input.key];
    if (!v) return;
    if (v.kind === "image" && v.value) count++;
    else if (v.kind !== "image" && v.value && String(v.value).trim()) count++;
  });
  return count;
}
