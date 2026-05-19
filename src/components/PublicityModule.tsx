"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { toPng } from "html-to-image";
import {
  Megaphone, Sparkles, Download, Trash2, RotateCw, X, Square, RectangleVertical, RectangleHorizontal
} from "lucide-react";

const FORMATS = [
  { id: 'post', label: 'Post', ratio: '1:1', width: 1080, height: 1080, icon: Square },
  { id: 'story', label: 'Story', ratio: '9:16', width: 1080, height: 1920, icon: RectangleVertical },
  { id: 'banner', label: 'Bannière', ratio: '1.91:1', width: 1200, height: 627, icon: RectangleHorizontal }
];

type PubCreative = {
    id?: string;
    headline: string;
    subline: string;
    cta: string;
    image_keyword?: string;
    bg_image: string;
    format: string;
    product_prompt?: string;
    created_at?: string;
    image_source?: string;
    image_license?: string;
    image_attribution?: string;
    image_attribution_required?: boolean;
    image_source_url?: string;
  };

type Props = {
  brandKit: any;
  isDarkMode: boolean;
};

export default function PublicityModule({ brandKit, isDarkMode }: Props) {
  const [pubFormat, setPubFormat] = useState('post');
  const [pubPrompt, setPubPrompt] = useState("");
  const [pubTarget, setPubTarget] = useState("");
  const [pubCta, setPubCta] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPub, setCurrentPub] = useState<PubCreative | null>(null);
  const [publications, setPublications] = useState<PubCreative[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPublications();
  }, []);

  const fetchPublications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    const { data } = await supabase
      .from('publicity_creations')
      .select('*')
      .ilike('client_email', user.email)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setPublications(data as PubCreative[]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPublications();
    setTimeout(() => setRefreshing(false), 400);
  };

  const handleGenerate = async () => {
    if (!pubPrompt.trim()) return alert("Décris ce que tu veux vendre ou promouvoir.");
    setLoading(true);
    setCurrentPub(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublicityMode: true,
          brandKit,
          prompt: pubPrompt,
          format: pubFormat,
          targetAudience: pubTarget,
          ctaText: pubCta
        })
      });
      const data = await res.json();

      if (data.headline) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newPub, error } = await supabase
          .from('publicity_creations')
          .insert([{
            client_email: user?.email?.toLowerCase(),
            brand_name: brandKit.brand_name,
            product_prompt: pubPrompt,
            format: pubFormat,
            headline: data.headline,
            subline: data.subline,
            cta: data.cta,
            image_keyword: data.image_keyword,
            bg_image: data.bg_image,
            status: 'draft'
          }])
          .select();

        if (error) {
          alert("Erreur sauvegarde : " + error.message);
        } else if (newPub) {
          setCurrentPub(newPub[0] as PubCreative);
          await fetchPublications();
        }
      } else {
        alert(data.error || "Aucune publicité générée. Réessaye.");
      }
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePub = async (id: string) => {
    if (!window.confirm("Supprimer cette publicité ?")) return;
    await supabase.from('publicity_creations').delete().eq('id', id);
    if (currentPub?.id === id) setCurrentPub(null);
    fetchPublications();
  };

  const handleExportPng = async () => {
    if (!currentPub) return;
    const el = document.getElementById(`pub-creative-${currentPub.id}`);
    if (!el) return alert("Élément introuvable.");

    try {
      const format = FORMATS.find(f => f.id === currentPub.format);
      const dataUrl = await toPng(el, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: brandKit?.bg_color || '#000'
      });
      const dl = document.createElement("a");
      dl.download = `pub-${currentPub.format}-${Date.now()}.png`;
      dl.href = dataUrl;
      dl.click();
    } catch (err: any) {
      alert("Erreur export : " + err.message);
    }
  };

  // === Rendu de la publicité ===
  const renderPubCreative = (pub: PubCreative, idAttr?: string) => {
    const aspectClass =
      pub.format === 'story' ? 'aspect-[9/16]' :
      pub.format === 'banner' ? 'aspect-[1.91/1]' :
      'aspect-square';

    const logoPosition = brandKit?.logo_position || 'left';
    const logoPosClass =
      logoPosition === 'center' ? 'top-[6%] left-1/2 -translate-x-1/2' :
      logoPosition === 'right' ? 'top-[6%] right-[6%]' :
      'top-[6%] left-[6%]';

    return (
      <div
        id={idAttr}
        className={`${aspectClass} relative flex flex-col p-[6%] rounded-[2rem] overflow-hidden border-[6px] border-white shadow-2xl justify-end`}
        style={{
          backgroundColor: brandKit?.bg_color || '#000',
          fontFamily: brandKit?.font_family,
          containerType: 'inline-size'
        }}
      >
        {pub.bg_image && (
          <div className="absolute inset-0 z-0">
            <img src={pub.bg_image} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10"></div>
          </div>
        )}

        <div className={`absolute z-20 ${logoPosClass}`}>
          {brandKit?.logo_url ? (
            <img src={brandKit.logo_url} className="h-[6cqw] object-contain opacity-90" alt="logo" />
          ) : (
            <span className="text-[2.5cqw] font-black uppercase tracking-widest text-white opacity-90">
              {brandKit?.brand_name}
            </span>
          )}
        </div>

        {pub.image_attribution_required && pub.image_attribution && (
          <div className="absolute bottom-[1cqw] right-[1cqw] z-30 text-[0.85cqw] font-medium text-white/80 bg-black/40 px-[0.7cqw] py-[0.25cqw] rounded-md backdrop-blur-sm">
            📷 {pub.image_attribution} · {pub.image_source}
          </div>
        )}
        <div className="relative z-10 space-y-[1.5cqw] text-white">
          <h2 className="font-black leading-[1.05] tracking-tight" style={{ fontSize: pub.format === 'banner' ? '6cqw' : '9cqw' }}>
            {pub.headline}
          </h2>
          <p className="font-semibold leading-snug opacity-90" style={{ fontSize: pub.format === 'banner' ? '2cqw' : '3cqw' }}>
            {pub.subline}
          </p>
          <div className="inline-block px-[4cqw] py-[1.5cqw] rounded-full mt-[2cqw]" style={{ backgroundColor: brandKit?.main_color || '#f97316' }}>
            <span className="font-black uppercase tracking-widest text-white" style={{ fontSize: pub.format === 'banner' ? '1.8cqw' : '2.5cqw' }}>
              {pub.cta}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Theming
  const themeBg = isDarkMode ? 'bg-neutral-950' : 'bg-neutral-50';
  const cardBg = isDarkMode ? 'bg-neutral-900' : 'bg-white';
  const cardBorder = isDarkMode ? 'border-neutral-800' : 'border-neutral-200';
  const inputBg = isDarkMode ? 'bg-neutral-950 border-neutral-800 text-neutral-100' : 'bg-neutral-50 border-neutral-100 text-neutral-900';
  const mutedText = isDarkMode ? 'text-neutral-500' : 'text-neutral-400';

  return (
    <div className={`flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 ${themeBg}`}>

      {/* === COLONNE GAUCHE — FORMULAIRE === */}
      <div className="space-y-4">
        <div className={`p-6 rounded-[2rem] border space-y-6 ${cardBg} ${cardBorder} ${isDarkMode ? '' : 'shadow-xl'}`}>
          <div className="flex items-center gap-2">
            <Megaphone size={16} className="text-orange-500" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Vendeur IA</h2>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPubFormat(f.id)}
                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${pubFormat === f.id ? 'border-orange-500 bg-orange-50 text-orange-600' : `border-transparent ${inputBg} opacity-60 hover:opacity-100`}`}
                  >
                    <Icon size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{f.label}</span>
                    <span className="text-[9px] opacity-50">{f.ratio}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">Que veux-tu vendre / promouvoir ?</label>
            <textarea
              value={pubPrompt}
              onChange={(e) => setPubPrompt(e.target.value)}
              placeholder="Ex: Soldes d'hiver -40% sur toute la collection, ou Lancement de notre nouveau cours de yoga le 15 nov..."
              className={`w-full p-4 rounded-2xl border outline-none h-28 text-sm resize-none ${inputBg}`}
            />
          </div>

          {/* Target */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">Cible <span className="opacity-40">(optionnel)</span></label>
            <input
              type="text"
              value={pubTarget}
              onChange={(e) => setPubTarget(e.target.value)}
              placeholder="Ex: jeunes parents 25-40 ans"
              className={`w-full p-3 rounded-xl border outline-none text-sm ${inputBg}`}
            />
          </div>

          {/* CTA */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">CTA souhaité <span className="opacity-40">(optionnel)</span></label>
            <input
              type="text"
              value={pubCta}
              onChange={(e) => setPubCta(e.target.value)}
              placeholder="Ex: J'en profite / Réserver / S'inscrire"
              className={`w-full p-3 rounded-xl border outline-none text-sm ${inputBg}`}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !pubPrompt.trim()}
            className="w-full bg-orange-500 text-white py-4 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            {loading ? "L'IA prépare ton pitch..." : "Générer la pub"}
          </button>
        </div>

        {/* HISTORIQUE */}
        <div className={`p-6 rounded-[2rem] border ${cardBg} ${cardBorder} ${isDarkMode ? '' : 'shadow-xl'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Historique</h3>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-1.5 rounded-lg transition-all ${isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
            >
              <RotateCw size={12} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          {publications.length === 0 ? (
            <p className={`text-xs ${mutedText} text-center py-4`}>Aucune publicité créée</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {publications.map((pub) => (
                <div
                  key={pub.id}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    currentPub?.id === pub.id
                      ? 'border-orange-500 bg-orange-50'
                      : `border-transparent ${inputBg} hover:border-orange-200`
                  }`}
                  onClick={() => setCurrentPub(pub)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate">{pub.headline}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">{pub.format}</span>
                      <span className={`text-[9px] font-medium ${mutedText}`}>{pub.created_at ? new Date(pub.created_at).toLocaleDateString('fr-FR') : ''}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); pub.id && handleDeletePub(pub.id); }}
                    className="p-1.5 text-red-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* === COLONNE DROITE — PREVIEW === */}
      <div className="lg:col-span-2 pb-12">
        {currentPub ? (
          <div className="space-y-4">
            <div className={`${pubFormat === 'banner' ? 'max-w-full' : pubFormat === 'story' ? 'max-w-md mx-auto' : 'max-w-2xl mx-auto'}`}>
              {renderPubCreative(currentPub, `pub-creative-${currentPub.id}`)}
            </div>

            <div className="max-w-2xl mx-auto flex flex-wrap gap-3 mt-6">
              <button
                onClick={handleExportPng}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
              >
                <Download size={14} /> Exporter PNG
              </button>
              <button
                onClick={() => {
                  setCurrentPub(null);
                  setPubPrompt("");
                  setPubCta("");
                  setPubTarget("");
                }}
                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
              >
                <X size={12} /> Nouvelle
              </button>
            </div>
          </div>
        ) : (
          <div className={`h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] italic text-[10px] font-black uppercase tracking-[0.4em] space-y-4 ${isDarkMode ? 'border-neutral-800 text-neutral-700' : 'border-neutral-200 text-neutral-300'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl ${isDarkMode ? 'bg-neutral-900' : 'bg-neutral-100'}`}>📢</div>
            <span>{loading ? "Génération en cours..." : "Atelier Pub prêt"}</span>
          </div>
        )}
      </div>
    </div>
  );
}