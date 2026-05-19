"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Film, Mic, Subtitles, Upload, Sparkles } from "lucide-react";

export default function VideoStudioPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="h-16 px-8 border-b flex justify-between items-center bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/generate')} className="p-2 hover:bg-neutral-100 rounded-xl transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center font-black text-white italic text-xl shadow-lg">B</div>
          <div>
            <h1 className="font-black tracking-tighter text-sm uppercase italic leading-tight">Studio Vidéo</h1>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Projet : {projectId}</p>
          </div>
        </div>
        <span className="px-4 py-2 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-full">Beta · Bientôt disponible</span>
      </nav>

      <main className="max-w-4xl mx-auto p-12 space-y-12">
        <div className="text-center space-y-4 py-12">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-500/20">
            <Film className="text-white" size={36} />
          </div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Transforme ton carrousel en vidéo</h2>
          <p className="text-neutral-500 max-w-2xl mx-auto font-medium">
            Génère une vidéo IA à partir de ton sujet, avec voix off, sous-titres et illustrations animées. Module en cours de finalisation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[2rem] border border-neutral-200 space-y-4 opacity-60">
            <Upload className="text-orange-500" size={24} />
            <h3 className="font-black uppercase text-sm tracking-tight">Vidéo source (optionnel)</h3>
            <p className="text-xs text-neutral-500 font-medium">Upload un MP4 de base que l&apos;IA habillera avec ton style de marque.</p>
            <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-6 text-center text-[10px] font-black uppercase tracking-widest text-neutral-300">
              Bientôt disponible
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-neutral-200 space-y-4 opacity-60">
            <Mic className="text-orange-500" size={24} />
            <h3 className="font-black uppercase text-sm tracking-tight">Voix off</h3>
            <p className="text-xs text-neutral-500 font-medium">Génère une voix off IA ou upload ta propre piste audio.</p>
            <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-6 text-center text-[10px] font-black uppercase tracking-widest text-neutral-300">
              Bientôt disponible
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-neutral-200 space-y-4 opacity-60">
            <Subtitles className="text-orange-500" size={24} />
            <h3 className="font-black uppercase text-sm tracking-tight">Sous-titres</h3>
            <p className="text-xs text-neutral-500 font-medium">Sous-titres synchronisés au style de ta marque.</p>
            <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-6 text-center text-[10px] font-black uppercase tracking-widest text-neutral-300">
              Bientôt disponible
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-100 p-8 rounded-[2rem] flex items-center justify-between">
          <div className="space-y-2">
            <h3 className="font-black text-sm uppercase">Ce module est en cours de construction</h3>
            <p className="text-xs text-neutral-500 font-medium max-w-md">On finalise la stack IA pour la génération vidéo. En attendant, continue de créer tes carrousels.</p>
          </div>
          <Sparkles className="text-orange-400" size={32} />
        </div>
      </main>
    </div>
  );
}