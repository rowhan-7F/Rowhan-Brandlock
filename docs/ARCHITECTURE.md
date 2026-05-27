# ROWHAN BRANDLOCK - Architecture Reference

> Document principal de reference pour comprendre l architecture complete du projet.  
> Pattern luxe : "Architecture documented = future-proof"  
> Derniere mise a jour : 27 mai 2026 (V1.2 - post Sprint 1)

---

## TABLE DES MATIERES

1. [Vision Produit](#1-vision-produit)
2. [Quick Start](#2-quick-start)
3. [Domaines Metier](#3-domaines-metier)
4. [Architecture Template-Driven](#4-architecture-template-driven)
5. [Diagrammes de Flow](#5-diagrammes-de-flow)
6. [Flow Projet Carousel](#6-flow-projet-carousel)
7. [Rendu Slide (SlideRenderer)](#7-rendu-slide-sliderendertsx)
8. [Export (exportCarousel.ts)](#8-export-exportcarouseltsx)
9. [Map des API Routes](#9-map-des-api-routes-50-routes)
10. [Securite (RLS)](#10-securite-rls-supabase)
11. [Architecture Multi-Format V1](#11-architecture-multi-format-deploye-sprint-1)
12. [Brand Charter Validation](#12-brand-charter-validation)
13. [Roadmap V1](#13-roadmap-v1-sprints)
14. [Patterns Luxe](#14-patterns-luxe-a-suivre)
15. [Points a Ameliorer V2+](#15-points-a-ameliorer-v2)
16. [Dependances](#16-dependances-key)
17. [Environnement Dev](#17-environnement-dev)
18. [Conventions](#18-conventions)
19. [FAQ / Troubleshooting](#19-faq--troubleshooting)
20. [Exemples Concrets](#20-exemples-concrets)
21. [Glossaire](#21-glossaire)
22. [Contact](#22-contact--ownership)

---

## 1. VISION PRODUIT

Rowhan BrandLock = SaaS B2G luxe Suisse pour studios graphiques institutionnels.

- Multi-tenant : chaque client a son espace
- Multi-roles : super_admin, tenant_admin, graphist
- Workflow : Brief -> Creation -> Validation -> Export
- Stack : Next.js 16, React 19, Tailwind 4, Supabase, Zustand, TypeScript

---

## 2. QUICK START

### 2.1 Pre-requis
- Node.js 20+
- npm 10+
- Compte Supabase (projet ocxdtgwjlkaxngvkadob)
- Compte Vercel

### 2.2 Lancement local

```bash
git clone git@github.com:rowhan-7F/Rowhan-Brandlock.git
cd brandlock-ia
npm install

# .env.local doit contenir :
# NEXT_PUBLIC_SUPABASE_URL=https://ocxdtgwjlkaxngvkadob.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
# SUPABASE_SERVICE_ROLE_KEY=<key>

npm run dev
```

### 2.3 Comptes test

| Role         | Email                       | Password         | Tenant       |
|--------------|-----------------------------|-------------------|--------------|
| super_admin  | admin@rowhan.com            | qwertz123456      | -            |
| tenant_admin | sauter.fabien@gmail.com     | 123456qwertz      | flag_geneve  |

### 2.4 Commandes

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Build production
npm run lint         # ESLint
npx tsx scripts/...  # Executer un script TS
git push origin feat/video-phase-1:main --force  # Push prod
```

### 2.5 URLs

- Prod : https://rowhan-brandlock.vercel.app
- Supabase : https://supabase.com/dashboard/project/ocxdtgwjlkaxngvkadob
- GitHub : https://github.com/rowhan-7F/Rowhan-Brandlock

---

## 3. DOMAINES METIER

### 3.1 Multi-tenant (core)
- tenant_configs : config_json contient TOUT (brand, fonts, templates)
- tenant_config_history : audit trail immutable (trigger auto)
- user_profiles : roles + permissions par tenant

### 3.2 Projets Carousel
- studio_projects : projets carousel (images)
- studio_tasks : briefs
- project_comments : feedback admin/graphiste
- brief_attachments : pieces jointes
- Render : SlideRenderer + exportCarousel.ts

### 3.3 Projets Video
- studio_video_projects : projets video
- studio_video_render_jobs : queue distribuee
- Format enum strict : 9_16, 1_1, 16_9

### 3.4 Brand Assets
- brand_images : bibliotheque tenant (tags, mood, faces)
- brand_video_assets : overlays intro/outro
- brand_video_asset_backgrounds : backgrounds video

### 3.5 Cross-cutting
- notifications, prospect_messages, feedback_reports
- metric_events + usage_events (tracking)

---

## 4. ARCHITECTURE TEMPLATE-DRIVEN

### 4.1 Structure tenant_configs.config_json

```json
{
  "tenant": { "id", "name", "tier", "compliance" },
  "brandIdentity": {
    "colors": { "brandPrimary", "brandSecondary", "textLight", "textDark" },
    "fonts": { "titleFont", "bodyFont" },
    "assets": { "logoColor", "logoWhite", "quoteMark", "annotationCircle" }
  },
  "transcription": { "language", "replacements", "preferredEngine" },
  "contentTaxonomy": { "badges": [] },
  "exportTemplates": {
    "carrousel_instagram": { ... },
    "carrousel_instagram_square": { ... },     // SPRINT 1
    "carrousel_linkedin_square": { ... },      // SPRINT 1
    "carrousel_instagram_story": { ... },      // SPRINT 1
    "carrousel_tiktok": { ... },               // SPRINT 1
    "carrousel_facebook": { ... },             // SPRINT 1
    "video_square_1_1": { ... },
    "video_story_9_16": { ... },
    "video_landscape_16_9": { ... }
  }
}
```

### 4.2 Variant/SubVariant
- inputs : champs de saisie
- components : composants atomiques de rendu
- layoutRules.safeZonesPx
- layoutRules.backgroundFilter

### 4.3 Atomic Components (slideComponents.tsx - 37 KB)
titleBlock, badge, quoteBlock, statValue, barChart, pieChart, backgroundMedia, foregroundImage, paperBackground, handwrittenAnnotation, detailsBox, etc.

---

## 5. DIAGRAMMES DE FLOW

### 5.1 Architecture generale
[Super Admin] -> [tenant_configs] -> [Tenants]
|
+-------+-------+
|       |       |
v       v       v
Admin Graphist Library
|       |       |
v       v       v
[tasks] -> [projects] -> [brand_images]
|
v
[Validation]
|
v
[Export ZIP]

### 5.2 Flow Brief -> Project -> Export
ADMIN              GRAPHISTE              ADMIN
| Create brief      |                     |
|---> studio_tasks  |                     |
|   Notification    |                     |
+------------------>|                     |
| Open + create       |
|---> studio_projects |
|                     |
| Edit autosave 2s    |
|---> PATCH /save     |
|                     |
| Submit              |
|---> status=pending  |
|                     |
| Review
|---> approve/reject
|     + Trigger SQL
|     -> task.completed
|
| Download ZIP
|---> html-to-image + JSZip

### 5.3 Flow Multi-Format (V1 Sprint 1+2+3)
GRAPHISTE clique "Nouveau projet"
|
v
[Modal] : choix format primary
|
v
[Studio editor]
|
| Selecteur formats actifs :
| [x] IG Feed (1080x1350)
| [x] IG Story (1080x1920)
| [x] LinkedIn (1200x1200)
|
v
[Render preview par format]
|
v
[Export multi-format ZIP]
|
+-- project-slug/
+-- carrousel_instagram/slide-NN.png
+-- carrousel_instagram_story/slide-NN.png
+-- carrousel_linkedin_square/slide-NN.png

---

## 6. FLOW PROJET CAROUSEL

1. Admin POST /api/admin/tasks -> studio_tasks (open) -> notification graphiste
2. Graphiste POST /api/studio/projects -> studio_projects (templateKey)
3. Edit dans /studio/[projectId] (useStudioProject debounce 2s) -> PATCH /save
4. Submit : PATCH /save (status=pending_approval) -> notification admin
5. Admin POST /api/studio/projects/[id]/review (decision=approve)
   -> Trigger SQL auto_complete_tasks_on_project_finished -> task=completed
6. Export : exportCarouselAsZip() -> html-to-image -> JSZip -> downloadBlob

---

## 7. RENDU SLIDE (SlideRenderer.tsx)

```typescript
type SlideRendererProps = {
  config: any;           // tenant.config_json
  variant: string;
  subVariant?: string;
  inputValues: Record<string, any>;
  templateKey?: string;  // KEY : determine le format !
  scale?: number;        // 0.25 preview, 1.0 export
  showSafeZones?: boolean;
};
```

Lit config.exportTemplates[templateKey] -> dimensions, layoutRules, components, variants.
Le templateKey est le PIVOT : changer templateKey = changer de format de rendu.

---

## 8. EXPORT (exportCarousel.ts)

### Pipeline
exportCarouselAsZip(options):
STEP 1 : prefetchImagesInContainer (CORS -> dataURL)
STEP 2 : waitForFonts (document.fonts.ready + 200ms)
STEP 3 : Pour chaque slide -> html-to-image.toPng + JSZip
STEP 4 : zip.generateAsync -> Blob -> downloadBlob

### Extension multi-format propose (Sprint 3)

```typescript
async function exportMultiFormatAsZip({ projectTitle, formats }) {
  const zip = new JSZip();
  const master = zip.folder(slugify(projectTitle));
  
  for (const fmt of formats) {
    const sub = master.folder(fmt.formatKey);
    await prefetchImagesInContainer(fmt.container);
    await waitForFonts();
    
    const slides = fmt.container.querySelectorAll("[data-export-slide]");
    for (let i = 0; i < slides.length; i++) {
      const dataUrl = await toPng(slides[i], { width: fmt.width, height: fmt.height });
      sub.file(`slide-${String(i+1).padStart(2,"0")}.png`, dataUrl.split(",")[1], { base64: true });
    }
  }
  
  return zip.generateAsync({ type: "blob" });
}
```

---

## 9. MAP DES API ROUTES (50 routes)

### Admin (tenant_admin)
- /api/admin/brand-assets [GET]
- /api/admin/brand-assets/[id]/backgrounds [POST, PATCH, DELETE]
- /api/admin/briefs/[taskId]/attachments [GET, POST, DELETE]
- /api/admin/briefs/[taskId]/images [GET, POST]
- /api/admin/library [GET, PATCH, DELETE]
- /api/admin/tasks [GET, POST, PATCH, DELETE]
- /api/admin/team [GET, POST, DELETE]

### Studio carousel
- /api/studio/projects [GET, POST, GET-by-id, DELETE]
- /api/studio/projects/[id]/comments [GET, POST]
- /api/studio/projects/[id]/review [POST]
- /api/studio/projects/[id]/save [PATCH]
- /api/studio/projects/[id]/transcribe [POST]
- /api/studio/upload [POST]

### Studio video
- /api/studio/video/projects [POST, PATCH, DELETE]
- /api/studio/video/projects/[id]/brand-assets [GET]
- /api/studio/video/projects/[id]/brolls [GET, POST, PATCH, DELETE, upload-url]
- /api/studio/video/projects/[id]/comments [GET, POST]
- /api/studio/video/projects/[id]/render [POST]
- /api/studio/video/projects/[id]/review [POST]
- /api/studio/video/projects/[id]/submit [POST]
- /api/studio/video/projects/[id]/transcribe [POST]
- /api/studio/video/projects/[id]/upload [POST]
- /api/studio/video/projects/[id]/voiceover [POST, DELETE, upload-url]
- /api/studio/video/render-jobs/[id] [GET]

### Super admin
- /api/super-admin/analytics [GET]
- /api/super-admin/bugs [GET, POST, PATCH, DELETE]
- /api/super-admin/clients/[tenantId]/brand-assets [GET, POST, PATCH, DELETE, backgrounds]
- /api/super-admin/prospects [GET, POST, PATCH, DELETE, convert]
- /api/super-admin/tenants [GET, POST, GET-by-id, DELETE]

### Cross-cutting
- /api/notifications [GET, PATCH, DELETE]
- /api/feedback [GET, POST, PATCH, DELETE]
- /api/library [GET, upload]
- /api/generate [POST]

---

## 10. SECURITE (RLS Supabase)

### Pattern multi-tenant

```sql
tenant_id = (
  SELECT user_profiles.tenant_id
  FROM user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1
)
OR is_super_admin()
```

### Roles
- super_admin : acces ALL via is_super_admin()
- tenant_admin : son tenant uniquement
- graphist : meme tenant + filtre assigned_to dans tasks

### Storage buckets
- brand-libraries : images
- video-brolls : brolls
- video-voiceovers : audio

---

## 11. ARCHITECTURE MULTI-FORMAT (DEPLOYE SPRINT 1)

### 11.1 Templates en DB (flag_geneve - 10 templates V1.3)

**CAROUSELS (4 formats - images statiques)** :

| Format Key                  | Dimensions  | Aspect | Usage         |
|-----------------------------|-------------|--------|---------------|
| carrousel_instagram         | 1080x1350   | 4:5    | IG Feed       |
| carrousel_instagram_square  | 1080x1080   | 1:1    | IG Square     |
| carrousel_linkedin_square   | 1200x1200   | 1:1    | LinkedIn      |
| carrousel_facebook          | 1200x627    | 1.91:1 | FB Link       |

**VIDEOS (6 formats orientes plateforme - Sprint 2.5)** :

| Format Key              | Format | Dimensions  | marginBottom | Usage          |
|-------------------------|--------|-------------|--------------|----------------|
| video_instagram_reel    | 9_16   | 1080x1920   | 320          | IG Reel        |
| video_tiktok            | 9_16   | 1080x1920   | 380          | TikTok         |
| video_youtube_shorts    | 9_16   | 1080x1920   | 200          | YT Shorts      |
| video_instagram_square  | 1_1    | 1080x1080   | 80           | IG Feed Video  |
| video_linkedin_square   | 1_1    | 1200x1200   | 100          | LinkedIn Video |
| video_youtube           | 16_9   | 1920x1080   | 80           | YouTube        |

**Architecture decouplee Sprint 2.5** :
- `format` (enum strict 9_16/1_1/16_9) -> worker render
- `platform` (6 plateformes UX) -> safeZones + subtitleStyle
- `templateKey = video_<platform>` -> stockage state_json
- Mapping deterministe : `VIDEO_PLATFORM_TO_FORMAT[platform]`

### 11.2 SafeZones par format

| Format                     | top | right | bottom | left |
|----------------------------|-----|-------|--------|------|
| carrousel_instagram        | 120 | 90    | 180    | 90   |
| carrousel_instagram_square | 80  | 80    | 80     | 80   |
| carrousel_linkedin_square  | 90  | 90    | 120    | 90   |
| carrousel_instagram_story  | 250 | 80    | 250    | 80   |
| carrousel_tiktok           | 200 | 200   | 300    | 80   |
| carrousel_facebook         | 60  | 60    | 60     | 60   |

### 11.3 Generation (Sprint 1)

- scripts/generate-social-templates.ts : genere les 5 templates par adaptation
- scripts/apply-social-templates.ts : applique via supabase-js
- scripts/test-brand-charter.ts : tests automatiques

### 11.4 Extension state_json (Sprint 2 propose)

```typescript
type ProjectStateJsonV2 = {
  templateKey: string;               // Format PRIMARY
  slides: SlideState[];
  activeFormats?: string[];          // Formats actifs
  formatValidations?: {
    [formatKey: string]: {
      status: "draft" | "pending" | "approved" | "rejected";
      validatedBy?: string;
      validatedAt?: string;
    };
  };
};

type SlideStateV2 = SlideState & {
  formatOverrides?: {
    [formatKey: string]: {
      inputs?: Partial<Record<string, SlideInputValue>>;
    };
  };
};
```

---

## 12. BRAND CHARTER VALIDATION

Fonction : src/lib/brandCharterValidation.ts

```typescript
import { validateBrandCharter, ALL_FORMAT_KEYS } from "@/lib/brandCharterValidation";

const result = validateBrandCharter("carrousel_instagram_square", tenantConfig);
// { valid: true, errors: [], warnings: [] }

// Pour valider tous les formats :
const report = validateTenantConfig("flag_geneve", tenantConfig);
// { tenantId, globalValid, formats: [...] }
```

### Verifications
- brandIdentity (colors brandPrimary, textLight)
- fonts (titleFont, bodyFont)
- Logos (warning si absent)
- Dimensions du template
- slideVariants requis (intro, content, outro)
- subVariants : inputs, components, safeZonesPx

### Etat actuel (verifie 27 mai 2026)
flag_geneve : 9/9 formats valides, 0 erreur, 0 warning

---

## 13. ROADMAP V1 (SPRINTS)

### Sprint 1 : Templates DB + Validation (DONE - 27 mai 2026)
- [x] 5 nouveaux templates dans config_json
- [x] Reutilisation slideVariants existants
- [x] SafeZones adaptees par format
- [x] Fonction TS validateBrandCharter
- [x] Tests automatiques

### Sprint 2 : Multi-format carousel (DONE - 27 mai 2026)
- [x] Modal "Nouveau projet carousel" avec 4 formats
- [x] Cleanup 9 -> 7 templates (story/tiktok carousel supprimes)
- [x] Validation TS 7/7 OK

### Sprint 2.5 : Video Platforms (DONE - 27 mai 2026)
- [x] Type VideoPlatform + mapping VIDEO_PLATFORM_TO_FORMAT
- [x] 6 templates video par plateforme en DB
- [x] Modal video 6 plateformes (au lieu de 3 formats)
- [x] API derive format depuis platform
- [x] Migration 57 projets existants
- [x] Validation TS 10/10 OK

### Sprint 3 : Export multi-format (PROPOSE)
- [ ] Modal export multi-format (checkboxes)
- [ ] exportMultiFormatAsZip
- [ ] UI admin status par format
- [ ] formatValidations dans state_json
- [ ] Apercu safeZones dans le selecteur de plateforme

### Sprint 3 : Export + validation par format
- [ ] Modal export multi-format (checkboxes)
- [ ] exportMultiFormatAsZip
- [ ] UI admin status par format
- [ ] formatValidations dans state_json

---

## 14. PATTERNS LUXE A SUIVRE

### 14.1 Race protection
useStudioProject.ts : reset timer/state au changement projectId, cleanup unmount, double-check projectId au save.

### 14.2 Business rules in DB (triggers)
auto_complete_tasks_on_project_finished (carousel) + auto_complete_tasks_on_video_finished (video) + trg_archive_tenant_config.

### 14.3 Data integrity par JSON
Tout dans state_json/config_json. Audit trail via tenant_config_history.

### 14.4 Composants atomiques
AdminMobileHeader : 1 composant N pages. Modifications futures = 1 endroit.

### 14.5 Polymorphisme
ProjectMessagesIcon : prop projectType. Routing API automatique.

### 14.6 Idempotence
Scripts PowerShell : check existence avant insertion.

### 14.7 supabase-js > SQL fragile (Sprint 1)
Pour les operations complexes sur jsonb gigantesque, supabase-js evite les problemes de parsing.

---

## 15. POINTS A AMELIORER (V2+)

### 15.1 Tables LEGACY (a migrer)
- client_projects (3 rows, inactif)
- brand_kits (3 rows, inactif)
- publicity_creations (2 rows, inactif)

### 15.2 Asymetries
- studio_projects.status : text -> enum
- studio_projects.task_id : pas de FK
- Symetrie carousel/video

### 15.3 Performance
- Optimiser logo.gif footer (35MB -> 2MB)
- Index GIN sur jsonb
- Cache CDN sur exports

### 15.4 UX
- Mobile responsive sur super admin
- Domain custom rowhan.ch
- Tests E2E (Playwright)

### 15.5 Securite (audit 8 phases)
Secrets, Auth, Rate limiting, RLS, XSS/CSRF, Uploads, Headers HTTP, npm audit.

---

## 16. DEPENDANCES KEY

- html-to-image : export PNG canvas
- JSZip : ZIP generation
- embla-carousel-react : carousel UI
- lucide-react : icones
- Tailwind 4 : styling
- Supabase : DB + Auth + Storage + Realtime
- Zustand : state management
- Next.js 16 : framework (Turbopack)
- dotenv : env vars (scripts)

---

## 17. ENVIRONNEMENT DEV

- Dossier : C:\Users\saute\brandlock-ia
- GitHub : rowhan-7F/Rowhan-Brandlock
- Vercel : rowhan-brandlock.vercel.app
- Supabase : ocxdtgwjlkaxngvkadob

---

## 18. CONVENTIONS

### Naming
- React : PascalCase.tsx
- Utils : camelCase.ts
- API : route.ts dans dossier [param]

### Style
- Tailwind 4 (pas de @apply)
- Inline style pour couleurs dynamiques
- globals.css minimal

### Couleurs brand
- bordeaux : #B11E2F
- ink : #181614
- cream : #F5F1EA
- warmGray : #807972

### Logique
- Mobile-first (sm:, md: desktop)
- Race protection systematique
- Idempotence scripts
- supabase-js > SQL pour jsonb gigantesque

---

## 19. FAQ / TROUBLESHOOTING

### Module not found
Verifier le fichier existe. Si non, le recreer.

### RLS policy violation
Verifier user_profiles.tenant_id et role.

### Token expired
JWT expire apres 1h. Logout + relogin.

### Export bloque CORS
Verifier buckets publics. Verifier prefetchImagesInContainer.

### Project approved bloque
Trigger SQL bloque modifs. C est normal (data integrity).

### SQL UPDATE qui fail silencieusement
Eviter $json$ pour jsonb gigantesque. Utiliser supabase-js a la place.
Pattern utilise dans Sprint 1 : scripts/apply-social-templates.ts.

### Lancer un script TS
```bash
npx tsx scripts/<nom>.ts
```

### Verifier l etat des templates
```sql
SELECT 
  jsonb_object_keys(config_json->'exportTemplates') AS templates
FROM tenant_configs
WHERE tenant_id = 'flag_geneve'
ORDER BY 1;
```

---

## 20. EXEMPLES CONCRETS

### state_json projet FILIPI (carousel)

```json
{
  "slides": [
    {
      "id": "slide_1779836697503_ibal1o5",
      "variant": "intro",
      "subVariant": "classic",
      "inputs": {
        "titleText": { "kind": "text", "value": "Alors Alors Alors..." },
        "badgeLabel": { "kind": "select", "value": "Mobilite" },
        "backgroundMedia": { "kind": "image", "value": { "url": "..." } }
      }
    }
  ],
  "templateKey": "carrousel_instagram"
}
```

### Output ZIP actuel
project-slug/
slide-01.png  (1080x1350)
slide-02.png

### Output ZIP multi-format (Sprint 3)
project-slug/
carrousel_instagram/
slide-01.png (1080x1350)
carrousel_instagram_story/
slide-01.png (1080x1920)
carrousel_linkedin_square/
slide-01.png (1200x1200)

---

## 21. GLOSSAIRE

| Terme              | Definition |
|--------------------|------------|
| Tenant             | Client de la plateforme (canton, ville, institution) |
| Super admin        | Anthropic / Rowhan team |
| Tenant admin       | Admin client, valide les projets |
| Graphiste          | Studio designer qui cree les projets |
| Brief              | Demande creation (studio_tasks) |
| Project            | Carousel ou video en cours |
| Slide              | Une image d un carousel |
| Variant            | Type de slide (intro, content, stat, quote, outro) |
| SubVariant         | Sous-type (classic, paper, bar_chart, etc.) |
| Atomic component   | Element reutilisable du SlideRenderer |
| Template           | Combinaison format + variants disponibles |
| Format             | Dimension cible (IG Feed 1080x1350, etc.) |
| Safe zone          | Zone centrale ou contenu critique va |
| state_json         | JSON d un projet |
| config_json        | JSON de la charte tenant |
| RLS                | Row Level Security (Postgres) |
| Trigger SQL        | Fonction Postgres auto sur INSERT/UPDATE |
| Race condition     | Bug etat incoherent |
| Debounce           | Attendre N ms avant d agir |

---

## 22. CONTACT / OWNERSHIP

- Founder : Fabien Sauter
- Email : sauter.fabien@gmail.com
- Stack : Next.js + Supabase + Vercel
- Branche dev : feat/video-phase-1
- Branche prod : main (auto-deploy Vercel)

---

## CHANGELOG

| Version | Date         | Changements |
|---------|--------------|-------------|
| 1.0     | 27 mai 2026  | Document initial |
| 1.1     | 27 mai 2026  | + Quick start, FAQ, exemples, glossaire, diagrammes |
| 1.2     | 27 mai 2026  | + Sprint 1 complete (multi-format DB + validation) |
| 1.2.1   | 27 mai 2026  | + Sprint 2 (UI modal carousel 4 formats) |
| 1.3     | 27 mai 2026  | + Sprint 2.5 (Video Platforms - 10 templates, decouplage format/platform) |