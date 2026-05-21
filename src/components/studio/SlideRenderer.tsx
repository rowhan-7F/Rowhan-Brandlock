"use client";

import React, { useEffect } from "react";
import {
  ATOMIC_COMPONENTS,
  resolveColor,
  placementToStyle,
} from "./slideComponents";

// ============================================================
//  TYPES
// ============================================================

export type SlideRendererProps = {
  config: any;
  variant: string;
  subVariant?: string;
  inputValues: Record<string, any>;
  templateKey?: string;
  scale?: number;
  showSafeZones?: boolean;
};

// ============================================================
//  INJECTION DES POLICES
// ============================================================

let fontsInjected = false;

function injectFonts(config: any) {
  if (fontsInjected) return;
  if (typeof document === "undefined") return;

  const fonts = config?.brandIdentity?.fonts || {};
  let css = "";

  Object.entries(fonts).forEach(([_, font]: [string, any]) => {
    if (typeof font !== "object") return;
    if (!font.url || !font.family) return;

    css += `
@font-face {
  font-family: "${font.family}";
  src: url("${font.url}") format("woff2");
  font-weight: ${font.weight || "normal"};
  font-style: ${font.style || "normal"};
  font-display: swap;
}
`;
  });

  if (css) {
    const style = document.createElement("style");
    style.id = "tenant-fonts";
    style.innerHTML = css;
    document.head.appendChild(style);
    fontsInjected = true;
  }
}

// ============================================================
//  HELPER : Résoudre la config (variant, subVariant)
// ============================================================

function resolveVariantConfig(template: any, variant: string, subVariant?: string): any {
  const variantBlock = template?.slideVariants?.[variant];
  if (!variantBlock) return null;

  if (variantBlock.subVariants) {
    const subKey = subVariant || Object.keys(variantBlock.subVariants)[0];
    return variantBlock.subVariants[subKey] || null;
  }

  return variantBlock;
}

// ============================================================
//  GRADIENTS
// ============================================================

function getGradientStyle(filter: string): React.CSSProperties | null {
  if (filter === "gradientBottom40") {
    return {
      position: "absolute",
      bottom: 0, left: 0, right: 0,
      height: "40%",
      background:
        "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0) 100%)",
    };
  }
  if (filter === "gradientBottom50") {
    return {
      position: "absolute",
      bottom: 0, left: 0, right: 0,
      height: "50%",
      background:
        "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 100%)",
    };
  }
  if (filter === "gradientBottom80") {
    return {
      position: "absolute",
      bottom: 0, left: 0, right: 0,
      height: "80%",
      background:
        "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0) 100%)",
    };
  }
  return null;
}

// ============================================================
//  SLIDE RENDERER PRINCIPAL
// ============================================================

export default function SlideRenderer({
  config,
  variant,
  subVariant,
  inputValues,
  templateKey = "carrousel_instagram",
  scale = 0.25,
  showSafeZones = false,
}: SlideRendererProps) {
  useEffect(() => {
    injectFonts(config);
  }, [config]);

  const template = config?.exportTemplates?.[templateKey];
  if (!template) {
    return <FallbackSlide message={`Template '${templateKey}' introuvable`} scale={scale} />;
  }

  const variantConfig = resolveVariantConfig(template, variant, subVariant);
  if (!variantConfig) {
    return <FallbackSlide message={`Variant '${variant}' / sub '${subVariant || ""}' introuvable`} scale={scale} />;
  }

  const baseWidth = template.dimensions?.width || 1080;
  const baseHeight = template.dimensions?.height || 1350;
  const scaledWidth = baseWidth * scale;
  const scaledHeight = baseHeight * scale;

  const components = variantConfig.components || {};
  const layoutRules = variantConfig.layoutRules || {};
  const safeZones = layoutRules.safeZonesPx || { top: 80, bottom: 80, left: 80, right: 80 };

  const backgroundMediaInput = inputValues.backgroundMedia;
  const backgroundUrl = backgroundMediaInput?.kind === "image"
    ? backgroundMediaInput.value?.url
    : null;

  const bgColor = resolveColor(config, "brandSecondary") || "#1A1A1A";
  const backgroundFilter = layoutRules.backgroundFilter || "overlayGradient";
  const overlayGradient = config?.brandIdentity?.colors?.overlayGradient;

  const gradientStyle = backgroundUrl ? getGradientStyle(backgroundFilter) : null;

  // ============================================================
  //  GROUPING AUTO : Badge + PartnerLabel
  //  Si les 2 sont présents et que partnerLabel a un inputKey rempli,
  //  on les rend dans un même container flex pour alignement parfait
  // ============================================================
  const badgeCfg = components.badge;
  const partnerCfg = components.partnerLabel;
  const badgeValue = badgeCfg ? extractValue(inputValues[badgeCfg.inputKey || "badgeLabel"]) : null;
  const partnerValue = partnerCfg ? extractValue(inputValues[partnerCfg.inputKey || "partnerName"]) : null;

  const shouldGroupBadgeAndPartner =
    badgeCfg?.enabled !== false &&
    partnerCfg?.enabled !== false &&
    badgeValue && partnerValue;

  return (
    <div
      style={{
        position: "relative",
        width: scaledWidth,
        height: scaledHeight,
        backgroundColor: bgColor,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* COUCHE 1 : Image */}
      {backgroundUrl ? (
        <img
          src={backgroundUrl} alt="" crossOrigin="anonymous"
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%", objectFit: "cover",
          }}
        />
      ) : (
        <NoImagePlaceholder scale={scale} />
      )}

      {/* COUCHE 2 : Gradient pré-défini */}
      {gradientStyle && <div style={gradientStyle} />}

      {/* COUCHE 2bis : Gradient JSON custom */}
      {backgroundUrl && backgroundFilter === "overlayGradient" && overlayGradient && (
        <div
          style={{
            position: "absolute", inset: 0,
            background: buildGradient(overlayGradient),
          }}
        />
      )}

      {/* ============================================================ */}
      {/*  COUCHE 3a : Badge + Partner groupés (cas spécial)           */}
      {/* ============================================================ */}
      {shouldGroupBadgeAndPartner && (
        <div style={customPlacementToStyle(badgeCfg, scale)}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: `${20 * scale}px`,
            }}
          >
            {/* Badge à gauche */}
            <BadgeRenderer config={config} componentConfig={badgeCfg} value={badgeValue} scale={scale} />
            {/* Partenaire à droite, aligné center */}
            <PartnerRenderer config={config} componentConfig={partnerCfg} value={partnerValue} scale={scale} />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  COUCHE 3b : Tous les autres composants (rendu standard)    */}
      {/* ============================================================ */}
      {Object.entries(components)
        .sort(([, a]: any, [, b]: any) => {
          // paperBackground doit être rendu EN PREMIER (couche de fond)
          const aType = a?.componentType || "";
          const bType = b?.componentType || "";
          if (aType === "paperBackground") return -1;
          if (bType === "paperBackground") return 1;
          return 0;
        })
        .map(([componentKey, componentConfigRaw]: [string, any]) => {
        if (componentConfigRaw?.enabled === false) return null;
        if (componentKey === "backgroundMedia") return null;

        // Skip badge + partnerLabel si on les a déjà rendus groupés
        if (shouldGroupBadgeAndPartner && (componentKey === "badge" || componentKey === "partnerLabel")) {
          return null;
        }

        const registryKey = componentConfigRaw?.componentType || componentKey;
        const Component = ATOMIC_COMPONENTS[registryKey];
        if (!Component) {
          console.warn(`[SlideRenderer] Composant inconnu : "${registryKey}"`);
          return null;
        }

        const inputKey = componentConfigRaw?.inputKey || guessInputKey(componentKey);
        const inputVal = inputValues[inputKey];
        const value = extractValue(inputVal);

        // Composants purement décoratifs (pas besoin de value)
        const isDecorative =
          registryKey === "separator" ||
          registryKey === "authorSeparator" ||
          registryKey === "paperBackground";
        if (!value && !isDecorative) return null;

        // === Enrichir componentConfig pour les charts (D6) ===
        // Les charts ont besoin de lire d'autres inputs en plus de leur inputKey
        let enrichedComponentConfig = componentConfigRaw;
        if (registryKey === "pieChart") {
          const centerKey = componentConfigRaw?.centerTextKey || "centerText";
          const centerVal = extractValue(inputValues[centerKey]);
          enrichedComponentConfig = { ...componentConfigRaw, _centerText: centerVal || "" };
        } else if (registryKey === "barChart") {
          const orientKey = componentConfigRaw?.orientationKey || "orientation";
          const orientVal = extractValue(inputValues[orientKey]);
          enrichedComponentConfig = { ...componentConfigRaw, _orientation: orientVal || "vertical" };
        }

        let positionStyle: React.CSSProperties;
        if (componentConfigRaw?.placement === "custom") {
          positionStyle = customPlacementToStyle(componentConfigRaw, scale);
        } else {
          const placement = componentConfigRaw?.placement || "top-left";
          const offsetY = componentConfigRaw?.placementOffsetY;
          positionStyle = placementToStyle(placement, safeZones, scale, offsetY);
        }

        // === Cas spécial : paperBackground occupe toute la slide ===
        // (pas de wrapper avec position, le composant gère lui-même son inset: 0)
        if (registryKey === "paperBackground") {
          return (
            <Component
              key={componentKey}
              config={config}
              componentConfig={enrichedComponentConfig}
              value={value}
              scale={scale}
            />
          );
        }

        return (
          <div key={componentKey} style={positionStyle}>
            <Component
              config={config}
              componentConfig={enrichedComponentConfig}
              value={value}
              scale={scale}
            />
          </div>
        );
      })}

      {/* COUCHE 4 : Safe zones debug */}
      {showSafeZones && (
        <div
          style={{
            position: "absolute",
            top: safeZones.top * scale, left: safeZones.left * scale,
            right: safeZones.right * scale, bottom: safeZones.bottom * scale,
            border: `${1 * scale}px dashed rgba(255, 0, 0, 0.5)`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

// ============================================================
//  HELPERS pour rendu groupé
// ============================================================

function BadgeRenderer({ config, componentConfig, value, scale }: any) {
  const Component = ATOMIC_COMPONENTS["badge"];
  if (!Component) return null;
  return <Component config={config} componentConfig={componentConfig} value={value} scale={scale} />;
}

function PartnerRenderer({ config, componentConfig, value, scale }: any) {
  const Component = ATOMIC_COMPONENTS["partnerLabel"];
  if (!Component) return null;
  return <Component config={config} componentConfig={componentConfig} value={value} scale={scale} />;
}

// ============================================================
//  HELPERS
// ============================================================

function customPlacementToStyle(componentConfig: any, scale: number): React.CSSProperties {
  const style: React.CSSProperties = { position: "absolute" };
  if (componentConfig.topPx !== undefined) style.top = componentConfig.topPx * scale;
  if (componentConfig.bottomPx !== undefined) style.bottom = componentConfig.bottomPx * scale;
  if (componentConfig.leftPx !== undefined) style.left = componentConfig.leftPx * scale;
  if (componentConfig.rightPx !== undefined) style.right = componentConfig.rightPx * scale;
  return style;
}

function guessInputKey(componentKey: string): string {
  const mapping: Record<string, string> = {
    badge: "badgeLabel",
    titleBlock: "titleText",
    bodyBlock: "bodyText",
    statValue: "statValue",
    statLabel: "statLabel",
    statSource: "statSource",
    quoteBlock: "quoteText",
    quoteAuthor: "quoteAuthor",
    quoteRole: "quoteRole",
    ctaText: "ctaText",
    partnerLabel: "partnerName",
    simpleText: "ctaText",
    detailsBox: "detailsText",
    subtitleBlock: "subtitleText",
    infoLine1: "line1",
    infoLine2: "line2",
    pieChart: "chartData",
    barChart: "chartData",
  };
  return mapping[componentKey] || componentKey;
}

function extractValue(inputVal: any): any {
  if (!inputVal) return null;
  if (inputVal.kind === "image") return inputVal.value;
  return inputVal.value || null;
}

function buildGradient(overlayGradient: any): string {
  if (Array.isArray(overlayGradient)) {
    return `linear-gradient(180deg, ${overlayGradient.join(", ")})`;
  }
  if (overlayGradient?.colors) {
    const angle = overlayGradient.angle || "180deg";
    return `linear-gradient(${angle}, ${overlayGradient.colors.join(", ")})`;
  }
  return "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.8) 100%)";
}

function NoImagePlaceholder({ scale }: { scale: number }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 50%, #1a1a1a 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        style={{
          color: "rgba(255, 255, 255, 0.3)",
          fontSize: `${14 * scale}px`,
          fontFamily: "system-ui", textAlign: "center",
        }}
      >
        Sélectionne une image de fond
        <br />
        dans le panneau de gauche
      </div>
    </div>
  );
}

function FallbackSlide({ message, scale }: { message: string; scale: number }) {
  return (
    <div
      style={{
        width: 1080 * scale, height: 1350 * scale,
        backgroundColor: "#fee2e2", border: "2px dashed #dc2626",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div style={{ color: "#dc2626", fontSize: `${14 * scale}px`, fontWeight: 700 }}>
        ⚠ {message}
      </div>
    </div>
  );
}
