const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const VISION_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_VISION_URL = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export type ImageMetadata = {
  description: string;
  tags: string[];
  mood: string;
  quality_score: number;
  has_faces: boolean;
  focal_point_x: number;
  focal_point_y: number;
  dominant_colors: string[];
};

export type TaggingResult = {
  metadata: ImageMetadata | null;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Analyse une image avec Gemini Vision et retourne ses métadonnées :
 * description, tags, mood, qualité, visages, point focal, couleurs dominantes.
 */
export async function tagImageWithVision(imageBuffer: Buffer): Promise<TaggingResult> {
  const base64 = imageBuffer.toString('base64');

  const visionPrompt = `Tu es un analyste d'images pour une bibliothèque visuelle de marque.

Analyse cette image et retourne UNIQUEMENT du JSON valide avec ces champs :
- "description" : une phrase courte en français qui décrit ce qu'on voit (max 120 caractères)
- "tags" : tableau de 5 à 8 mots-clés en français (sujets visibles, environnement, ambiance, style). Ex : ["femme", "bureau", "ordinateur", "concentration", "lumiere naturelle"]
- "mood" : un seul mot parmi "calme", "energique", "serieux", "joyeux", "elegant", "brut", "chaleureux", "froid"
- "quality_score" : entier de 1 à 10 (10 = qualité studio parfaite, 1 = flou ou très mauvais)
- "has_faces" : booléen, true si on voit clairement des visages humains reconnaissables (pas des silhouettes lointaines)
- "focal_point_x" : décimal entre 0.0 et 1.0, position horizontale du sujet principal (0.5 = centre)
- "focal_point_y" : décimal entre 0.0 et 1.0, position verticale du sujet principal (0.5 = centre)
- "dominant_colors" : tableau de 3 codes hexadécimaux des couleurs dominantes (ex: ["#3a5f8c", "#d4a373", "#1a1a1a"])

RÉPONDS UNIQUEMENT EN JSON, sans markdown, sans texte autour.`;

  const body = {
    contents: [{
      parts: [
        { text: visionPrompt },
        { inline_data: { mime_type: 'image/jpeg', data: base64 } }
      ]
    }],
    generationConfig: {
      temperature: 0.3,
      response_mime_type: "application/json"
    }
  };

  try {
    const res = await fetch(GEMINI_VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`⚠ Vision HTTP ${res.status}:`, errBody.substring(0, 200));
      return { metadata: null, inputTokens: 0, outputTokens: 0 };
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

    if (!text) return { metadata: null, inputTokens, outputTokens };

    return {
      metadata: JSON.parse(text) as ImageMetadata,
      inputTokens,
      outputTokens
    };
  } catch (err: any) {
    console.error('❌ Erreur Vision tagging:', err.message);
    return { metadata: null, inputTokens: 0, outputTokens: 0 };
  }
}