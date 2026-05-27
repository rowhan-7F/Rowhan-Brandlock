/**
 * Sprint 1 - Generateur de templates multi-format
 * 
 * Genere 5 nouveaux templates basees sur carrousel_instagram (1080x1350) :
 *   - carrousel_instagram_square (1080x1080)
 *   - carrousel_linkedin_square (1200x1200)
 *   - carrousel_instagram_story (1080x1920)
 *   - carrousel_tiktok (1080x1920)
 *   - carrousel_facebook (1200x627)
 * 
 * Usage : npx tsx scripts/generate-social-templates.ts
 * Output : scripts/social-templates-output.sql
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// DEFINITIONS DES NOUVEAUX FORMATS
// ============================================================

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1350;

type FormatSpec = {
  formatKey: string;
  id: string;
  label: string;
  width: number;
  height: number;
  safeZones: { top: number; right: number; bottom: number; left: number };
  // Strategie de placement personnalisee si besoin
  customTitlePosition?: "top" | "center" | "bottom";
};

const FORMATS: FormatSpec[] = [
  {
    formatKey: "carrousel_instagram_square",
    id: "ig_carrousel_square",
    label: "Carrousel Instagram Square",
    width: 1080,
    height: 1080,
    safeZones: { top: 80, right: 80, bottom: 80, left: 80 },
  },
  {
    formatKey: "carrousel_linkedin_square",
    id: "linkedin_carrousel_square",
    label: "Carrousel LinkedIn Square",
    width: 1200,
    height: 1200,
    safeZones: { top: 90, right: 90, bottom: 120, left: 90 },
  },
  {
    formatKey: "carrousel_instagram_story",
    id: "ig_story",
    label: "Story / Reel Instagram",
    width: 1080,
    height: 1920,
    safeZones: { top: 250, right: 80, bottom: 250, left: 80 },
    customTitlePosition: "center",
  },
  {
    formatKey: "carrousel_tiktok",
    id: "tiktok_vertical",
    label: "TikTok Vertical",
    width: 1080,
    height: 1920,
    safeZones: { top: 200, right: 200, bottom: 300, left: 80 },
    customTitlePosition: "center",
  },
  {
    formatKey: "carrousel_facebook",
    id: "fb_link_preview",
    label: "Facebook Link Preview",
    width: 1200,
    height: 627,
    safeZones: { top: 60, right: 60, bottom: 60, left: 60 },
  },
];

// ============================================================
// HELPERS DE TRANSFORMATION
// ============================================================

function ratioY(fmt: FormatSpec): number {
  return fmt.height / BASE_HEIGHT;
}

function ratioX(fmt: FormatSpec): number {
  return fmt.width / BASE_WIDTH;
}

function ratioAvg(fmt: FormatSpec): number {
  return (ratioY(fmt) + ratioX(fmt)) / 2;
}

/**
 * Scale une valeur en px selon le ratio vertical
 */
function scaleY(value: number, fmt: FormatSpec): number {
  return Math.round(value * ratioY(fmt));
}

/**
 * Scale une valeur en px selon le ratio horizontal
 */
function scaleX(value: number, fmt: FormatSpec): number {
  return Math.round(value * ratioX(fmt));
}

/**
 * Scale une fontSize "Xpx" selon le ratio moyen
 */
function scaleFontSize(fontSizeStr: string, fmt: FormatSpec): string {
  const match = fontSizeStr.match(/^(\d+)px$/);
  if (!match) return fontSizeStr;
  const baseSize = parseInt(match[1], 10);
  const scaled = Math.round(baseSize * ratioAvg(fmt));
  return `${scaled}px`;
}

/**
 * Adapte un component aux dimensions du nouveau format
 */
function adaptComponent(component: any, fmt: FormatSpec): any {
  const adapted = { ...component };
  
  // Scale positions
  if (typeof adapted.topPx === "number") adapted.topPx = scaleY(adapted.topPx, fmt);
  if (typeof adapted.bottomPx === "number") adapted.bottomPx = scaleY(adapted.bottomPx, fmt);
  if (typeof adapted.leftPx === "number") adapted.leftPx = scaleX(adapted.leftPx, fmt);
  if (typeof adapted.rightPx === "number") adapted.rightPx = scaleX(adapted.rightPx, fmt);
  
  // Scale dimensions
  if (typeof adapted.widthPx === "number") adapted.widthPx = scaleX(adapted.widthPx, fmt);
  if (typeof adapted.heightPx === "number") adapted.heightPx = scaleY(adapted.heightPx, fmt);
  if (typeof adapted.chartHeight === "number") adapted.chartHeight = scaleY(adapted.chartHeight, fmt);
  
  // Scale fontSize
  if (typeof adapted.fontSize === "string") {
    adapted.fontSize = scaleFontSize(adapted.fontSize, fmt);
  }
  
  return adapted;
}

/**
 * Adapte un subVariant complet (components + layoutRules)
 */
function adaptSubVariant(subVariant: any, fmt: FormatSpec): any {
  const adapted = JSON.parse(JSON.stringify(subVariant)); // deep clone
  
  // Adapt all components
  if (adapted.components) {
    const newComponents: Record<string, any> = {};
    for (const [key, component] of Object.entries(adapted.components)) {
      newComponents[key] = adaptComponent(component, fmt);
    }
    adapted.components = newComponents;
  }
  
  // Override safeZones with format-specific ones
  if (adapted.layoutRules) {
    adapted.layoutRules.safeZonesPx = fmt.safeZones;
  }
  
  return adapted;
}

/**
 * Genere un template complet pour un format
 */
function generateTemplate(baseTemplate: any, fmt: FormatSpec): any {
  const newTemplate: any = {
    id: fmt.id,
    type: "image",
    label: fmt.label,
    format: "jpeg",
    dimensions: {
      width: fmt.width,
      height: fmt.height,
    },
    carouselRules: { ...baseTemplate.carouselRules },
    slideVariants: {},
  };
  
  // Adapt all slideVariants
  for (const [variantKey, variant] of Object.entries(baseTemplate.slideVariants) as any) {
    const adaptedVariant: any = {
      label: variant.label,
      description: variant.description,
      subVariants: {},
    };
    
    for (const [subKey, subVariant] of Object.entries(variant.subVariants) as any) {
      adaptedVariant.subVariants[subKey] = adaptSubVariant(subVariant, fmt);
    }
    
    newTemplate.slideVariants[variantKey] = adaptedVariant;
  }
  
  return newTemplate;
}

// ============================================================
// TEMPLATE DE REFERENCE (carrousel_instagram)
// Copie depuis l'audit DB
// ============================================================

const REFERENCE_TEMPLATE = {
  "id": "ig_carrousel",
  "type": "image",
  "label": "Carrousel Instagram",
  "format": "jpeg",
  "dimensions": { "width": 1080, "height": 1350 },
  "carouselRules": {
    "maxSlides": 10,
    "minSlides": 1,
    "lastSlideMustBe": "conclusion",
    "firstSlideMustBe": "intro",
    "suggestedSlideCount": 6
  },
  "slideVariants": {
    "intro": {
      "label": "Slide d'introduction",
      "description": "Premiere slide du carrousel",
      "subVariants": {
        "classic": {
          "label": "Accroche avec categorie",
          "inputs": [
            { "key": "badgeLabel", "hint": "Choisis le theme principal de cette slide", "type": "select", "label": "Categorie (badge)", "options": ["Actu semaine","Actualite","Democratie","Entrepreneuriat","Culture","Economie","Qualite de vie","Territoire","Securite","Politique","Mobilite","Education"], "required": true },
            { "key": "partnerName", "hint": "Si l article vient d un partenaire media, selectionne-le", "type": "select", "label": "Partenaire media (optionnel)", "options": ["","Blick","RTS","Le Temps","24 Heures","Tribune de Geneve","Le Matin"], "required": false },
            { "key": "titleText", "hint": "Max 4 lignes. Entoure un mot avec * * pour le surligner", "type": "text", "label": "Titre principal", "required": true, "maxLength": 110, "placeholder": "Ex: Comment le G7 va *bloquer* Geneve" },
            { "key": "backgroundMedia", "type": "image", "label": "Image de fond", "required": true }
          ],
          "components": {
            "badge": { "style": "neo-brutalist", "topPx": 700, "leftPx": 90, "bgColor": "#FFFFFF", "enabled": true, "fontSize": "38px", "inputKey": "badgeLabel", "paddingX": "22px", "paddingY": "8px", "placement": "custom", "textColor": "#000000", "fontWeight": 900, "borderColor": "#000000", "borderWidth": "1px", "shadowColor": "brandPrimary", "borderRadius": "14px", "shadowOffset": "-6px 6px" },
            "titleBlock": { "font": "titleFont", "topPx": 825, "leftPx": 90, "enabled": true, "rightPx": 90, "fontSize": "92px", "inputKey": "titleText", "maxLines": 4, "maxWidth": "88%", "placement": "custom", "textColor": "textLight", "lineHeight": "1.05", "autoHighlight": { "svgAsset": "annotationCircle", "triggerCharacter": "*" }, "letterSpacing": "-0.025em" },
            "partnerLabel": { "font": "titleFont", "topPx": 710, "leftPx": 480, "enabled": true, "fontSize": "38px", "inputKey": "partnerName", "placement": "custom", "textColor": "textLight", "fontWeight": 900 },
            "backgroundMedia": { "enabled": true, "required": true }
          },
          "description": "Badge categorie + titre sur image de fond",
          "layoutRules": { "safeZonesPx": { "top": 120, "left": 90, "right": 90, "bottom": 180 }, "backgroundFilter": "gradientBottom80" }
        }
      }
    },
    "content": {
      "label": "Slide de contenu",
      "description": "Texte explicatif ou developpement",
      "subVariants": {
        "paper": {
          "label": "Papier froisse (style editorial)",
          "inputs": [
            { "key": "titleText", "hint": "Entoure un mot avec * * pour le surligner en orange manuscrit", "type": "text", "label": "Titre principal", "required": true, "maxLength": 90, "placeholder": "Ex: Les *secrets* du G7 a Geneve" },
            { "key": "subtitleText", "type": "text", "label": "Sous-titre (optionnel)", "required": false, "maxLength": 80, "placeholder": "Ex: Tout ce qu il faut savoir" },
            { "key": "foregroundImage", "hint": "Image PNG avec fond transparent qui flotte sur le papier", "type": "image", "label": "Photo detouree (optionnel)", "required": false },
            { "key": "annotation1", "hint": "Texte ecrit a la main, en orange, position haute droite", "type": "text", "label": "Annotation manuscrite n1", "required": false, "maxLength": 60, "placeholder": "Ex: une note rapide en marge" },
            { "key": "annotation2", "hint": "Texte ecrit a la main, en orange, position basse", "type": "text", "label": "Annotation manuscrite n2", "required": false, "maxLength": 60, "placeholder": "Ex: une seconde note plus bas" }
          ],
          "components": {
            "titleBlock": { "font": "titleFont", "topPx": 140, "leftPx": 90, "enabled": true, "rightPx": 90, "fontSize": "88px", "inputKey": "titleText", "maxLines": 4, "maxWidth": "88%", "placement": "custom", "textColor": "#1A1A1A", "lineHeight": "1.05", "autoHighlight": { "svgAsset": "annotationUnderline", "highlightColor": "brandPrimary", "triggerCharacter": "*" }, "letterSpacing": "-0.025em" },
            "annotation1": { "topPx": 680, "enabled": true, "rightPx": 70, "fontSize": "40px", "inputKey": "annotation1", "maxWidth": "380px", "rotation": 4, "placement": "custom", "textColor": "brandPrimary", "componentType": "handwrittenAnnotation" },
            "annotation2": { "enabled": true, "rightPx": 90, "bottomPx": 100, "fontSize": "36px", "inputKey": "annotation2", "maxWidth": "500px", "rotation": -2, "placement": "custom", "textAlign": "right", "textColor": "brandPrimary", "componentType": "handwrittenAnnotation" },
            "subtitleBlock": { "font": "bodyFont", "topPx": 540, "leftPx": 90, "enabled": true, "rightPx": 90, "fontSize": "32px", "inputKey": "subtitleText", "fontStyle": "italic", "placement": "custom", "textColor": "#444444", "fontWeight": 600 },
            "backgroundMedia": { "enabled": false, "required": false },
            "foregroundImage": { "topPx": 650, "leftPx": 90, "enabled": true, "widthPx": 480, "heightPx": 480, "inputKey": "foregroundImage", "rotation": -3, "placement": "custom", "componentType": "foregroundImage" },
            "paperBackground": { "enabled": true, "inputKey": "_paper", "textureUrl": "/assets/flag/textures/paper-texture.jpg", "componentType": "paperBackground", "fallbackColor": "#F5EFE3" }
          },
          "description": "Fond papier + titre + photo detouree + annotations manuscrites",
          "layoutRules": { "safeZonesPx": { "top": 100, "left": 90, "right": 90, "bottom": 100 }, "backgroundFilter": "none" }
        },
        "standard": {
          "label": "Article standard",
          "inputs": [
            { "key": "titleText", "hint": "Max 4 lignes", "type": "text", "label": "Titre", "required": true, "maxLength": 120, "placeholder": "Ex: Les primes maladie vont encore grimper" },
            { "key": "ctaText", "type": "text", "label": "Texte de CTA (optionnel)", "required": false, "maxLength": 50, "placeholder": "Ex: + plus d infos en description" },
            { "key": "backgroundMedia", "type": "image", "label": "Image de fond", "required": true }
          ],
          "components": {
            "simpleText": { "font": "bodyFont", "leftPx": 90, "enabled": true, "opacity": 0.95, "bottomPx": 200, "fontSize": "32px", "inputKey": "ctaText", "placement": "custom", "textColor": "textLight", "fontWeight": 700 },
            "titleBlock": { "font": "titleFont", "topPx": 760, "leftPx": 90, "enabled": true, "rightPx": 90, "fontSize": "82px", "inputKey": "titleText", "maxLines": 4, "maxWidth": "90%", "placement": "custom", "textColor": "textLight", "lineHeight": "1.05", "letterSpacing": "-0.02em" },
            "backgroundMedia": { "enabled": true, "required": true }
          },
          "description": "Titre + CTA sur image de fond",
          "layoutRules": { "safeZonesPx": { "top": 120, "left": 90, "right": 90, "bottom": 180 }, "backgroundFilter": "gradientBottom80" }
        }
      }
    },
    "stat": {
      "label": "Slide statistique",
      "description": "Chiffre, graphique ou donnees",
      "subVariants": {
        "bar_chart": {
          "label": "Graphique en barres",
          "inputs": [
            { "key": "titleText", "type": "text", "label": "Titre", "required": true, "maxLength": 80, "placeholder": "Ex: Evolution des nuitees hotelieres" },
            { "key": "orientation", "hint": "Vertical pour labels courts. Horizontal pour labels longs.", "type": "select", "label": "Orientation des barres", "options": ["vertical","horizontal"], "required": true },
            { "key": "chartData", "hint": "Une ligne par categorie. Separateur ; (point-virgule).", "type": "textarea", "label": "Donnees du graphique", "required": true, "maxLength": 800, "placeholder": "Format simple : Categorie ; Valeur\nJanvier ; 245\nFevrier ; 263" },
            { "key": "sourceText", "type": "text", "label": "Source (optionnel)", "required": false, "maxLength": 100, "placeholder": "Ex: Office du tourisme de Geneve 2026" },
            { "key": "backgroundMedia", "type": "image", "label": "Image de fond (optionnel)", "required": false }
          ],
          "components": {
            "barChart": { "topPx": 360, "leftPx": 0, "enabled": true, "rightPx": 120, "inputKey": "chartData", "placement": "custom", "chartHeight": 600, "componentType": "barChart", "orientationKey": "orientation" },
            "simpleText": { "font": "bodyFont", "leftPx": 0, "enabled": true, "opacity": 0.75, "rightPx": 0, "bottomPx": 140, "fontSize": "22px", "inputKey": "sourceText", "fontStyle": "italic", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 500 },
            "titleBlock": { "font": "titleFont", "topPx": 130, "leftPx": 90, "enabled": true, "rightPx": 90, "fontSize": "52px", "inputKey": "titleText", "maxLines": 3, "maxWidth": "90%", "placement": "custom", "textColor": "textLight", "lineHeight": "1.1", "letterSpacing": "-0.02em" },
            "backgroundMedia": { "enabled": true, "required": false }
          },
          "description": "Barres verticales ou horizontales (au choix)",
          "layoutRules": { "safeZonesPx": { "top": 120, "left": 90, "right": 90, "bottom": 180 }, "backgroundFilter": "overlayGradient" }
        },
        "pie_chart": {
          "label": "Graphique camembert (donut)",
          "inputs": [
            { "key": "titleText", "type": "text", "label": "Titre / Question", "required": true, "maxLength": 80, "placeholder": "Ex: Dans quels secteurs travaillent nos deputes ?" },
            { "key": "chartData", "hint": "Une ligne par categorie. Format : Label ; Valeur", "type": "textarea", "label": "Donnees du graphique", "required": true, "maxLength": 500, "placeholder": "Domaine prive ; 57.5\nSecteur public ; 27.5\nRetraites ; 10" },
            { "key": "centerText", "hint": "Affiche au centre du donut", "type": "text", "label": "Texte au centre (optionnel)", "required": false, "maxLength": 20, "placeholder": "Ex: 100% ou 850 deputes" },
            { "key": "sourceText", "type": "text", "label": "Source (optionnel)", "required": false, "maxLength": 100, "placeholder": "Ex: Statistiques cantonales 2024" },
            { "key": "backgroundMedia", "type": "image", "label": "Image de fond (optionnel)", "required": false }
          ],
          "components": {
            "pieChart": { "topPx": 380, "leftPx": 0, "enabled": true, "rightPx": 0, "inputKey": "chartData", "chartType": "donut", "placement": "custom", "chartHeight": 580, "centerTextKey": "centerText", "componentType": "pieChart", "innerRadiusRatio": 0.55 },
            "simpleText": { "font": "bodyFont", "leftPx": 0, "enabled": true, "opacity": 0.75, "rightPx": 0, "bottomPx": 140, "fontSize": "22px", "inputKey": "sourceText", "fontStyle": "italic", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 500 },
            "titleBlock": { "font": "titleFont", "topPx": 130, "leftPx": 90, "enabled": true, "rightPx": 90, "fontSize": "52px", "inputKey": "titleText", "maxLines": 3, "maxWidth": "90%", "placement": "custom", "textColor": "textLight", "lineHeight": "1.1", "letterSpacing": "-0.02em" },
            "backgroundMedia": { "enabled": true, "required": false }
          },
          "description": "Donut avec total au centre + legende",
          "layoutRules": { "safeZonesPx": { "top": 120, "left": 90, "right": 90, "bottom": 180 }, "backgroundFilter": "overlayGradient" }
        },
        "simple_number": {
          "label": "Chiffre mis en avant",
          "inputs": [
            { "key": "statValue", "hint": "Le chiffre phare a mettre en avant", "type": "text", "label": "Chiffre", "required": true, "maxLength": 12, "placeholder": "Ex: 87%" },
            { "key": "statLabel", "type": "text", "label": "Legende", "required": true, "maxLength": 80, "placeholder": "Ex: des Genevois fiers de leur canton" },
            { "key": "statSource", "type": "text", "label": "Source (optionnel)", "required": false, "maxLength": 60, "placeholder": "Ex: Sondage cantonal 2024" },
            { "key": "backgroundMedia", "type": "image", "label": "Image de fond (optionnel)", "required": false }
          ],
          "components": {
            "statLabel": { "font": "titleFont", "topPx": 740, "leftPx": 90, "enabled": true, "rightPx": 90, "fontSize": "46px", "inputKey": "statLabel", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 700, "lineHeight": "1.15" },
            "statValue": { "font": "titleFont", "topPx": 380, "leftPx": 0, "enabled": true, "rightPx": 0, "fontSize": "280px", "inputKey": "statValue", "placement": "custom", "textAlign": "center", "textColor": "brandPrimary", "fontWeight": 900 },
            "simpleText": { "font": "bodyFont", "leftPx": 0, "enabled": true, "opacity": 0.75, "rightPx": 0, "bottomPx": 180, "fontSize": "22px", "inputKey": "statSource", "fontStyle": "italic", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 500 },
            "backgroundMedia": { "enabled": true, "required": false }
          },
          "description": "Un seul gros chiffre + sa legende",
          "layoutRules": { "safeZonesPx": { "top": 120, "left": 90, "right": 90, "bottom": 180 }, "backgroundFilter": "overlayGradient" }
        }
      }
    },
    "quote": {
      "label": "Slide citation",
      "description": "Citation ou temoignage",
      "subVariants": {
        "simple": {
          "label": "Citation simple",
          "inputs": [
            { "key": "quoteText", "hint": "Pas besoin de mettre les guillemets, ils s ajoutent automatiquement en orange", "type": "textarea", "label": "Citation", "required": true, "maxLength": 200, "placeholder": "Ex: Une phrase qui resume tout..." },
            { "key": "quoteAuthor", "type": "text", "label": "Auteur", "required": true, "maxLength": 50, "placeholder": "Ex: Carole-Anne Kast" },
            { "key": "quoteRole", "type": "text", "label": "Fonction (optionnel)", "required": false, "maxLength": 60, "placeholder": "Ex: Conseillere d Etat (DIN)" },
            { "key": "backgroundMedia", "type": "image", "label": "Image de fond", "required": true }
          ],
          "components": {
            "quoteBlock": { "font": "titleFont", "topPx": 430, "leftPx": 0, "enabled": true, "rightPx": 0, "fontSize": "54px", "inputKey": "quoteText", "maxWidth": "88%", "fontStyle": "italic", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 700, "lineHeight": "1.2", "letterSpacing": "-0.015em", "quoteMarksColor": "brandPrimary" },
            "simpleText": { "font": "bodyFont", "topPx": 895, "leftPx": 0, "enabled": true, "opacity": 0.95, "rightPx": 0, "bottomPx": 140, "fontSize": "26px", "inputKey": "quoteRole", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 500 },
            "quoteAuthor": { "font": "titleFont", "topPx": 830, "leftPx": 0, "enabled": true, "rightPx": 0, "bottomPx": 200, "fontSize": "38px", "inputKey": "quoteAuthor", "fontStyle": "italic", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 500 },
            "authorSeparator": { "topPx": 800, "leftPx": 0, "bgColor": "brandPrimary", "enabled": true, "rightPx": 0, "widthPx": 210, "bottomPx": 280, "heightPx": 3, "placement": "custom", "componentType": "separator" },
            "backgroundMedia": { "enabled": true, "required": true }
          },
          "description": "Citation + auteur + fonction (centre sur image)",
          "layoutRules": { "safeZonesPx": { "top": 120, "left": 90, "right": 90, "bottom": 100 }, "backgroundFilter": "overlayGradient" }
        },
        "with_details": {
          "label": "Citation avec encadre contextuel",
          "inputs": [
            { "key": "quoteText", "type": "textarea", "label": "Citation", "required": true, "maxLength": 180, "placeholder": "Ex: Une phrase qui resume tout..." },
            { "key": "quoteAuthor", "type": "text", "label": "Auteur", "required": true, "maxLength": 50, "placeholder": "Ex: Monica Bonfanti" },
            { "key": "quoteRole", "type": "text", "label": "Fonction (optionnel)", "required": false, "maxLength": 60, "placeholder": "Ex: Commandante de la Police cantonale" },
            { "key": "detailsText", "hint": "Information complementaire", "type": "textarea", "label": "Encadre contextuel", "required": true, "maxLength": 200, "placeholder": "Ex: L armee a annonce entre 2 000 et 5 000 militaires deployes..." },
            { "key": "backgroundMedia", "type": "image", "label": "Image de fond", "required": true }
          ],
          "components": {
            "detailsBox": { "font": "bodyFont", "leftPx": 90, "enabled": true, "rightPx": 90, "bottomPx": 200, "fontSize": "24px", "inputKey": "detailsText", "paddingX": "24px", "paddingY": "20px", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 500, "lineHeight": "1.4", "borderColor": "textLight", "borderWidth": "2px", "borderRadius": "12px", "backgroundOpacity": 0.1 },
            "quoteBlock": { "font": "titleFont", "topPx": 310, "leftPx": 0, "enabled": true, "rightPx": 0, "fontSize": "48px", "inputKey": "quoteText", "maxWidth": "88%", "fontStyle": "italic", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 700, "lineHeight": "1.2", "letterSpacing": "-0.015em", "quoteMarksColor": "brandPrimary" },
            "simpleText": { "font": "bodyFont", "topPx": 730, "leftPx": 0, "enabled": true, "opacity": 0.95, "rightPx": 0, "bottomPx": 320, "fontSize": "24px", "inputKey": "quoteRole", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 500 },
            "quoteAuthor": { "font": "titleFont", "topPx": 670, "leftPx": 0, "enabled": true, "rightPx": 0, "bottomPx": 380, "fontSize": "34px", "inputKey": "quoteAuthor", "fontStyle": "italic", "placement": "custom", "textAlign": "center", "textColor": "textLight", "fontWeight": 500 },
            "authorSeparator": { "topPx": 640, "leftPx": 0, "bgColor": "brandPrimary", "enabled": true, "rightPx": 0, "widthPx": 210, "bottomPx": 460, "heightPx": 3, "placement": "custom", "componentType": "separator" },
            "backgroundMedia": { "enabled": true, "required": true }
          },
          "description": "Citation + auteur + encadre contextuel en bas",
          "layoutRules": { "safeZonesPx": { "top": 120, "left": 90, "right": 90, "bottom": 100 }, "backgroundFilter": "overlayGradient" }
        }
      }
    },
    "outro": {
      "label": "Slide de fin",
      "description": "Conclusion ou appel a l action",
      "subVariants": {
        "question": {
          "label": "Question rhetorique",
          "inputs": [
            { "key": "questionText", "hint": "Entoure les mots a mettre en avant avec * *", "type": "textarea", "label": "Question", "required": true, "maxLength": 150, "placeholder": "Ex: *Et toi* ? Tu utilises quels outils ?" },
            { "key": "backgroundMedia", "type": "image", "label": "Image de fond", "required": true }
          ],
          "components": {
            "titleBlock": { "font": "titleFont", "topPx": 350, "leftPx": 90, "enabled": true, "rightPx": 90, "fontSize": "88px", "inputKey": "questionText", "maxLines": 5, "maxWidth": "92%", "placement": "custom", "textColor": "textLight", "lineHeight": "1.05", "autoHighlight": { "svgAsset": "annotationCircle", "triggerCharacter": "*" }, "letterSpacing": "-0.025em" },
            "backgroundMedia": { "enabled": true, "required": true }
          },
          "description": "Question geante avec mots-cles en orange",
          "layoutRules": { "safeZonesPx": { "top": 120, "left": 90, "right": 90, "bottom": 100 }, "backgroundFilter": "overlayGradient" }
        },
        "practical_info": {
          "label": "Infos pratiques",
          "inputs": [
            { "key": "titleText", "type": "text", "label": "Titre principal", "required": true, "maxLength": 50, "placeholder": "Ex: Infos pratiques" },
            { "key": "subtitleText", "type": "text", "label": "Sous-titre (optionnel)", "required": false, "maxLength": 50, "placeholder": "Ex: (dispo debut juin)" },
            { "key": "line1", "type": "text", "label": "Ligne 1 (optionnel)", "required": false, "maxLength": 80, "placeholder": "Ex: Site : www.g7.ge.ch" },
            { "key": "line2", "type": "text", "label": "Ligne 2 (optionnel)", "required": false, "maxLength": 80, "placeholder": "Ex: Ligne verte : 0800 902 456" },
            { "key": "backgroundMedia", "type": "image", "label": "Image de fond", "required": true }
          ],
          "components": {
            "infoLine1": { "font": "bodyFont", "topPx": 670, "leftPx": 90, "enabled": true, "fontSize": "30px", "inputKey": "line1", "placement": "custom", "textColor": "textLight", "fontWeight": 700 },
            "infoLine2": { "font": "bodyFont", "topPx": 730, "leftPx": 90, "enabled": true, "fontSize": "30px", "inputKey": "line2", "placement": "custom", "textColor": "textLight", "fontWeight": 700 },
            "titleBlock": { "font": "titleFont", "topPx": 420, "leftPx": 90, "enabled": true, "rightPx": 90, "fontSize": "92px", "inputKey": "titleText", "maxLines": 2, "maxWidth": "90%", "placement": "custom", "textColor": "textLight", "lineHeight": "1.05", "letterSpacing": "-0.025em" },
            "subtitleBlock": { "font": "bodyFont", "topPx": 540, "leftPx": 90, "enabled": true, "opacity": 0.85, "fontSize": "28px", "inputKey": "subtitleText", "fontStyle": "italic", "placement": "custom", "textColor": "textLight", "fontWeight": 500 },
            "backgroundMedia": { "enabled": true, "required": true }
          },
          "description": "Slide de fin avec liens et contacts",
          "layoutRules": { "safeZonesPx": { "top": 120, "left": 90, "right": 90, "bottom": 100 }, "backgroundFilter": "gradientBottom80" }
        }
      }
    }
  }
};

// ============================================================
// GENERATION
// ============================================================

console.log("Generation des templates multi-format...\n");

const newTemplates: Record<string, any> = {};

for (const fmt of FORMATS) {
  console.log(`  Generation : ${fmt.formatKey} (${fmt.width}x${fmt.height})`);
  console.log(`    ratio_x = ${ratioX(fmt).toFixed(3)}, ratio_y = ${ratioY(fmt).toFixed(3)}`);
  
  newTemplates[fmt.formatKey] = generateTemplate(REFERENCE_TEMPLATE, fmt);
}

// Compter les variants/subVariants generes
let totalVariants = 0;
let totalSubVariants = 0;
let totalComponents = 0;

for (const tpl of Object.values(newTemplates)) {
  for (const variant of Object.values((tpl as any).slideVariants) as any) {
    totalVariants++;
    for (const subVariant of Object.values(variant.subVariants) as any) {
      totalSubVariants++;
      totalComponents += Object.keys(subVariant.components || {}).length;
    }
  }
}

console.log(`\n=== Statistiques ===`);
console.log(`Templates : ${Object.keys(newTemplates).length}`);
console.log(`Variants total : ${totalVariants}`);
console.log(`SubVariants total : ${totalSubVariants}`);
console.log(`Components total : ${totalComponents}`);

// ============================================================
// GENERER LE SQL
// ============================================================

const sqlPath = path.join(__dirname, "social-templates-output.sql");

const newTemplatesJson = JSON.stringify(newTemplates, null, 2);

const sql = `-- ============================================================
-- SPRINT 1 - Ajout des templates multi-format
-- Genere automatiquement par scripts/generate-social-templates.ts
-- Date : ${new Date().toISOString()}
--
-- 5 nouveaux templates :
--   - carrousel_instagram_square (1080x1080)
--   - carrousel_linkedin_square (1200x1200)
--   - carrousel_instagram_story (1080x1920)
--   - carrousel_tiktok (1080x1920)
--   - carrousel_facebook (1200x627)
-- ============================================================

-- IDEMPOTENT : verifier que les templates n existent pas deja
DO $$
DECLARE
  has_square BOOLEAN;
BEGIN
  SELECT (config_json->'exportTemplates') ? 'carrousel_instagram_square'
  INTO has_square
  FROM tenant_configs
  WHERE tenant_id = 'flag_geneve';
  
  IF has_square THEN
    RAISE NOTICE 'Templates deja presents - SKIP migration';
  ELSE
    RAISE NOTICE 'Templates absents - APPLY migration';
  END IF;
END $$;

-- Update config_json en ajoutant les nouveaux templates
-- Sans toucher aux templates existants (jsonb concat conserve les cles existantes)
UPDATE tenant_configs
SET 
  config_json = jsonb_set(
    config_json,
    '{exportTemplates}',
    (config_json->'exportTemplates') || ${"$json$"}${newTemplatesJson}${"$json$"}::jsonb,
    true
  ),
  config_version = '1.1.0',
  updated_at = now()
WHERE tenant_id = 'flag_geneve'
  AND NOT (config_json->'exportTemplates' ? 'carrousel_instagram_square');

-- Trigger archive automatiquement dans tenant_config_history (trg_archive_tenant_config)

-- Verification
SELECT 
  tenant_id,
  config_version,
  jsonb_object_keys(config_json->'exportTemplates') AS templates
FROM tenant_configs
WHERE tenant_id = 'flag_geneve'
ORDER BY 3;
`;

fs.writeFileSync(sqlPath, sql, "utf8");
console.log(`\nOK SQL genere : ${sqlPath}`);
console.log(`Taille : ${(fs.statSync(sqlPath).size / 1024).toFixed(1)} KB`);

// Aussi sauver le JSON brut pour inspection
const jsonPath = path.join(__dirname, "social-templates-output.json");
fs.writeFileSync(jsonPath, newTemplatesJson, "utf8");
console.log(`OK JSON genere : ${jsonPath}`);
console.log(`Taille : ${(fs.statSync(jsonPath).size / 1024).toFixed(1)} KB`);