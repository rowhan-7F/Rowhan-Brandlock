import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Correctif SSL Windows
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Clé manquante" }, { status: 500 });

    const body = await req.json();
    const { prompt, brandName, forbiddenWords } = body;

    // UTILISATION DU MODÈLE DÉTECTÉ DANS TON TERMINAL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Tu es l'expert branding pour ${brandName || 'BrandLock'}. 
            Ne jamais utiliser : ${forbiddenWords?.join(", ") || "aucun"}.
            Demande : ${prompt}`
          }]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("ERREUR GOOGLE :", data.error.message);
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Pas de réponse.";
    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("CRASH SERVEUR :", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}