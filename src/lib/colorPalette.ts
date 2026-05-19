// src/lib/colorPalette.ts
// Helpers pour générer des palettes harmonieuses à partir des couleurs de la charte
// Utilisé par les graphiques (bar, pie, comparison, line) pour varier les couleurs

function hexToHsl(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return [0, 0, 50];
    const r = parseInt(clean.substr(0, 2), 16) / 255;
    const g = parseInt(clean.substr(2, 2), 16) / 255;
    const b = parseInt(clean.substr(4, 2), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }
  
  function hslToHex(h: number, s: number, l: number): string {
    const ll = l / 100;
    const a = (s * Math.min(ll, 1 - ll)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  
  /**
   * Génère une palette de couleurs harmonieuses.
   * - Si secondaryColors est fourni et non vide → utilise [main, ...secondaires]
   * - Sinon → dérive automatiquement 4 variations harmoniques de la couleur principale
   *
   * Retourne toujours au moins 5 couleurs distinctes.
   */
  export function getColorPalette(mainColor: string, secondaryColors?: any[]): string[] {
    // 1) Si l'utilisateur a défini des couleurs secondaires en charte
    if (Array.isArray(secondaryColors) && secondaryColors.length > 0) {
      const extracted = secondaryColors
        .map((c) => (typeof c === 'string' ? c : c?.hex || null))
        .filter((c): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c));
      if (extracted.length > 0) {
        return [mainColor, ...extracted].slice(0, 6);
      }
    }
    // 2) Sinon dérivation automatique
    try {
      const [h, s, l] = hexToHsl(mainColor);
      return [
        mainColor,
        hslToHex((h + 30) % 360, Math.max(s - 8, 35), Math.min(l + 8, 70)),
        hslToHex((h + 180) % 360, Math.max(s - 18, 30), Math.min(l + 5, 65)),
        hslToHex((h + 210) % 360, Math.max(s - 22, 30), Math.max(l - 8, 28)),
        hslToHex((h - 30 + 360) % 360, Math.max(s, 45), Math.min(l + 12, 72))
      ];
    } catch {
      return [mainColor, '#94a3b8', '#64748b', '#475569', '#334155'];
    }
  }