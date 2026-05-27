/**
 * Sprint 2.5 - Generation des templates video par plateforme
 *
 * 6 nouveaux templates orientes plateforme :
 *   - video_instagram_reel    (9:16, marges UI Reel)
 *   - video_tiktok            (9:16, marges UI TikTok)
 *   - video_youtube_shorts    (9:16, marges minimales)
 *   - video_instagram_square  (1:1)
 *   - video_linkedin_square   (1:1)
 *   - video_youtube           (16:9, cinema)
 *
 * Usage : npx tsx scripts/generate-video-platforms.ts
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// SPECS PAR PLATEFORME
// ============================================================

type VideoPlatformSpec = {
  templateKey: string;
  format: "9_16" | "1_1" | "16_9";
  dimensions: { width: number; height: number };
  marginBottom: number;
  fontSize: number;
  padding: number;
  description: string;
};

const PLATFORM_SPECS: VideoPlatformSpec[] = [
  {
    templateKey: "video_instagram_reel",
    format: "9_16",
    dimensions: { width: 1080, height: 1920 },
    marginBottom: 320,
    fontSize: 56,
    padding: 16,
    description: "Instagram Reel - UI Reel : like/comment/share/save sur la droite, description en bas",
  },
  {
    templateKey: "video_tiktok",
    format: "9_16",
    dimensions: { width: 1080, height: 1920 },
    marginBottom: 380,
    fontSize: 56,
    padding: 16,
    description: "TikTok - UI laterale (icones droite), description haut et bas",
  },
  {
    templateKey: "video_youtube_shorts",
    format: "9_16",
    dimensions: { width: 1080, height: 1920 },
    marginBottom: 200,
    fontSize: 56,
    padding: 16,
    description: "YouTube Shorts - UI minimale, plus de place pour le contenu",
  },
  {
    templateKey: "video_instagram_square",
    format: "1_1",
    dimensions: { width: 1080, height: 1080 },
    marginBottom: 80,
    fontSize: 48,
    padding: 14,
    description: "Instagram Feed Video - Carre, marge bas pour caption",
  },
  {
    templateKey: "video_linkedin_square",
    format: "1_1",
    dimensions: { width: 1200, height: 1200 },
    marginBottom: 100,
    fontSize: 52,
    padding: 16,
    description: "LinkedIn Video - Carre 1200x1200 pour qualite, marges generales",
  },
  {
    templateKey: "video_youtube",
    format: "16_9",
    dimensions: { width: 1920, height: 1080 },
    marginBottom: 80,
    fontSize: 56,
    padding: 18,
    description: "YouTube standard - Horizontal cinema, sous-titres bas",
  },
];

// ============================================================
// TEMPLATE GENERATION
// ============================================================

function generateVideoTemplate(spec: VideoPlatformSpec): any {
  return {
    fps: 30,
    intros: [],
    outros: [],
    dimensions: spec.dimensions,
    allowedModes: [
      "studio_clean",
      "voice_music",
      "field_event",
      "premium_demux",
    ],
    subtitleStyle: {
      color: "#FFFFFF",
      padding: spec.padding,
      fontSize: spec.fontSize,
      position: "bottom",
      fontFamily: "Helvetica Neue Bold, Arial Black, sans-serif",
      lineHeight: 1.2,
      marginBottom: spec.marginBottom,
      letterSpacing: 0,
      backgroundColor: "rgba(0, 0, 0, 0.85)",
    },
    colorGradingLUT: null,
    audioBrandJingle: null,
    // Metadata Sprint 2.5
    platform: spec.templateKey.replace("video_", ""),
    description: spec.description,
  };
}

// ============================================================
// MAIN
// ============================================================

console.log("Generation des templates video par plateforme...");
console.log("");

const templates: Record<string, any> = {};

for (const spec of PLATFORM_SPECS) {
  console.log(`  - ${spec.templateKey} (${spec.dimensions.width}x${spec.dimensions.height}, marginBottom: ${spec.marginBottom})`);
  templates[spec.templateKey] = generateVideoTemplate(spec);
}

console.log("");
console.log("=== Statistiques ===");
console.log(`Templates : ${Object.keys(templates).length}`);
console.log(`Formats techniques :`);
console.log(`  - 9:16 (${PLATFORM_SPECS.filter(s => s.format === "9_16").length})`);
console.log(`  - 1:1  (${PLATFORM_SPECS.filter(s => s.format === "1_1").length})`);
console.log(`  - 16:9 (${PLATFORM_SPECS.filter(s => s.format === "16_9").length})`);

// Sauvegarder JSON
const outputJson = path.join(__dirname, "video-platforms-output.json");
fs.writeFileSync(outputJson, JSON.stringify(templates, null, 2));
console.log("");
console.log(`OK JSON genere : ${outputJson}`);
console.log(`   Taille : ${(fs.statSync(outputJson).size / 1024).toFixed(1)} KB`);