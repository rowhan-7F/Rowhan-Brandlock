"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getInsightTextClass, getInsightInlineStyle } from "../../../lib/insightStyles";
import { getColorPalette } from "../../../lib/colorPalette";
import { Check, MessageSquare, ThumbsUp, Send, Loader2, CheckCircle2 } from "lucide-react";

const SwissFlag = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Suisse">
    <rect width="32" height="32" fill="#FF0000" rx="3" />
    <rect x="13" y="7" width="6" height="18" fill="white" />
    <rect x="7" y="13" width="18" height="6" fill="white" />
  </svg>
);

export default function ApprovePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [brandKit, setBrandKit] = useState<any>(null);
  const [annotations, setAnnotations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'approved' | 'reviewed' | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    const { data: projectData, error: projectError } = await supabase
      .from('client_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !projectData) {
      setLoading(false);
      return;
    }
    setProject(projectData);
    setAnnotations(projectData.annotations || projectData.slides.map(() => ''));

    // === Snapshot charte (Phase 3) ===
    // Si le projet est approuvé ET a un snapshot figé → on utilise la charte du moment de l'approbation
    // Sinon → charte live (brouillon, en attente, correction)
    if (projectData.status === 'approved' && projectData.brand_snapshot) {
        setBrandKit(projectData.brand_snapshot);
      } else if (projectData.client_email) {
        const { data: kitData } = await supabase
          .from('brand_kits')
          .select('*')
          .eq('client_email', projectData.client_email)
          .single();
        if (kitData) setBrandKit(kitData);
      }

    setLoading(false);
  };

  // Auto-save des annotations après 2 secondes d'inactivité
  const triggerAutoSave = useCallback((newAnnotations: string[]) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaving(true);
      await supabase
        .from('client_projects')
        .update({ annotations: newAnnotations })
        .eq('id', projectId);
      setAutoSaving(false);
      setLastSaved(new Date());
    }, 2000);
  }, [projectId]);

  const updateAnnotation = (index: number, value: string) => {
    const updated = [...annotations];
    updated[index] = value;
    setAnnotations(updated);
    triggerAutoSave(updated);
  };

  const handleApprove = async () => {
    if (!window.confirm("Confirmer l'approbation ? Le client recevra le feu vert pour publier.\n\nLa charte actuelle sera figée dans ce projet : si tu modifies la charte plus tard, ce projet restera identique.")) return;
    setSubmitting(true);

    // === Snapshot charte (Phase 3) ===
    // On capture l'état complet de la charte au moment de l'approbation pour le figer dans le projet
    let brand_snapshot: any = null;
    if (project?.client_email) {
      const { data: kitData } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('client_email', project.client_email)
        .single();
      brand_snapshot = kitData || null;
    }

    await supabase
      .from('client_projects')
      .update({ status: 'approved', annotations, brand_snapshot })
      .eq('id', projectId);
    setSubmitting(false);
    setSubmitted('approved');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  };

  const handleRequestChanges = async () => {
    const hasAnnotations = annotations.some((a) => a && a.trim().length > 0);
    if (!hasAnnotations) {
      return alert("Tu n'as laissé aucun commentaire. Ajoute au moins un retour sur une vignette avant de demander des corrections.");
    }
    if (!window.confirm("Envoyer les corrections au client ?")) return;
    setSubmitting(true);
    await supabase
      .from('client_projects')
      .update({ status: 'reviewed', annotations })
      .eq('id', projectId);
    setSubmitting(false);
    setSubmitted('reviewed');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  };

  const renderHighlightedText = (text: string) => {
    const parts = (text || '').split(/(<mark>.*?<\/mark>)/g);
    return parts.map((part, i) => {
      if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
        const cleanWord = part.replace(/<\/?mark>/g, '');
        let style: any = { borderRadius: '0.5cqw', fontWeight: 900 };
        if (brandKit?.highlight_style === 'bg_color') {
          style = { ...style, backgroundColor: brandKit.main_color, color: brandKit.bg_color, padding: '0 1cqw' };
        } else if (brandKit?.highlight_style === 'underline') {
          style = { ...style, textDecoration: 'underline', textDecorationColor: brandKit.main_color, textDecorationThickness: '0.6cqw', textUnderlineOffset: '0.5cqw' };
        } else {
          style = { ...style, color: brandKit?.main_color };
        }
        return <span key={i} style={style}>{cleanWord}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const getFontSizeCqw = (size: string): string => {
    switch (size) {
      case 'small': return '2.5cqw';
      case 'medium': return '3.5cqw';
      case 'large': return '4.5cqw';
      case 'xl': return '5.5cqw';
      default: return '3.5cqw';
    }
  };

  const renderSlide = (slide: any, i: number, total: number) => {
    if (!brandKit) return null;

    const alignment = brandKit.text_alignment || 'center';
    const textAlignClass = alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center';
    const flexAlignClass = alignment === 'left' ? 'items-start' : alignment === 'right' ? 'items-end' : 'items-center';

    const logoPosition = brandKit.logo_position || 'left';
    const logoPositionClass =
      logoPosition === 'center' ? 'top-[6%] left-1/2 -translate-x-1/2' :
      logoPosition === 'right' ? 'top-[6%] right-[6%]' :
      'top-[6%] left-[6%]';
    const paginationPositionClass = logoPosition === 'right' ? 'bottom-[6%] right-[6%]' : 'top-[6%] right-[6%]';

    const justifyClass = 'justify-end';

    const slideFontSize =
      slide.type === 'intro' ? getFontSizeCqw(brandKit.intro_text_size || 'xl') :
      slide.type === 'end' ? getFontSizeCqw(brandKit.end_text_size || 'xl') :
      getFontSizeCqw(brandKit.text_size || 'medium');

    const isTitleSlide = slide.type === 'intro' || slide.type === 'conclusion' || slide.type === 'end';
    const fontWeightClass = isTitleSlide ? 'font-black' : 'font-semibold';
    const textColor = slide.bg_image ? '#ffffff' : (brandKit.text_color || '#0a0a0a');

    // Palette de couleurs (main + secondaires définies OU dérivées)
    const palette = getColorPalette(brandKit?.main_color || '#f97316', brandKit?.secondary_colors);

    return (
      <div
        className={`aspect-square relative flex flex-col p-[8%] rounded-[2rem] overflow-hidden border-[6px] border-white shadow-2xl ${justifyClass}`}
        style={{
          backgroundColor: brandKit.bg_color,
          fontFamily: brandKit.font_family,
          containerType: 'inline-size'
        }}
      >
        {slide.bg_image && (
          <div className="absolute inset-0 z-0">
            <img src={slide.bg_image} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
          </div>
        )}

        <div className={`absolute z-20 ${logoPositionClass}`}>
          {brandKit.logo_url ? (
            <img src={brandKit.logo_url} className="h-[5cqw] object-contain opacity-90" alt="logo" />
          ) : (
            <span className="text-[2cqw] font-black uppercase tracking-widest" style={{ color: textColor, opacity: 0.7 }}>
              {brandKit.brand_name}
            </span>
          )}
        </div>

        <span className={`absolute z-20 text-[1.8cqw] font-black opacity-30 uppercase ${paginationPositionClass}`} style={{ color: textColor }}>
          {i + 1}/{total}
        </span>

        <div className={`relative z-10 w-full flex flex-col ${flexAlignClass}`} style={{ textAlign: alignment }}>

        {slide.type === 'intro' && slide.subtitle && (
            <div className={`flex items-center gap-[1.5cqw] mb-[3%] ${alignment === 'right' ? 'justify-end flex-row-reverse' : alignment === 'center' ? 'justify-center' : 'justify-start'}`}>
              {slide.badge_url ? (
                <img src={slide.badge_url} className="h-[18cqw] object-contain mix-blend-multiply" alt="" crossOrigin="anonymous" />
              ) : (
                <span
                  className={getInsightTextClass(brandKit?.insight_style || 'plain')}
                  style={{
                    fontFamily: brandKit?.insight_font_family || brandKit?.font_family,
                    ...getInsightInlineStyle(brandKit?.insight_style || 'plain', brandKit?.main_color || '#f97316', brandKit?.bg_color || '#000', textColor)
                  }}
                >
                  {slide.subtitle}
                </span>
              )}
            </div>
          )}

          {slide.type === 'stat' && slide.value && (
            <>
              <div
                className="font-black leading-[0.85] mb-[2%]"
                style={{
                  color: brandKit.main_color,
                  fontSize: slide.chart_data?.length ? '19cqw' : '15cqw',
                  letterSpacing: '-0.045em'
                }}
              >
                {slide.value}
              </div>
              {slide.value_caption && (
                <div
                  className="font-bold leading-tight mb-[3%]"
                  style={{
                    color: textColor,
                    fontSize: '2.4cqw',
                    opacity: 0.85,
                    maxWidth: '92%'
                  }}
                >
                  {slide.value_caption}
                </div>
              )}
            </>
          )}

          {slide.type === 'stat' && Array.isArray(slide.chart_data) && slide.chart_data.length > 0 && (() => {
            const chartType = slide.chart_type || 'bar';
            const data = slide.chart_data as Array<{ label: string; value: number }>;
            const trackBg = slide.bg_image ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)';

            if (chartType === 'bar') {
              const maxValue = Math.max(...data.map((p) => Number(p.value) || 0));
              return (
                <div className="space-y-[1.5cqw] mb-[4%] w-full">
                  {data.map((point, idx) => {
                    const pct = maxValue > 0 ? (Number(point.value) / maxValue) * 100 : 0;
                    const barColor = palette[idx % palette.length];
                    return (
                      <div key={idx} className="flex items-center gap-[1.5cqw]">
                        <span className="text-[1.6cqw] font-bold w-[22cqw] shrink-0 truncate" style={{ color: textColor }}>{point.label}</span>
                        <div className="flex-1 h-[2cqw] rounded-full overflow-hidden" style={{ backgroundColor: trackBg }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                        </div>
                        <span className="text-[1.8cqw] font-black w-[7cqw] text-right" style={{ color: textColor }}>{point.value}</span>
                      </div>
                    );
                  })}
                </div>
              );
            }

            if (chartType === 'pie') {
              const total = data.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
              if (total === 0) return null;
              let currentAngle = -90;
              const segments = data.map((point, idx) => {
                const value = Number(point.value) || 0;
                const angle = (value / total) * 360;
                const startAngle = currentAngle;
                const endAngle = currentAngle + angle;
                currentAngle = endAngle;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const x1 = 50 + 40 * Math.cos(startRad);
                const y1 = 50 + 40 * Math.sin(startRad);
                const x2 = 50 + 40 * Math.cos(endRad);
                const y2 = 50 + 40 * Math.sin(endRad);
                const largeArc = angle > 180 ? 1 : 0;
                const path = angle >= 359.99
                  ? `M 50 10 A 40 40 0 1 1 49.99 10 Z`
                  : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                return { path, color: palette[idx % palette.length], label: point.label, value: point.value };
              });
              return (
                <div className="flex items-center gap-[3cqw] mb-[4%] w-full">
                  <svg viewBox="0 0 100 100" className="w-[32cqw] h-[32cqw] shrink-0">
                    {segments.map((seg, idx) => (
                      <path key={idx} d={seg.path} fill={seg.color} />
                    ))}
                  </svg>
                  <div className="flex-1 space-y-[1cqw]">
                    {segments.map((seg, idx) => (
                      <div key={idx} className="flex items-center gap-[1cqw]">
                        <div className="w-[1.8cqw] h-[1.8cqw] rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                        <span className="text-[1.5cqw] font-bold flex-1 truncate" style={{ color: textColor }}>{seg.label}</span>
                        <span className="text-[1.7cqw] font-black" style={{ color: textColor }}>{seg.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (chartType === 'comparison') {
              const pair = data.slice(0, 2);
              const colorA = palette[0];
              const colorB = palette[1] || palette[0];
              if (pair.length === 1) {
                return (
                  <div className="w-full text-center mb-[4%]">
                    <div className="font-black leading-[0.9]" style={{ color: colorA, fontSize: '14cqw' }}>{pair[0].value}</div>
                    <div className="text-[2cqw] font-bold uppercase tracking-widest mt-[1cqw]" style={{ color: textColor, opacity: 0.7 }}>{pair[0].label}</div>
                  </div>
                );
              }
              return (
                <div className="flex items-center justify-center gap-[2cqw] mb-[4%] w-full">
                  <div className="flex-1 text-center">
                    <div className="font-black leading-[0.9]" style={{ color: colorA, fontSize: '11cqw' }}>{pair[0].value}</div>
                    <div className="text-[1.6cqw] font-bold uppercase tracking-widest mt-[1cqw]" style={{ color: textColor, opacity: 0.7 }}>{pair[0].label}</div>
                  </div>
                  <div className="font-black text-[5cqw] opacity-30" style={{ color: textColor }}>VS</div>
                  <div className="flex-1 text-center">
                    <div className="font-black leading-[0.9]" style={{ color: colorB, fontSize: '11cqw' }}>{pair[1].value}</div>
                    <div className="text-[1.6cqw] font-bold uppercase tracking-widest mt-[1cqw]" style={{ color: textColor, opacity: 0.7 }}>{pair[1].label}</div>
                  </div>
                </div>
              );
            }

            if (chartType === 'line') {
              const maxValue = Math.max(...data.map((p) => Number(p.value) || 0));
              if (maxValue === 0) return null;
              const points = data.map((point, idx) => {
                const x = data.length > 1 ? (idx / (data.length - 1)) * 90 + 5 : 50;
                const y = 45 - ((Number(point.value) / maxValue) * 35);
                return { x, y, label: point.label, value: point.value };
              });
              const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              const lineColor = palette[0];
              return (
                <div className="w-full mb-[4%]">
                  <div className="relative w-full h-[20cqw]">
                    <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      <path d={`${pathD} L ${points[points.length-1].x} 50 L ${points[0].x} 50 Z`} fill={lineColor} opacity="0.15" />
                      <path d={pathD} stroke={lineColor} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {points.map((p, idx) => (
                      <div
                        key={idx}
                        className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 z-10"
                        style={{
                          left: `${p.x}%`,
                          top: `${(p.y / 50) * 100}%`,
                          width: '2.4cqw',
                          height: '2.4cqw',
                          backgroundColor: palette[idx % palette.length],
                          boxShadow: '0 0 0 0.4cqw rgba(255,255,255,0.7)'
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-[1.5cqw] px-[1cqw] gap-[1cqw]">
                    {points.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-center text-center flex-1">
                        <span className="text-[1.7cqw] font-black" style={{ color: palette[idx % palette.length] }}>{p.value}</span>
                        <span className="text-[1.3cqw] font-bold opacity-70 truncate w-full" style={{ color: textColor }}>{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return null;
          })()}

          {slide.type === 'quote' && (
            <div className="text-[10cqw] font-black leading-none mb-[-2%]" style={{ color: brandKit.main_color, opacity: 0.3 }}>
              &ldquo;
            </div>
          )}

          <p
            className={`leading-[1.32] ${slide.type === 'quote' ? 'italic' : ''} ${textAlignClass} ${fontWeightClass}`}
            style={{ fontSize: slideFontSize, color: textColor }}
          >
            {renderHighlightedText(slide.text || '')}
          </p>

          {slide.type === 'quote' && slide.author && (
            <p className="font-black mt-[4%] opacity-80" style={{ color: textColor, fontSize: '2.2cqw' }}>
              — {slide.author}
            </p>
          )}

          {(slide.type === 'intro' || slide.type === 'conclusion' || slide.type === 'end') && (
            <div
              className={`h-[1cqw] mt-[5%] rounded-full ${alignment === 'right' ? 'ml-auto' : alignment === 'center' ? 'mx-auto' : ''}`}
              style={{ backgroundColor: brandKit.main_color, width: '15cqw' }}
            ></div>
          )}
        </div>

        {slide.image_attribution_required && slide.image_attribution && (
          <div className="absolute bottom-[1cqw] right-[1cqw] z-30 text-[0.85cqw] font-medium text-white/80 bg-black/40 px-[0.7cqw] py-[0.25cqw] rounded-md backdrop-blur-sm">
            📷 {slide.image_attribution} · {slide.image_source}
          </div>
        )}
      </div>
    );
  };

  // === ÉTATS DE LA PAGE ===

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400">
          <Loader2 className="animate-spin" size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-12">
        <div className="bg-white rounded-[2.5rem] p-12 max-w-md text-center shadow-2xl border border-neutral-200">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-4">Projet introuvable</h1>
          <p className="text-sm text-neutral-500 font-medium">Ce lien d&apos;approbation n&apos;existe pas ou a été supprimé.</p>
        </div>
      </div>
    );
  }

  // Confirmation après soumission
  if (submitted) {
    const isApproved = submitted === 'approved';
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-12">
        <div className="bg-white rounded-[2.5rem] p-12 max-w-md text-center shadow-2xl border border-neutral-200 space-y-6">
          <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center ${isApproved ? 'bg-green-100' : 'bg-orange-100'}`}>
            {isApproved ? <CheckCircle2 className="text-green-600" size={40} /> : <MessageSquare className="text-orange-600" size={40} />}
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">
            {isApproved ? "Projet approuvé !" : "Corrections envoyées"}
          </h1>
          <p className="text-sm text-neutral-500 font-medium">
            {isApproved
              ? `Le client de ${project.brand_name} reçoit le feu vert pour publier ses vignettes.`
              : "Le client est notifié de tes retours et va apporter les corrections demandées."}
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
            Tu peux maintenant fermer cet onglet
          </p>
        </div>
      </div>
    );
  }

  // Page déjà approuvée avant cette visite
  const alreadyApproved = project.status === 'approved';

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* HEADER */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img src="/media/logo.png" alt="BrandLock" className="h-10 w-auto object-contain" />
            <SwissFlag className="h-10 w-10 shrink-0" />
            <div className="ml-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Approbation</p>
              <h1 className="text-lg font-black italic uppercase tracking-tighter">{project.project_title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {autoSaving && (
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                <Loader2 size={12} className="animate-spin" /> Sauvegarde
              </span>
            )}
            {!autoSaving && lastSaved && (
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-green-600">
                <Check size={12} /> Sauvegardé
              </span>
            )}
            {!alreadyApproved && (
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-600/20 hover:bg-green-700 disabled:opacity-40 flex items-center gap-2"
              >
                <ThumbsUp size={12} /> Tout est OK
              </button>
            )}
          </div>
        </div>
      </header>

      {/* INFO BAR */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {alreadyApproved ? (
          <div className="bg-green-50 border border-green-200 rounded-3xl p-6 flex items-center gap-4">
            <CheckCircle2 className="text-green-600 shrink-0" size={28} />
            <div>
              <h2 className="font-black text-sm uppercase tracking-tight">Projet déjà approuvé</h2>
              <p className="text-xs text-green-700 font-medium mt-1">
                Tu as donné ton feu vert le {new Date(project.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Cette page est en lecture seule.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 space-y-2 shadow-sm">
            <h2 className="font-black text-sm uppercase tracking-tight">Tu valides {project.slides?.length || 0} vignettes pour {project.brand_name}</h2>
            <p className="text-xs text-neutral-500 font-medium leading-relaxed">
              Parcours les vignettes ci-dessous. Tu peux laisser un commentaire sous chacune si tu veux des modifs précises. Si tout est bon, clique sur <span className="font-black text-green-600">Tout est OK</span> en haut. Sinon, écris tes retours et clique sur <span className="font-black text-orange-600">Demander des corrections</span> en bas.
            </p>
          </div>
        )}
      </div>

      {/* SLIDES + ANNOTATIONS */}
      <main className="max-w-5xl mx-auto px-6 pb-32 space-y-12">
        {project.slides?.map((slide: any, i: number) => (
          <section key={i} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Vignette {i + 1}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 px-2 py-0.5 bg-orange-50 rounded-md">
                {slide.type}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div>
                {renderSlide(slide, i, project.slides.length)}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                  <MessageSquare size={12} />
                  Ton retour sur cette vignette
                </label>
                {alreadyApproved ? (
                  <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-4 text-sm text-neutral-500 min-h-[140px] whitespace-pre-wrap">
                    {annotations[i] || <span className="italic text-neutral-300">Aucun retour</span>}
                  </div>
                ) : (
                  <textarea
                    value={annotations[i] || ''}
                    onChange={(e) => updateAnnotation(i, e.target.value)}
                    placeholder="Ex : texte trop long, image floue, change le mot surligné..."
                    className="w-full p-4 bg-white border border-neutral-200 rounded-2xl outline-none focus:border-orange-500 text-sm resize-none h-[140px] shadow-sm"
                  />
                )}
                {!alreadyApproved && annotations[i] && annotations[i].trim().length > 0 && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-orange-500">
                    ⚠ Cette vignette a un retour
                  </p>
                )}
              </div>
            </div>
          </section>
        ))}
      </main>

      {/* FOOTER : boutons d'action */}
      {!alreadyApproved && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 shadow-2xl z-30">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-neutral-500 font-medium">
              {annotations.filter((a) => a && a.trim().length > 0).length} vignette(s) commentée(s) sur {project.slides?.length || 0}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRequestChanges}
                disabled={submitting}
                className="bg-orange-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-600 disabled:opacity-40 flex items-center gap-2"
              >
                <Send size={12} />
                {submitting ? 'Envoi...' : 'Demander des corrections'}
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="bg-green-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-600/20 hover:bg-green-700 disabled:opacity-40 flex items-center gap-2"
              >
                <ThumbsUp size={12} />
                {submitting ? 'Envoi...' : 'Approuver le tout'}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
