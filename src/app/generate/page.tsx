'use client';
import { useBrandStore } from '@/store/useBrandStore';
import { useState } from 'react';

export default function GeneratePage() {
  // 1. On récupère les réglages de la marque
  const { primaryColor, brandName, forbiddenWords } = useBrandStore();
  
  // 2. On gère les états locaux (ce que l'utilisateur écrit et ce que l'IA répond)
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState(''); 
  const [loading, setLoading] = useState(false);

  // 3. La fonction qui appelle ton API Gemini
  const handleGenerate = async () => {
    if (!prompt) return; // On ne génère rien si c'est vide
    setLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, brandName, forbiddenWords }),
      });
      const data = await response.json();
      setResult(data.text);
    } catch (error) {
      console.error("Erreur:", error);
      setResult("Désolé, une erreur est survenue lors de la génération.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Générateur de Contenu</h1>
        <p className="text-slate-500">L'IA génère, BrandLock sécurise la cohérence.</p>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Panneau de Contrôle */}
        <div className="space-y-6">
          <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Instruction pour l'IA</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Crée un post Instagram pour le lancement de notre nouveau produit..."
              className="w-full h-40 p-6 bg-white border border-slate-200 rounded-[1.5rem] focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none shadow-sm text-sm"
            />
            <button 
              onClick={handleGenerate} // On branche la fonction ici !
              disabled={loading}
              style={{ backgroundColor: loading ? '#94a3b8' : primaryColor }}
              className="w-full py-4 rounded-2xl text-white font-bold shadow-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:cursor-not-allowed"
            >
              {loading ? "Génération en cours..." : `Générer avec ${brandName}`}
            </button>
          </div>
        </div>

        {/* Prévisualisation "Cinématique" */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-violet-600 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative h-full bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
            
            <div className="flex-1 flex items-center justify-center p-12 relative overflow-hidden text-center">
                <div 
                    className="absolute inset-0 opacity-20 blur-[100px]"
                    style={{ backgroundColor: primaryColor }}
                ></div>
                
                <div className="relative z-10 space-y-6 max-w-lg">
                    <div 
                        className="inline-block px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white border border-white/20"
                        style={{ backgroundColor: primaryColor }}
                    >
                        {brandName}
                    </div>
                    {/* Le texte ici change selon le résultat de l'IA */}
                    <h2 className="text-2xl font-medium text-white leading-relaxed">
                        {loading ? "L'IA réfléchit..." : result || "Votre futur contenu apparaîtra ici..."}
                    </h2>
                </div>
            </div>

            <div className="p-6 bg-black/40 backdrop-blur-md border-t border-white/10 flex justify-between items-center">
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                    Status: {loading ? "Rendering..." : "Ready"}
                </span>
                <div className="flex gap-2">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_10px] ${loading ? 'bg-orange-500 animate-pulse' : 'bg-green-500 shadow-green-500'}`}></div>
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}