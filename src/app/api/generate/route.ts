import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logUsageEvent, geminiTextCost, COST_NANO_BANANA_IMAGE } from "../../../lib/usage";
import { getStockImageWithMetadata } from "../../../lib/imageSources";
import { Agent, setGlobalDispatcher } from "undici";

// Désactive la vérification TLS dans cette route — contourne l'interception SSL
// de l'antivirus (Avast/Kaspersky/etc.) qui fait du MITM sur les HTTPS sortants.
// En production sans antivirus, ces 2 lignes deviennent inutiles mais sans effet négatif.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

// === Config ===
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEXT_MODEL = 'gemini-3.1-flash-lite';
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// === Types ===
type GeminiUsage = {
  inputTokens: number;
  outputTokens: number;
  grounded: boolean;
};

// === Helpers JSON ===

function extractJsonFromResponse(text: string): any {
  try { return JSON.parse(text.trim()); } catch {}
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.substring(firstBrace, lastBrace + 1);
    try { return JSON.parse(candidate); } catch {}
  }
  throw new Error("Réponse Gemini illisible : impossible d'extraire le JSON");
}

// === Helpers Gemini Texte ===

async function callGeminiText(
  systemPrompt: string,
  useGrounding: boolean,
  pdfs?: Array<{name: string; data: string; size: number; mimeType?: string}>
): Promise<{ text: string; usage: GeminiUsage }> {
  const parts: any[] = [];

  // Ajoute les fichiers en premier (Gemini les analyse mieux dans cet ordre)
  if (pdfs && pdfs.length > 0) {
    for (const pdf of pdfs) {
      parts.push({
        inlineData: {
          mimeType: pdf.mimeType || 'application/pdf',
          data: pdf.data
        }
      });
    }
  }

  parts.push({ text: systemPrompt });

  const body: any = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.7 }
  };

  if (useGrounding) {
    body.tools = [{ googleSearch: {} }];
  } else {
    body.generationConfig.response_mime_type = "application/json";
  }

  const res = await fetch(GEMINI_TEXT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 429) throw new Error("QUOTA_EXCEEDED");
    throw new Error(data.error?.message || `Erreur Gemini ${res.status}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Réponse Gemini vide");

  const usage: GeminiUsage = {
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    grounded: useGrounding
  };

  return { text, usage };
}

async function callWithGroundingFallback(
  groundedPrompt: string,
  fallbackPrompt: string,
  pdfs?: Array<{name: string; data: string; size: number; mimeType?: string}>
): Promise<{ text: string; usage: GeminiUsage; usedFallback: boolean }> {
  try {
    const { text, usage } = await callGeminiText(groundedPrompt, true, pdfs);
    return { text, usage, usedFallback: false };
  } catch (err: any) {
    if (err.message === "QUOTA_EXCEEDED") {
      console.warn("⚠ Quota grounding épuisé, fallback non-grounded");
      const { text, usage } = await callGeminiText(fallbackPrompt, false, pdfs);
      return { text, usage, usedFallback: true };
    }
    throw err;
  }
}

// === Helper Pexels (libre de droit, gratuit) ===

async function fetchPexelsImage(keyword: string, retries = 2): Promise<string | null> {
  if (!PEXELS_API_KEY) {
    console.warn("⚠ PEXELS_API_KEY manquante");
    return null;
  }

  const cleanKeyword = encodeURIComponent(keyword.split(',')[0].trim().split(' ')[0]);
  const url = `https://api.pexels.com/v1/search?query=${cleanKeyword}&per_page=15&orientation=square&size=large`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });

      if (!res.ok) {
        console.warn(`⚠ Pexels HTTP ${res.status} (tentative ${attempt + 1}/${retries + 1})`);
        if (attempt === retries) return null;
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }

      const data = await res.json();
      if (!data.photos || data.photos.length === 0) {
        console.warn(`⚠ Pexels : aucune photo pour "${keyword}"`);
        return null;
      }

      const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
      return photo.src?.large2x || photo.src?.large || photo.src?.original;
    } catch (err: any) {
      console.warn(`⚠ Pexels tentative ${attempt + 1}/${retries + 1} : ${err.message}`);
      if (attempt === retries) {
        console.error(`❌ Pexels définitivement échoué pour "${keyword}"`);
        return null;
      }
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

// === Helper LoremFlickr (fallback ultime si Pexels en panne) ===

function generateLoremFlickrUrl(keyword: string): string {
  const safe = encodeURIComponent(keyword.split(',')[0].trim().split(' ')[0]);
  const lock = Math.floor(Math.random() * 10000);
  return `https://loremflickr.com/1080/1080/${safe},aesthetic?lock=${lock}`;
}

async function getStockImage(keyword: string): Promise<string> {
  const pexelsUrl = await fetchPexelsImage(keyword);
  if (pexelsUrl) return pexelsUrl;
  return generateLoremFlickrUrl(keyword);
}

// === Helper : matcher une image de la bibliothèque CLIENT à un keyword de slide ===
// Tokenise le keyword (sans stop-words, sans accents) et score chaque image
// sur le nombre de tokens qui matchent ses tags / description / nom de fichier.
const BRAND_MATCH_STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
  'et', 'ou', 'mais', 'pour', 'avec', 'sans', 'sur', 'dans', 'chez',
  'the', 'and', 'with', 'for', 'from', 'this', 'that', 'these', 'those',
  'photo', 'image', 'picture', 'view', 'shot', 'background', 'scene', 'real'
]);

function normalizeForMatch(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findBrandImageMatch(
  images: any[],
  keyword: string,
  usedIds: Set<string>
): any | null {
  if (!images || images.length === 0 || !keyword) return null;

  const tokens = normalizeForMatch(keyword)
    .split(/[\s,'.\-_/]+/)
    .filter((t) => t.length >= 3 && !BRAND_MATCH_STOP_WORDS.has(t));

  if (tokens.length === 0) return null;

  const scored = images
    .filter((img) => img?.url && !usedIds.has(img.id))
    .map((img) => {
      const haystack = normalizeForMatch([
        Array.isArray(img.tags) ? img.tags.join(' ') : (img.tags || ''),
        img.description || '',
        img.alt_text || '',
        img.keywords || '',
        img.name || '',
        img.filename || '',
        img.title || ''
      ].join(' '));

      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score++;
      }
      return { img, score };
    })
    .filter((s) => s.score >= 1)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.img || null;
}

// === ANTI-HALLUCINATION : sécurise les attributions de citations ===
// Extrait tous les noms POTENTIELS associés à la marque cliente. Ces noms
// ne doivent JAMAIS apparaître comme auteurs de citations — la marque cliente
// n'est jamais une source publique vérifiable au sens journalistique du terme.

function extractBrandContextNames(brandKit: any): string[] {
  const names = new Set<string>();

  // 1. Prénom/nom extraits de l'email local (sauter.fabien@x → sauter, fabien, "fabien sauter", "sauter fabien")
  if (brandKit?.client_email) {
    const local = String(brandKit.client_email).split('@')[0];
    const parts = local
      .split(/[._\-+0-9]+/)
      .map((p: string) => p.trim().toLowerCase())
      .filter((p: string) => p.length >= 2 && /^[a-zà-ÿ]+$/i.test(p));
    parts.forEach((p: string) => names.add(p));
    if (parts.length >= 2) {
      names.add(parts.join(' '));
      names.add([...parts].reverse().join(' '));
    }
  }

  // 2. Nom de marque
  if (brandKit?.brand_name) {
    names.add(String(brandKit.brand_name).toLowerCase().trim());
  }

  // 3. Domaine de l'email (sans extension) — ex: "metaservices"
  if (brandKit?.client_email) {
    const domain = String(brandKit.client_email).split('@')[1] || '';
    const domainBase = domain.split('.')[0]?.toLowerCase();
    if (domainBase && domainBase.length >= 3 && !['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'live', 'protonmail'].includes(domainBase)) {
      names.add(domainBase);
    }
  }

  return Array.from(names).filter((n) => n.length >= 3);
}

function authorMatchesBrandContext(author: string, brandNames: string[]): boolean {
  if (!author || brandNames.length === 0) return false;
  const authorN = normalizeForMatch(author);
  const authorWords = authorN.split(/\s+/).filter((w) => w.length >= 3);
  if (authorWords.length === 0) return false;

  for (const bn of brandNames) {
    const bnN = normalizeForMatch(bn);
    const bnWords = bnN.split(/\s+/).filter((w) => w.length >= 3);

    // Match si UN seul mot du brand context apparaît dans l'auteur (strict)
    for (const bw of bnWords) {
      if (authorWords.includes(bw)) return true;
    }
  }
  return false;
}

// Nettoie une slide convertie de quote → explanation : enlève les guillemets,
// retire l'auteur, et reformule légèrement si besoin pour ne plus avoir l'air d'une citation.
function stripQuotationMarkers(text: string): string {
  if (!text) return '';
  return text
    .replace(/^[«"'"'\s]+/, '')
    .replace(/[»"'"'\s]+$/, '')
    .trim();
}

// === Helpers Nano Banana Pro (gardés pour usage manuel uniquement) ===

async function callNanoBananaPro(imagePrompt: string, useGrounding: boolean): Promise<string | null> {
  const body: any = {
    contents: [{ parts: [{ text: imagePrompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '1:1', imageSize: '1K' }
    }
  };

  if (useGrounding) body.tools = [{ googleSearch: {} }];

  try {
    const res = await fetch(GEMINI_IMAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`⚠ Nano Banana Pro HTTP ${res.status}:`, errBody.substring(0, 300));
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) return part.inlineData.data;
    }

    const refusalText = parts.find((p: any) => p.text)?.text;
    const finishReason = data.candidates?.[0]?.finishReason;
    console.warn(`⚠ Nano Banana Pro : pas d'image. finishReason=${finishReason}`);
    if (refusalText) console.warn(`   Message modèle : ${refusalText.substring(0, 200)}`);

    return null;
  } catch (err: any) {
    console.error(`❌ Erreur Nano Banana:`, err.message);
    return null;
  }
}

async function uploadImageToSupabase(base64Data: string, fileName: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠ Variables Supabase manquantes, skip upload");
    return null;
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const buffer = Buffer.from(base64Data, 'base64');

    const { error: uploadError } = await supabaseAdmin.storage
      .from('slide-images')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error("❌ Erreur upload Supabase:", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('slide-images')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err: any) {
    console.error("❌ Exception upload:", err.message);
    return null;
  }
}

async function generateAiImageOnDemand(userPrompt: string, brandName: string): Promise<string | null> {
  const wrappedPrompt = `Create a modern editorial illustration for a social media carousel slide.

User description : "${userPrompt}"
Brand : ${brandName}

STYLE REQUIREMENTS :
- Modern, clean, professional editorial illustration (NYT, Wired, Fast Company style)
- Conceptual or photographic, depending on the user's request
- Bold colors, contemporary palette
- Full-bleed composition that fills the entire frame edge-to-edge — NO centered subject with empty borders
- ABSOLUTELY NO text, letters, captions, watermarks, or signatures
- Square 1:1 framing`;

  const base64 = await callNanoBananaPro(wrappedPrompt, false);
  if (!base64) return null;

  const fileName = `ai-custom-${Date.now()}.png`;
  return await uploadImageToSupabase(base64, fileName);
}

// === Handler principal ===

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY manquante dans .env.local" }, { status: 500 });
    }

    const body = await req.json();
    const { prompt, brandKit, slideCount = 6, isIdeaMode, link, regenerateImageKeyword, customImagePrompt, selectedInsight, isPublicityMode, format, targetAudience, ctaText } = body;
    let attachedPdfs = body.attachedPdfs;

    // === Cas : génération AI sur demande utilisateur (mode édition) ===
    if (customImagePrompt) {
      const imageUrl = await generateAiImageOnDemand(customImagePrompt, brandKit?.brand_name || 'Brand');
      if (imageUrl) {
        await logUsageEvent({
          client_email: brandKit?.client_email || '',
          brand_name: brandKit?.brand_name,
          event_type: 'image_regen_ai',
          provider: 'nano_banana',
          model: IMAGE_MODEL,
          cost_usd: COST_NANO_BANANA_IMAGE,
          metadata: { custom_prompt: customImagePrompt.slice(0, 200) }
        });
        return NextResponse.json({ bg_image: imageUrl, ai_generated: true });
      } else {
        return NextResponse.json(
          { error: "L'IA a refusé de générer cette image. Essaie une description différente." },
          { status: 400 }
        );
      }
    }

    // === Cas : nouvelle image stock (bouton refresh) ===
    if (regenerateImageKeyword) {
      const result = await getStockImageWithMetadata(regenerateImageKeyword);
      await logUsageEvent({
        client_email: brandKit?.client_email || '',
        brand_name: brandKit?.brand_name,
        event_type: 'image_regen_stock',
        provider: result.source as any,
        cost_usd: 0,
        metadata: { keyword: regenerateImageKeyword, source: result.source }
      });
      return NextResponse.json({
        bg_image: result.url,
        image_source: result.source,
        image_license: result.license,
        image_attribution: result.attribution,
        image_attribution_required: result.attribution_required,
        image_source_url: result.source_url
      });
    }

    // === Cas : résumé éclair de la mémoire client (déclenché depuis Analytics) ===
    if (body.summarizeMemory && body.memoryText) {
      const summaryPrompt = `Voici la mémoire accumulée d'un client de notre SaaS de création de contenus :

"${body.memoryText}"

Synthétise cette mémoire en UNE SEULE PHRASE de 25 mots maximum qui capture l'essence du client : son activité, sa cible principale, et son ton de voix dominant. Style : factuel, percutant, professionnel. Pas de blabla, pas de préambule.

Réponds UNIQUEMENT EN JSON STRICT, SANS MARKDOWN :
{"summary": "ta phrase ici"}`;

      const { text } = await callGeminiText(summaryPrompt, false);
      const parsed = extractJsonFromResponse(text);
      return NextResponse.json({ summary: parsed.summary || '' });
    }

    // === PUBLICITY MODE ===
    if (isPublicityMode) {
      const publicityPrompt = `Tu es un COPYWRITER PUBLICITAIRE pour ${brandKit.brand_name}.
ADN de la marque : ${brandKit.positioning || 'Non défini'}.
Ton de voix : ${brandKit.tone || 'Professionnel'}.
${brandKit.publicity_context ? `Contexte commercial / Ce que vend la marque : ${brandKit.publicity_context}` : ''}
${brandKit.forbidden_words ? `Mots STRICTEMENT interdits : ${brandKit.forbidden_words}` : ''}

Ton rôle : agir comme un VENDEUR efficace. Pas neutre, pas informatif. Tu dois donner ENVIE d'acheter ou d'agir maintenant.

OBJECTIF DE LA PUB : ${prompt}
FORMAT : ${format || 'post'} (post=carré Instagram, story=vertical, banner=horizontal)
${targetAudience ? `CIBLE : ${targetAudience}` : ''}
${ctaText ? `CTA souhaité par le client : ${ctaText} (reste cohérent)` : ''}

RÈGLES STRICTES :
- "headline" : accroche puissante, courte, max 8 mots, qui interpelle ou crée un manque. Pas de mots tièdes.
- "subline" : précise la promesse ou le bénéfice unique, max 15 mots. Tangible, concret.
- "cta" : appel à l'action court, max 4 mots, à l'impératif (ex: "Réserver maintenant", "J'en profite", "Découvrir", "S'inscrire")
- "image_keyword" : un seul mot anglais simple et photographique pour la photo de fond Pexels (ex: "celebration", "luxury", "fitness")

RÉPONDS UNIQUEMENT EN JSON STRICT, SANS MARKDOWN :
{
  "headline": "...",
  "subline": "...",
  "cta": "...",
  "image_keyword": "..."
}`;

      const { text, usage, usedFallback } = await callWithGroundingFallback(publicityPrompt, publicityPrompt);
      const parsed = extractJsonFromResponse(text);

      if (parsed.image_keyword) {
        const stockResult = await getStockImageWithMetadata(parsed.image_keyword);
        parsed.bg_image = stockResult.url;
        parsed.image_source = stockResult.source;
        parsed.image_license = stockResult.license;
        parsed.image_attribution = stockResult.attribution;
        parsed.image_attribution_required = stockResult.attribution_required;
        parsed.image_source_url = stockResult.source_url;
      }

      await logUsageEvent({
        client_email: brandKit?.client_email || '',
        brand_name: brandKit?.brand_name,
        event_type: 'publicity_generation',
        provider: 'gemini',
        model: TEXT_MODEL,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cost_usd: geminiTextCost(usage.inputTokens, usage.outputTokens, !usedFallback),
        metadata: { format, prompt: prompt?.slice(0, 200), used_fallback: usedFallback }
      });

      return NextResponse.json({ ...parsed, usedFallback });
    }

    // === IDEA MODE ===
    if (isIdeaMode) {
      const ideaPrompt = `Expert stratégie pour ${brandKit.brand_name}.
ADN de la marque : ${brandKit.positioning || 'Non défini'}.
Ton de voix : ${brandKit.tone || 'Professionnel'}.

Propose 3 idées de sujets courts (15-20 mots chacun), actuels et pertinents pour les réseaux sociaux de cette marque. Si pertinent, base-toi sur l'actualité récente du web pour des sujets brûlants.

${link ? `Source d'inspiration : ${link}` : ''}

RÉPONDS UNIQUEMENT EN JSON, SANS MARKDOWN :
{ "ideas": ["Sujet 1", "Sujet 2", "Sujet 3"] }`;

      const { text, usage, usedFallback } = await callWithGroundingFallback(ideaPrompt, ideaPrompt);
      const parsed = extractJsonFromResponse(text);

      await logUsageEvent({
        client_email: brandKit?.client_email || '',
        brand_name: brandKit?.brand_name,
        event_type: 'idea_generation',
        provider: 'gemini',
        model: TEXT_MODEL,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cost_usd: geminiTextCost(usage.inputTokens, usage.outputTokens, !usedFallback),
        metadata: { link: link?.slice(0, 200), used_fallback: usedFallback }
      });

      return NextResponse.json({ ...parsed, usedFallback });
    }

    // === PRODUCTION MODE ===
    // Charger les fichiers de connaissance globaux du brand kit (chartes, guidelines, etc.)
    if (brandKit?.knowledge_files?.length > 0 && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const knowledgeStart = Date.now();
        const knowledgePromises = brandKit.knowledge_files
          .filter((f: any) => f.path && f.name && /\.(pdf|jpe?g|png|webp)$/i.test(f.name))
          .slice(0, 5)
          .map(async (f: any) => {
            try {
              const { data, error } = await supabaseAdmin.storage
                .from('brand-knowledge')
                .download(f.path);
              if (error || !data) {
                console.warn(`⚠ Échec téléchargement ${f.name}: ${error?.message}`);
                return null;
              }
              const arrayBuffer = await data.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              const lowerName = f.name.toLowerCase();
              const mimeType = lowerName.endsWith('.pdf') ? 'application/pdf' :
                               lowerName.endsWith('.png') ? 'image/png' :
                               lowerName.endsWith('.webp') ? 'image/webp' :
                               'image/jpeg';
              return { name: f.name, data: base64, size: f.size, mimeType };
            } catch (err: any) {
              console.warn(`⚠ Erreur lecture ${f.name}:`, err.message);
              return null;
            }
          });
        const loaded = (await Promise.all(knowledgePromises)).filter(Boolean);
        if (loaded.length > 0) {
          attachedPdfs = [...(loaded as any[]), ...(attachedPdfs || [])];
          const elapsed = ((Date.now() - knowledgeStart) / 1000).toFixed(1);
          console.log(`📚 ${loaded.length} fichier(s) de connaissance globaux chargé(s) en ${elapsed}s`);
        }
      } catch (err: any) {
        console.warn("⚠ Erreur chargement knowledge_files:", err.message);
      }
    }

    // === Charger la bibliothèque d'images OFFICIELLES du client ===
    // Elle servira (a) à informer l'IA dans son prompt et (b) à matcher en local pour utiliser
    // ces photos en PRIORITÉ avant d'aller chercher dans les banques d'images génériques.
    let brandLibraryImages: any[] = [];
    if (brandKit?.client_email && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: imgData, error: imgError } = await supabaseAdmin
          .from('brand_images')
          .select('*')
          .ilike('client_email', brandKit.client_email);
        if (imgError) {
          console.warn("⚠ Erreur lecture brand_images :", imgError.message);
        } else {
          // Résolution d'URL : on essaie plusieurs noms de champs ET plusieurs buckets
          // car on ne connaît pas précisément le schéma de brand_images
          const directFields = ['url', 'public_url', 'publicUrl', 'image_url', 'imageUrl', 'signed_url', 'signedUrl', 'src'];
          const pathFields = ['path', 'storage_path', 'storagePath', 'file_path', 'filePath', 'image_path', 'imagePath', 'object_path'];
          const defaultBuckets = ['brand-images', 'brand-library', 'client-images', 'brand-knowledge', 'images'];

          brandLibraryImages = (imgData || []).map((img: any) => {
            // Étape 1 : URL directe ?
            for (const f of directFields) {
              if (typeof img[f] === 'string' && img[f].startsWith('http')) {
                return { ...img, url: img[f] };
              }
            }
            // Étape 2 : path + bucket → reconstitue
            for (const pf of pathFields) {
              const path = img[pf];
              if (typeof path === 'string' && path.length > 0) {
                const bucketsToTry = [img.bucket, ...defaultBuckets].filter(Boolean);
                for (const bucket of bucketsToTry) {
                  try {
                    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
                    if (urlData?.publicUrl) {
                      return { ...img, url: urlData.publicUrl };
                    }
                  } catch { /* essaie bucket suivant */ }
                }
              }
            }
            // Aucune URL résolue
            return img;
          });
          const resolved = brandLibraryImages.filter((i: any) => i.url && String(i.url).startsWith('http')).length;
          console.log(`📚 Bibliothèque client : ${resolved}/${brandLibraryImages.length} image(s) avec URL résolvable`);
          if (resolved === 0 && brandLibraryImages.length > 0) {
            console.warn(`⚠ Aucune URL résolvable. Champs de la première ligne :`, Object.keys(brandLibraryImages[0]));
          }
        }
      } catch (err: any) {
        console.warn("⚠ Erreur chargement bibliothèque client :", err.message);
      }
    }

    const middleCount = Math.max(0, slideCount - 3);

    const insightLabel = selectedInsight?.label || 'Insight Hebdomadaire';
    const referenceUrlsBlock = brandKit.reference_urls?.length > 0
      ? `\nLIENS DE RÉFÉRENCE de la marque (consulte ces URLs via Google Search pour mieux la comprendre) :\n${brandKit.reference_urls.map((u: string) => `- ${u}`).join('\n')}\n`
      : '';

    // Liste des images officielles que l'IA doit considérer EN PRIORITÉ
    const brandLibraryBlock = brandLibraryImages.length > 0
      ? `\nBIBLIOTHÈQUE D'IMAGES OFFICIELLES DU CLIENT (${brandLibraryImages.length} photos disponibles) :
${brandLibraryImages.slice(0, 40).map((img: any) => {
        const tags = Array.isArray(img.tags) ? img.tags.join(', ') : (img.tags || '');
        const desc = img.description || img.alt_text || img.name || img.filename || 'Image';
        return `- ${desc}${tags ? ' (mots-clés : ' + tags + ')' : ''}`;
      }).join('\n')}

⚡ PRIORITÉ ABSOLUE : Pour CHAQUE slide, vérifie d'abord si une de ces images officielles correspond au sujet (même de loin). Si oui, formule "image_keyword" en RÉUTILISANT EXACTEMENT les mots-clés présents dans les tags ou la description de cette image (en anglais OU en français, peu importe). Le backend matchera automatiquement et utilisera l'image OFFICIELLE DU CLIENT au lieu d'aller piocher dans les banques génériques. Privilégier les photos du client = authenticité de marque, identité visuelle préservée, crédibilité maximale. Ne va vers des keywords génériques que si AUCUNE photo officielle ne s'approche du sujet de la slide.
`
      : '';

    const buildProductionPrompt = (): string => {
      const slideStructure = slideCount === 3
        ? `Structure OBLIGATOIRE : exactement 3 slides
1. type "intro" (avec subtitle "${insightLabel}", texte d'accroche fort)
2. type "conclusion" (synthèse)
3. type "end" (CTA d'invitation à agir)`
        : `Structure OBLIGATOIRE : exactement ${slideCount} slides
1. type "intro" (avec subtitle "${insightLabel}", texte d'accroche fort)
${middleCount} slides du milieu : UNIQUEMENT "explanation" et "stat" — varie entre les deux pour un carrousel dynamique
Avant-dernière : type "conclusion" (synthèse)
Dernière : type "end" (CTA d'invitation à agir)`;

      return `Tu es le Directeur Artistique de ${brandKit.brand_name}.
ADN de la marque : ${brandKit.positioning || 'Non défini'}.
Ton de voix : ${brandKit.tone || 'Professionnel'}.
${brandKit.forbidden_words ? `Mots STRICTEMENT interdits : ${brandKit.forbidden_words}` : ''}
${referenceUrlsBlock}${brandLibraryBlock}
${brandKit.learned_knowledge ? `\nMÉMOIRE CLIENT (apprentissages cumulés des générations précédentes - exploite ces infos pour MIEUX comprendre la marque, son audience, ses spécificités) :\n${brandKit.learned_knowledge}\n` : ''}
${attachedPdfs && attachedPdfs.length > 0 ? `\nDOCUMENTS PDF JOINTS À CETTE GÉNÉRATION : ${attachedPdfs.length} fichier(s) ci-joint(s) en input multimodal. ANALYSE-LES en profondeur pour extraire chiffres, citations, dates, statistiques, faits clés à intégrer dans les vignettes — particulièrement pour les slides "stat" (utilise les vrais chiffres du PDF dans "value" et "chart_data"). Les PDFs sont la SOURCE DE VÉRITÉ prioritaire sur tes connaissances générales.\n` : ''}
Crée un carrousel de ${slideCount} slides pour : ${prompt}.

${slideStructure}

🚨 RÈGLES DE VÉRACITÉ — CRITIQUES, NON-NÉGOCIABLES (priorité absolue sur toutes les autres règles) :

1. **TYPE "quote" STRICTEMENT INTERDIT** dans cette génération. Ne génère JAMAIS de slide de type "quote", peu importe le sujet, peu importe le ton de marque. Utilise UNIQUEMENT "explanation" et "stat" pour les slides du milieu. Si tu penses qu'une citation serait pertinente, traduis l'idée en "explanation" (texte d'analyse en mots-tiens, sans attribution).

2. **AUCUNE ATTRIBUTION inventée**. Ne JAMAIS écrire "selon X", "comme l'a dit Y", "Y affirme que", ni mettre de phrases entre guillemets attribuées à une personne. Tu ne peux PAS vérifier que la personne a réellement dit ces mots. Reste impersonnel : "selon une étude récente", "les données montrent", "une majorité d'experts s'accorde".

3. **NOMS DE PERSONNES INTERDITS dans les textes des slides**. Ne mentionne JAMAIS le nom d'une personne réelle (politique, dirigeant, célébrité, expert, et SURTOUT pas le nom du client ${brandKit.brand_name} ni de quiconque associé à cette marque). Les personnes ne sont JAMAIS des sources directement citées dans ce carrousel. Si tu veux référencer une autorité, utilise une formulation institutionnelle : "le gouvernement", "le canton de Genève", "l'organisation X" — pas un nom propre.

4. **STATISTIQUES — VERIFIABILITÉ OBLIGATOIRE**. Tout chiffre précis ("73%", "2x", "1 250", "9 sur 10") doit provenir : (a) des PDFs joints à cette génération, OU (b) d'une source web vérifiée via Google Search (mode grounding), OU (c) d'une donnée explicite dans le prompt utilisateur. Si tu n'as AUCUNE de ces sources, NE FORCE PAS un chiffre — utilise une slide "explanation" avec une formulation qualitative ("une part croissante", "la majorité", "ces dernières années") plutôt qu'une "stat" inventée.

5. **EN CAS DE DOUTE → toujours préférer le générique vrai au spécifique inventé**. La crédibilité du client est PRIORITAIRE sur l'effet d'autorité. Un carrousel solide aux affirmations vraies vaut infiniment mieux qu'un carrousel "punchy" rempli de chiffres ou citations fabriqués.

RÈGLES DE CONTENU (après respect absolu des règles de véracité ci-dessus) :
- L'ANGLE ÉDITORIAL est défini par le sous-titre intro "${insightLabel}". Utilise cet angle pour orienter le TON, la STRUCTURE et l'ANGLE D'ANALYSE du carrousel. Exemples concrets : "événement" → focus dates/lieux/programme/billetterie/expérience attendue ; "politique" → focus enjeux/positions/débats/conséquences citoyennes ; "actualité" → focus contexte/faits/réactions/perspectives ; "lancement" → focus nouveautés/bénéfices/différenciation/preuves ; "promotion" → focus offre/urgence/bénéfice client/conditions ; "tutoriel" → focus étapes/conseils/erreurs courantes ; "étude" → focus chiffres/méthodo/insights/recommandations. CETTE ORIENTATION EST LE POINT DE DÉPART, pas une cage : analyse aussi le sujet plus globalement pour apporter de la profondeur et du contexte.
- Utilise <mark>...</mark> pour surligner 1 à 2 mots-clés essentiels par slide
- Pour "stat" : "value" doit être court et frappant (ex: "73%", "2x", "1M+") MAIS UNIQUEMENT si tu as une source réelle (PDF, grounding, prompt user). AJOUTE TOUJOURS un champ "value_caption" : courte phrase de 4 à 10 mots (max 60 caractères) qui CONTEXTUALISE concrètement ce que représente le chiffre. Cette phrase apparaît SOUS le gros chiffre pour expliquer en un coup d'œil. Le "text" plus long explique ensuite les détails. AJOUTE AUSSI un champ "chart_data" : tableau de 3 à 4 objets {"label": "...", "value": <nombre>} qui décomposent et CONTEXTUALISENT la stat principale. Le "label" est court (max 18 caractères). Le "value" est un nombre brut sans symbole (ex: 73 pas "73%"). Inclus toujours la stat principale comme un des points. Si la stat est un pourcentage d'un ensemble (ex: répartition), la somme des values = 100. Si c'est des valeurs comparables (ex: 2020 vs 2026), garde les nombres bruts.
- Chaque "text" : 1 à 2 phrases courtes max, IMPERSONNELLES (sans nom propre de personne)
- "image_keyword" : phrase courte (3 à 6 mots) qui décrit CONCRÈTEMENT la photo idéale. ⚡ RAPPEL CRITIQUE : si la BIBLIOTHÈQUE D'IMAGES OFFICIELLES du client (ci-dessus) contient une photo qui correspond au sujet du carrousel ou de la slide, RÉUTILISE LES MOTS-CLÉS EXACTS de ses tags/description dans ton image_keyword (peu importe la langue, FR ou EN). Le système matchera et utilisera la photo officielle. SINON, formule un keyword photographique générique en anglais qui combine LE SUJET PRINCIPAL DU CARROUSEL ET le concept visuel de cette slide (3 à 6 mots, photo réelle, pas concept abstrait). Exemples génériques : Carrousel "Lake Parade Geneva" + slide "au bord de l'eau" → "Lake Parade Geneva lakeside crowd". Carrousel "Nouveau restaurant Lausanne" + slide "ambiance feutrée" → "cozy Lausanne restaurant interior dim lighting". Pour "end" génère AUSSI un keyword pertinent (lié à l'action/CTA ou au sujet général).

EN PLUS DU CARROUSEL, mets à jour la MÉMOIRE CLIENT : ajoute un champ "knowledge_update" à la fin du JSON. Ce champ doit contenir le résumé CONSOLIDÉ et COMPLET de ta compréhension du client APRÈS cette génération. Structure en sections claires : Activité / Audience cible / Tonalité de voix / Sujets récurrents / Données factuelles importantes (chiffres tirés des PDFs notamment). Intègre les nouveaux apprentissages AVEC le contexte déjà accumulé en une seule version cohérente. Max 1500 caractères. Sois factuel, organisé, évolutif — chaque génération doit enrichir progressivement cette mémoire. ⚠️ NE STOCKE JAMAIS de noms de personnes physiques dans la mémoire (ni le client, ni des tiers) — uniquement des faits institutionnels sur la marque.

RÉPONDS UNIQUEMENT EN JSON STRICT, SANS MARKDOWN, SANS COMMENTAIRES :
{
  "project_title": "Titre court accrocheur du carrousel",
  "slides": [
    { "type": "intro", "subtitle": "${insightLabel}", "text": "...", "image_keyword": "..." },
    { "type": "explanation" | "stat", "text": "...", "value": "73%" (uniquement si stat), "value_caption": "courte phrase explicative" (uniquement si stat), "chart_data": [{"label":"Catégorie A","value":73},{"label":"Catégorie B","value":18},{"label":"Catégorie C","value":9}] (uniquement si stat), "image_keyword": "..." },
    { "type": "conclusion", "text": "...", "image_keyword": "..." },
    { "type": "end", "text": "...", "image_keyword": "..." }
  ],
  "knowledge_update": "Activité : ... | Audience : ... | Tonalité : ... | Sujets récurrents : ... | Données factuelles : ..."
}`;
    };

    const productionPrompt = buildProductionPrompt();

    const { text, usage, usedFallback } = await callWithGroundingFallback(productionPrompt, productionPrompt, attachedPdfs);
    const parsed = extractJsonFromResponse(text);

    // === 🛡️ FILTRE ANTI-HALLUCINATION (couche backend) ===
    // Filet de sécurité : même si l'IA viole le prompt et génère une "quote" ou attribue
    // une phrase au client, on intercepte avant que ça atteigne l'utilisateur final.
    if (parsed.slides && Array.isArray(parsed.slides)) {
      const brandContextNames = extractBrandContextNames(brandKit);
      let quotesIntercepted = 0;
      let authorsRejected = 0;

      for (const slide of parsed.slides) {
        // Couche 1 : tout slide de type "quote" est neutralisé en "explanation"
        if (slide.type === 'quote') {
          slide.type = 'explanation';
          slide.text = stripQuotationMarkers(slide.text || '');
          if (slide.author) {
            console.warn(`🚨 QUOTE INTERCEPTÉE : auteur revendiqué "${slide.author}" — slide convertie en explanation`);
            delete slide.author;
          }
          quotesIntercepted++;
        }

        // Couche 2 : si malgré tout un champ "author" reste sur n'importe quel type, on le supprime
        if (slide.author) {
          if (authorMatchesBrandContext(slide.author, brandContextNames)) {
            console.warn(`🚨 AUTEUR REJETÉ : "${slide.author}" correspond au contexte de la marque (${brandKit?.brand_name})`);
            authorsRejected++;
          }
          delete slide.author;
        }

        // Couche 3 : nettoyage du texte — supprime les attributions inline du type
        // "selon Fabien Sauter", "comme l'a dit X", "Y affirme que..." si le nom matche le brand context
        if (slide.text && brandContextNames.length > 0) {
          for (const name of brandContextNames) {
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Pattern : "selon Nom", "selon le Nom", "par Nom", "Nom affirme", etc.
            const inlineAttrib = new RegExp(`(selon|d'apr[èe]s|comme l'a dit|comme le dit|par|de)\\s+(le\\s+|la\\s+|monsieur\\s+|madame\\s+|m\\.\\s+|mme\\s+)?${escaped}\\b`, 'gi');
            if (inlineAttrib.test(slide.text)) {
              console.warn(`🚨 ATTRIBUTION INLINE détectée et supprimée pour "${name}"`);
              slide.text = slide.text.replace(inlineAttrib, '').replace(/\s+/g, ' ').trim();
            }
          }
        }
      }

      if (quotesIntercepted > 0 || authorsRejected > 0) {
        console.warn(`⚠ Filtre anti-hallucination : ${quotesIntercepted} quote(s) neutralisée(s), ${authorsRejected} auteur(s) rejeté(s)`);
      }
    }

    // === Récupération des images : BIBLIOTHÈQUE CLIENT EN PRIORITÉ, puis stock en fallback ===
    if (parsed.slides && Array.isArray(parsed.slides)) {
      console.log(`📸 Résolution des images pour ${parsed.slides.length} slide(s)...`);
      const startTime = Date.now();

      // Pass 1 : matching local instantané dans la bibliothèque client
      const usedLibraryIds = new Set<string>();
      const slidesNeedingStock: number[] = [];
      let libraryHits = 0;

      for (let i = 0; i < parsed.slides.length; i++) {
        const slide = parsed.slides[i];
        if (!slide.image_keyword) continue;

        const brandMatch = findBrandImageMatch(brandLibraryImages, slide.image_keyword, usedLibraryIds);
        if (brandMatch && brandMatch.url) {
          usedLibraryIds.add(brandMatch.id);
          slide.bg_image = brandMatch.url;
          slide.image_source = 'brand_library';
          slide.image_license = 'owned';
          slide.image_attribution = null;
          slide.image_attribution_required = false;
          slide.image_source_url = null;
          libraryHits++;
          console.log(`  ✓ Slide ${i + 1} → bibliothèque client (keyword: "${slide.image_keyword}")`);
        } else {
          slidesNeedingStock.push(i);
        }
      }

      // Pass 2 : fallback stock (Pexels) en parallèle pour les slides restantes
      const stockPromises = slidesNeedingStock.map(async (i) => {
        const slide = parsed.slides[i];
        const stockResult = await getStockImageWithMetadata(slide.image_keyword);
        return { i, stockResult };
      });
      const stockResults = await Promise.all(stockPromises);
      for (const { i, stockResult } of stockResults) {
        const slide = parsed.slides[i];
        slide.bg_image = stockResult.url;
        slide.image_source = stockResult.source;
        slide.image_license = stockResult.license;
        slide.image_attribution = stockResult.attribution;
        slide.image_attribution_required = stockResult.attribution_required;
        slide.image_source_url = stockResult.source_url;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✓ Images résolues : ${libraryHits} bibliothèque + ${slidesNeedingStock.length} stock en ${elapsed}s`);

      // Injecter le badge URL sur la slide intro si un insight avec badge a été sélectionné
      if (selectedInsight?.badge_url && parsed.slides[0]?.type === 'intro') {
        parsed.slides[0].badge_url = selectedInsight.badge_url;
      }
    }

    // === Sauvegarde de la mémoire client accumulée ===
    if (parsed.knowledge_update && brandKit?.client_email && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabaseAdmin
          .from('brand_kits')
          .update({ learned_knowledge: parsed.knowledge_update })
          .ilike('client_email', brandKit.client_email);
        console.log(`🧠 Mémoire client mise à jour (${parsed.knowledge_update.length} chars)`);
      } catch (err: any) {
        console.warn("⚠ Erreur sauvegarde mémoire :", err.message);
      }
      delete parsed.knowledge_update;
    }

    // === Log événement carrousel ===
    await logUsageEvent({
      client_email: brandKit?.client_email || '',
      brand_name: brandKit?.brand_name,
      event_type: 'carousel_generation',
      provider: 'gemini',
      model: TEXT_MODEL,
      units: parsed.slides?.length || slideCount,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: geminiTextCost(usage.inputTokens, usage.outputTokens, !usedFallback),
      metadata: { slides: parsed.slides?.length, prompt: prompt?.slice(0, 200), used_fallback: usedFallback }
    });

    return NextResponse.json({ ...parsed, usedFallback });

  } catch (error: any) {
    console.error("❌ Crash Route API:", error.message, error.stack);
    return NextResponse.json(
      { error: error.message || "Erreur serveur. Réessayez." },
      { status: 500 }
    );
  }
}