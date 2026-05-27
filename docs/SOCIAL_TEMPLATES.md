# SOCIAL TEMPLATES - Specifications V1

> Document de reference pour les **5 nouveaux templates multi-format** ajoutes en Sprint 1.  
> Complement a ARCHITECTURE.md (sections 4, 11).  
> Date : 27 mai 2026

---

## 1. APERCU DES FORMATS

| Format Key | Dimensions | Aspect Ratio | Usage |
|-----------|-----------|--------------|-------|
| carrousel_instagram | 1080 x 1350 | 4:5 | IG Feed Portrait (existant) |
| carrousel_instagram_square | 1080 x 1080 | 1:1 | IG Feed Square (NOUVEAU) |
| carrousel_linkedin_square | 1200 x 1200 | 1:1 | LinkedIn Feed (NOUVEAU) |
| carrousel_instagram_story | 1080 x 1920 | 9:16 | IG Stories/Reels (NOUVEAU) |
| carrousel_tiktok | 1080 x 1920 | 9:16 | TikTok (NOUVEAU) |
| carrousel_facebook | 1200 x 627 | 1.91:1 | Facebook Link (NOUVEAU) |

---

## 2. SAFE ZONES PAR FORMAT

### 2.1 IG Feed Square (1080x1080)
safeZonesPx: { top: 80, right: 80, bottom: 80, left: 80 }
Pas d UI plateforme superposee.

### 2.2 LinkedIn Square (1200x1200)
safeZonesPx: { top: 90, right: 90, bottom: 120, left: 90 }
Bottom plus large pour signature institutionnelle.

### 2.3 IG Story (1080x1920)
safeZonesPx: { top: 250, right: 80, bottom: 250, left: 80 }
Top : profile bar IG. Bottom : action bar (reply, share).

### 2.4 TikTok (1080x1920)
safeZonesPx: { top: 200, right: 200, bottom: 300, left: 80 }
Right : boutons likes/comments/share. Bottom : caption + username.

### 2.5 Facebook Link (1200x627)
safeZonesPx: { top: 60, right: 60, bottom: 60, left: 60 }
Format compact, marges reduites.

---

## 3. STRATEGIE DE REUTILISATION

Les 5 nouveaux templates **reutilisent les memes slideVariants** que carrousel_instagram :
- intro (classic)
- content (paper, standard)
- stat (bar_chart, pie_chart, simple_number)
- quote (simple, with_details)
- outro (question, practical_info)

### Calcul des positions

Formule de reference (base = carrousel_instagram 1080x1350) :
ratio_height = format.height / 1350
ratio_width = format.width / 1080
newTopPx = baseTopPx * ratio_height
newLeftPx = baseLeftPx * ratio_width
newFontSize = baseFontSize * (ratio_height + ratio_width) / 2

---

## 4. RATIOS PAR FORMAT (table de reference)

| Format | width | height | r_w | r_h | r_moyen |
|--------|-------|--------|-----|-----|---------|
| IG Square | 1080 | 1080 | 1.00 | 0.80 | 0.90 |
| LinkedIn | 1200 | 1200 | 1.11 | 0.89 | 1.00 |
| IG Story | 1080 | 1920 | 1.00 | 1.42 | 1.21 |
| TikTok | 1080 | 1920 | 1.00 | 1.42 | 1.21 |
| Facebook | 1200 | 627 | 1.11 | 0.46 | 0.79 |

---

## 5. VALIDATION CHARTE PAR FORMAT

Fonction TS `validateBrandCharter(formatKey, tenantConfig)` retourne :
- valid: boolean
- errors: string[]
- warnings: string[]

Voir `/src/lib/brandCharterValidation.ts`

---

## 6. CHECKLIST IMPLEMENTATION SPRINT 1

- [x] Document specs SOCIAL_TEMPLATES.md
- [ ] Lecture config_json actuel flag_geneve
- [ ] Script SQL d ajout des 5 templates
- [ ] Fonction TS validateBrandCharter
- [ ] Test : SlideRenderer affiche correctement
- [ ] Test : Export PNG aux bonnes dimensions

---

## CHANGELOG

| Version | Date | Changements |
|---------|------|-------------|
| 1.0 | 27 mai 2026 | Document initial Sprint 1 |