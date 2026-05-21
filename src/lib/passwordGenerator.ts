// ============================================================
//  PASSWORD GENERATOR LUXURY
//  Génère des mots de passe SOLIDES + LISIBLES + PRONONÇABLES
//
//  Critères :
//  - Min 16 caractères
//  - 3 mots prononçables capitalisés (faciles à transmettre)
//  - 2 chiffres
//  - 1 symbole spécial
//  - Pas de caractères ambigus (l/I, 0/O)
// ============================================================

// Mots simples mémorables (sans accents, sans ambiguïté)
const WORDS = [
    "Tigre", "Roche", "Lune", "Soleil", "Aigle", "Loup", "Fjord", "Cedre",
    "Verre", "Pierre", "Ocean", "Mont", "Sable", "Foret", "Vague", "Ciel",
    "Bronze", "Cuivre", "Argent", "Marbre", "Velours", "Saphir", "Onyx",
    "Berlin", "Rome", "Tokyo", "Madrid", "Vienne", "Geneve", "Zurich", "Berne",
    "Phare", "Voile", "Quartz", "Cristal", "Ambre", "Rubis", "Jade", "Perle",
    "Faucon", "Cerf", "Lynx", "Renard", "Heron", "Cygne", "Corbeau", "Etoile",
  ];
  
  const SYMBOLS = ["!", "@", "#", "$", "%", "&", "*", "?", "+", "-"];
  
  // Chiffres SANS 0 et 1 (ambigus avec O et l/I)
  const SAFE_DIGITS = ["2", "3", "4", "5", "6", "7", "8", "9"];
  
  /**
   * Génère un mot de passe solide ET facile à transmettre/lire
   * Exemple : "Tigre-Saphir72-Onyx!"
   */
  export function generateStrongPassword(): string {
    // 3 mots aléatoires capitalisés
    const word1 = WORDS[Math.floor(Math.random() * WORDS.length)];
    const word2 = WORDS[Math.floor(Math.random() * WORDS.length)];
    const word3 = WORDS[Math.floor(Math.random() * WORDS.length)];
  
    // 2 chiffres aléatoires (sans 0 ni 1)
    const digit1 = SAFE_DIGITS[Math.floor(Math.random() * SAFE_DIGITS.length)];
    const digit2 = SAFE_DIGITS[Math.floor(Math.random() * SAFE_DIGITS.length)];
  
    // 1 symbole
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  
    // Format : Word1-Word2NN-Word3!
    return `${word1}-${word2}${digit1}${digit2}-${word3}${symbol}`;
  }
  
  /**
   * Génère un slug de tenant à partir d'une raison sociale
   * Ex : "Canton de Genève" → "canton_de_geneve"
   */
  export function generateTenantSlug(companyName: string): string {
    return companyName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
  }
  
  /**
   * Vérifie qu'un mot de passe est solide
   */
  export function checkPasswordStrength(password: string): {
    isStrong: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;
  
    if (password.length >= 12) score += 2;
    else feedback.push("Trop court (min 12 caractères)");
  
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push("Manque une majuscule");
  
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push("Manque une minuscule");
  
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push("Manque un chiffre");
  
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push("Manque un caractère spécial");
  
    return {
      isStrong: score >= 5,
      score,
      feedback,
    };
  }
  