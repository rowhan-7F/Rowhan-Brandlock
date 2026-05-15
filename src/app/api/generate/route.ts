import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialisation de l'instance Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  // 1. TEST DE CONNEXION INITIAL (Diagnostic réseau)
  try {
    const testFetch = await fetch("https://www.google.com", { method: "HEAD" });
    console.log("--- DIAGNOSTIC RÉSEAU ---");
    console.log("Accès Google.com :", testFetch.ok ? "RÉUSSI ✅" : "ÉCHOUÉ ❌");
  } catch (e) {
    console.error("--- ALERTE RÉSEAU ---");
    console.error("Le serveur ne peut même pas joindre Google.com. Le problème est local (Pare-feu ou DNS).");
  }

  try {
    // 2. Récupération des données du Brand Kit
    const { prompt, brandName, forbiddenWords } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 3. Construction du Prompt avec verrouillage de marque
    const systemPrompt = `
      Tu es un expert en communication pour la marque "${brandName}".
      CONSIGNES STRICTES :
      - Ne jamais mentionner les mots suivants : ${forbiddenWords.join(", ")}.
      - Adopte un ton professionnel, créatif et percutant.
      - Le contenu doit être optimisé pour une prévisualisation cinématique HDR.

      DEMANDE UTILISATEUR :
      ${prompt}
    `;

    // 4. Appel à l'API Gemini
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });

  } catch (error: any) {
    // 5. Logging ultra-précis pour ton terminal Cursor
    console.error("--- ERREUR GEMINI ---");
    console.error("MESSAGE :", error.message);
    if (error.cause) {
      console.error("CAUSE PROFONDE :", error.cause);
    }
    
    return NextResponse.json(
      { error: "La génération a échoué. Détails dans le terminal." }, 
      { status: 500 }
    );
  }
}

// Log de vérification au démarrage du serveur
console.log("DEBUG - Clé API détectée ?", !!process.env.GEMINI_API_KEY);
if (process.env.GEMINI_API_KEY) {
  console.log("DEBUG - Format de clé valide (AIza...) :", process.env.GEMINI_API_KEY.startsWith("AIza"));
}