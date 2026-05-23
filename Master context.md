# 🇨🇭 BrandLock SaaS — MASTER CONTEXT

> **À lire EN PREMIER** dans toute nouvelle conversation Claude (ou par tout nouveau dev).
> Ce document est la **source unique de vérité** pour comprendre l'architecture,
> les conventions, les décisions et l'état actuel du projet.
>
> **Si une info de ce document contredit une autre source (training data, autre doc,
> intuition) — ce document gagne.**

---

**Date dernière mise à jour :** 23 mai 2026
**Branche active :** `feat/video-phase-1`
**HEAD commit :** `b928950 feat(brand-assets): Phase 7 V2 - Intro/Outro overlays + backgrounds`
**OS dev :** Windows 11 + Cursor IDE + PowerShell

---

## ⚡ TL;DR

BrandLock est une **SaaS B2G suisse** de génération de vidéos brandées (avec sous-titres,
intro/outro, voice-off, b-rolls, exports multi-format) avec **transcription souveraine
100% locale** via Whisper.cpp.

- **Founder :** Fabien Sauter (solo)
- **Target initial :** Canton de Genève (DIP) — 9'500 CHF/an
- **Stack :** Next.js 16.2.6 / React 19 / Tailwind 4 / Supabase / Worker Node TS + FFmpeg + Whisper.cpp
- **Différenciation luxury :** souveraineté Suisse maximale, zéro cloud externe pour IA/transcription
- **État actuel :** pipeline vidéo 100% local OK, multi-tenant solide sur `tenant_configs`, UI superadmin complète, infrastructure brand assets prête. Reste à câbler FFmpeg compose intro+video+outro dans le rendu final.

---

## 📑 SOMMAIRE

1. [Projet — Vue d'ensemble](#1-projet--vue-densemble)
2. [Stack technique complète](#2-stack-technique-complète)
3. [Personas & rôles](#3-personas--rôles)
4. [Architecture multi-tenant](#4-architecture-multi-tenant)
5. [Hiérarchie des routes (URL)](#5-hiérarchie-des-routes-url)
6. [Base de données — tables principales](#6-base-de-données--tables-principales)
7. [Buckets Supabase Storage](#7-buckets-supabase-storage)
8. [Worker Node — pipeline vidéo](#8-worker-node--pipeline-vidéo)
9. [Conventions de code & style luxury](#9-conventions-de-code--style-luxury)
10. [Pièges techniques connus](#10-pièges-techniques-connus)
11. [Phases & commits historiques](#11-phases--commits-historiques)
12. [Décisions architecturales clés](#12-décisions-architecturales-clés)
13. [TODO — Phases futures](#13-todo--phases-futures)
14. [Règles pour futur dev (humain ou IA)](#14-règles-pour-futur-dev-humain-ou-ia)

---

## 1. PROJET — Vue d'ensemble

| Aspect | Détail |
|---|---|
| **Owner** | Fabien Sauter (solo founder & dev) |
| **Positionnement** | Luxury B2G/B2B suisse, souveraineté maximale |
| **Target commercial initial** | Canton de Genève (DIP) — 9'500 CHF/an |
| **Tiers business** | `enterprise_b2g` (public), `pro_b2b` (privé), `starter` (découverte) |
| **Différenciation** | Souveraineté 🇨🇭 : zéro cloud externe pour transcription/IA |
| **Domaine** | Studio de génération de vidéos brandées (subtitles, intro/outro, voice-off, b-rolls) |
| **Formats supportés** | 9:16 (vertical), 1:1 (carré), 16:9 (horizontal) |
| **Project dir local** | `C:\Users\saute\brandlock-ia` |

### Workflow business type

```
1. Fabien (superadmin) onboarde un client → crée son tenant_config (charte, JSON)
2. Fabien upload les brand assets (intro/outro overlays) verrouillés charte
3. L'admin client + le studio interne du tenant ont accès au studio
4. Le studio crée des projets vidéo (uploads MP4 source)
5. Pipeline : extract audio → Whisper.cpp local → subtitles → render
6. Sortie : MP4 final avec intro + subtitles + b-rolls + voice-off + outro
```

---

## 2. STACK TECHNIQUE COMPLÈTE

### Frontend
- **Next.js 16.2.6** (App Router, Server Components, breaking changes vs versions précédentes — voir `AGENTS.md`)
- **React 19**
- **Tailwind CSS 4**
- **Zustand** (state management)
- **lucide-react** (icons)
- **Style luxury inline** : `font-black italic uppercase tracking-tighter`, couleurs custom inline (pas de theme.config)

### Backend / API
- **Next.js API routes** (`src/app/api/**/route.ts`)
- **Supabase** :
  - Auth (JWT-based, `auth.uid()`)
  - Postgres DB
  - Storage (buckets publics + service_role pour write)
  - Region : **Frankfurt (EU central)** — User a mentionné "Zurich" à vérifier en TODO
- **Auth helpers** : `src/lib/auth-helpers.ts` (getAuthenticatedUser, isTenantAdmin)

### Worker (pipeline vidéo)
- **Node.js + TypeScript** avec **tsx watch** (PAS `node --experimental-strip-types`)
- **FFmpeg** (CLI, via `child_process.spawn`)
- **libass** (subtitles burn)
- **Whisper.cpp v1.8.4 BLAS** (transcription locale)
  - Modèle : `ggml-large-v3.bin` (2.95 GB)
  - CPU 16 threads + BLAS
  - Pas de GPU (compat futur préservée)
  - Pas de DTW (gain négligeable vs coût perf)
- **Pas de Whisper Infomaniak** (rollback complet, voir Phase H)
- **Pas de VAD custom** (Whisper.cpp gère nativement)
- **Pas d'anchors binary search** (devenu inutile avec word-level timestamps natifs)

### Infrastructure
- **GitHub** (branche `feat/video-phase-1`)
- **VPS Infomaniak Ubuntu 24** (futur déploiement worker, Phase 9)
- **Cursor IDE** (édition + AI assist)
- **PowerShell** (terminal Windows — pièges à connaître, voir section 10)

---

## 3. PERSONAS & RÔLES

### 3.1 Schéma des rôles

```
🇨🇭 SUPERADMIN (Fabien lui-même)
   ├─ scope: "platform"
   ├─ role: "super_admin"
   ├─ Voit TOUT, gère TOUS les tenants
   ├─ Upload chartes verrouillées (brand assets templates)
   └─ Routes : /super-admin/*

👔 ADMIN CLIENT (ex: Directeur Com Canton de Genève)
   ├─ scope: "tenant"
   ├─ role: "tenant_admin"
   ├─ Voit SON tenant
   ├─ Approuve les uploads studio (BG variants, images)
   ├─ Manage ses users (futur)
   └─ Routes : /admin/tenant/*

🎨 STUDIO INTERNE (équipe créative du tenant)
   ├─ scope: "tenant"
   ├─ role: "graphist" (= "studio" dans le vocabulaire conceptuel)
   ├─ Crée projets vidéo
   ├─ Upload BG variants (en attente d'approbation admin client)
   └─ Routes : /studio/*

🔮 [FUTUR] Cross-tenant sharing
   ├─ Pattern "Marie en vacances chez Genève → Pierre studio LVMH peut éditer son projet"
   ├─ Permission via table project_collaborators (à créer)
   └─ Partage uniquement initiable par superadmin (sécurité)
```

### 3.2 Auth check pattern

```typescript
// Côté API (route.ts)
const auth = await authenticateSuperAdmin(req); // ou getAuthenticatedUser
if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
const { user, supabase } = auth;
// user.role : "super_admin" | "tenant_admin" | "graphist"
// user.scope : "platform" | "tenant"
// user.tenant_id : "flag_geneve" ou null si scope=platform
```

```typescript
// Côté UI (page.tsx ou composant)
const { data: profile } = await supabase
  .from("user_profiles")
  .select("scope, role")
  .eq("user_id", session.user.id)
  .maybeSingle();

if (profile?.scope === "platform" && profile?.role === "super_admin") {
  // Superadmin
}
```

---

## 4. ARCHITECTURE MULTI-TENANT

### 4.1 Source de vérité = `tenant_configs`

⚠️ **PIÈGE** : Il n'existe **PAS** de table `tenants` dédiée. La table maître est
`tenant_configs`. Le `tenant_id` est un slug text (ex: `"flag_geneve"`) qui sert
de PK ET de FK partout.

### 4.2 Schéma `tenant_configs`

| Colonne | Type | Notes |
|---|---|---|
| `tenant_id` | text PK | ex: "flag_geneve", "lvmh_paris" |
| `tenant_name` | text | "Canton de Genève — DIP" |
| `tier` | text | `enterprise_b2g` / `pro_b2b` / `starter` (default: `enterprise_b2g`) |
| `config_json` | jsonb | Charte complète (couleurs, logo, contacts, etc.) |
| `config_version` | text | Versioning pour rollback |
| `is_active` | boolean | Actif/inactif |
| `notes` | text | Notes internes superadmin |
| `onboarding_status` | text | default `'pending'` |
| `created_from_prospect_id` | uuid | Tracking commercial |
| `first_login_at` | timestamptz | |
| `created_by`, `created_at`, `updated_at` | | Audit |

### 4.3 Tables historiques associées

- `tenant_config_history` : versions du `config_json` (rollback possible)

### 4.4 Tenants actifs actuels (mai 2026)

| tenant_id | display_name | tier | projets vidéo |
|---|---|---|---|
| `flag_geneve` | Canton de Genève — DIP | enterprise_b2g | 26 |

---

## 5. HIÉRARCHIE DES ROUTES (URL)

### 5.1 Espace superadmin (`/super-admin/*`)

```
/super-admin/                            Dashboard superadmin
/super-admin/clients                     Liste tenants (cards + stats)
/super-admin/clients/new                 Création tenant + users (formulaire complet)
/super-admin/clients/[tenantId]          Détail tenant + users + brand assets + danger zone
/super-admin/analytics                   Analytics globales plateforme
/super-admin/bugs                        Triage bugs reportés
/super-admin/prospects                   Pipeline commercial prospects
```

### 5.2 Espace admin client (`/admin/tenant/*`)

```
/admin/tenant/                           Home admin client
/admin/tenant/library                    Library images charte (avec approbation)
/admin/tenant/projects/[projectId]       Détail projet
```

### 5.3 Espace studio (`/studio/*`)

```
/studio/                                 Liste projets du tenant
/studio/[projectId]                      Édition projet (slides)
/studio/video/[id]                       Édition projet vidéo
/video/[id]                              Player public (?)
```

### 5.4 Endpoints API

```
/api/admin/briefs/[taskId]/attachments
/api/admin/briefs/[taskId]/images
/api/admin/library                       GET/POST brand images
/api/admin/library/[imageId]             PATCH/DELETE (approve/reject)
/api/admin/tasks                         Studio tasks
/api/admin/tasks/[taskId]
/api/studio/video/projects/[id]/transcribe   Job transcribe (Whisper.cpp)
/api/studio/video/projects/[id]/render       Job render (FFmpeg)
/api/studio/video/projects/[id]              CRUD project
/api/super-admin/analytics
/api/super-admin/bugs
/api/super-admin/bugs/[id]
/api/super-admin/prospects
/api/super-admin/prospects/[id]
/api/super-admin/prospects/[id]/convert
/api/super-admin/tenants                 GET liste + POST créer (avec users atomique)
/api/super-admin/tenants/[tenantId]      GET détail + DELETE cascade
/api/super-admin/clients/[tenantId]/brand-assets                          ⭐ Phase 7 V2
/api/super-admin/clients/[tenantId]/brand-assets/[assetId]                ⭐ Phase 7 V2
/api/super-admin/clients/[tenantId]/brand-assets/[assetId]/backgrounds    ⭐ Phase 7 V2
```

> ⚠️ **NB** : Il a existé temporairement (le soir du 22/05/2026) des routes
> `/admin/superadmin/*` créées par erreur. **Rollback complet effectué**.
> Les SEULES routes superadmin valides commencent par `/super-admin/` (avec dash).

---

## 6. BASE DE DONNÉES — Tables principales

### 6.1 Tables existant en production

| Table | Description | Notes |
|---|---|---|
| `tenant_configs` | **Source de vérité** des tenants | Voir section 4 |
| `tenant_config_history` | Historique versions de `config_json` | |
| `user_profiles` | Profils users (lien auth.users) | PK = `user_id` (PAS `id`) |
| `brand_images` | Images charte du tenant | Workflow approbation |
| `brand_video_assets` ⭐ | Templates intro/outro (Phase 7 V2) | FK tenant_id → tenant_configs |
| `brand_video_asset_backgrounds` ⭐ | Variantes BG par template (Phase 7 V2) | Workflow approbation |
| `brief_attachments` | Pièces jointes briefs |  |
| `feedback_reports` | Feedbacks users |  |
| `metric_events` | Events analytics |  |
| `notifications` | Notifications users |  |
| `project_comments` | Commentaires sur projets |  |
| `studio_projects` | Projets slides (non-vidéo) | `state_json` jsonb (pas de colonne "slides") |
| `studio_tasks` | Tasks/briefs |  |
| `studio_video_projects` | Projets vidéo | `state_json` jsonb, status, source_format |
| `studio_video_render_jobs` | Jobs worker (transcribe + render) | **PAS de `tenant_id`** (déduit via `project_id`). Enum `render_job_status`: `queued/processing/completed/failed/cancelled` |
| `v_tenant_monthly_usage` | VUE (read-only) usage mensuel par tenant |  |

### 6.2 Schéma `user_profiles`

| Colonne | Type | Notes |
|---|---|---|
| `user_id` | uuid PK | Pas `id` ! Lien vers `auth.users.id` |
| `scope` | text NOT NULL | `"platform"` ou `"tenant"` |
| `tenant_id` | text NULL | NULL si platform (superadmin) |
| `role` | text NOT NULL | `"super_admin"` / `"tenant_admin"` / `"graphist"` |
| `display_name`, `email` | text | |
| `temporary_role`, `temporary_role_expires_at` | | Système rôle temporaire |
| `delegated_by` | uuid | Délégation |
| `created_at`, `updated_at` | timestamptz | |

### 6.3 Schéma `brand_video_assets` (Phase 7 V2)

```sql
CREATE TABLE brand_video_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenant_configs(tenant_id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('intro', 'outro')),
  name text NOT NULL,
  overlay_url text NOT NULL,
  overlay_filename text NOT NULL,
  overlay_format text NOT NULL CHECK (overlay_format IN ('png', 'gif', 'mov', 'webm')),
  overlay_width integer NOT NULL,
  overlay_height integer NOT NULL,
  duration_seconds numeric(6,2) NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 30),
  default_bg_url text,
  default_bg_filename text,
  default_bg_kind text CHECK (default_bg_kind IN ('video', 'image')),
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 6.4 Schéma `brand_video_asset_backgrounds` (Phase 7 V2)

```sql
CREATE TABLE brand_video_asset_backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES brand_video_assets(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES tenant_configs(tenant_id) ON DELETE CASCADE,
  name text NOT NULL,
  bg_url text NOT NULL,
  bg_filename text NOT NULL,
  bg_format text NOT NULL CHECK (bg_format IN ('mp4', 'png', 'jpg', 'jpeg', 'webp')),
  bg_kind text NOT NULL CHECK (bg_kind IN ('video', 'image')),
  width integer NOT NULL,
  height integer NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  uploaded_by_role text CHECK (uploaded_by_role IN ('superadmin', 'tenant_admin', 'graphist')),
  approved_by uuid,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 6.5 RLS policies — pattern actuel

Les policies sont basiques (service_role full + authenticated read). **Le filtrage strict
par tenant_id est fait côté API**, pas via RLS function.

> ⚠️ Pas de fonction `current_tenant_id()` SQL existante (rollback Phase 7.0).
> Si besoin futur de RLS strictes, il faudra la créer en utilisant
> `user_profiles.user_id = auth.uid()` pour extraire le tenant_id.

---

## 7. BUCKETS SUPABASE STORAGE

| Bucket | Public | Limite | MIME types autorisés |
|---|---|---|---|
| `video-sources` | privé | — | source MP4 + audio.wav extrait |
| `video-exports` | privé | — | final.mp4 rendus |
| `video-voiceovers` | — | 50 MB | audio (Phase 6A) |
| `video-brolls` | — | 100 MB | video/mp4, video/quicktime, image/png, image/jpeg, image/webp (Phase 6B) |
| `brand-video-overlays` ⭐ | public | 50 MB | image/png, image/gif, video/quicktime, video/webm |
| `brand-video-asset-backgrounds` ⭐ | public | 200 MB | video/mp4, image/png, image/jpeg, image/webp |
| `brand-images` | (?) | — | Images charte (workflow approbation) |

### 7.1 Convention de paths

```
video-sources/                  {tenant_id}/{project_id}/source.{ext}
                                {tenant_id}/{project_id}/audio.wav

video-exports/                  {tenant_id}/{project_id}/final.mp4

brand-video-overlays/           {tenant_id}/{uuid}.{ext}
brand-video-asset-backgrounds/  {tenant_id}/{asset_id}/{uuid}.{ext}
```

---

## 8. WORKER NODE — Pipeline vidéo

### 8.1 Structure

```
worker/
├─ src/
│  ├─ index.ts                     Boot worker, polling jobs
│  ├─ config.ts                    .env, clients Supabase
│  ├─ logger.ts                    log helper
│  ├─ jobs/
│  │  ├─ transcribe.ts             Job TRANSCRIBE (8 étapes)
│  │  └─ renderSubs.ts             Job RENDER (concat + burn subs + mix audio + overlay b-rolls)
│  ├─ ffmpeg/
│  │  ├─ extractAudio.ts           MP4/MP3/WAV/M4A → WAV 16kHz mono PCM
│  │  ├─ extractClip.ts            Extract sub-clip
│  │  └─ burnSubs.ts               Burn subs + voice-off mix + b-rolls overlay
│  ├─ whisperCpp/                  ⭐ Wrapper Node Whisper.cpp local
│  │  ├─ types.ts                  Types stricts (WhisperCppResult, etc.)
│  │  ├─ config.ts                 Paths binaire + modèle + KNOWN_HALLUCINATIONS_FR
│  │  ├─ parseOutput.ts            Parse JSON brut + reconstructWordsFromTokens
│  │  ├─ runWhisperCpp.ts          Spawn process + capture progress
│  │  ├─ index.ts                  Barrel export
│  │  └─ README.md                 Doc API du wrapper
│  ├─ subs/
│  │  └─ generateAss.ts            Génère .ass (silence-aware, anti-orphan, anti-flash)
│  ├─ sanitizer/
│  │  └─ apply.ts                  Apply lexique tenant
│  └─ storage/
│     ├─ download.ts               downloadFromStorage
│     └─ upload.ts                 uploadToStorage
├─ scripts/
│  ├─ test-whisper-parser.ts       Unit test parser
│  ├─ test-whisper-spawn.ts        E2E spawn engine
│  ├─ test-reconstruct.ts          Test mots reconstruits
│  ├─ diag-words.ts                Inspect words en DB
│  └─ trigger-retranscribe.ts      Re-déclenche transcribe via SQL (legacy)
├─ whisper-cpp/                    ⭐ Binaires + modèles (.gitignore)
│  ├─ bin/                         whisper-cli.exe + DLLs
│  ├─ models/                      ggml-large-v3.bin (2.95 GB)
│  ├─ samples/                     audio de test
│  └─ README.md                    Setup Windows + Linux VPS
└─ tmp/                            Working dir job-spécifique (auto-cleanup)
```

### 8.2 Job TRANSCRIBE (8 étapes)

```
1/8  Charger le projet (state_json depuis studio_video_projects)
2/8  Download media source ⭐ Phase X1 :
       - Si state_json.voiceover_audio.url → bucket video-voiceovers (priorité)
       - Sinon → video-sources (audio source MP4)
3/8  Extract audio WAV 16kHz mono PCM (FFmpeg)
4/8  Upload audio.wav vers video-sources
5/8  Whisper.cpp local (transcription)
6/8  Apply sanitizer (lexique tenant)
7/8  Save transcript en DB (state_json.transcript)
8/8  Update job complete
```

### 8.3 Pipeline subtitles (generateAss.ts) — paramètres clés

| Constante | Valeur | Effet |
|---|---|---|
| `SILENCE_FLUSH_THRESHOLD_MS` | **400** | Gap ≥ 400ms = nouveau sub-segment (vrai silence syntaxique) |
| `mergeOrphanSegments.maxMergeGapSec` | **0.40** | Fusionne orphelins si gap ≤ 400ms (aligné avec silence flush) |
| `extendShortSegments.minDurationSec` | **1.0** | Sub trop court étendu à 1s mini (anti-flash) |
| `MAX_REAL_DURATION_PER_SEGMENT` | **4.0** | Cap subdivision (Whisper.cpp donne déjà segments naturels) |
| `MAX_DURATION_PER_SEGMENT` | **3.5** | Cap dur pour buildSegmentsFromWords |
| Mini-délai apparition | **+100ms** | `seg.start + 0.10` (anti onset trop précoce vs perception auditive) |
| `FR_LINK_WORDS` malus | **+100** | Évite finir ligne 1 sur "de/le/et/à/un/d'/qu'/..." |

### 8.4 Whisper.cpp — config

```
Binaire : worker/whisper-cpp/bin/whisper-cli.exe (Windows) / whisper-cli (Linux)
Modèle  : worker/whisper-cpp/models/ggml-large-v3.bin (2.95 GB)
Args    : -m <model> -f audio.wav -l fr -ojf -of <out> -pp -t 16 -ng
          -ng = NO GPU (préserve compat futur)
          PAS de -nfa (pas de DTW)
```

### 8.5 Hallucinations FR filtrées automatiquement

Voir `KNOWN_HALLUCINATIONS_FR` dans `worker/src/whisperCpp/config.ts` :
- "Sous-titrage Société Radio-Canada"
- "Merci d'avoir regardé"
- "N'oubliez pas de vous abonner"
- "Sous-titres Amara.org"
- etc. (8 regex patterns)

### 8.6 Performance Whisper.cpp (vidéo FR 94s)

| Setup | Temps | Ratio |
|---|---|---|
| Win 11, CPU 16 threads + BLAS, no GPU | ~107s | 1.13x |
| Via Node spawn wrapper | ~138s | 1.47x |
| Avec DTW activé (NON utilisé) | ~150s | 1.60x |

---

## 9. CONVENTIONS DE CODE & STYLE LUXURY

### 9.1 Couleurs charte

```typescript
const BRAND_BORDEAUX = "#B11E2F";  // Couleur primaire principale
const BRAND_NEUTRAL  = "#1A1A1A";  // Texte fort, contrastes

// Couleurs secondaires courantes :
//   #F26522 orange (admin client)
//   #3B82F6 blue (intros)
//   #8B5CF6 purple (outros)
//   #10B981 green (success)
//   #F59E0B amber (trial / pending)
//   #EF4444 red (suspended / danger)
//   #737373 neutral-500 (archived)
```

### 9.2 Style luxury Tailwind typique

```html
<!-- Eyebrow superadmin -->
<div class="text-[10px] font-black uppercase tracking-widest text-orange-600">
  Super Administration
</div>

<!-- Titre principal luxury -->
<h1 class="text-3xl font-black italic uppercase tracking-tighter">
  Canton de Genève
</h1>

<!-- ID technique -->
<p class="text-xs font-mono text-neutral-400">flag_geneve</p>

<!-- Badge status -->
<span class="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded
             bg-green-50 text-green-700 border border-green-200">
  Active
</span>

<!-- Card luxury -->
<div class="bg-white rounded-2xl border border-neutral-200 p-5">
  ...
</div>

<!-- Bouton primaire -->
<button class="inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs
               font-bold uppercase tracking-wider rounded-lg transition shadow-sm hover:shadow-md"
        style="background-color: #B11E2F">
  Action
</button>
```

### 9.3 Icons : `lucide-react`

Toujours via import nommé :
```typescript
import { Building2, Crown, Shield, Film, Loader2, Check, X, ... } from "lucide-react";
```

Tailles typiques : `size={12}` pour badges, `size={14-16}` pour boutons, `size={18-22}` pour avatars/headers.

### 9.4 Composants existants connus

| Composant | Path | Usage |
|---|---|---|
| `AppHeader` | (?) | Props : `title`, `eyebrow`, `backHref`, `rightSlot`, `eyebrowColor`, `sticky`. **PAS `subtitle`** |
| `confirmDialog` | `@/lib/...` | Signature 2 args : `(message, { description, confirmLabel, cancelLabel, destructive })` |
| `RenderPanel` | `src/components/studio/video/RenderPanel.tsx` | Panel rendu vidéo (slider offset SUPPRIMÉ post Whisper.cpp) |
| `TranscriptPanel` | `src/components/studio/video/TranscriptPanel.tsx` | Panel transcription (bouton "Retranscrire" intégré) |
| `BrandAssetsSection` ⭐ | `src/components/admin/BrandAssetsSection.tsx` | Section Intro/Outro dans /super-admin/clients/[tenantId] (Phase 7 V2) |
| `PendingImagesValidation` | `src/components/admin/PendingImagesValidation.tsx` | Validation images charte (NON-COMMITTED actuellement) |

### 9.5 Lib utilitaires

| Lib | Path | Notes |
|---|---|---|
| Supabase client | `@/lib/supabase` | Client browser |
| Auth helpers | `@/lib/auth-helpers` | `getAuthenticatedUser`, `isTenantAdmin` |
| Toast | `@/lib/toast` | toast.success / .error |
| Current tenant hook | `@/lib/useCurrentTenant` | Hook React pour profile + tenant |
| Job status hook | `@/lib/video/transcriptStatus` | useJobStatus polling worker |
| Video types | `@/lib/video/types` | VideoProject etc. |

---

## 10. PIÈGES TECHNIQUES CONNUS

### 10.1 PowerShell

- **Brackets `[id]`** dans paths sont interprétés comme **wildcards**. Solution : `-LiteralPath`
  ```powershell
  # ❌ Casse
  Get-Content "src\app\super-admin\clients\[tenantId]\page.tsx"
  # ✅ Marche
  Get-Content -LiteralPath "src\app\super-admin\clients\[tenantId]\page.tsx"
  ```

- **Set-Content -Encoding UTF8** ajoute un **BOM** (problématique pour Node/Git).
  Solution :
  ```powershell
  [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
  ```

- **Commits multi-lignes** : éviter `-m "..."` (PowerShell foire avec `\"`).
  Utiliser un fichier temp :
  ```powershell
  $msg = @'...'@
  $msgPath = "$env:TEMP\commit-msg.txt"
  [System.IO.File]::WriteAllText($msgPath, $msg, (New-Object System.Text.UTF8Encoding $false))
  git commit -F $msgPath
  Remove-Item $msgPath
  ```

- **`-Encoding UTF8`** sur `Get-Content` parfois non-supporté selon version PS.
  Sur PS 5.1 (Windows par défaut), pas de souci. Sur PS 7+, vérifier.

### 10.2 Node Windows TLS

Pour les fetch Supabase qui foirent avec erreur TLS :
```powershell
$env:NODE_OPTIONS = "--use-system-ca"
```

### 10.3 tsx watch

- Worker utilise `tsx` (PAS `node --experimental-strip-types` qui ne supporte pas les imports .js→.ts)
- Reload peut être capricieux : toujours vérifier Terminal 2 après modif worker/

### 10.4 Cursor IDE

- **Copy-paste cassé sur gros fichiers React/JSX**. Préférer édition directe `Ctrl+A → paste → Ctrl+S` plutôt que via PowerShell pour gros fichiers
- `Ctrl+P` pour quick file picker
- `Ctrl+Shift+M` pour panel d'erreurs TypeScript

### 10.5 Supabase

- **`tenant_id` est TEXT partout, PAS UUID** (slug technique du genre `flag_geneve`)
- **`user_profiles.user_id`** est la PK, **PAS `id`** (pour FK depuis auth.uid())
- **`studio_video_render_jobs`** n'a **PAS de colonne tenant_id** (déduit via `project_id`)
- **`studio_projects`** : pas de colonne `slides`, tout dans `state_json` jsonb
- **`config_json`** dans tenant_configs : valeur JSON libre, structure non-strict, attention aux clés

### 10.6 Git

- **Windows OneDrive sync** : Desktop = `C:\Users\saute\OneDrive\Bureau\` (pas `C:\Users\saute\Desktop\`)
- **LF/CRLF warnings** : normaux sur Windows, git autocrlf gère
- **PendingImagesValidation.tsx** : modifié non-committed (volontairement laissé en l'état)

### 10.7 Whisper.cpp

- Format input préféré : **WAV 16kHz mono PCM** (FFmpeg s'occupe de la conversion)
- Tokens sont en **BPE sub-tokens** (ex: " Fab" + "ien" → "Fabien"). Toujours utiliser `reconstructWordsFromTokens()` pour avoir les vrais mots
- **Ponctuation isolée** (`,` `.` `!` `?`) attachée au mot précédent textuellement, mais **ne PAS update end_ms** (sinon les vrais silences sont perdus)
- Timing : `from_ms`/`to_ms` en millisecondes (convertir en secondes pour `generateAss`)

### 10.8 FFmpeg

- `extractAudio` accepte n'importe quel format en input (MP4, MP3, MOV, WAV, M4A...). FFmpeg gère via `-vn -acodec pcm_s16le -ar 16000 -ac 1`
- Pour overlay PNG-α : `-filter_complex overlay=...`
- Pour concat : passer par `concat demuxer` (plus robuste que `-filter_complex concat`)

---

## 11. PHASES & COMMITS HISTORIQUES

### 11.1 Phases ACCOMPLIES

| Phase | Description | Statut |
|---|---|---|
| **1-5** | Upload + transcription Whisper Infomaniak + anchors binary search + subs FFmpeg+libass + slider offset + VAD detection | ✅ Déprécié post Whisper.cpp |
| **6A** | Voice-off upload + audio mix FFmpeg amix | ✅ Actif |
| **6B** | B-rolls video/image overlay | ✅ Actif |
| **D** | Wrapper Node Whisper.cpp (5 fichiers + 2 tests) | ✅ commit `25f6475` |
| **E** | Refactor pipeline transcribe pour Whisper.cpp (extractAudio MP3→WAV, transcribe 10→8 étapes) | ✅ commit `d11933e` |
| **F** | Polish subtitles (silence-aware, anti-orphan, anti-flash, FR link words, reconstructWordsFromTokens) | ✅ commit `d11933e` |
| **H** | Cleanup code mort (708 lignes supprimées : whisper/client.ts, poll.ts, findSpeechAnchors.ts, detectSpeechStart.ts) | ✅ commit `2d7a4f9` |
| **I** | Documentation (2 README : whisper-cpp/ + whisperCpp/) | ✅ commit `0d38386` |
| **X1** | Voice-off priority pour transcription (si voice-off uploadé) | ✅ commit `a182517` |
| **UI cleanup post-migration** | Suppression slider subtitle_offset, fix label "Whisper Infomaniak" → "Whisper.cpp local" | ✅ commit `e7960da` |
| **7 V2 Brand Assets** | Tables brand_video_assets + brand_video_asset_backgrounds FK vers tenant_configs, 3 API routes, composant BrandAssetsSection, intégration UI | ✅ commit `b928950` |

### 11.2 Phases ROLLBACK (n'existent plus)

- **Phase 7.0.A + 7.0.B + 7.1 (V1)** : créée table `tenants` doublon avec `tenant_configs`. **Rollback complet effectué** (drop tables + 14 FK + fonction `current_tenant_id()`). Cause : pas vérifié l'archi existante avant de créer.
- **Routes `/admin/superadmin/*`** : doublon avec `/super-admin/*` existant. **Tout supprimé**.

### 11.3 Git log actuel (top 7)

```
b928950 (HEAD -> feat/video-phase-1) feat(brand-assets): Phase 7 V2 - Intro/Outro overlays + backgrounds
a182517 feat(worker): Phase X1 - voice-off priority pour transcription
e7960da chore(video-ui): cleanup post-migration Whisper.cpp
0d38386 docs(worker): Phase I - documentation Whisper.cpp pour future toi
2d7a4f9 chore(worker): Phase H - cleanup code mort post-migration Whisper.cpp
d11933e feat(video): Phase E+F complete - Whisper.cpp full pipeline + subtitles polish
25f6475 feat(worker): Phase D - Whisper.cpp wrapper Node complete
de4dc8a feat(video): Phase 6A+6B complete - voice-off audio mix + b-rolls overlay + format-adaptive subs
```

---

## 12. DÉCISIONS ARCHITECTURALES CLÉS

### 12.1 Migration Whisper.cpp local (Phases D-I)

**Pourquoi :** Souveraineté Suisse maximale pour B2G (Canton Genève DIP). Élimination
de la dépendance Infomaniak Whisper API qui causait du drift sur vidéos longues
(>60s, ex: Whisper compressait 92s de speech dans 28.59s).

**Comment :** Whisper.cpp v1.8.4 + modèle large-v3 + BLAS + 16 threads CPU.
Word-level timestamps natifs (~50ms précision).

**Trade-off :** ~107s pour 94s d'audio (1.13x realtime) vs ~28s pour l'API.
Acceptable car local + souverain + précis.

### 12.2 Pas de DTW

Testé en Phase C3 : DTW ajoute ~40% de temps de calcul pour gain négligeable
(±20-50ms vs ±50-200ms sans DTW). DTW nécessite `-nfa` (no flash attn) et
n'est PAS compatible GPU futur.

**Décision finale :** segment-level + tokens offsets suffisent largement.

### 12.3 `tenant_configs` comme source de vérité (NOT `tenants`)

L'archi existante du user utilise `tenant_configs(tenant_id, tenant_name, tier, config_json...)`.
Tout PK/FK pointe vers `tenant_configs.tenant_id` (text).

**Rule :** Quand on ajoute une nouvelle table avec un `tenant_id`, **TOUJOURS** FK vers
`tenant_configs(tenant_id)`, **PAS** une nouvelle table tenants.

### 12.4 Brand Assets — compositing au render time

Plutôt que des MP4 intro/outro complets auto-suffisants (V1 abandonnée), les intros/outros
sont **compositées au render time** :
- **Overlay** (PNG-α / GIF / MOV-α / WebM-α) verrouillé charte par superadmin
- **Background** (vidéo MP4 ou image) modifiable par tenant_admin/graphist (avec approbation admin client)
- FFmpeg compose les 2 + concat avec la vidéo principale

**Avantage :** Le client garde de la créativité (changer le BG) sans avoir besoin de
recompiler le template (qui reste verrouillé charte).

### 12.5 Pas de table tenants dédiée (rollback)

Tentative initiale de créer `tenants` séparée a échoué (doublon avec `tenant_configs`).
**Garde uniquement `tenant_configs`** = un seul source of truth.

### 12.6 Cross-tenant project sharing — futur, dédié, sécurisé

Pour permettre "Marie en vacances chez Genève → Pierre studio LVMH peut éditer son
projet temporairement", on créera une table `project_collaborators` :
- Partage **initiable uniquement par superadmin** (sécurité B2G)
- Avec `expires_at` pour expiration auto
- Reason explicite ("Marie en vacances jusqu'au 15/06")
- Phase dédiée future (pas dans Phase 7)

### 12.7 Studio interne au tenant (par défaut)

Chaque tenant a son propre studio interne (`scope=tenant`, `role=graphist`).
Pas de studio multi-tenant pour le moment. Le cross-tenant sharing (12.6) couvrira
les cas de délégation exceptionnelle.

---

## 13. TODO — Phases futures

### 13.1 Court terme (post-démo Genève)

| Phase | Description | Estimé |
|---|---|---|
| **7.3** | API + UI studio/admin client : upload BG variants (en attente d'approbation) | ~45 min |
| **7.4** | API + UI admin client : approbation/rejet des BGs en attente | ~30 min |
| **7.5** | Sélection intro+outro+BG dans `RenderPanel.tsx` (slot picker par projet) | ~30 min |
| **7.6** | Worker FFmpeg compose : intro overlay + concat intro+video+outro | ~60 min |
| **7.7** | Tests E2E + commit final Phase 7 | ~15 min |
| **Cross-tenant sharing** | Table `project_collaborators` + UI partage + filtres queries | ~2h |
| **Versionner migrations Supabase** | Créer `supabase/migrations/*.sql` rétroactivement (Phase 7.1 V2 + ROLLBACK) | ~1h |
| **PendingImagesValidation.tsx** | Décider : commit ce gros diff ou rollback | ~10 min |
| **Bouton "Retranscrire" en État 1** | Actuellement seulement visible quand projet déjà transcribed | ~15 min |

### 13.2 Moyen terme

| Phase | Description | Estimé |
|---|---|---|
| **Phase Brand Assets V2 CSS** | Support CSS animé via Puppeteer headless (record-to-video) pour overlays animés sans After Effects | 2-3 jours |
| **Phase X2 Affinement IA** | Option A : Gemini opt-in pour polish 95→99% (casse souveraineté). Option B : LLM local Ollama+Mistral (luxury max). | 1-2 sem |
| **Bug fix : GitHub backup repo** | Erreur "Repository not found" sur le backup auto | ~30 min |
| **Refactor : table tenants dédiée (si vraiment besoin)** | Migrer `tenant_configs` colonnes essentielles vers `tenants` propre. NON-PRIORITAIRE. | 1 jour |

### 13.3 Long terme

| Phase | Description |
|---|---|
| **Phase 9 — Deploy VPS Linux** | Infomaniak Ubuntu 24 + pm2 + compile Whisper.cpp from source (`cmake -DGGML_BLAS=1`) |
| **Phase 10 — `whisper-server` daemon** | Mode daemon réduit cold start ~3s → ~50ms (vs spawn process à chaque job) |
| **Migration Supabase région** | Vérifier "Zurich" (probablement Frankfurt EU central). Plan migration vraie infra Suisse 100% souveraine pour B2G ultra-sensible. |
| **CSS animé via Puppeteer** | Pour overlays riches sans After Effects (V2 brand assets) |
| **Multi-langue** | DE/IT support (l'archi `language_default` est prête) |
| **Plan tarifaire formalisé** | "trial", "luxury_geneve_9500", "enterprise", "custom" à matérialiser dans Stripe/facturation |

### 13.4 Idées exploratoires

- Mode "AI agent" : Claude/IA peut éditer le studio en autonomie pour le tenant
- Workflow d'approbation multi-niveaux (graphist → tenant_admin → superadmin pour des assets très sensibles)
- Export 4K + watermark "BrandLock made in 🇨🇭"
- API publique tenant pour intégrations (Zapier-like)

---

## 14. RÈGLES POUR FUTUR DEV (humain ou IA)

### 14.1 AVANT de créer un nouveau composant/page/table

1. **AUDITER l'existant** d'abord :
   ```powershell
   # Cherche les pages similaires
   Get-ChildItem -Path "src\app" -Recurse -Filter "page.tsx" | Where-Object { $_.FullName -match "<keyword>" }

   # Cherche les composants similaires
   Get-ChildItem -Path "src\components" -Recurse -Filter "*.tsx"

   # Cherche les API similaires
   Get-ChildItem -Path "src\app\api" -Recurse -Filter "route.ts"

   # Cherche les tables similaires
   SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
   ```

2. **Aligner sur les conventions existantes** :
   - Couleur charte `#B11E2F` bordeaux
   - Icons lucide-react
   - Tailwind classes luxury (voir section 9.2)
   - `Crown` icon orange pour eyebrows superadmin
   - `Shield` icon BRAND_BORDEAUX pour identité superadmin

3. **Ne JAMAIS créer une table avec son propre `tenant_id`** sans FK vers `tenant_configs(tenant_id)`.

4. **Toujours utiliser les helpers existants** :
   - Auth : `getAuthenticatedUser` (côté API) ou `authenticateSuperAdmin` (côté API superadmin)
   - Supabase : `import { supabase } from "@/lib/supabase"`
   - Toast : `import { toast } from "@/lib/toast"`

### 14.2 Encoding / Edition

- **TOUJOURS utiliser `[System.IO.File]::WriteAllText` avec UTF8Encoding(false)** pour créer des fichiers UTF-8 sans BOM
- Préférer édition directe Cursor (`Ctrl+P` → file → `Ctrl+A` → paste → `Ctrl+S`) plutôt que PowerShell `Set-Content` pour gros fichiers
- Pour les commits, **toujours fichier temp `-F`**, jamais `-m "multi\nline\nwith\\\"escapes\""`

### 14.3 SQL & migrations

- Lancer dans **Supabase SQL Editor** (web UI). Pas de `supabase/migrations/` versionné encore (TODO)
- Toujours **idempotent** : `CREATE TABLE IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`, `ON CONFLICT DO NOTHING`
- Pour drop avec dépendances : `CASCADE`
- Pour debug : `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '<motif>'`

### 14.4 Worker / Pipeline

- Tout nouveau job worker : ajouter dans `worker/src/jobs/`, hooker dans `worker/src/index.ts` (polling)
- Toujours `await updateProgress(jobId, percent, message)` à chaque étape majeure
- Hallucinations FR à filtrer ? Ajouter regex dans `KNOWN_HALLUCINATIONS_FR` (worker/src/whisperCpp/config.ts)
- Logging : `log.info()`, `log.error()`, `log.project(title, tenant_id)` (depuis `worker/src/logger.ts`)

### 14.5 UI luxury

- **Pas de subtitles** (au sens HTML `<h2>` avec long texte gris) — préférer `eyebrow` + `title`
- **Toujours** uppercase + tracking-widest sur les labels eyebrow
- **Italic + tracking-tighter** sur les gros titres (h1)
- **font-mono** sur les IDs techniques
- **rounded-2xl** sur les cards principales, **rounded-xl** sur les enfants, **rounded-lg** sur les boutons

### 14.6 Quand demander de l'aide humaine

- **Si tu hésites sur le nommage d'une nouvelle entité business** → demander
- **Si tu vas créer >3 fichiers en cascade** → présenter le plan d'abord
- **Si tu vas modifier une table en production** → confirmer
- **Si tu vas supprimer du code "qui semble inutile"** → vérifier d'abord les imports/refs

### 14.7 Ne JAMAIS

- ❌ Créer une table `tenants` séparée (existe déjà sous `tenant_configs`)
- ❌ Utiliser `/admin/superadmin/*` (mort, on utilise `/super-admin/*`)
- ❌ Réintroduire Infomaniak Whisper (souveraineté brisée)
- ❌ Réintroduire le slider `subtitle_offset` dans RenderPanel (Whisper.cpp n'a plus de drift)
- ❌ Importer `from "@/lib/auth"` ou autre alias inventé (vérifier le vrai path : `@/lib/auth-helpers`)
- ❌ Stocker du tenant_id en UUID (c'est TEXT slug, ex: "flag_geneve")
- ❌ Ajouter `tenant_id` à `studio_video_render_jobs` (n'a pas cette colonne, déduit via project)

---

## 📎 ANNEXES

### A. Variables d'environnement clés

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_URL=...                       # côté worker

# Whisper.cpp (optionnels, defaults OK)
WHISPER_CPP_BINARY_PATH=...
WHISPER_CPP_MODEL_PATH=...

# Worker
WORKER_ID=worker-local-1               # default
POLL_INTERVAL_MS=5000                  # default
TMP_DIR=./tmp
LOG_LEVEL=info

# Node Windows (TLS)
NODE_OPTIONS=--use-system-ca
```

### B. Commandes utiles

```powershell
# Worker (terminal 2)
cd worker
$env:NODE_OPTIONS = "--use-system-ca"
npx tsx watch src/index.ts

# Next.js dev (terminal 1)
npm run dev

# Re-déclencher une transcription (legacy script, préférer le bouton UI)
cd worker
$env:NODE_OPTIONS = "--use-system-ca"
npx tsx scripts/trigger-retranscribe.ts <project_title>

# Test Whisper.cpp parser
cd worker
npx tsx scripts/test-whisper-parser.ts

# Test E2E spawn engine (~107s)
npx tsx scripts/test-whisper-spawn.ts

# Inspecter words en DB
npx tsx scripts/diag-words.ts
```

### C. URLs utiles dev

```
http://localhost:3000/                     Home
http://localhost:3000/super-admin          Dashboard superadmin
http://localhost:3000/super-admin/clients  Liste tenants
http://localhost:3000/super-admin/clients/flag_geneve  Détail Genève (avec brand assets)
http://localhost:3000/studio               Studio
```

### D. Documents associés (à lire après ce MASTER)

- `worker/whisper-cpp/README.md` — Setup Whisper.cpp Windows/Linux
- `worker/src/whisperCpp/README.md` — API wrapper Node
- `AGENTS.md` — Avertissement Next.js 16.2 breaking changes
- `CLAUDE.md` — Lien vers AGENTS.md

---

## 🔚 Fin du MASTER_CONTEXT.md

> Si ce document est obsolète par rapport à la réalité du code, **la priorité est de
> mettre à jour ce document**, pas d'ignorer la divergence. Ce fichier est la mémoire
> long-terme du projet.

**Dernière vérification de cohérence :** 23 mai 2026 (Phase 7 V2 brand assets terminée)

🇨🇭 **BrandLock — souveraineté, luxury, précision.**