-- ============================================================
-- SPRINT 1 - Ajout des templates multi-format
-- Genere automatiquement par scripts/generate-social-templates.ts
-- Date : 2026-05-27T11:13:24.579Z
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
    (config_json->'exportTemplates') || $json${
  "carrousel_instagram_square": {
    "id": "ig_carrousel_square",
    "type": "image",
    "label": "Carrousel Instagram Square",
    "format": "jpeg",
    "dimensions": {
      "width": 1080,
      "height": 1080
    },
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
              {
                "key": "badgeLabel",
                "hint": "Choisis le theme principal de cette slide",
                "type": "select",
                "label": "Categorie (badge)",
                "options": [
                  "Actu semaine",
                  "Actualite",
                  "Democratie",
                  "Entrepreneuriat",
                  "Culture",
                  "Economie",
                  "Qualite de vie",
                  "Territoire",
                  "Securite",
                  "Politique",
                  "Mobilite",
                  "Education"
                ],
                "required": true
              },
              {
                "key": "partnerName",
                "hint": "Si l article vient d un partenaire media, selectionne-le",
                "type": "select",
                "label": "Partenaire media (optionnel)",
                "options": [
                  "",
                  "Blick",
                  "RTS",
                  "Le Temps",
                  "24 Heures",
                  "Tribune de Geneve",
                  "Le Matin"
                ],
                "required": false
              },
              {
                "key": "titleText",
                "hint": "Max 4 lignes. Entoure un mot avec * * pour le surligner",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 110,
                "placeholder": "Ex: Comment le G7 va *bloquer* Geneve"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "badge": {
                "style": "neo-brutalist",
                "topPx": 560,
                "leftPx": 90,
                "bgColor": "#FFFFFF",
                "enabled": true,
                "fontSize": "34px",
                "inputKey": "badgeLabel",
                "paddingX": "22px",
                "paddingY": "8px",
                "placement": "custom",
                "textColor": "#000000",
                "fontWeight": 900,
                "borderColor": "#000000",
                "borderWidth": "1px",
                "shadowColor": "brandPrimary",
                "borderRadius": "14px",
                "shadowOffset": "-6px 6px"
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 660,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "83px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "partnerLabel": {
                "font": "titleFont",
                "topPx": 568,
                "leftPx": 480,
                "enabled": true,
                "fontSize": "34px",
                "inputKey": "partnerName",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 900
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Badge categorie + titre sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "hint": "Entoure un mot avec * * pour le surligner en orange manuscrit",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 90,
                "placeholder": "Ex: Les *secrets* du G7 a Geneve"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Tout ce qu il faut savoir"
              },
              {
                "key": "foregroundImage",
                "hint": "Image PNG avec fond transparent qui flotte sur le papier",
                "type": "image",
                "label": "Photo detouree (optionnel)",
                "required": false
              },
              {
                "key": "annotation1",
                "hint": "Texte ecrit a la main, en orange, position haute droite",
                "type": "text",
                "label": "Annotation manuscrite n1",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une note rapide en marge"
              },
              {
                "key": "annotation2",
                "hint": "Texte ecrit a la main, en orange, position basse",
                "type": "text",
                "label": "Annotation manuscrite n2",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une seconde note plus bas"
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 112,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "79px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "#1A1A1A",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationUnderline",
                  "highlightColor": "brandPrimary",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "annotation1": {
                "topPx": 544,
                "enabled": true,
                "rightPx": 70,
                "fontSize": "36px",
                "inputKey": "annotation1",
                "maxWidth": "380px",
                "rotation": 4,
                "placement": "custom",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "annotation2": {
                "enabled": true,
                "rightPx": 90,
                "bottomPx": 80,
                "fontSize": "32px",
                "inputKey": "annotation2",
                "maxWidth": "500px",
                "rotation": -2,
                "placement": "custom",
                "textAlign": "right",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 432,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "29px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "#444444",
                "fontWeight": 600
              },
              "backgroundMedia": {
                "enabled": false,
                "required": false
              },
              "foregroundImage": {
                "topPx": 520,
                "leftPx": 90,
                "enabled": true,
                "widthPx": 480,
                "heightPx": 384,
                "inputKey": "foregroundImage",
                "rotation": -3,
                "placement": "custom",
                "componentType": "foregroundImage"
              },
              "paperBackground": {
                "enabled": true,
                "inputKey": "_paper",
                "textureUrl": "/assets/flag/textures/paper-texture.jpg",
                "componentType": "paperBackground",
                "fallbackColor": "#F5EFE3"
              }
            },
            "description": "Fond papier + titre + photo detouree + annotations manuscrites",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "none"
            }
          },
          "standard": {
            "label": "Article standard",
            "inputs": [
              {
                "key": "titleText",
                "hint": "Max 4 lignes",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 120,
                "placeholder": "Ex: Les primes maladie vont encore grimper"
              },
              {
                "key": "ctaText",
                "type": "text",
                "label": "Texte de CTA (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: + plus d infos en description"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 90,
                "enabled": true,
                "opacity": 0.95,
                "bottomPx": 160,
                "fontSize": "29px",
                "inputKey": "ctaText",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 608,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "74px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Titre + CTA sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Evolution des nuitees hotelieres"
              },
              {
                "key": "orientation",
                "hint": "Vertical pour labels courts. Horizontal pour labels longs.",
                "type": "select",
                "label": "Orientation des barres",
                "options": [
                  "vertical",
                  "horizontal"
                ],
                "required": true
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Separateur ; (point-virgule).",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 800,
                "placeholder": "Format simple : Categorie ; Valeur\nJanvier ; 245\nFevrier ; 263"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Office du tourisme de Geneve 2026"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "barChart": {
                "topPx": 288,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 120,
                "inputKey": "chartData",
                "placement": "custom",
                "chartHeight": 480,
                "componentType": "barChart",
                "orientationKey": "orientation"
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 112,
                "fontSize": "20px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 104,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "47px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Barres verticales ou horizontales (au choix)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "pie_chart": {
            "label": "Graphique camembert (donut)",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre / Question",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Dans quels secteurs travaillent nos deputes ?"
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Format : Label ; Valeur",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 500,
                "placeholder": "Domaine prive ; 57.5\nSecteur public ; 27.5\nRetraites ; 10"
              },
              {
                "key": "centerText",
                "hint": "Affiche au centre du donut",
                "type": "text",
                "label": "Texte au centre (optionnel)",
                "required": false,
                "maxLength": 20,
                "placeholder": "Ex: 100% ou 850 deputes"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Statistiques cantonales 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "pieChart": {
                "topPx": 304,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "inputKey": "chartData",
                "chartType": "donut",
                "placement": "custom",
                "chartHeight": 464,
                "centerTextKey": "centerText",
                "componentType": "pieChart",
                "innerRadiusRatio": 0.55
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 112,
                "fontSize": "20px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 104,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "47px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Donut avec total au centre + legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "simple_number": {
            "label": "Chiffre mis en avant",
            "inputs": [
              {
                "key": "statValue",
                "hint": "Le chiffre phare a mettre en avant",
                "type": "text",
                "label": "Chiffre",
                "required": true,
                "maxLength": 12,
                "placeholder": "Ex: 87%"
              },
              {
                "key": "statLabel",
                "type": "text",
                "label": "Legende",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: des Genevois fiers de leur canton"
              },
              {
                "key": "statSource",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Sondage cantonal 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "statLabel": {
                "font": "titleFont",
                "topPx": 592,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "41px",
                "inputKey": "statLabel",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.15"
              },
              "statValue": {
                "font": "titleFont",
                "topPx": 304,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "252px",
                "inputKey": "statValue",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "brandPrimary",
                "fontWeight": 900
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 144,
                "fontSize": "20px",
                "inputKey": "statSource",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Un seul gros chiffre + sa legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "quoteText",
                "hint": "Pas besoin de mettre les guillemets, ils s ajoutent automatiquement en orange",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Carole-Anne Kast"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Conseillere d Etat (DIN)"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 344,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "49px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 716,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 112,
                "fontSize": "23px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 664,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 160,
                "fontSize": "34px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 640,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 210,
                "bottomPx": 224,
                "heightPx": 2,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + fonction (centre sur image)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "with_details": {
            "label": "Citation avec encadre contextuel",
            "inputs": [
              {
                "key": "quoteText",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 180,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Monica Bonfanti"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Commandante de la Police cantonale"
              },
              {
                "key": "detailsText",
                "hint": "Information complementaire",
                "type": "textarea",
                "label": "Encadre contextuel",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: L armee a annonce entre 2 000 et 5 000 militaires deployes..."
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "detailsBox": {
                "font": "bodyFont",
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "bottomPx": 160,
                "fontSize": "22px",
                "inputKey": "detailsText",
                "paddingX": "24px",
                "paddingY": "20px",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500,
                "lineHeight": "1.4",
                "borderColor": "textLight",
                "borderWidth": "2px",
                "borderRadius": "12px",
                "backgroundOpacity": 0.1
              },
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 248,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "43px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 584,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 256,
                "fontSize": "22px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 536,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 304,
                "fontSize": "31px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 512,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 210,
                "bottomPx": 368,
                "heightPx": 2,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + encadre contextuel en bas",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "questionText",
                "hint": "Entoure les mots a mettre en avant avec * *",
                "type": "textarea",
                "label": "Question",
                "required": true,
                "maxLength": 150,
                "placeholder": "Ex: *Et toi* ? Tu utilises quels outils ?"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 280,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "79px",
                "inputKey": "questionText",
                "maxLines": 5,
                "maxWidth": "92%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Question geante avec mots-cles en orange",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "practical_info": {
            "label": "Infos pratiques",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Infos pratiques"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: (dispo debut juin)"
              },
              {
                "key": "line1",
                "type": "text",
                "label": "Ligne 1 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Site : www.g7.ge.ch"
              },
              {
                "key": "line2",
                "type": "text",
                "label": "Ligne 2 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Ligne verte : 0800 902 456"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "infoLine1": {
                "font": "bodyFont",
                "topPx": 536,
                "leftPx": 90,
                "enabled": true,
                "fontSize": "27px",
                "inputKey": "line1",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "infoLine2": {
                "font": "bodyFont",
                "topPx": 584,
                "leftPx": 90,
                "enabled": true,
                "fontSize": "27px",
                "inputKey": "line2",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 336,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "83px",
                "inputKey": "titleText",
                "maxLines": 2,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.025em"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 432,
                "leftPx": 90,
                "enabled": true,
                "opacity": 0.85,
                "fontSize": "25px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Slide de fin avec liens et contacts",
            "layoutRules": {
              "safeZonesPx": {
                "top": 80,
                "right": 80,
                "bottom": 80,
                "left": 80
              },
              "backgroundFilter": "gradientBottom80"
            }
          }
        }
      }
    }
  },
  "carrousel_linkedin_square": {
    "id": "linkedin_carrousel_square",
    "type": "image",
    "label": "Carrousel LinkedIn Square",
    "format": "jpeg",
    "dimensions": {
      "width": 1200,
      "height": 1200
    },
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
              {
                "key": "badgeLabel",
                "hint": "Choisis le theme principal de cette slide",
                "type": "select",
                "label": "Categorie (badge)",
                "options": [
                  "Actu semaine",
                  "Actualite",
                  "Democratie",
                  "Entrepreneuriat",
                  "Culture",
                  "Economie",
                  "Qualite de vie",
                  "Territoire",
                  "Securite",
                  "Politique",
                  "Mobilite",
                  "Education"
                ],
                "required": true
              },
              {
                "key": "partnerName",
                "hint": "Si l article vient d un partenaire media, selectionne-le",
                "type": "select",
                "label": "Partenaire media (optionnel)",
                "options": [
                  "",
                  "Blick",
                  "RTS",
                  "Le Temps",
                  "24 Heures",
                  "Tribune de Geneve",
                  "Le Matin"
                ],
                "required": false
              },
              {
                "key": "titleText",
                "hint": "Max 4 lignes. Entoure un mot avec * * pour le surligner",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 110,
                "placeholder": "Ex: Comment le G7 va *bloquer* Geneve"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "badge": {
                "style": "neo-brutalist",
                "topPx": 622,
                "leftPx": 100,
                "bgColor": "#FFFFFF",
                "enabled": true,
                "fontSize": "38px",
                "inputKey": "badgeLabel",
                "paddingX": "22px",
                "paddingY": "8px",
                "placement": "custom",
                "textColor": "#000000",
                "fontWeight": 900,
                "borderColor": "#000000",
                "borderWidth": "1px",
                "shadowColor": "brandPrimary",
                "borderRadius": "14px",
                "shadowOffset": "-6px 6px"
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 733,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "92px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "partnerLabel": {
                "font": "titleFont",
                "topPx": 631,
                "leftPx": 533,
                "enabled": true,
                "fontSize": "38px",
                "inputKey": "partnerName",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 900
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Badge categorie + titre sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "hint": "Entoure un mot avec * * pour le surligner en orange manuscrit",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 90,
                "placeholder": "Ex: Les *secrets* du G7 a Geneve"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Tout ce qu il faut savoir"
              },
              {
                "key": "foregroundImage",
                "hint": "Image PNG avec fond transparent qui flotte sur le papier",
                "type": "image",
                "label": "Photo detouree (optionnel)",
                "required": false
              },
              {
                "key": "annotation1",
                "hint": "Texte ecrit a la main, en orange, position haute droite",
                "type": "text",
                "label": "Annotation manuscrite n1",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une note rapide en marge"
              },
              {
                "key": "annotation2",
                "hint": "Texte ecrit a la main, en orange, position basse",
                "type": "text",
                "label": "Annotation manuscrite n2",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une seconde note plus bas"
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 124,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "88px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "#1A1A1A",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationUnderline",
                  "highlightColor": "brandPrimary",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "annotation1": {
                "topPx": 604,
                "enabled": true,
                "rightPx": 78,
                "fontSize": "40px",
                "inputKey": "annotation1",
                "maxWidth": "380px",
                "rotation": 4,
                "placement": "custom",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "annotation2": {
                "enabled": true,
                "rightPx": 100,
                "bottomPx": 89,
                "fontSize": "36px",
                "inputKey": "annotation2",
                "maxWidth": "500px",
                "rotation": -2,
                "placement": "custom",
                "textAlign": "right",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 480,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "32px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "#444444",
                "fontWeight": 600
              },
              "backgroundMedia": {
                "enabled": false,
                "required": false
              },
              "foregroundImage": {
                "topPx": 578,
                "leftPx": 100,
                "enabled": true,
                "widthPx": 533,
                "heightPx": 427,
                "inputKey": "foregroundImage",
                "rotation": -3,
                "placement": "custom",
                "componentType": "foregroundImage"
              },
              "paperBackground": {
                "enabled": true,
                "inputKey": "_paper",
                "textureUrl": "/assets/flag/textures/paper-texture.jpg",
                "componentType": "paperBackground",
                "fallbackColor": "#F5EFE3"
              }
            },
            "description": "Fond papier + titre + photo detouree + annotations manuscrites",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "none"
            }
          },
          "standard": {
            "label": "Article standard",
            "inputs": [
              {
                "key": "titleText",
                "hint": "Max 4 lignes",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 120,
                "placeholder": "Ex: Les primes maladie vont encore grimper"
              },
              {
                "key": "ctaText",
                "type": "text",
                "label": "Texte de CTA (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: + plus d infos en description"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 100,
                "enabled": true,
                "opacity": 0.95,
                "bottomPx": 178,
                "fontSize": "32px",
                "inputKey": "ctaText",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 676,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "82px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Titre + CTA sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Evolution des nuitees hotelieres"
              },
              {
                "key": "orientation",
                "hint": "Vertical pour labels courts. Horizontal pour labels longs.",
                "type": "select",
                "label": "Orientation des barres",
                "options": [
                  "vertical",
                  "horizontal"
                ],
                "required": true
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Separateur ; (point-virgule).",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 800,
                "placeholder": "Format simple : Categorie ; Valeur\nJanvier ; 245\nFevrier ; 263"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Office du tourisme de Geneve 2026"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "barChart": {
                "topPx": 320,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 133,
                "inputKey": "chartData",
                "placement": "custom",
                "chartHeight": 533,
                "componentType": "barChart",
                "orientationKey": "orientation"
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 124,
                "fontSize": "22px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 116,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "52px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Barres verticales ou horizontales (au choix)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "pie_chart": {
            "label": "Graphique camembert (donut)",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre / Question",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Dans quels secteurs travaillent nos deputes ?"
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Format : Label ; Valeur",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 500,
                "placeholder": "Domaine prive ; 57.5\nSecteur public ; 27.5\nRetraites ; 10"
              },
              {
                "key": "centerText",
                "hint": "Affiche au centre du donut",
                "type": "text",
                "label": "Texte au centre (optionnel)",
                "required": false,
                "maxLength": 20,
                "placeholder": "Ex: 100% ou 850 deputes"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Statistiques cantonales 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "pieChart": {
                "topPx": 338,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "inputKey": "chartData",
                "chartType": "donut",
                "placement": "custom",
                "chartHeight": 516,
                "centerTextKey": "centerText",
                "componentType": "pieChart",
                "innerRadiusRatio": 0.55
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 124,
                "fontSize": "22px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 116,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "52px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Donut avec total au centre + legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "simple_number": {
            "label": "Chiffre mis en avant",
            "inputs": [
              {
                "key": "statValue",
                "hint": "Le chiffre phare a mettre en avant",
                "type": "text",
                "label": "Chiffre",
                "required": true,
                "maxLength": 12,
                "placeholder": "Ex: 87%"
              },
              {
                "key": "statLabel",
                "type": "text",
                "label": "Legende",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: des Genevois fiers de leur canton"
              },
              {
                "key": "statSource",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Sondage cantonal 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "statLabel": {
                "font": "titleFont",
                "topPx": 658,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "46px",
                "inputKey": "statLabel",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.15"
              },
              "statValue": {
                "font": "titleFont",
                "topPx": 338,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "280px",
                "inputKey": "statValue",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "brandPrimary",
                "fontWeight": 900
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 160,
                "fontSize": "22px",
                "inputKey": "statSource",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Un seul gros chiffre + sa legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "quoteText",
                "hint": "Pas besoin de mettre les guillemets, ils s ajoutent automatiquement en orange",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Carole-Anne Kast"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Conseillere d Etat (DIN)"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 382,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "54px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 796,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 124,
                "fontSize": "26px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 738,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 178,
                "fontSize": "38px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 711,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 233,
                "bottomPx": 249,
                "heightPx": 3,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + fonction (centre sur image)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "with_details": {
            "label": "Citation avec encadre contextuel",
            "inputs": [
              {
                "key": "quoteText",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 180,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Monica Bonfanti"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Commandante de la Police cantonale"
              },
              {
                "key": "detailsText",
                "hint": "Information complementaire",
                "type": "textarea",
                "label": "Encadre contextuel",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: L armee a annonce entre 2 000 et 5 000 militaires deployes..."
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "detailsBox": {
                "font": "bodyFont",
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "bottomPx": 178,
                "fontSize": "24px",
                "inputKey": "detailsText",
                "paddingX": "24px",
                "paddingY": "20px",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500,
                "lineHeight": "1.4",
                "borderColor": "textLight",
                "borderWidth": "2px",
                "borderRadius": "12px",
                "backgroundOpacity": 0.1
              },
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 276,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "48px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 649,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 284,
                "fontSize": "24px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 596,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 338,
                "fontSize": "34px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 569,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 233,
                "bottomPx": 409,
                "heightPx": 3,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + encadre contextuel en bas",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "questionText",
                "hint": "Entoure les mots a mettre en avant avec * *",
                "type": "textarea",
                "label": "Question",
                "required": true,
                "maxLength": 150,
                "placeholder": "Ex: *Et toi* ? Tu utilises quels outils ?"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 311,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "88px",
                "inputKey": "questionText",
                "maxLines": 5,
                "maxWidth": "92%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Question geante avec mots-cles en orange",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "practical_info": {
            "label": "Infos pratiques",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Infos pratiques"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: (dispo debut juin)"
              },
              {
                "key": "line1",
                "type": "text",
                "label": "Ligne 1 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Site : www.g7.ge.ch"
              },
              {
                "key": "line2",
                "type": "text",
                "label": "Ligne 2 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Ligne verte : 0800 902 456"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "infoLine1": {
                "font": "bodyFont",
                "topPx": 596,
                "leftPx": 100,
                "enabled": true,
                "fontSize": "30px",
                "inputKey": "line1",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "infoLine2": {
                "font": "bodyFont",
                "topPx": 649,
                "leftPx": 100,
                "enabled": true,
                "fontSize": "30px",
                "inputKey": "line2",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 373,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "92px",
                "inputKey": "titleText",
                "maxLines": 2,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.025em"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 480,
                "leftPx": 100,
                "enabled": true,
                "opacity": 0.85,
                "fontSize": "28px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Slide de fin avec liens et contacts",
            "layoutRules": {
              "safeZonesPx": {
                "top": 90,
                "right": 90,
                "bottom": 120,
                "left": 90
              },
              "backgroundFilter": "gradientBottom80"
            }
          }
        }
      }
    }
  },
  "carrousel_instagram_story": {
    "id": "ig_story",
    "type": "image",
    "label": "Story / Reel Instagram",
    "format": "jpeg",
    "dimensions": {
      "width": 1080,
      "height": 1920
    },
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
              {
                "key": "badgeLabel",
                "hint": "Choisis le theme principal de cette slide",
                "type": "select",
                "label": "Categorie (badge)",
                "options": [
                  "Actu semaine",
                  "Actualite",
                  "Democratie",
                  "Entrepreneuriat",
                  "Culture",
                  "Economie",
                  "Qualite de vie",
                  "Territoire",
                  "Securite",
                  "Politique",
                  "Mobilite",
                  "Education"
                ],
                "required": true
              },
              {
                "key": "partnerName",
                "hint": "Si l article vient d un partenaire media, selectionne-le",
                "type": "select",
                "label": "Partenaire media (optionnel)",
                "options": [
                  "",
                  "Blick",
                  "RTS",
                  "Le Temps",
                  "24 Heures",
                  "Tribune de Geneve",
                  "Le Matin"
                ],
                "required": false
              },
              {
                "key": "titleText",
                "hint": "Max 4 lignes. Entoure un mot avec * * pour le surligner",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 110,
                "placeholder": "Ex: Comment le G7 va *bloquer* Geneve"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "badge": {
                "style": "neo-brutalist",
                "topPx": 996,
                "leftPx": 90,
                "bgColor": "#FFFFFF",
                "enabled": true,
                "fontSize": "46px",
                "inputKey": "badgeLabel",
                "paddingX": "22px",
                "paddingY": "8px",
                "placement": "custom",
                "textColor": "#000000",
                "fontWeight": 900,
                "borderColor": "#000000",
                "borderWidth": "1px",
                "shadowColor": "brandPrimary",
                "borderRadius": "14px",
                "shadowOffset": "-6px 6px"
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 1173,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "111px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "partnerLabel": {
                "font": "titleFont",
                "topPx": 1010,
                "leftPx": 480,
                "enabled": true,
                "fontSize": "46px",
                "inputKey": "partnerName",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 900
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Badge categorie + titre sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "hint": "Entoure un mot avec * * pour le surligner en orange manuscrit",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 90,
                "placeholder": "Ex: Les *secrets* du G7 a Geneve"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Tout ce qu il faut savoir"
              },
              {
                "key": "foregroundImage",
                "hint": "Image PNG avec fond transparent qui flotte sur le papier",
                "type": "image",
                "label": "Photo detouree (optionnel)",
                "required": false
              },
              {
                "key": "annotation1",
                "hint": "Texte ecrit a la main, en orange, position haute droite",
                "type": "text",
                "label": "Annotation manuscrite n1",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une note rapide en marge"
              },
              {
                "key": "annotation2",
                "hint": "Texte ecrit a la main, en orange, position basse",
                "type": "text",
                "label": "Annotation manuscrite n2",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une seconde note plus bas"
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 199,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "107px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "#1A1A1A",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationUnderline",
                  "highlightColor": "brandPrimary",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "annotation1": {
                "topPx": 967,
                "enabled": true,
                "rightPx": 70,
                "fontSize": "48px",
                "inputKey": "annotation1",
                "maxWidth": "380px",
                "rotation": 4,
                "placement": "custom",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "annotation2": {
                "enabled": true,
                "rightPx": 90,
                "bottomPx": 142,
                "fontSize": "44px",
                "inputKey": "annotation2",
                "maxWidth": "500px",
                "rotation": -2,
                "placement": "custom",
                "textAlign": "right",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 768,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "39px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "#444444",
                "fontWeight": 600
              },
              "backgroundMedia": {
                "enabled": false,
                "required": false
              },
              "foregroundImage": {
                "topPx": 924,
                "leftPx": 90,
                "enabled": true,
                "widthPx": 480,
                "heightPx": 683,
                "inputKey": "foregroundImage",
                "rotation": -3,
                "placement": "custom",
                "componentType": "foregroundImage"
              },
              "paperBackground": {
                "enabled": true,
                "inputKey": "_paper",
                "textureUrl": "/assets/flag/textures/paper-texture.jpg",
                "componentType": "paperBackground",
                "fallbackColor": "#F5EFE3"
              }
            },
            "description": "Fond papier + titre + photo detouree + annotations manuscrites",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "none"
            }
          },
          "standard": {
            "label": "Article standard",
            "inputs": [
              {
                "key": "titleText",
                "hint": "Max 4 lignes",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 120,
                "placeholder": "Ex: Les primes maladie vont encore grimper"
              },
              {
                "key": "ctaText",
                "type": "text",
                "label": "Texte de CTA (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: + plus d infos en description"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 90,
                "enabled": true,
                "opacity": 0.95,
                "bottomPx": 284,
                "fontSize": "39px",
                "inputKey": "ctaText",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 1081,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "99px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Titre + CTA sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Evolution des nuitees hotelieres"
              },
              {
                "key": "orientation",
                "hint": "Vertical pour labels courts. Horizontal pour labels longs.",
                "type": "select",
                "label": "Orientation des barres",
                "options": [
                  "vertical",
                  "horizontal"
                ],
                "required": true
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Separateur ; (point-virgule).",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 800,
                "placeholder": "Format simple : Categorie ; Valeur\nJanvier ; 245\nFevrier ; 263"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Office du tourisme de Geneve 2026"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "barChart": {
                "topPx": 512,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 120,
                "inputKey": "chartData",
                "placement": "custom",
                "chartHeight": 853,
                "componentType": "barChart",
                "orientationKey": "orientation"
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 199,
                "fontSize": "27px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 185,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "63px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Barres verticales ou horizontales (au choix)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "pie_chart": {
            "label": "Graphique camembert (donut)",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre / Question",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Dans quels secteurs travaillent nos deputes ?"
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Format : Label ; Valeur",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 500,
                "placeholder": "Domaine prive ; 57.5\nSecteur public ; 27.5\nRetraites ; 10"
              },
              {
                "key": "centerText",
                "hint": "Affiche au centre du donut",
                "type": "text",
                "label": "Texte au centre (optionnel)",
                "required": false,
                "maxLength": 20,
                "placeholder": "Ex: 100% ou 850 deputes"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Statistiques cantonales 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "pieChart": {
                "topPx": 540,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "inputKey": "chartData",
                "chartType": "donut",
                "placement": "custom",
                "chartHeight": 825,
                "centerTextKey": "centerText",
                "componentType": "pieChart",
                "innerRadiusRatio": 0.55
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 199,
                "fontSize": "27px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 185,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "63px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Donut avec total au centre + legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "simple_number": {
            "label": "Chiffre mis en avant",
            "inputs": [
              {
                "key": "statValue",
                "hint": "Le chiffre phare a mettre en avant",
                "type": "text",
                "label": "Chiffre",
                "required": true,
                "maxLength": 12,
                "placeholder": "Ex: 87%"
              },
              {
                "key": "statLabel",
                "type": "text",
                "label": "Legende",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: des Genevois fiers de leur canton"
              },
              {
                "key": "statSource",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Sondage cantonal 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "statLabel": {
                "font": "titleFont",
                "topPx": 1052,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "56px",
                "inputKey": "statLabel",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.15"
              },
              "statValue": {
                "font": "titleFont",
                "topPx": 540,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "339px",
                "inputKey": "statValue",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "brandPrimary",
                "fontWeight": 900
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 256,
                "fontSize": "27px",
                "inputKey": "statSource",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Un seul gros chiffre + sa legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "quoteText",
                "hint": "Pas besoin de mettre les guillemets, ils s ajoutent automatiquement en orange",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Carole-Anne Kast"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Conseillere d Etat (DIN)"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 612,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "65px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 1273,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 199,
                "fontSize": "31px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 1180,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 284,
                "fontSize": "46px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 1138,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 210,
                "bottomPx": 398,
                "heightPx": 4,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + fonction (centre sur image)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "with_details": {
            "label": "Citation avec encadre contextuel",
            "inputs": [
              {
                "key": "quoteText",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 180,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Monica Bonfanti"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Commandante de la Police cantonale"
              },
              {
                "key": "detailsText",
                "hint": "Information complementaire",
                "type": "textarea",
                "label": "Encadre contextuel",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: L armee a annonce entre 2 000 et 5 000 militaires deployes..."
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "detailsBox": {
                "font": "bodyFont",
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "bottomPx": 284,
                "fontSize": "29px",
                "inputKey": "detailsText",
                "paddingX": "24px",
                "paddingY": "20px",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500,
                "lineHeight": "1.4",
                "borderColor": "textLight",
                "borderWidth": "2px",
                "borderRadius": "12px",
                "backgroundOpacity": 0.1
              },
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 441,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "58px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 1038,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 455,
                "fontSize": "29px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 953,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 540,
                "fontSize": "41px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 910,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 210,
                "bottomPx": 654,
                "heightPx": 4,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + encadre contextuel en bas",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "questionText",
                "hint": "Entoure les mots a mettre en avant avec * *",
                "type": "textarea",
                "label": "Question",
                "required": true,
                "maxLength": 150,
                "placeholder": "Ex: *Et toi* ? Tu utilises quels outils ?"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 498,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "107px",
                "inputKey": "questionText",
                "maxLines": 5,
                "maxWidth": "92%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Question geante avec mots-cles en orange",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "practical_info": {
            "label": "Infos pratiques",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Infos pratiques"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: (dispo debut juin)"
              },
              {
                "key": "line1",
                "type": "text",
                "label": "Ligne 1 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Site : www.g7.ge.ch"
              },
              {
                "key": "line2",
                "type": "text",
                "label": "Ligne 2 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Ligne verte : 0800 902 456"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "infoLine1": {
                "font": "bodyFont",
                "topPx": 953,
                "leftPx": 90,
                "enabled": true,
                "fontSize": "36px",
                "inputKey": "line1",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "infoLine2": {
                "font": "bodyFont",
                "topPx": 1038,
                "leftPx": 90,
                "enabled": true,
                "fontSize": "36px",
                "inputKey": "line2",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 597,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "111px",
                "inputKey": "titleText",
                "maxLines": 2,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.025em"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 768,
                "leftPx": 90,
                "enabled": true,
                "opacity": 0.85,
                "fontSize": "34px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Slide de fin avec liens et contacts",
            "layoutRules": {
              "safeZonesPx": {
                "top": 250,
                "right": 80,
                "bottom": 250,
                "left": 80
              },
              "backgroundFilter": "gradientBottom80"
            }
          }
        }
      }
    }
  },
  "carrousel_tiktok": {
    "id": "tiktok_vertical",
    "type": "image",
    "label": "TikTok Vertical",
    "format": "jpeg",
    "dimensions": {
      "width": 1080,
      "height": 1920
    },
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
              {
                "key": "badgeLabel",
                "hint": "Choisis le theme principal de cette slide",
                "type": "select",
                "label": "Categorie (badge)",
                "options": [
                  "Actu semaine",
                  "Actualite",
                  "Democratie",
                  "Entrepreneuriat",
                  "Culture",
                  "Economie",
                  "Qualite de vie",
                  "Territoire",
                  "Securite",
                  "Politique",
                  "Mobilite",
                  "Education"
                ],
                "required": true
              },
              {
                "key": "partnerName",
                "hint": "Si l article vient d un partenaire media, selectionne-le",
                "type": "select",
                "label": "Partenaire media (optionnel)",
                "options": [
                  "",
                  "Blick",
                  "RTS",
                  "Le Temps",
                  "24 Heures",
                  "Tribune de Geneve",
                  "Le Matin"
                ],
                "required": false
              },
              {
                "key": "titleText",
                "hint": "Max 4 lignes. Entoure un mot avec * * pour le surligner",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 110,
                "placeholder": "Ex: Comment le G7 va *bloquer* Geneve"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "badge": {
                "style": "neo-brutalist",
                "topPx": 996,
                "leftPx": 90,
                "bgColor": "#FFFFFF",
                "enabled": true,
                "fontSize": "46px",
                "inputKey": "badgeLabel",
                "paddingX": "22px",
                "paddingY": "8px",
                "placement": "custom",
                "textColor": "#000000",
                "fontWeight": 900,
                "borderColor": "#000000",
                "borderWidth": "1px",
                "shadowColor": "brandPrimary",
                "borderRadius": "14px",
                "shadowOffset": "-6px 6px"
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 1173,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "111px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "partnerLabel": {
                "font": "titleFont",
                "topPx": 1010,
                "leftPx": 480,
                "enabled": true,
                "fontSize": "46px",
                "inputKey": "partnerName",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 900
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Badge categorie + titre sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "hint": "Entoure un mot avec * * pour le surligner en orange manuscrit",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 90,
                "placeholder": "Ex: Les *secrets* du G7 a Geneve"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Tout ce qu il faut savoir"
              },
              {
                "key": "foregroundImage",
                "hint": "Image PNG avec fond transparent qui flotte sur le papier",
                "type": "image",
                "label": "Photo detouree (optionnel)",
                "required": false
              },
              {
                "key": "annotation1",
                "hint": "Texte ecrit a la main, en orange, position haute droite",
                "type": "text",
                "label": "Annotation manuscrite n1",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une note rapide en marge"
              },
              {
                "key": "annotation2",
                "hint": "Texte ecrit a la main, en orange, position basse",
                "type": "text",
                "label": "Annotation manuscrite n2",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une seconde note plus bas"
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 199,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "107px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "#1A1A1A",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationUnderline",
                  "highlightColor": "brandPrimary",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "annotation1": {
                "topPx": 967,
                "enabled": true,
                "rightPx": 70,
                "fontSize": "48px",
                "inputKey": "annotation1",
                "maxWidth": "380px",
                "rotation": 4,
                "placement": "custom",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "annotation2": {
                "enabled": true,
                "rightPx": 90,
                "bottomPx": 142,
                "fontSize": "44px",
                "inputKey": "annotation2",
                "maxWidth": "500px",
                "rotation": -2,
                "placement": "custom",
                "textAlign": "right",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 768,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "39px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "#444444",
                "fontWeight": 600
              },
              "backgroundMedia": {
                "enabled": false,
                "required": false
              },
              "foregroundImage": {
                "topPx": 924,
                "leftPx": 90,
                "enabled": true,
                "widthPx": 480,
                "heightPx": 683,
                "inputKey": "foregroundImage",
                "rotation": -3,
                "placement": "custom",
                "componentType": "foregroundImage"
              },
              "paperBackground": {
                "enabled": true,
                "inputKey": "_paper",
                "textureUrl": "/assets/flag/textures/paper-texture.jpg",
                "componentType": "paperBackground",
                "fallbackColor": "#F5EFE3"
              }
            },
            "description": "Fond papier + titre + photo detouree + annotations manuscrites",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "none"
            }
          },
          "standard": {
            "label": "Article standard",
            "inputs": [
              {
                "key": "titleText",
                "hint": "Max 4 lignes",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 120,
                "placeholder": "Ex: Les primes maladie vont encore grimper"
              },
              {
                "key": "ctaText",
                "type": "text",
                "label": "Texte de CTA (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: + plus d infos en description"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 90,
                "enabled": true,
                "opacity": 0.95,
                "bottomPx": 284,
                "fontSize": "39px",
                "inputKey": "ctaText",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 1081,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "99px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Titre + CTA sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Evolution des nuitees hotelieres"
              },
              {
                "key": "orientation",
                "hint": "Vertical pour labels courts. Horizontal pour labels longs.",
                "type": "select",
                "label": "Orientation des barres",
                "options": [
                  "vertical",
                  "horizontal"
                ],
                "required": true
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Separateur ; (point-virgule).",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 800,
                "placeholder": "Format simple : Categorie ; Valeur\nJanvier ; 245\nFevrier ; 263"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Office du tourisme de Geneve 2026"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "barChart": {
                "topPx": 512,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 120,
                "inputKey": "chartData",
                "placement": "custom",
                "chartHeight": 853,
                "componentType": "barChart",
                "orientationKey": "orientation"
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 199,
                "fontSize": "27px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 185,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "63px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Barres verticales ou horizontales (au choix)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "pie_chart": {
            "label": "Graphique camembert (donut)",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre / Question",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Dans quels secteurs travaillent nos deputes ?"
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Format : Label ; Valeur",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 500,
                "placeholder": "Domaine prive ; 57.5\nSecteur public ; 27.5\nRetraites ; 10"
              },
              {
                "key": "centerText",
                "hint": "Affiche au centre du donut",
                "type": "text",
                "label": "Texte au centre (optionnel)",
                "required": false,
                "maxLength": 20,
                "placeholder": "Ex: 100% ou 850 deputes"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Statistiques cantonales 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "pieChart": {
                "topPx": 540,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "inputKey": "chartData",
                "chartType": "donut",
                "placement": "custom",
                "chartHeight": 825,
                "centerTextKey": "centerText",
                "componentType": "pieChart",
                "innerRadiusRatio": 0.55
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 199,
                "fontSize": "27px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 185,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "63px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Donut avec total au centre + legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "simple_number": {
            "label": "Chiffre mis en avant",
            "inputs": [
              {
                "key": "statValue",
                "hint": "Le chiffre phare a mettre en avant",
                "type": "text",
                "label": "Chiffre",
                "required": true,
                "maxLength": 12,
                "placeholder": "Ex: 87%"
              },
              {
                "key": "statLabel",
                "type": "text",
                "label": "Legende",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: des Genevois fiers de leur canton"
              },
              {
                "key": "statSource",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Sondage cantonal 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "statLabel": {
                "font": "titleFont",
                "topPx": 1052,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "56px",
                "inputKey": "statLabel",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.15"
              },
              "statValue": {
                "font": "titleFont",
                "topPx": 540,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "339px",
                "inputKey": "statValue",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "brandPrimary",
                "fontWeight": 900
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 256,
                "fontSize": "27px",
                "inputKey": "statSource",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Un seul gros chiffre + sa legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "quoteText",
                "hint": "Pas besoin de mettre les guillemets, ils s ajoutent automatiquement en orange",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Carole-Anne Kast"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Conseillere d Etat (DIN)"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 612,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "65px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 1273,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 199,
                "fontSize": "31px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 1180,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 284,
                "fontSize": "46px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 1138,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 210,
                "bottomPx": 398,
                "heightPx": 4,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + fonction (centre sur image)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "with_details": {
            "label": "Citation avec encadre contextuel",
            "inputs": [
              {
                "key": "quoteText",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 180,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Monica Bonfanti"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Commandante de la Police cantonale"
              },
              {
                "key": "detailsText",
                "hint": "Information complementaire",
                "type": "textarea",
                "label": "Encadre contextuel",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: L armee a annonce entre 2 000 et 5 000 militaires deployes..."
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "detailsBox": {
                "font": "bodyFont",
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "bottomPx": 284,
                "fontSize": "29px",
                "inputKey": "detailsText",
                "paddingX": "24px",
                "paddingY": "20px",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500,
                "lineHeight": "1.4",
                "borderColor": "textLight",
                "borderWidth": "2px",
                "borderRadius": "12px",
                "backgroundOpacity": 0.1
              },
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 441,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "58px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 1038,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 455,
                "fontSize": "29px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 953,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 540,
                "fontSize": "41px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 910,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 210,
                "bottomPx": 654,
                "heightPx": 4,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + encadre contextuel en bas",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "questionText",
                "hint": "Entoure les mots a mettre en avant avec * *",
                "type": "textarea",
                "label": "Question",
                "required": true,
                "maxLength": 150,
                "placeholder": "Ex: *Et toi* ? Tu utilises quels outils ?"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 498,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "107px",
                "inputKey": "questionText",
                "maxLines": 5,
                "maxWidth": "92%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Question geante avec mots-cles en orange",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "practical_info": {
            "label": "Infos pratiques",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Infos pratiques"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: (dispo debut juin)"
              },
              {
                "key": "line1",
                "type": "text",
                "label": "Ligne 1 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Site : www.g7.ge.ch"
              },
              {
                "key": "line2",
                "type": "text",
                "label": "Ligne 2 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Ligne verte : 0800 902 456"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "infoLine1": {
                "font": "bodyFont",
                "topPx": 953,
                "leftPx": 90,
                "enabled": true,
                "fontSize": "36px",
                "inputKey": "line1",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "infoLine2": {
                "font": "bodyFont",
                "topPx": 1038,
                "leftPx": 90,
                "enabled": true,
                "fontSize": "36px",
                "inputKey": "line2",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 597,
                "leftPx": 90,
                "enabled": true,
                "rightPx": 90,
                "fontSize": "111px",
                "inputKey": "titleText",
                "maxLines": 2,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.025em"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 768,
                "leftPx": 90,
                "enabled": true,
                "opacity": 0.85,
                "fontSize": "34px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Slide de fin avec liens et contacts",
            "layoutRules": {
              "safeZonesPx": {
                "top": 200,
                "right": 200,
                "bottom": 300,
                "left": 80
              },
              "backgroundFilter": "gradientBottom80"
            }
          }
        }
      }
    }
  },
  "carrousel_facebook": {
    "id": "fb_link_preview",
    "type": "image",
    "label": "Facebook Link Preview",
    "format": "jpeg",
    "dimensions": {
      "width": 1200,
      "height": 627
    },
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
              {
                "key": "badgeLabel",
                "hint": "Choisis le theme principal de cette slide",
                "type": "select",
                "label": "Categorie (badge)",
                "options": [
                  "Actu semaine",
                  "Actualite",
                  "Democratie",
                  "Entrepreneuriat",
                  "Culture",
                  "Economie",
                  "Qualite de vie",
                  "Territoire",
                  "Securite",
                  "Politique",
                  "Mobilite",
                  "Education"
                ],
                "required": true
              },
              {
                "key": "partnerName",
                "hint": "Si l article vient d un partenaire media, selectionne-le",
                "type": "select",
                "label": "Partenaire media (optionnel)",
                "options": [
                  "",
                  "Blick",
                  "RTS",
                  "Le Temps",
                  "24 Heures",
                  "Tribune de Geneve",
                  "Le Matin"
                ],
                "required": false
              },
              {
                "key": "titleText",
                "hint": "Max 4 lignes. Entoure un mot avec * * pour le surligner",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 110,
                "placeholder": "Ex: Comment le G7 va *bloquer* Geneve"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "badge": {
                "style": "neo-brutalist",
                "topPx": 325,
                "leftPx": 100,
                "bgColor": "#FFFFFF",
                "enabled": true,
                "fontSize": "30px",
                "inputKey": "badgeLabel",
                "paddingX": "22px",
                "paddingY": "8px",
                "placement": "custom",
                "textColor": "#000000",
                "fontWeight": 900,
                "borderColor": "#000000",
                "borderWidth": "1px",
                "shadowColor": "brandPrimary",
                "borderRadius": "14px",
                "shadowOffset": "-6px 6px"
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 383,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "72px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "partnerLabel": {
                "font": "titleFont",
                "topPx": 330,
                "leftPx": 533,
                "enabled": true,
                "fontSize": "30px",
                "inputKey": "partnerName",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 900
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Badge categorie + titre sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "hint": "Entoure un mot avec * * pour le surligner en orange manuscrit",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 90,
                "placeholder": "Ex: Les *secrets* du G7 a Geneve"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Tout ce qu il faut savoir"
              },
              {
                "key": "foregroundImage",
                "hint": "Image PNG avec fond transparent qui flotte sur le papier",
                "type": "image",
                "label": "Photo detouree (optionnel)",
                "required": false
              },
              {
                "key": "annotation1",
                "hint": "Texte ecrit a la main, en orange, position haute droite",
                "type": "text",
                "label": "Annotation manuscrite n1",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une note rapide en marge"
              },
              {
                "key": "annotation2",
                "hint": "Texte ecrit a la main, en orange, position basse",
                "type": "text",
                "label": "Annotation manuscrite n2",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: une seconde note plus bas"
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 65,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "69px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "88%",
                "placement": "custom",
                "textColor": "#1A1A1A",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationUnderline",
                  "highlightColor": "brandPrimary",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "annotation1": {
                "topPx": 316,
                "enabled": true,
                "rightPx": 78,
                "fontSize": "32px",
                "inputKey": "annotation1",
                "maxWidth": "380px",
                "rotation": 4,
                "placement": "custom",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "annotation2": {
                "enabled": true,
                "rightPx": 100,
                "bottomPx": 46,
                "fontSize": "28px",
                "inputKey": "annotation2",
                "maxWidth": "500px",
                "rotation": -2,
                "placement": "custom",
                "textAlign": "right",
                "textColor": "brandPrimary",
                "componentType": "handwrittenAnnotation"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 251,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "25px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "#444444",
                "fontWeight": 600
              },
              "backgroundMedia": {
                "enabled": false,
                "required": false
              },
              "foregroundImage": {
                "topPx": 302,
                "leftPx": 100,
                "enabled": true,
                "widthPx": 533,
                "heightPx": 223,
                "inputKey": "foregroundImage",
                "rotation": -3,
                "placement": "custom",
                "componentType": "foregroundImage"
              },
              "paperBackground": {
                "enabled": true,
                "inputKey": "_paper",
                "textureUrl": "/assets/flag/textures/paper-texture.jpg",
                "componentType": "paperBackground",
                "fallbackColor": "#F5EFE3"
              }
            },
            "description": "Fond papier + titre + photo detouree + annotations manuscrites",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "none"
            }
          },
          "standard": {
            "label": "Article standard",
            "inputs": [
              {
                "key": "titleText",
                "hint": "Max 4 lignes",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 120,
                "placeholder": "Ex: Les primes maladie vont encore grimper"
              },
              {
                "key": "ctaText",
                "type": "text",
                "label": "Texte de CTA (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: + plus d infos en description"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 100,
                "enabled": true,
                "opacity": 0.95,
                "bottomPx": 93,
                "fontSize": "25px",
                "inputKey": "ctaText",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 353,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "65px",
                "inputKey": "titleText",
                "maxLines": 4,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Titre + CTA sur image de fond",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "gradientBottom80"
            }
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
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Evolution des nuitees hotelieres"
              },
              {
                "key": "orientation",
                "hint": "Vertical pour labels courts. Horizontal pour labels longs.",
                "type": "select",
                "label": "Orientation des barres",
                "options": [
                  "vertical",
                  "horizontal"
                ],
                "required": true
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Separateur ; (point-virgule).",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 800,
                "placeholder": "Format simple : Categorie ; Valeur\nJanvier ; 245\nFevrier ; 263"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Office du tourisme de Geneve 2026"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "barChart": {
                "topPx": 167,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 133,
                "inputKey": "chartData",
                "placement": "custom",
                "chartHeight": 279,
                "componentType": "barChart",
                "orientationKey": "orientation"
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 65,
                "fontSize": "17px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 60,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "41px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Barres verticales ou horizontales (au choix)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "pie_chart": {
            "label": "Graphique camembert (donut)",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre / Question",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: Dans quels secteurs travaillent nos deputes ?"
              },
              {
                "key": "chartData",
                "hint": "Une ligne par categorie. Format : Label ; Valeur",
                "type": "textarea",
                "label": "Donnees du graphique",
                "required": true,
                "maxLength": 500,
                "placeholder": "Domaine prive ; 57.5\nSecteur public ; 27.5\nRetraites ; 10"
              },
              {
                "key": "centerText",
                "hint": "Affiche au centre du donut",
                "type": "text",
                "label": "Texte au centre (optionnel)",
                "required": false,
                "maxLength": 20,
                "placeholder": "Ex: 100% ou 850 deputes"
              },
              {
                "key": "sourceText",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 100,
                "placeholder": "Ex: Statistiques cantonales 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "pieChart": {
                "topPx": 176,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "inputKey": "chartData",
                "chartType": "donut",
                "placement": "custom",
                "chartHeight": 269,
                "centerTextKey": "centerText",
                "componentType": "pieChart",
                "innerRadiusRatio": 0.55
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 65,
                "fontSize": "17px",
                "inputKey": "sourceText",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 60,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "41px",
                "inputKey": "titleText",
                "maxLines": 3,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.1",
                "letterSpacing": "-0.02em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Donut avec total au centre + legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "simple_number": {
            "label": "Chiffre mis en avant",
            "inputs": [
              {
                "key": "statValue",
                "hint": "Le chiffre phare a mettre en avant",
                "type": "text",
                "label": "Chiffre",
                "required": true,
                "maxLength": 12,
                "placeholder": "Ex: 87%"
              },
              {
                "key": "statLabel",
                "type": "text",
                "label": "Legende",
                "required": true,
                "maxLength": 80,
                "placeholder": "Ex: des Genevois fiers de leur canton"
              },
              {
                "key": "statSource",
                "type": "text",
                "label": "Source (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Sondage cantonal 2024"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond (optionnel)",
                "required": false
              }
            ],
            "components": {
              "statLabel": {
                "font": "titleFont",
                "topPx": 344,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "36px",
                "inputKey": "statLabel",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.15"
              },
              "statValue": {
                "font": "titleFont",
                "topPx": 176,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "221px",
                "inputKey": "statValue",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "brandPrimary",
                "fontWeight": 900
              },
              "simpleText": {
                "font": "bodyFont",
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.75,
                "rightPx": 0,
                "bottomPx": 84,
                "fontSize": "17px",
                "inputKey": "statSource",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": false
              }
            },
            "description": "Un seul gros chiffre + sa legende",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "quoteText",
                "hint": "Pas besoin de mettre les guillemets, ils s ajoutent automatiquement en orange",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Carole-Anne Kast"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Conseillere d Etat (DIN)"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 200,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "43px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 416,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 65,
                "fontSize": "20px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 385,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 93,
                "fontSize": "30px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 372,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 233,
                "bottomPx": 130,
                "heightPx": 1,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + fonction (centre sur image)",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "with_details": {
            "label": "Citation avec encadre contextuel",
            "inputs": [
              {
                "key": "quoteText",
                "type": "textarea",
                "label": "Citation",
                "required": true,
                "maxLength": 180,
                "placeholder": "Ex: Une phrase qui resume tout..."
              },
              {
                "key": "quoteAuthor",
                "type": "text",
                "label": "Auteur",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Monica Bonfanti"
              },
              {
                "key": "quoteRole",
                "type": "text",
                "label": "Fonction (optionnel)",
                "required": false,
                "maxLength": 60,
                "placeholder": "Ex: Commandante de la Police cantonale"
              },
              {
                "key": "detailsText",
                "hint": "Information complementaire",
                "type": "textarea",
                "label": "Encadre contextuel",
                "required": true,
                "maxLength": 200,
                "placeholder": "Ex: L armee a annonce entre 2 000 et 5 000 militaires deployes..."
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "detailsBox": {
                "font": "bodyFont",
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "bottomPx": 93,
                "fontSize": "19px",
                "inputKey": "detailsText",
                "paddingX": "24px",
                "paddingY": "20px",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500,
                "lineHeight": "1.4",
                "borderColor": "textLight",
                "borderWidth": "2px",
                "borderRadius": "12px",
                "backgroundOpacity": 0.1
              },
              "quoteBlock": {
                "font": "titleFont",
                "topPx": 144,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "fontSize": "38px",
                "inputKey": "quoteText",
                "maxWidth": "88%",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 700,
                "lineHeight": "1.2",
                "letterSpacing": "-0.015em",
                "quoteMarksColor": "brandPrimary"
              },
              "simpleText": {
                "font": "bodyFont",
                "topPx": 339,
                "leftPx": 0,
                "enabled": true,
                "opacity": 0.95,
                "rightPx": 0,
                "bottomPx": 149,
                "fontSize": "19px",
                "inputKey": "quoteRole",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "quoteAuthor": {
                "font": "titleFont",
                "topPx": 311,
                "leftPx": 0,
                "enabled": true,
                "rightPx": 0,
                "bottomPx": 176,
                "fontSize": "27px",
                "inputKey": "quoteAuthor",
                "fontStyle": "italic",
                "placement": "custom",
                "textAlign": "center",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "authorSeparator": {
                "topPx": 297,
                "leftPx": 0,
                "bgColor": "brandPrimary",
                "enabled": true,
                "rightPx": 0,
                "widthPx": 233,
                "bottomPx": 214,
                "heightPx": 1,
                "placement": "custom",
                "componentType": "separator"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Citation + auteur + encadre contextuel en bas",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "overlayGradient"
            }
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
              {
                "key": "questionText",
                "hint": "Entoure les mots a mettre en avant avec * *",
                "type": "textarea",
                "label": "Question",
                "required": true,
                "maxLength": 150,
                "placeholder": "Ex: *Et toi* ? Tu utilises quels outils ?"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "titleBlock": {
                "font": "titleFont",
                "topPx": 163,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "69px",
                "inputKey": "questionText",
                "maxLines": 5,
                "maxWidth": "92%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "autoHighlight": {
                  "svgAsset": "annotationCircle",
                  "triggerCharacter": "*"
                },
                "letterSpacing": "-0.025em"
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Question geante avec mots-cles en orange",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "overlayGradient"
            }
          },
          "practical_info": {
            "label": "Infos pratiques",
            "inputs": [
              {
                "key": "titleText",
                "type": "text",
                "label": "Titre principal",
                "required": true,
                "maxLength": 50,
                "placeholder": "Ex: Infos pratiques"
              },
              {
                "key": "subtitleText",
                "type": "text",
                "label": "Sous-titre (optionnel)",
                "required": false,
                "maxLength": 50,
                "placeholder": "Ex: (dispo debut juin)"
              },
              {
                "key": "line1",
                "type": "text",
                "label": "Ligne 1 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Site : www.g7.ge.ch"
              },
              {
                "key": "line2",
                "type": "text",
                "label": "Ligne 2 (optionnel)",
                "required": false,
                "maxLength": 80,
                "placeholder": "Ex: Ligne verte : 0800 902 456"
              },
              {
                "key": "backgroundMedia",
                "type": "image",
                "label": "Image de fond",
                "required": true
              }
            ],
            "components": {
              "infoLine1": {
                "font": "bodyFont",
                "topPx": 311,
                "leftPx": 100,
                "enabled": true,
                "fontSize": "24px",
                "inputKey": "line1",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "infoLine2": {
                "font": "bodyFont",
                "topPx": 339,
                "leftPx": 100,
                "enabled": true,
                "fontSize": "24px",
                "inputKey": "line2",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 700
              },
              "titleBlock": {
                "font": "titleFont",
                "topPx": 195,
                "leftPx": 100,
                "enabled": true,
                "rightPx": 100,
                "fontSize": "72px",
                "inputKey": "titleText",
                "maxLines": 2,
                "maxWidth": "90%",
                "placement": "custom",
                "textColor": "textLight",
                "lineHeight": "1.05",
                "letterSpacing": "-0.025em"
              },
              "subtitleBlock": {
                "font": "bodyFont",
                "topPx": 251,
                "leftPx": 100,
                "enabled": true,
                "opacity": 0.85,
                "fontSize": "22px",
                "inputKey": "subtitleText",
                "fontStyle": "italic",
                "placement": "custom",
                "textColor": "textLight",
                "fontWeight": 500
              },
              "backgroundMedia": {
                "enabled": true,
                "required": true
              }
            },
            "description": "Slide de fin avec liens et contacts",
            "layoutRules": {
              "safeZonesPx": {
                "top": 60,
                "right": 60,
                "bottom": 60,
                "left": 60
              },
              "backgroundFilter": "gradientBottom80"
            }
          }
        }
      }
    }
  }
}$json$::jsonb,
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
