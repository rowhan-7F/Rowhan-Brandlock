'use client';
import { useBrandStore } from '@/store/useBrandStore';

export default function BrandKit() {
  const { primaryColor, setPrimaryColor, brandName, setBrandName } = useBrandStore();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configuration de Marque</h1>
        <p className="text-slate-500">Définissez les règles que l'IA ne devra jamais briser.</p>
      </header>

      <div className="grid gap-8 p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Nom de la marque</label>
          <input 
            type="text" 
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Couleur Primaire</label>
          <div className="flex gap-4 items-center">
            <input 
              type="color" 
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-16 h-16 rounded-xl cursor-pointer border-none"
            />
            <span className="font-mono font-bold text-slate-600">{primaryColor}</span>
          </div>
        </div>
      </div>
    </div>
  );
}