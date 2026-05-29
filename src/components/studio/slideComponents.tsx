"use client";

import React from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend,
} from "recharts";

// ============================================================
//  TYPES
// ============================================================

export type ComponentProps = {
  config: any;
  componentConfig: any;
  value: any;
  scale: number;
};

// ============================================================
//  HELPERS
// ============================================================

function resolveColor(config: any, colorRef: string | undefined): string {
  if (!colorRef) return "transparent";
  if (colorRef.startsWith("#") || colorRef.startsWith("rgb") || colorRef.startsWith("hsl")) {
    return colorRef;
  }
  const colors = config?.brandIdentity?.colors || {};
  return colors[colorRef] || colorRef;
}

function placementToStyle(
  placement: string,
  safeZones: { top?: number; bottom?: number; left?: number; right?: number } = {},
  scale: number,
  offsetY?: string
): React.CSSProperties {
  const t = (safeZones.top || 80) * scale;
  const b = (safeZones.bottom || 80) * scale;
  const l = (safeZones.left || 80) * scale;
  const r = (safeZones.right || 80) * scale;

  const styles: Record<string, React.CSSProperties> = {
    "top-left": { position: "absolute", top: t, left: l },
    "top-center": { position: "absolute", top: t, left: "50%", transform: "translateX(-50%)" },
    "top-right": { position: "absolute", top: t, right: r },
    "middle-left": { position: "absolute", top: "50%", left: l, transform: "translateY(-50%)" },
    "center": { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" as const },
    "middle-right": { position: "absolute", top: "50%", right: r, transform: "translateY(-50%)" },
    "bottom-left": { position: "absolute", bottom: b, left: l },
    "bottom-center": { position: "absolute", bottom: b, left: "50%", transform: "translateX(-50%)", textAlign: "center" as const },
    "bottom-right": { position: "absolute", bottom: b, right: r },
  };

  const baseStyle = styles[placement] || styles["top-left"];

  if (offsetY && (placement.startsWith("bottom") || placement.startsWith("top"))) {
    const offsetNum = parseFloat(offsetY);
    if (!isNaN(offsetNum)) {
      const scaledOffset = offsetNum * scale;
      if (placement.startsWith("bottom")) {
        return { ...baseStyle, bottom: (baseStyle.bottom as number) - scaledOffset };
      } else {
        return { ...baseStyle, top: (baseStyle.top as number) - scaledOffset };
      }
    }
  }

  return baseStyle;
}

function scalePx(value: string | undefined, scale: number, fallback: number = 16): number {
  if (!value) return fallback * scale;
  const num = parseFloat(value);
  if (isNaN(num)) return fallback * scale;
  return num * scale;
}

function resolveFontFamily(config: any, fontRef: string | undefined, fallback: string = "sans-serif"): string {
  if (!fontRef) return fallback;
  const fonts = config?.brandIdentity?.fonts || {};
  const font = fonts[fontRef];
  if (!font) return fallback;
  if (typeof font === "object") return font.family || fallback;
  return font || fallback;
}

// ============================================================
//  AUTO-HIGHLIGHT (*mot*)
// ============================================================

function AutoHighlightText({
  text, highlightConfig, config, scale,
}: {
  text: string;
  highlightConfig?: { triggerCharacter?: string; svgAsset?: string };
  config: any;
  scale: number;
}) {
  if (!text) return null;

  const trigger = highlightConfig?.triggerCharacter || "*";
  const svgAssetKey = highlightConfig?.svgAsset || "annotationCircle";
  const assets = config?.assets || config?.brandIdentity?.assets || {};
  const svgPath = assets[svgAssetKey];

  const regex = new RegExp(`\\${trigger}([^\\${trigger}]+)\\${trigger}`, "g");
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ text: text.slice(lastIdx, match.index), highlighted: false });
    }
    parts.push({ text: match[1], highlighted: true });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push({ text: text.slice(lastIdx), highlighted: false });
  }

  const brandColor = config?.brandIdentity?.colors?.brandPrimary || "#F26522";

  return (
    <>
      {parts.map((part, i) => {
        if (!part.highlighted) return <span key={i}>{part.text}</span>;
        return (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              padding: `0 ${8 * scale}px`,
              color: brandColor,
            }}
          >
            <span style={{ position: "relative", zIndex: 2 }}>{part.text}</span>
            {svgPath && (
              <img
                src={svgPath} alt=""
                style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -50%) scale(1.15)",
                  width: "115%", height: "auto",
                  zIndex: 1, pointerEvents: "none",
                }}
              />
            )}
          </span>
        );
      })}
    </>
  );
}

// ============================================================
//  BADGE
// ============================================================

function BadgeComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!componentConfig?.enabled) return null;
  if (!value) return null;

  const style = componentConfig.style || "classic";
  const fontFamily = resolveFontFamily(config, "bodyFont", "Inter, sans-serif");

  if (style === "neo-brutalist") {
    const bgColor = resolveColor(config, componentConfig.bgColor) || "#FFFFFF";
    const textColor = resolveColor(config, componentConfig.textColor) || "#000000";
    const borderColor = resolveColor(config, componentConfig.borderColor) || "#000000";
    const shadowColor = resolveColor(config, componentConfig.shadowColor) || "#F26522";
    const borderWidth = scalePx(componentConfig.borderWidth, scale, 3);
    const borderRadius = scalePx(componentConfig.borderRadius, scale, 14);
    const fontSize = scalePx(componentConfig.fontSize, scale, 24);
    const fontWeight = componentConfig.fontWeight || 900;
    const paddingX = scalePx(componentConfig.paddingX, scale, 18);
    const paddingY = scalePx(componentConfig.paddingY, scale, 6);

    const shadowOffset = componentConfig.shadowOffset || "-6px 6px";
    const [offsetX, offsetY] = shadowOffset.split(" ").map((s: string) => scalePx(s.replace("px", ""), scale, 6));
    const boxShadow = `${offsetX}px ${offsetY}px 0px ${shadowColor}`;

    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgColor,
          color: textColor,
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius,
          padding: `${paddingY}px ${paddingX}px`,
          fontFamily, fontSize, fontWeight,
          lineHeight: 1,
          textTransform: "uppercase",
          letterSpacing: `${1 * scale}px`,
          boxShadow,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: resolveColor(config, componentConfig.bgColor),
        color: resolveColor(config, componentConfig.textColor),
        paddingTop: `${10 * scale}px`,
        paddingBottom: `${10 * scale}px`,
        paddingLeft: `${18 * scale}px`,
        paddingRight: `${24 * scale}px`,
        fontFamily, fontWeight: 700,
        fontSize: `${22 * scale}px`,
        textTransform: "uppercase",
        letterSpacing: `${2 * scale}px`,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  PARTNER LABEL
// ============================================================

function PartnerLabelComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "textLight");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "titleFont", "system-ui");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 36);

  return (
    <div
      style={{
        color: textColor,
        fontFamily,
        fontSize,
        fontWeight: componentConfig?.fontWeight || 900,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  TITLE BLOCK (avec auto-highlight)
// ============================================================

function TitleBlockComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor);
  const fontFamily = resolveFontFamily(config, componentConfig?.font, "system-ui");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 60);
  const lineHeight = componentConfig?.lineHeight || "1.1";
  const maxWidth = componentConfig?.maxWidth || "90%";
  const autoHighlight = componentConfig?.autoHighlight;
  const maxLines = componentConfig?.maxLines;

  const lineClampStyle: React.CSSProperties = maxLines
    ? {
        display: "-webkit-box",
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
      }
    : {};

  return (
    <div
      style={{
        color: textColor,
        fontFamily, fontSize, lineHeight,
        fontWeight: 900, maxWidth,
        textTransform: componentConfig?.textTransform || "none",
        letterSpacing: componentConfig?.letterSpacing || "-0.02em",
        ...lineClampStyle,
        whiteSpace: "pre-line",
      }}
    >
      <AutoHighlightText
        text={value}
        highlightConfig={autoHighlight}
        config={config}
        scale={scale}
      />
    </div>
  );
}

// ============================================================
//  BODY BLOCK
// ============================================================

function BodyBlockComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "textLight");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "bodyFont", "Inter, sans-serif");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 28);
  const lineHeight = componentConfig?.lineHeight || "1.4";
  const maxWidth = componentConfig?.maxWidth || "85%";

  return (
    <div
      style={{
        color: textColor, fontFamily, fontSize, lineHeight,
        fontWeight: 500, maxWidth,
        whiteSpace: "pre-line",
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  STAT VALUE
// ============================================================

function StatValueComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "brandPrimary");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "titleFont", "system-ui");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 180);
  const textAlign = componentConfig?.textAlign || "left";

  return (
    <div
      style={{
        width: textAlign === "center" ? "100%" : "auto",
        color: textColor, fontFamily, fontSize,
        fontWeight: 900, lineHeight: 1, letterSpacing: "-0.05em",
        textAlign: textAlign as React.CSSProperties["textAlign"],
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  STAT LABEL
// ============================================================

function StatLabelComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "textLight");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "bodyFont", "Inter, sans-serif");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 32);
  const textAlign = componentConfig?.textAlign || "left";
  const lineHeight = componentConfig?.lineHeight || "1.3";

  return (
    <div
      style={{
        width: textAlign === "center" ? "100%" : "auto",
        color: textColor, fontFamily, fontSize,
        fontWeight: componentConfig?.fontWeight || 600,
        lineHeight,
        maxWidth: textAlign === "center" ? "100%" : "80%",
        textAlign: textAlign as React.CSSProperties["textAlign"],
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  QUOTE BLOCK — citation italique avec guillemets orange (D4)
// ============================================================

function QuoteBlockComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "textLight");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "titleFont", "system-ui");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 45);
  const lineHeight = componentConfig?.lineHeight || "1.25";
  const maxWidth = componentConfig?.maxWidth || "85%";
  const fontStyle = componentConfig?.fontStyle || "italic";
  const fontWeight = componentConfig?.fontWeight || 700;
  const letterSpacing = componentConfig?.letterSpacing || "-0.015em";
  const textAlign = componentConfig?.textAlign || "left";

  const quoteMarksColor = resolveColor(
    config,
    componentConfig?.quoteMarksColor || "brandPrimary"
  );

  return (
    <div
      style={{
        // Largeur 100% pour permettre le centrage par textAlign
        width: textAlign === "center" ? "100%" : "auto",
        textAlign: textAlign as React.CSSProperties["textAlign"],
      }}
    >
      <div
        style={{
          color: textColor, fontFamily, fontSize,
          fontWeight, lineHeight, fontStyle,
          letterSpacing, maxWidth,
          margin: textAlign === "center" ? "0 auto" : "0",
          display: "inline-block",
        }}
      >
        <span
          style={{
            color: quoteMarksColor,
            marginRight: `${10 * scale}px`,
            fontStyle: "normal",
            fontWeight: 900,
            fontSize: `${fontSize * 1.2}px`,
            lineHeight: 0,
            position: "relative",
            top: `${10 * scale}px`,
          }}
        >
          «
        </span>
        {value}
        <span
          style={{
            color: quoteMarksColor,
            marginLeft: `${10 * scale}px`,
            fontStyle: "normal",
            fontWeight: 900,
            fontSize: `${fontSize * 1.2}px`,
            lineHeight: 0,
            position: "relative",
            top: `${10 * scale}px`,
          }}
        >
          »
        </span>
      </div>
    </div>
  );
}

// ============================================================
//  QUOTE AUTHOR
// ============================================================

function QuoteAuthorComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "brandPrimary");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "titleFont", "system-ui");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 34);
  const textAlign = componentConfig?.textAlign || "left";

  return (
    <div
      style={{
        width: textAlign === "center" ? "100%" : "auto",
        color: textColor, fontFamily, fontSize,
        fontWeight: componentConfig?.fontWeight || 900,
        lineHeight: 1.1,
        letterSpacing: "-0.01em",
        textAlign: textAlign as React.CSSProperties["textAlign"],
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  SIMPLE TEXT — texte secondaire générique
// ============================================================

function SimpleTextComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "textLight");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "bodyFont", "Inter, sans-serif");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 24);
  const fontStyle = componentConfig?.fontStyle || "normal";
  const textAlign = componentConfig?.textAlign || "left";

  return (
    <div
      style={{
        width: textAlign === "center" ? "100%" : "auto",
        color: textColor, fontFamily, fontSize,
        fontWeight: componentConfig?.fontWeight || 500,
        opacity: componentConfig?.opacity ?? 1,
        fontStyle,
        lineHeight: 1.3,
        textAlign: textAlign as React.CSSProperties["textAlign"],
        whiteSpace: "pre-line",
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  DETAILS BOX — encadré contextuel (D4 quote.with_details)
// ============================================================

function DetailsBoxComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "textLight");
  const borderColor = resolveColor(config, componentConfig?.borderColor || "textLight");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "bodyFont", "Inter, sans-serif");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 24);
  const lineHeight = componentConfig?.lineHeight || "1.4";
  const borderWidth = scalePx(componentConfig?.borderWidth, scale, 2);
  const borderRadius = scalePx(componentConfig?.borderRadius, scale, 12);
  const paddingX = scalePx(componentConfig?.paddingX, scale, 24);
  const paddingY = scalePx(componentConfig?.paddingY, scale, 20);
  const textAlign = componentConfig?.textAlign || "left";

  // Opacity du fond contrôlable depuis le JSON (par défaut 10%)
  const bgOpacity = componentConfig?.backgroundOpacity ?? 0.1;

  return (
    <div
      style={{
        color: textColor,
        fontFamily, fontSize, lineHeight,
        fontWeight: componentConfig?.fontWeight || 500,
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius,
        padding: `${paddingY}px ${paddingX}px`,
        backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`,
        textAlign: textAlign as React.CSSProperties["textAlign"],
        whiteSpace: "pre-line",
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  SUBTITLE BLOCK — sous-titre italique (D7 practical_info)
// ============================================================

function SubtitleBlockComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "textLight");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "bodyFont", "Inter, sans-serif");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 28);
  const fontStyle = componentConfig?.fontStyle || "italic";

  return (
    <div
      style={{
        color: textColor, fontFamily, fontSize,
        fontWeight: componentConfig?.fontWeight || 500,
        opacity: componentConfig?.opacity ?? 0.85,
        fontStyle,
        lineHeight: 1.2,
        whiteSpace: "pre-line",
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  INFO LINE — ligne d'info pratique (D7 practical_info)
// ============================================================

function InfoLineComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "textLight");
  const fontFamily = resolveFontFamily(config, componentConfig?.font || "bodyFont", "Inter, sans-serif");
  const fontSize = scalePx(componentConfig?.fontSize, scale, 30);

  return (
    <div
      style={{
        color: textColor, fontFamily, fontSize,
        fontWeight: componentConfig?.fontWeight || 700,
        lineHeight: 1.4,
        whiteSpace: "pre-line",
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  CHARTS (D6) — Pie Chart (donut) + Bar Chart
// ============================================================

// Parse "Label ; Valeur" (1 par ligne) → [{name, value}]
// Accepte ; (nouveau standard) ou | (ancien compat)
function parsePieChartData(text: string): Array<{ name: string; value: number }> {
  if (!text) return [];
  return text.split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && (line.includes(";") || line.includes("|")))
    .map(line => {
      // Accepte ; ou | comme séparateur principal
      const sep = line.includes(";") ? ";" : "|";
      const [name, valueStr] = line.split(sep).map(s => s.trim());
      const value = parseFloat(valueStr.replace(",", ".").replace("%", ""));
      return { name, value: isNaN(value) ? 0 : value };
    })
    .filter(d => d.value > 0);
}

// Parse "Catégorie ; Série1:val ; Série2:val" (multi-séries)
// OU "Catégorie ; val" (mono-série)
// Accepte ; (nouveau standard) ou | (ancien compat)
function parseBarChartData(text: string): {
  data: Array<Record<string, any>>;
  seriesKeys: string[];
  isMultiSeries: boolean;
} {
  if (!text) return { data: [], seriesKeys: [], isMultiSeries: false };
  
  const lines = text.split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && (l.includes(";") || l.includes("|")));
  const seriesSet = new Set<string>();
  const data: Array<Record<string, any>> = [];

  for (const line of lines) {
    // Accepte ; ou | comme séparateur principal
    const sep = line.includes(";") ? ";" : "|";
    const parts = line.split(sep).map(s => s.trim());
    const category = parts[0];
    const row: Record<string, any> = { name: category };

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes(":")) {
        const [seriesName, valStr] = part.split(":").map(s => s.trim());
        const val = parseFloat(valStr.replace(",", "."));
        if (!isNaN(val)) {
          row[seriesName] = val;
          seriesSet.add(seriesName);
        }
      } else {
        const val = parseFloat(part.replace(",", "."));
        if (!isNaN(val)) {
          row.value = val;
        }
      }
    }
    data.push(row);
  }

  const isMultiSeries = seriesSet.size > 0;
  const seriesKeys = isMultiSeries ? Array.from(seriesSet) : ["value"];
  return { data, seriesKeys, isMultiSeries };
}

// Palette charts : nuances brand orange + beige + brique (100% charte Genève)
function getChartColors(brandPrimary: string): string[] {
  return [
    brandPrimary,    // #F26522 — Orange brand (principal)
    "#FFB380",       // Orange clair
    "#7A2900",       // Brique foncé
    "#F5F5F0",       // Beige clair
    "#FFD9C2",       // Pêche très clair
    "#C44315",       // Orange foncé
  ];
}

// PIE CHART — Donut avec total au centre
function PieChartComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const data = parsePieChartData(value);
  if (data.length === 0) {
    return (
      <div style={{
        color: "rgba(255,255,255,0.5)",
        textAlign: "center",
        fontSize: `${16 * scale}px`,
        fontFamily: "system-ui",
        padding: `${40 * scale}px`,
      }}>
        Aucune donnée valide
      </div>
    );
  }

  const brandPrimary = config?.brandIdentity?.colors?.brandPrimary || "#F26522";
  const colors = getChartColors(brandPrimary);
  const chartHeight = (componentConfig?.chartHeight ?? 580) * scale;
  const innerRadiusRatio = componentConfig?.innerRadiusRatio ?? 0.55;
  const fontFamily = resolveFontFamily(config, "titleFont", "system-ui");

  // Texte du centre : depuis le state (inputValues[centerTextKey]) si présent, sinon "100%"
  // → on doit le récupérer via le SlideRenderer en passant tout inputValues ; mais ici on a juste value/componentConfig.
  // Solution : on passe centerText via componentConfig (rempli par SlideRenderer).
  const centerText = componentConfig?._centerText || "";

  const radius = chartHeight / 2 * 0.85;
  const innerRadius = radius * innerRadiusRatio;

  return (
    <div style={{ width: "100%", height: chartHeight, position: "relative" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={radius}
            innerRadius={innerRadius}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={colors[idx % colors.length]} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={Math.max(6, 10 * scale)}
            wrapperStyle={{
              fontFamily,
              fontSize: `${22 * scale}px`,
              fontWeight: 700,
              color: "#FFFFFF",
              paddingTop: `${16 * scale}px`,
            }}
            formatter={(value, entry: any) => (
              <span style={{ color: "#FFFFFF", marginRight: `${12 * scale}px` }}>
                {value} <strong style={{ opacity: 0.8 }}>{entry?.payload?.value}%</strong>
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Texte au centre du donut */}
      {centerText && (
        <div
          style={{
            position: "absolute",
            top: "42%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#FFFFFF",
            fontFamily,
            fontSize: `${64 * scale}px`,
            fontWeight: 900,
            textAlign: "center",
            letterSpacing: "-0.02em",
            pointerEvents: "none",
            lineHeight: 1,
          }}
        >
          {centerText}
        </div>
      )}
    </div>
  );
}

// BAR CHART — Vertical ou Horizontal selon orientation
function BarChartComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const { data, seriesKeys, isMultiSeries } = parseBarChartData(value);
  if (data.length === 0) {
    return (
      <div style={{
        color: "rgba(255,255,255,0.5)",
        textAlign: "center",
        fontSize: `${16 * scale}px`,
        fontFamily: "system-ui",
        padding: `${40 * scale}px`,
      }}>
        Aucune donnée valide
      </div>
    );
  }

  const brandPrimary = config?.brandIdentity?.colors?.brandPrimary || "#F26522";
  const colors = getChartColors(brandPrimary);
  const chartHeight = (componentConfig?.chartHeight ?? 600) * scale;
  const fontFamily = resolveFontFamily(config, "bodyFont", "Inter, sans-serif");
  const orientation = (componentConfig?._orientation || "vertical").toLowerCase();
  const isHorizontal = orientation === "horizontal";

  const axisStyle = {
    fontSize: 18 * scale,
    fontFamily,
    fill: "#FFFFFF",
    fontWeight: 600,
  };

  // Pour vertical : barres centrées via barCategoryGap
  // Pour horizontal : layout vertical avec labels à gauche
  const barSizeVertical = isMultiSeries
    ? undefined  // laisse Recharts décider en multi-séries
    : Math.min(80 * scale, (100 / Math.max(1, data.length)) * 3);

  return (
    <div style={{
      width: "100%",
      height: chartHeight,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}>
      <div style={{ width: "100%", height: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={isHorizontal ? "vertical" : "horizontal"}
            margin={{
              top: 20 * scale,
              right: 30 * scale,
              left: isHorizontal ? 40 * scale : 20 * scale,
              bottom: 20 * scale,
            }}
            barCategoryGap={isMultiSeries ? "15%" : "30%"}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />

            {isHorizontal ? (
              <>
                <XAxis type="number" tick={axisStyle} stroke="rgba(255,255,255,0.4)" />
                <YAxis type="category" dataKey="name" tick={axisStyle} stroke="rgba(255,255,255,0.4)" width={130 * scale} />
              </>
            ) : (
              <>
                <XAxis type="category" dataKey="name" tick={axisStyle} stroke="rgba(255,255,255,0.4)" />
                <YAxis type="number" tick={axisStyle} stroke="rgba(255,255,255,0.4)" />
              </>
            )}

            {isMultiSeries && (
              <Legend
                iconType="circle"
                iconSize={Math.max(6, 10 * scale)}
                wrapperStyle={{
                  fontFamily,
                  fontSize: `${20 * scale}px`,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  paddingTop: `${10 * scale}px`,
                }}
              />
            )}

            {seriesKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[idx % colors.length]}
                radius={[4 * scale, 4 * scale, 0, 0]}
                maxBarSize={isHorizontal ? 60 * scale : 100 * scale}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================
//  PAPER BACKGROUND (D5b) — Texture papier froissé en fond
// ============================================================

function PaperBackgroundComponent({ componentConfig, scale }: ComponentProps) {
  const textureUrl = componentConfig?.textureUrl;
  const fallbackColor = componentConfig?.fallbackColor || "#F5EFE3";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: fallbackColor,
        backgroundImage: textureUrl ? `url("${textureUrl}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        // Fallback CSS si texture pas trouvée : effet papier subtil
        boxShadow: !textureUrl ? "inset 0 0 200px rgba(0,0,0,0.05)" : undefined,
      }}
    >
      {/* Overlay subtil pour donner du grain si pas de texture */}
      {!textureUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
            backgroundSize: `${8 * scale}px ${8 * scale}px`,
            opacity: 0.6,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

// ============================================================
//  FOREGROUND IMAGE (D5b) — Photo détourée flottante
// ============================================================

function ForegroundImageComponent({ componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  // value est l'objet image { url, isApproved, ... }
  const url = typeof value === "string" ? value : value?.url;
  if (!url) return null;

  const widthPx = (componentConfig?.widthPx ?? 480) * scale;
  const heightPx = (componentConfig?.heightPx ?? 480) * scale;
  const rotation = componentConfig?.rotation ?? 0;

  return (
    <img
      src={url}
      alt=""
      crossOrigin="anonymous"
      style={{
        width: widthPx,
        height: heightPx,
        objectFit: "contain", // détouré = pas crop
        transform: `rotate(${rotation}deg)`,
        // Légère ombre pour faire flotter sur le papier
        filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.18))",
      }}
    />
  );
}

// ============================================================
//  HANDWRITTEN ANNOTATION (D5b) — Texte cursive orange manuscrit
// ============================================================

function HandwrittenAnnotationComponent({ config, componentConfig, value, scale }: ComponentProps) {
  if (!value) return null;

  const textColor = resolveColor(config, componentConfig?.textColor || "brandPrimary");
  // On utilise une cursive web-safe en fallback en attendant une vraie police script
  const fontFamily =
    resolveFontFamily(config, componentConfig?.font || "scriptFont", "") ||
    `"Caveat", "Shadows Into Light", "Dancing Script", cursive`;
  const fontSize = scalePx(componentConfig?.fontSize, scale, 40);
  const rotation = componentConfig?.rotation ?? 0;
  const maxWidth = componentConfig?.maxWidth || "400px";
  const textAlign = componentConfig?.textAlign || "left";

  // Parse maxWidth pour scaler
  const maxWidthScaled = typeof maxWidth === "string" && maxWidth.endsWith("px")
    ? `${parseFloat(maxWidth) * scale}px`
    : maxWidth;

  return (
    <div
      style={{
        color: textColor,
        fontFamily,
        fontSize,
        fontWeight: componentConfig?.fontWeight || 600,
        lineHeight: 1.15,
        letterSpacing: "0.01em",
        maxWidth: maxWidthScaled,
        textAlign: textAlign as React.CSSProperties["textAlign"],
        transform: `rotate(${rotation}deg)`,
        transformOrigin: textAlign === "right" ? "right center" : "left center",
        // Léger flou très subtil pour effet "feutre"
        textShadow: `0 0 ${1 * scale}px ${textColor}`,
      }}
    >
      {value}
    </div>
  );
}

// ============================================================
//  SEPARATOR — Trait de séparation (D4)
// ============================================================

function SeparatorComponent({ config, componentConfig, value, scale }: ComponentProps) {
  const bgColor = resolveColor(config, componentConfig?.bgColor || "brandPrimary");
  const widthPx = (componentConfig?.widthPx ?? 70) * scale;
  const heightPx = (componentConfig?.heightPx ?? 3) * scale;
  const textAlign = componentConfig?.textAlign || "center";

  return (
    <div
      style={{
        width: "100%",
        textAlign: textAlign as React.CSSProperties["textAlign"],
      }}
    >
      <div
        style={{
          display: "inline-block",
          backgroundColor: bgColor,
          width: widthPx,
          height: heightPx,
          borderRadius: heightPx / 2,
        }}
      />
    </div>
  );
}

// ============================================================
//  REGISTRE
// ============================================================

export const ATOMIC_COMPONENTS: Record<string, React.ComponentType<ComponentProps>> = {
  badge: BadgeComponent,
  partnerLabel: PartnerLabelComponent,
  titleBlock: TitleBlockComponent,
  bodyBlock: BodyBlockComponent,
  statValue: StatValueComponent,
  statLabel: StatLabelComponent,
  quoteBlock: QuoteBlockComponent,
  quoteAuthor: QuoteAuthorComponent,
  simpleText: SimpleTextComponent,
  detailsBox: DetailsBoxComponent,
  subtitleBlock: SubtitleBlockComponent,
  infoLine1: InfoLineComponent,
  infoLine2: InfoLineComponent,
  separator: SeparatorComponent,
  authorSeparator: SeparatorComponent,
  pieChart: PieChartComponent,
  barChart: BarChartComponent,
  // D5b — Pattern papier froissé
  paperBackground: PaperBackgroundComponent,
  foregroundImage: ForegroundImageComponent,
  handwrittenAnnotation: HandwrittenAnnotationComponent,
};

export { resolveColor, placementToStyle, resolveFontFamily, scalePx };
