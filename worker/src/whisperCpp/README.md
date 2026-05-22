# Whisper.cpp Wrapper — Node TypeScript API

Wrapper TypeScript autour du binaire `whisper-cli.exe` pour transcription
audio locale. Utilisé par le job `transcribe` du worker.

## 📁 Structure


worker/src/whisperCpp/
├── types.ts             # Types stricts (WhisperCppResult, Token, Segment)
├── config.ts            # Paths binaire + modèle + KNOWN_HALLUCINATIONS_FR
├── parseOutput.ts       # Parse JSON brut + reconstructWordsFromTokens
├── runWhisperCpp.ts     # Spawn process + capture progress
├── index.ts             # Barrel export
└── README.md            # Ce fichier

## 🚀 Usage de base

```typescript
import { runWhisperCpp } from "./whisperCpp/index.js";

const result = await runWhisperCpp({
  audioPath: "/path/to/audio.wav",   // WAV 16kHz mono recommandé
  language: "fr",                     // ou "auto"
  threads: 16,                        // CPU threads (sweet spot)
  outputDir: "/tmp/job-xxx/",
  outputBasename: "whisper_output",   // sans extension
  onProgress: (percent) => {
    console.log(`Progress: ${percent}%`);
  },
});

console.log(result.language);         // "fr"
console.log(result.duration_seconds); // 92.42
console.log(result.segments.length);  // 21
console.log(result.hallucinations_filtered); // 1
console.log(result.text);             // texte complet
console.log(result.segments[0].text); // 1er segment
console.log(result.segments[0].tokens); // tokens avec timing précis
```

## 🔧 Configuration via .env

```bash
# Optionnel — par défaut = chemins relatifs depuis worker/
WHISPER_CPP_BINARY_PATH=/custom/path/to/whisper-cli
WHISPER_CPP_MODEL_PATH=/custom/path/to/ggml-large-v3.bin
```

Sans ces variables, le wrapper utilise :
- Windows : `worker/whisper-cpp/bin/whisper-cli.exe`
- Linux : `worker/whisper-cpp/bin/whisper-cli`

## 📐 Types principaux

```typescript
type WhisperCppResult = {
  language: string;             // "fr", "en", ...
  duration_seconds: number;
  text: string;                 // texte complet concaténé
  segments: WhisperCppSegment[];
  hallucinations_filtered: number;
  timings_ms?: { load: number; total: number };
};

type WhisperCppSegment = {
  from_ms: number;
  to_ms: number;
  text: string;
  tokens: WhisperCppToken[];    // sub-tokens BPE
};

type WhisperCppToken = {
  text: string;                 // peut être un sub-mot (" Fab", "ien")
  from_ms: number;
  to_ms: number;
  confidence: number;           // 0-1
};
```

## 🧩 Reconstruction des vrais mots

Whisper tokenize en BPE (sub-tokens). Pour avoir les vrais mots :

```typescript
import { reconstructWordsFromTokens } from "./whisperCpp/index.js";

const realWords = reconstructWordsFromTokens(result.segments[0].tokens);
// [
//   { word: "Bonjour,",  start_ms: 1000, end_ms: 1550, confidence: 0.97 },
//   { word: "je",        start_ms: 2050, end_ms: 2120, confidence: 0.99 },
//   { word: "m'appelle", start_ms: 2120, end_ms: 2530, confidence: 0.99 },
//   { word: "Fabien",    start_ms: 2840, end_ms: 3020, confidence: 1.00 },
// ]
```

**Règles de reconstruction** :
- Token commençant par espace = nouveau mot
- Autres = suite du mot précédent
- Ponctuation isolée (`,`, `.`, `!`, `?`) attachée au mot précédent mais
  **n'écrase pas `end_ms`** (sinon les silences réels sont perdus)

## 🛡️ Filtrage des hallucinations

Le wrapper filtre automatiquement les hallucinations FR connues :
- "Sous-titrage Société Radio-Canada"
- "Merci d'avoir regardé"
- "N'oubliez pas de vous abonner"
- "Sous-titres Amara.org"

Voir `KNOWN_HALLUCINATIONS_FR` dans `config.ts` pour la liste complète.
Pour ajouter une nouvelle hallucination, append un regex à cette liste.

## ⚡ Performances typiques

Pour ~94s d'audio FR sur Win 11 CPU 16 threads :

## 🧪 Scripts de test

```bash
# Test parser JSON (rapide, pas de spawn binaire)
npx tsx scripts/test-whisper-parser.ts

# Test E2E spawn engine (~107s)
npx tsx scripts/test-whisper-spawn.ts

# Test reconstruction des mots
npx tsx scripts/test-reconstruct.ts

# Diag des words actuels en DB pour un projet
npx tsx scripts/diag-words.ts

# Re-déclenche un job transcribe (utile si le bouton UI n'existe pas)
npx tsx scripts/trigger-retranscribe.ts <project_title>
```

## 🔮 Roadmap

- **Phase 9** : Déploiement VPS Linux Infomaniak (compile from source)
- **Phase 10** : Mode `whisper-server` daemon (cold start ~3s → ~50ms)
- **Phase X1** : Détection auto voice-off → transcribe le voice-off à la place
- **Phase X2** : Affinement IA optionnel (Gemini ou LLM local)