"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { toPng } from "html-to-image";
import PublicityModule from "../../components/PublicityModule";
import BrandLibrarySection from "../../components/BrandLibrarySection";
import { getInsightTextClass, getInsightInlineStyle } from "../../lib/insightStyles";
import { getColorPalette } from "../../lib/colorPalette";
import {
  Download, Send, Sparkles, Check, X, Trash2, Lightbulb, Pencil,
  Image as ImageIcon, RefreshCw, ArrowUp, ArrowDown, Layers, Archive,
  Link as LinkIcon, FileVideo, FilePlus, RotateCw, LogOut, Sun, Moon, MessageSquare, FileText,
  BarChart3, PieChart, GitCompare, TrendingUp, FolderOpen, Search
} from "lucide-react";

const SwissFlag = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Suisse">
    <rect width="32" height="32" fill="#FF0000" rx="3" />
    <rect x="13" y="7" width="6" height="18" fill="white" />
    <rect x="7" y="13" width="18" height="6" fill="white" />
  </svg>
);

const SLIDE_TYPES = [
  { value: 'intro', label: 'Intro' },
  { value: 'explanation', label: 'Explication' },
  { value: 'stat', label: 'Statistique' },
  { value: 'quote', label: 'Citation' },
  { value: 'conclusion', label: 'Conclusion' },
  { value: 'end', label: 'Fin (CTA)' }
];

const EXPORT_FORMATS = [
  { id: 'instagram-square', label: 'Instagram Carré', ratio: '1:1', width: 1080, height: 1080, layout: 'square' },
  { id: 'instagram-portrait', label: 'Instagram Portrait', ratio: '4:5', width: 1080, height: 1350, layout: 'portrait' },
  { id: 'instagram-story', label: 'Story / Reels', ratio: '9:16', width: 1080, height: 1920, layout: 'story' },
  { id: 'linkedin-square', label: 'LinkedIn Carré', ratio: '1:1', width: 1200, height: 1200, layout: 'square' },
  { id: 'linkedin-landscape', label: 'LinkedIn Paysage', ratio: '1.91:1', width: 1200, height: 627, layout: 'landscape' },
  { id: 'facebook-square', label: 'Facebook Carré', ratio: '1:1', width: 1200, height: 1200, layout: 'square' }
];

export default function ClientGeneratePage() {
  const router = useRouter();

  const [brandKit, setBrandKit] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [ideasFromFallback, setIdeasFromFallback] = useState(false);
  const [link, setLink] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [slides, setSlides] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectAnnotations, setProjectAnnotations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'studio' | 'library' | 'publicity' | 'photos'>('studio');
  const [libraryTab, setLibraryTab] = useState<'drafts' | 'pending' | 'approved' | 'archived'>('drafts');
  const [refreshingLibrary, setRefreshingLibrary] = useState(false);
  const [approvalEmails, setApprovalEmails] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['instagram-square']);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [tempText, setTempText] = useState("");
  const [tempValue, setTempValue] = useState("");
  const [tempValueCaption, setTempValueCaption] = useState("");
  const [regeneratingImageIndex, setRegeneratingImageIndex] = useState<number | null>(null);

  // Modal de changement d'image
  const [imageModalSlideIndex, setImageModalSlideIndex] = useState<number | null>(null);
  const [attachedPdfs, setAttachedPdfs] = useState<Array<{name: string; data: string; size: number}>>([]);
  const [stockKeyword, setStockKeyword] = useState("");
  const [customAiPrompt, setCustomAiPrompt] = useState("");
  const [generatingCustomImage, setGeneratingCustomImage] = useState(false);

  // Bibliothèque d'images officielles du client (chargée à l'ouverture du modal image)
  const [libraryImages, setLibraryImages] = useState<any[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  useEffect(() => {
    loadClientBrandKit();
    fetchProjects();
  }, []);

  const loadClientBrandKit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { data, error } = await supabase
        .from('brand_kits')
        .select('*')
        .ilike('client_email', user.email)
        .maybeSingle();
      if (error) {
        alert(`Erreur chargement charte : ${error.message}`);
        return;
      }
      if (data) {
        setBrandKit(data);
        if (data.insights?.length > 0) {
          setSelectedInsightId((curr) => curr || data.insights[0].id);
        }
      } else {
        alert(`Aucune charte trouvée pour ${user.email}.\nContacte ton admin pour qu'il crée ou rattache une charte à ton compte.`);
        await supabase.auth.signOut();
        router.push("/");
      }
    }
  };

  const fetchProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { data } = await supabase
        .from('client_projects')
        .select('*')
        .ilike('client_email', user.email)
        .order('updated_at', { ascending: false });
      if (data) setProjects(data);
    }
  };

  const handleRefreshLibrary = async () => {
    setRefreshingLibrary(true);
    await fetchProjects();
    setTimeout(() => setRefreshingLibrary(false), 400);
  };

  const handleLogout = async () => {
    if (!window.confirm("Te déconnecter ?")) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleNewProject = () => {
    if (slides.length > 0 && !window.confirm("Démarrer un nouveau projet ? Le projet en cours reste enregistré dans tes brouillons.")) return;
    setSlides([]);
    setCurrentProjectId(null);
    setProjectAnnotations([]);
    setPrompt("");
    setSuggestedIdeas([]);
    setEditMode(false);
    setEditingSlideIndex(null);
    setApprovalEmails("");
    setView('studio');
  };

  const openProject = async (project: any) => {
    await loadClientBrandKit();
    setSlides(project.slides || []);
    setCurrentProjectId(project.id);
    setProjectAnnotations(project.annotations || []);
    setView('studio');
    setEditMode(false);
  };

  const handleGetIdeas = async () => {
    if (!brandKit) return;
    setLoadingIdeas(true);
    setSuggestedIdeas([]);
    setIdeasFromFallback(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isIdeaMode: true, brandKit, link })
      });
      const data = await res.json();
      if (data.ideas && data.ideas.length > 0) {
        setSuggestedIdeas(data.ideas);
        if (data.usedFallback) setIdeasFromFallback(true);
      } else if (data.error) {
        alert(data.error);
      } else {
        alert("Pas d'idées reçues. Réessaye dans quelques minutes.");
      }
    } catch {
      alert("Erreur Inspire-moi.");
    } finally {
      setLoadingIdeas(false);
    }
  };

  const handlePickIdea = (idea: string) => {
    setPrompt((p) => (p ? `${p}\n• ${idea}` : `• ${idea}`));
  };

  const handleGenerateProduction = async () => {
    if (!brandKit) return;
    setLoading(true);
    setEditMode(false);
    setProjectAnnotations([]);
    try {
      await loadClientBrandKit();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandKit,
          slideCount,
          prompt,
          link,
          isIdeaMode: false,
          selectedInsight: brandKit?.insights?.find((i: any) => i.id === selectedInsightId)
            || brandKit?.insights?.[0]
            || null,
          attachedPdfs
        })
      });
      const data = await res.json();

      if (data.slides) {
        setSlides(data.slides);
        setAttachedPdfs([]);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newProject } = await supabase.from('client_projects').insert([{
          client_email: user?.email?.toLowerCase(),
          brand_name: brandKit.brand_name,
          project_title: data.project_title || "Nouveau projet",
          slides: data.slides,
          status: 'draft',
          prompt_used: prompt,
          bg_color: brandKit.bg_color,
          main_color: brandKit.main_color
        }]).select();
        if (newProject) {
          setCurrentProjectId(newProject[0].id);
          fetchProjects();
        }
      } else {
        alert(data.error || "Aucune slide générée.");
      }
    } catch {
      alert("Erreur production.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (id: string, title: string) => {
    if (!window.confirm(`Supprimer "${title}" ? Cette action est irréversible.`)) return;
    await supabase.from('client_projects').delete().eq('id', id);
    if (currentProjectId === id) {
      setSlides([]);
      setCurrentProjectId(null);
      setProjectAnnotations([]);
    }
    fetchProjects();
  };

  const handleArchiveProject = async (id: string) => {
    if (!window.confirm("Archiver ce projet ? Il ne sera plus modifiable.")) return;
    await supabase.from('client_projects').update({
      archived: true,
      archived_at: new Date().toISOString()
    }).eq('id', id);
    fetchProjects();
  };

  const handleSendForApproval = async () => {
    if (!currentProjectId) return;
    await supabase.from('client_projects').update({
      status: 'pending',
      approval_emails: approvalEmails || null
    }).eq('id', currentProjectId);
    const approvalLink = `${window.location.origin}/approve/${currentProjectId}`;
    if (approvalEmails.trim()) {
      alert(`Projet envoyé à : ${approvalEmails}\n\nLien d'approbation :\n${approvalLink}`);
    } else {
      navigator.clipboard.writeText(approvalLink);
      alert(`Lien d'approbation copié dans le presse-papier :\n\n${approvalLink}`);
    }
    await fetchProjects();
    setView('library');
    setLibraryTab('pending');
  };

  const handleCopyApprovalLink = () => {
    if (!currentProjectId) return;
    const approvalLink = `${window.location.origin}/approve/${currentProjectId}`;
    navigator.clipboard.writeText(approvalLink);
    alert("Lien copié dans le presse-papier !");
  };

  const persistSlides = async (newSlides: any[]) => {
    setSlides(newSlides);
    if (currentProjectId) {
      await supabase.from('client_projects').update({
        slides: newSlides,
        updated_at: new Date().toISOString()
      }).eq('id', currentProjectId);
    }
  };

  const startEditingText = (index: number) => {
    setEditingSlideIndex(index);
    setTempText(slides[index].text || '');
    setTempValue(slides[index].value || '');
    setTempValueCaption(slides[index].value_caption || '');
  };

  const saveSlideText = async (index: number) => {
    const updatedSlides = [...slides];
    updatedSlides[index].text = tempText;
    if (updatedSlides[index].type === 'stat') {
      updatedSlides[index].value = tempValue;
      updatedSlides[index].value_caption = tempValueCaption;
    }
    await persistSlides(updatedSlides);
    setEditingSlideIndex(null);
  };

  const applyHighlightToSelection = () => {
    if (!editTextAreaRef.current) return;
    const textarea = editTextAreaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return alert("Sélectionne du texte à surligner.");
    const newText = tempText.substring(0, start) + `<mark>${tempText.substring(start, end)}</mark>` + tempText.substring(end);
    setTempText(newText);
  };

  const clearAllHighlights = () => {
    setTempText(tempText.replace(/<\/?mark>/g, ''));
  };

  const changeChartType = async (index: number, type: string) => {
    const updatedSlides = [...slides];
    updatedSlides[index] = { ...updatedSlides[index], chart_type: type };
    await persistSlides(updatedSlides);
  };

  const changeSlideType = async (index: number, newType: string) => {
    if (index === 0 || index === slides.length - 1) {
      return alert("La première et la dernière vignette ont un template fixe.");
    }
    const updatedSlides = [...slides];
    updatedSlides[index] = { ...updatedSlides[index], type: newType };
    if (newType === 'stat' && !updatedSlides[index].value) {
      updatedSlides[index].value = '50%';
    }
    await persistSlides(updatedSlides);
  };

  const deleteSlide = async (index: number) => {
    if (index === 0 || index === slides.length - 1) {
      return alert("Tu ne peux pas supprimer la première ou la dernière vignette.");
    }
    if (slides.length <= 3) {
      return alert("Tu dois garder au moins 3 vignettes (intro + milieu + fin).");
    }
    if (!window.confirm("Supprimer cette vignette ?")) return;
    const updatedSlides = slides.filter((_, idx) => idx !== index);
    await persistSlides(updatedSlides);
    setEditingSlideIndex(null);
  };

  const removeSlideImage = async (index: number) => {
    const updatedSlides = [...slides];
    updatedSlides[index].bg_image = null;
    await persistSlides(updatedSlides);
  };

  const handleImageUpload = async (index: number, file: File) => {
    setRegeneratingImageIndex(index);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentProjectId || 'tmp'}-${index}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('slide-images')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('slide-images')
        .getPublicUrl(fileName);
      const updatedSlides = [...slides];
      updatedSlides[index].bg_image = publicUrl;
      await persistSlides(updatedSlides);
    } catch (err: any) {
      alert("Erreur upload : " + err.message);
    } finally {
      setRegeneratingImageIndex(null);
    }
  };

  // Résolveur d'URL robuste : ne sait pas exactement quel champ stocke l'URL
  // ni quel bucket Supabase est utilisé, donc on essaie plusieurs candidats dans l'ordre :
  // 1. Champs URL directs (url, public_url, image_url, signed_url)
  // 2. Si c'est juste un path, on construit la public URL via supabase.storage
  // 3. Si rien ne marche, on retourne null et l'UI affichera un placeholder
  const resolveLibraryImageUrl = (img: any): string | null => {
    if (!img) return null;
    // Étape 1 : URLs directes
    const directFields = ['url', 'public_url', 'publicUrl', 'image_url', 'imageUrl', 'signed_url', 'signedUrl', 'src'];
    for (const f of directFields) {
      const v = img[f];
      if (typeof v === 'string' && v.startsWith('http')) return v;
    }
    // Étape 2 : construction depuis un path + nom de bucket
    const pathFields = ['path', 'storage_path', 'storagePath', 'file_path', 'filePath', 'image_path', 'imagePath', 'object_path'];
    const bucketCandidates = [img.bucket, 'brand-images', 'brand-library', 'client-images', 'brand-knowledge', 'images'].filter(Boolean);
    for (const pf of pathFields) {
      const path = img[pf];
      if (typeof path === 'string' && path.length > 0) {
        for (const bucket of bucketCandidates) {
          try {
            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
            if (data?.publicUrl) return data.publicUrl;
          } catch { /* essaie le bucket suivant */ }
        }
      }
    }
    return null;
  };

  const loadBrandLibrary = async () => {
    if (!brandKit?.client_email) return;
    setLoadingLibrary(true);
    try {
      const { data, error } = await supabase
        .from('brand_images')
        .select('*')
        .ilike('client_email', brandKit.client_email)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn("Erreur chargement bibliothèque :", error.message);
        setLibraryImages([]);
      } else {
        // Résolution proactive de l'URL pour chaque image — sinon le <img> ne sait pas où chercher
        const enriched = (data || []).map((img: any) => ({
          ...img,
          _resolvedUrl: resolveLibraryImageUrl(img)
        }));
        const withUrls = enriched.filter((i: any) => i._resolvedUrl);
        const withoutUrls = enriched.filter((i: any) => !i._resolvedUrl);
        if (withoutUrls.length > 0) {
          console.warn(`⚠ ${withoutUrls.length} image(s) sans URL résolvable. Champs disponibles sur la première :`, Object.keys(withoutUrls[0]));
          console.warn('Première image non résolue :', withoutUrls[0]);
        }
        console.log(`📚 Bibliothèque chargée : ${withUrls.length} image(s) avec URL valide, ${withoutUrls.length} sans URL`);
        setLibraryImages(enriched);
      }
    } catch (err: any) {
      console.warn("Exception bibliothèque :", err.message);
      setLibraryImages([]);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const applyLibraryImage = async (image: any) => {
    if (imageModalSlideIndex === null) return;
    const resolvedUrl = image._resolvedUrl || resolveLibraryImageUrl(image);
    if (!resolvedUrl) {
      alert("Impossible d'utiliser cette image : URL introuvable. Contacte ton admin pour vérifier les médias.");
      return;
    }
    const updatedSlides = [...slides];
    updatedSlides[imageModalSlideIndex].bg_image = resolvedUrl;
    updatedSlides[imageModalSlideIndex].image_source = 'brand_library';
    updatedSlides[imageModalSlideIndex].image_license = 'owned';
    updatedSlides[imageModalSlideIndex].image_attribution = null;
    updatedSlides[imageModalSlideIndex].image_attribution_required = false;
    updatedSlides[imageModalSlideIndex].image_source_url = null;
    await persistSlides(updatedSlides);
    closeImageModal();
  };

  const openImageModal = (index: number) => {
    const slide = slides[index];
    setImageModalSlideIndex(index);
    setStockKeyword(slide.image_keyword || "");
    setCustomAiPrompt("");
    setLibrarySearch("");
    loadBrandLibrary();
  };

  const closeImageModal = () => {
    setImageModalSlideIndex(null);
    setStockKeyword("");
    setCustomAiPrompt("");
    setLibrarySearch("");
  };

  const refreshStockImage = async () => {
    if (imageModalSlideIndex === null) return;
    if (!stockKeyword.trim()) return alert("Tape un mot-clé pour la recherche.");
    setRegeneratingImageIndex(imageModalSlideIndex);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateImageKeyword: stockKeyword.trim() })
      });
      const data = await res.json();
      if (data.bg_image) {
        const updatedSlides = [...slides];
        updatedSlides[imageModalSlideIndex].bg_image = data.bg_image;
        updatedSlides[imageModalSlideIndex].image_keyword = stockKeyword.trim();
        await persistSlides(updatedSlides);
        closeImageModal();
      }
    } catch {
      alert("Erreur récupération image stock.");
    } finally {
      setRegeneratingImageIndex(null);
    }
  };

  const generateCustomAiImage = async () => {
    if (imageModalSlideIndex === null) return;
    if (!customAiPrompt.trim()) return alert("Décris l'image que tu veux générer.");
    if (!window.confirm("Cette génération AI coûte ~$0.04 et prend 20-40 secondes. Continuer ?")) return;

    setGeneratingCustomImage(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customImagePrompt: customAiPrompt.trim(), brandKit })
      });
      const data = await res.json();
      if (data.bg_image) {
        const updatedSlides = [...slides];
        updatedSlides[imageModalSlideIndex].bg_image = data.bg_image;
        await persistSlides(updatedSlides);
        closeImageModal();
      } else {
        alert(data.error || "Erreur génération AI.");
      }
    } catch {
      alert("Erreur génération AI.");
    } finally {
      setGeneratingCustomImage(false);
    }
  };

  const moveSlide = async (index: number, direction: 'up' | 'down') => {
    if (index === 0 || index === slides.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex === 0 || targetIndex === slides.length - 1) return;
    const updatedSlides = [...slides];
    [updatedSlides[index], updatedSlides[targetIndex]] = [updatedSlides[targetIndex], updatedSlides[index]];
    await persistSlides(updatedSlides);
  };

  const handleOpenExport = () => setShowExportModal(true);

  const toggleFormat = (id: string) => {
    setSelectedFormats((curr) =>
      curr.includes(id) ? curr.filter((f) => f !== id) : [...curr, id]
    );
  };

  const downloadAllFormats = async () => {
    if (selectedFormats.length === 0) return alert("Sélectionne au moins un format.");
    setShowExportModal(false);

    for (const formatId of selectedFormats) {
      const format = EXPORT_FORMATS.find((f) => f.id === formatId);
      if (!format) continue;

      for (let i = 0; i < slides.length; i++) {
        const el = document.getElementById(`slide-${i}-${formatId}`);
        if (el) {
          try {
            const dataUrl = await toPng(el, {
              pixelRatio: 2,
              cacheBust: true,
              backgroundColor: brandKit?.bg_color || '#ffffff'
            });
            const dl = document.createElement("a");
            dl.download = `${format.id}-slide-${i + 1}.png`;
            dl.href = dataUrl;
            dl.click();
            await new Promise(r => setTimeout(r, 300));
          } catch (err) {
            console.error(`Erreur export ${format.id}-slide-${i + 1}:`, err);
          }
        }
      }
    }
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

  const statusDot = (status: string, archived: boolean) => {
    if (archived) return <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-md ${isDarkMode ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-500'}`}>Archivé</span>;
    const map: Record<string, { color: string; label: string }> = {
      draft: { color: 'bg-neutral-300', label: 'Brouillon' },
      pending: { color: 'bg-orange-400', label: 'En attente' },
      reviewed: { color: 'bg-neutral-300', label: 'Corrections demandées' },
      approved: { color: 'bg-green-500', label: 'Approuvé' }
    };
    const s = map[status] || map.draft;
    return (
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${s.color}`}></span>
        <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>{s.label}</span>
      </div>
    );
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

  const renderSlide = (slide: any, i: number, options: { idSuffix?: string; layout?: string } = {}) => {
    const { idSuffix = '', layout = 'square' } = options;

    // === Template config par type de vignette (Phase 2b) ===
    const template = brandKit?.templates?.[slide.type] || {};

    // Typo : template > typo par défaut > brandKit.font_family > fallback
    const typographies = Array.isArray(brandKit?.typographies) ? brandKit.typographies : [];
    const templateTypo = template.font_id ? typographies.find((t: any) => t.id === template.font_id) : null;
    const defaultTypo = typographies.find((t: any) => t.is_default) || typographies[0];
    const fontFamily = templateTypo?.family || defaultTypo?.family || brandKit?.font_family || 'Inter, system-ui, sans-serif';

    // Couleur du texte : template.color_ref > text_color global (blanc forcé si bg_image)
    const resolveColor = (ref?: string): string => {
      if (!ref || ref === 'text') return brandKit?.text_color || '#0a0a0a';
      if (ref === 'main') return brandKit?.main_color || '#f97316';
      if (ref === 'bg') return brandKit?.bg_color || '#ffffff';
      const sec = (brandKit?.secondary_colors || []).find((c: any) => c?.id === ref);
      return sec?.hex || brandKit?.text_color || '#0a0a0a';
    };
    const templateColor = resolveColor(template.color_ref);
    const textColor = slide.bg_image ? '#ffffff' : templateColor;

    // Alignement horizontal : template > global
    const alignment = (template.h_align || brandKit?.text_alignment || 'center') as 'left' | 'center' | 'right';
    const textAlignClass = alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center';
    const flexAlignClass = alignment === 'left' ? 'items-start' : alignment === 'right' ? 'items-end' : 'items-center';

    // Alignement vertical : template > 'bottom'
    const vAlign = template.v_align || 'bottom';

    const logoPosition = brandKit?.logo_position || 'left';
    const logoPositionClass =
      logoPosition === 'center' ? 'top-[6%] left-1/2 -translate-x-1/2' :
      logoPosition === 'right' ? 'top-[6%] right-[6%]' :
      'top-[6%] left-[6%]';

    const paginationPositionClass = logoPosition === 'right' ? 'bottom-[6%] right-[6%]' : 'top-[6%] right-[6%]';

    const aspectClass =
      layout === 'portrait' ? 'aspect-[4/5]' :
      layout === 'story' ? 'aspect-[9/16]' :
      layout === 'landscape' ? 'aspect-[1.91/1]' :
      'aspect-square';

    const justifyClass =
      layout === 'landscape' ? 'justify-center' :
      vAlign === 'top' ? 'justify-start' :
      vAlign === 'center' ? 'justify-center' :
      'justify-end';

    // Quand v_align='top', on pousse le contenu sous la zone du logo pour éviter le chevauchement
    const contentTopMargin = vAlign === 'top' && layout !== 'landscape' ? 'mt-[10cqw]' : '';

    // Taille du texte : template > intro/end size > text_size global
    const sizeKey = template.text_size
      || (slide.type === 'intro' ? brandKit?.intro_text_size :
          slide.type === 'end' ? brandKit?.end_text_size :
          brandKit?.text_size)
      || 'medium';
    const slideFontSize = getFontSizeCqw(sizeKey);

    const isTitleSlide = slide.type === 'intro' || slide.type === 'conclusion' || slide.type === 'end';
    const fontWeightClass = isTitleSlide ? 'font-black' : 'font-semibold';

    // Palette de couleurs (main + secondaires définies OU dérivées)
    const palette = getColorPalette(brandKit?.main_color || '#f97316', brandKit?.secondary_colors);

    return (
      <div
        id={`slide-${i}${idSuffix}`}
        className={`${aspectClass} relative flex flex-col p-[8%] rounded-[2rem] overflow-hidden border-[6px] border-white shadow-2xl ${justifyClass}`}
        style={{
          backgroundColor: brandKit?.bg_color,
          fontFamily,
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
          {brandKit?.logo_url ? (
            <img src={brandKit.logo_url} className="h-[5cqw] object-contain opacity-90" alt="logo" />
          ) : (
            <span className="text-[2cqw] font-black uppercase tracking-widest" style={{ color: textColor, opacity: 0.7 }}>
              {brandKit?.brand_name}
            </span>
          )}
        </div>

        <span className={`absolute z-20 text-[1.8cqw] font-black opacity-30 uppercase ${paginationPositionClass}`} style={{ color: textColor }}>
          {i + 1}/{slides.length}
        </span>

        <div className={`relative z-10 w-full flex flex-col ${flexAlignClass} ${contentTopMargin}`} style={{ textAlign: alignment }}>

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
                  color: brandKit?.main_color,
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
            <div className="text-[10cqw] font-black leading-none mb-[-2%]" style={{ color: brandKit?.main_color, opacity: 0.3 }}>
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
              style={{ backgroundColor: brandKit?.main_color, width: '15cqw' }}
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

  if (!brandKit) return <div className={`h-screen flex items-center justify-center font-black italic ${isDarkMode ? 'bg-neutral-950 text-orange-400' : 'bg-neutral-50 text-orange-500'}`}>CHARGEMENT...</div>;

  const filteredProjects = projects.filter((p) => {
    if (libraryTab === 'archived') return p.archived;
    if (p.archived) return false;
    if (libraryTab === 'drafts') return p.status === 'draft' || p.status === 'reviewed';
    if (libraryTab === 'pending') return p.status === 'pending';
    if (libraryTab === 'approved') return p.status === 'approved';
    return true;
  });

  const themeBg = isDarkMode ? 'bg-neutral-950' : 'bg-neutral-50';
  const themeText = isDarkMode ? 'text-neutral-100' : 'text-neutral-900';
  const cardBg = isDarkMode ? 'bg-neutral-900' : 'bg-white';
  const cardBorder = isDarkMode ? 'border-neutral-800' : 'border-neutral-200';
  const inputBg = isDarkMode ? 'bg-neutral-950 border-neutral-800 text-neutral-100' : 'bg-neutral-50 border-neutral-100 text-neutral-900';
  const mutedText = isDarkMode ? 'text-neutral-500' : 'text-neutral-400';
  const subtleBg = isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100';

  const accentColor = brandKit?.main_color || '#f97316';

  const hasAnnotations = projectAnnotations.some((a) => a && a.trim().length > 0);

  return (
    <div className={`min-h-screen flex flex-col ${themeBg} ${themeText}`}>

      <nav className={`h-16 px-8 border-b flex justify-between items-center z-30 sticky top-0 ${isDarkMode ? 'border-neutral-900 bg-neutral-950' : 'border-neutral-200 bg-white'}`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/media/logo.png" alt="BrandLock" className="h-9 w-auto object-contain" />
            <SwissFlag className="h-9 w-9 shrink-0" />
          </div>
          <div className={`flex p-1 rounded-lg ${subtleBg}`}>
            <button onClick={() => setView('studio')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${view === 'studio' ? (isDarkMode ? 'bg-neutral-700 text-orange-400 shadow-sm' : 'bg-white shadow-sm text-orange-600') : 'opacity-40'}`}>Studio</button>
            <button onClick={() => setView('library')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${view === 'library' ? (isDarkMode ? 'bg-neutral-700 text-orange-400 shadow-sm' : 'bg-white shadow-sm text-orange-600') : 'opacity-40'}`}>Projets</button>
            {brandKit?.publicity_enabled && (
              <button onClick={() => setView('publicity')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${view === 'publicity' ? (isDarkMode ? 'bg-neutral-700 text-orange-400 shadow-sm' : 'bg-white shadow-sm text-orange-600') : 'opacity-40'}`}>📢 Pub</button>
            )}
            <button onClick={() => setView('photos')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${view === 'photos' ? (isDarkMode ? 'bg-neutral-700 text-orange-400 shadow-sm' : 'bg-white shadow-sm text-orange-600') : 'opacity-40'}`}>🖼️ Photos</button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleLogout} title="Déconnexion" className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}>
            <LogOut size={16} />
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} title={isDarkMode ? "Mode clair" : "Mode sombre"} className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </nav>

      {view === 'studio' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">

          <div className="space-y-4">
            <div className={`p-6 rounded-[2rem] border space-y-6 ${cardBg} ${cardBorder} ${isDarkMode ? '' : 'shadow-xl'}`}>
              <div className="flex justify-between items-center">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Creative Lab</h2>
                {slides.length > 0 && (
                  <button
                    onClick={handleNewProject}
                    title="Nouveau projet"
                    className={`p-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  >
                    <FilePlus size={12} /> Nouveau
                  </button>
                )}
              </div>

              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Décris ton sujet, ou clique sur Inspire-moi..." className={`w-full p-4 rounded-2xl border outline-none h-32 text-sm resize-none ${inputBg}`} />

              <button onClick={handleGetIdeas} disabled={loadingIdeas} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 ${isDarkMode ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-900 text-white'}`}>
                <Lightbulb size={14} />
                {loadingIdeas ? "Recherche en cours..." : "Inspire-moi"}
              </button>

              {suggestedIdeas.length > 0 && (
                <div className={`space-y-2 p-3 rounded-2xl border ${isDarkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-100'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">
                    {ideasFromFallback ? "Idées basées sur ta charte (quota web épuisé)" : "Idées du web (clique pour ajouter)"}
                  </p>
                  {suggestedIdeas.map((idea, idx) => (
                    <button key={idx} onClick={() => handlePickIdea(idea)} className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-all ${isDarkMode ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 hover:text-orange-400' : 'bg-white hover:bg-orange-50 hover:text-orange-600 border-neutral-100'}`}>{idea}</button>
                  ))}
                  <button
                    onClick={handleGetIdeas}
                    disabled={loadingIdeas}
                    className={`w-full mt-1 px-3 py-2 rounded-xl border-2 border-dashed text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40 ${isDarkMode ? 'border-neutral-800 hover:border-orange-500 text-neutral-400 hover:text-orange-400' : 'border-neutral-200 hover:border-orange-500 text-neutral-500 hover:text-orange-500'}`}
                  >
                    <RefreshCw size={12} className={loadingIdeas ? 'animate-spin' : ''} />
                    {loadingIdeas ? "Recherche..." : "Régénérer 3 nouvelles idées"}
                  </button>
                </div>
              )}

{brandKit?.insights && brandKit.insights.length > 1 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 px-1">Sous-titre intro</label>
                  <select
                    value={selectedInsightId || ''}
                    onChange={(e) => setSelectedInsightId(e.target.value)}
                    className={`w-full p-3 rounded-xl border outline-none text-sm ${inputBg}`}
                  >
                    {brandKit.insights.map((insight: any) => (
                      <option key={insight.id} value={insight.id}>{insight.label}</option>
                    ))}
                  </select>
                </div>
              )}



<div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 px-1">Documents PDF (optionnel)</label>
                {attachedPdfs.map((pdf, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-100'}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText size={14} className="shrink-0 text-orange-500" />
                      <span className="text-xs font-medium truncate">{pdf.name}</span>
                      <span className={`text-[10px] shrink-0 ${mutedText}`}>{(pdf.size / 1024 / 1024).toFixed(1)}MB</span>
                    </div>
                    <button onClick={() => setAttachedPdfs(prev => prev.filter((_, i) => i !== idx))} className={`p-1 rounded shrink-0 ${isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-200'}`}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {attachedPdfs.length < 3 && (
                  <label className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDarkMode ? 'border-neutral-800 hover:border-orange-500 text-neutral-400' : 'border-neutral-200 hover:border-orange-500 text-neutral-500'}`}>
                    <FilePlus size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ajouter PDF ({attachedPdfs.length}/3)</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) {
                          alert('PDF trop gros (max 10MB)');
                          e.target.value = '';
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const base64 = (reader.result as string).split(',')[1];
                          setAttachedPdfs(prev => [...prev, { name: file.name, data: base64, size: file.size }]);
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>

              <button onClick={handleGenerateProduction} disabled={loading || !prompt} className="w-full bg-orange-500 text-white py-4 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                <Sparkles size={14} />
                {loading ? "Génération en cours..." : "Créer Vignettes"}
              </button>

              <div className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-100'}`}>
                <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">{slideCount} Slides</span>
                <input type="range" min="3" max="8" value={slideCount} onChange={(e) => setSlideCount(parseInt(e.target.value))} className="accent-orange-500 w-24" />
              </div>
            </div>

            {slides.length > 0 && (
              <div className={`p-6 rounded-[2rem] border space-y-3 ${cardBg} ${cardBorder} ${isDarkMode ? '' : 'shadow-xl'}`}>
                {!editMode ? (
                  <>
                    <button onClick={() => setEditMode(true)} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200' : 'bg-neutral-100 hover:bg-neutral-200'}`}>
                      <Pencil size={14} /> Modifier les vignettes
                    </button>
                    <button onClick={handleOpenExport} className="w-full bg-orange-500 text-white py-3 rounded-xl text-[10px] font-black uppercase shadow-lg flex items-center justify-center gap-2">
                      <Download size={14} /> Exporter PNG
                    </button>
                    <div className={`border-t pt-3 space-y-2 ${isDarkMode ? 'border-neutral-800' : ''}`}>
                      <input type="text" value={approvalEmails} onChange={(e) => setApprovalEmails(e.target.value)} placeholder="Email du patron (optionnel)..." className={`w-full p-3 rounded-xl text-xs outline-none ${isDarkMode ? 'bg-neutral-950 text-neutral-100 border border-neutral-800' : 'bg-neutral-50 border-none'}`} />
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleCopyApprovalLink} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isDarkMode ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-neutral-900 text-white'}`}>
                          <LinkIcon size={12} /> Copier lien
                        </button>
                        <button onClick={handleSendForApproval} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isDarkMode ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-neutral-900 text-white'}`}>
                          <Send size={12} /> Envoyer
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <button onClick={() => { setEditMode(false); setEditingSlideIndex(null); }} className="w-full bg-green-600 text-white py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                    <Check size={14} /> OK / Sauvegarder
                  </button>
                )}
              </div>
            )}

            {hasAnnotations && (
              <div className={`p-6 rounded-[2rem] border-2 ${isDarkMode ? 'bg-orange-950/20 border-orange-900' : 'bg-orange-50 border-orange-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={14} className={isDarkMode ? 'text-orange-400' : 'text-orange-600'} />
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>Corrections demandées</h3>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-orange-200' : 'text-orange-700'}`}>
                  Le patron a laissé des annotations sur certaines vignettes. Regarde sous chaque slide concernée pour voir les retours.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 pb-12">
            {slides.length > 0 ? (
              <div className="space-y-6">
                {editMode && (
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-orange-950/30 border-orange-900/50' : 'bg-orange-50 border-orange-200'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>Mode édition — utilise les icônes en haut de chaque vignette</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {slides.map((slide, i) => {
                    const isFirst = i === 0;
                    const isLast = i === slides.length - 1;
                    const isLocked = isFirst || isLast;
                    const annotationText = projectAnnotations[i];
                    const hasAnnotation = annotationText && annotationText.trim().length > 0;

                    return (
                      <div key={i} className="space-y-3">
                        <div className="relative group">
                          {renderSlide(slide, i)}

                          {editMode && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 opacity-90 group-hover:opacity-100 transition-opacity">
                              <div className="flex flex-wrap gap-1.5 p-2 bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-neutral-200">
                                <button onClick={() => startEditingText(i)} title="Modifier texte" className="p-2 bg-white rounded-xl hover:bg-orange-500 hover:text-white transition-all">
                                  <Pencil size={14} />
                                </button>
                                <input type="file" accept="image/*" ref={(el) => { fileInputRefs.current[i] = el; }} onChange={(e) => e.target.files?.[0] && handleImageUpload(i, e.target.files[0])} className="hidden" />
                                <button onClick={() => fileInputRefs.current[i]?.click()} title="Importer une image depuis mon ordinateur" className="p-2 bg-white rounded-xl hover:bg-orange-500 hover:text-white transition-all">
                                  <FilePlus size={14} />
                                </button>
                                <button onClick={() => openImageModal(i)} disabled={regeneratingImageIndex === i} title="Modifier l'image (médias, banque d'images, IA)" className="p-2 bg-white rounded-xl hover:bg-orange-500 hover:text-white transition-all disabled:opacity-40">
                                  <RefreshCw size={14} className={regeneratingImageIndex === i ? 'animate-spin' : ''} />
                                </button>
                                {slide.bg_image && (
                                  <button onClick={() => removeSlideImage(i)} title="Supprimer image" className="p-2 bg-white rounded-xl hover:bg-red-500 hover:text-white transition-all">
                                    <X size={14} />
                                  </button>
                                )}
                                {!isLocked && (
                                  <>
                                    <button onClick={() => moveSlide(i, 'up')} disabled={i <= 1} title="Monter" className="p-2 bg-white rounded-xl hover:bg-orange-500 hover:text-white transition-all disabled:opacity-30">
                                      <ArrowUp size={14} />
                                    </button>
                                    <button onClick={() => moveSlide(i, 'down')} disabled={i >= slides.length - 2} title="Descendre" className="p-2 bg-white rounded-xl hover:bg-orange-500 hover:text-white transition-all disabled:opacity-30">
                                      <ArrowDown size={14} />
                                    </button>
                                    <button onClick={() => deleteSlide(i)} title="Supprimer cette vignette" className="p-2 bg-white rounded-xl hover:bg-red-500 hover:text-white transition-all">
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {hasAnnotation && (
                          <div className={`p-4 rounded-2xl border-l-4 border-orange-500 ${isDarkMode ? 'bg-orange-950/20' : 'bg-orange-50'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <MessageSquare size={12} className={isDarkMode ? 'text-orange-400' : 'text-orange-600'} />
                              <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>Feedback patron</span>
                            </div>
                            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-orange-100' : 'text-orange-900'}`}>
                              {annotationText}
                            </p>
                          </div>
                        )}

{editMode && !isLocked && (
                          <div className="flex items-center gap-2 px-2">
                            <Layers size={12} className={mutedText} />
                            <select value={slide.type} onChange={(e) => changeSlideType(i, e.target.value)} className={`flex-1 text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-2 outline-none ${isDarkMode ? 'bg-neutral-900 border border-neutral-800 text-neutral-200' : 'bg-neutral-50 border border-neutral-100'}`}>
                              {SLIDE_TYPES.filter((t) => t.value !== 'intro' && t.value !== 'end').map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {editMode && !isLocked && slide.type === 'stat' && Array.isArray(slide.chart_data) && slide.chart_data.length > 0 && (
                          <div className="flex items-center gap-2 px-2 mt-2">
                            <BarChart3 size={12} className={mutedText} />
                            <div className="flex gap-1 flex-1 flex-wrap">
                              {[
                                { value: 'bar', label: 'Barres', Icon: BarChart3 },
                                { value: 'pie', label: 'Camembert', Icon: PieChart },
                                { value: 'comparison', label: 'Versus', Icon: GitCompare },
                                { value: 'line', label: 'Courbe', Icon: TrendingUp },
                              ].map(({ value, label, Icon }) => {
                                const isActive = (slide.chart_type || 'bar') === value;
                                return (
                                  <button
                                    key={value}
                                    onClick={() => changeChartType(i, value)}
                                    title={label}
                                    className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all ${
                                      isActive
                                        ? 'bg-orange-500 text-white shadow-md'
                                        : (isDarkMode ? 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 border border-neutral-800' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border border-neutral-100')
                                    }`}
                                  >
                                    <Icon size={10} />
                                    <span className="hidden lg:inline">{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {editMode && isLocked && (
                          <div className={`text-[9px] font-black uppercase tracking-widest px-2 ${isDarkMode ? 'text-neutral-600' : 'text-neutral-300'}`}>
                            {isFirst ? '⛔ Template intro verrouillé' : '⛔ Template fin verrouillé'}
                          </div>
                        )}

                        {editingSlideIndex === i && (
                          <div className={`p-4 rounded-2xl border shadow-xl space-y-3 ${cardBg} ${cardBorder}`}>
                            {slides[i].type === 'stat' && (
                              <div className="space-y-2">
                                <div>
                                  <label className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Chiffre principal (gros)</label>
                                  <input
                                    type="text"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    placeholder="Ex: 73%, 2x, 1M+, 320..."
                                    className={`w-full p-3 rounded-xl text-base font-black outline-none ${isDarkMode ? 'bg-neutral-950 text-neutral-100 border border-neutral-800' : 'bg-neutral-50 border'}`}
                                  />
                                </div>
                                <div>
                                  <label className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Phrase courte sous le chiffre (max 60 car.)</label>
                                  <input
                                    type="text"
                                    value={tempValueCaption}
                                    onChange={(e) => setTempValueCaption(e.target.value)}
                                    placeholder="Ex: de vélos supplémentaires à Genève en 1 an"
                                    maxLength={60}
                                    className={`w-full p-3 rounded-xl text-xs outline-none ${isDarkMode ? 'bg-neutral-950 text-neutral-100 border border-neutral-800' : 'bg-neutral-50 border'}`}
                                  />
                                  <div className={`text-[9px] mt-1 ${isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>{tempValueCaption.length}/60</div>
                                </div>
                                <div className={`text-[10px] font-black uppercase tracking-wider pt-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Texte d&apos;explication détaillé</div>
                              </div>
                            )}
                            <textarea ref={editTextAreaRef} value={tempText} onChange={(e) => setTempText(e.target.value)} className={`w-full p-4 rounded-xl text-sm font-mono outline-none resize-none h-28 ${isDarkMode ? 'bg-neutral-950 text-neutral-100 border border-neutral-800' : 'bg-neutral-50 border'}`} />
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={applyHighlightToSelection} className={`flex-1 min-w-[80px] text-[10px] font-black py-3 rounded-xl uppercase hover:bg-orange-500 hover:text-white transition-all ${isDarkMode ? 'bg-neutral-800 text-neutral-200' : 'bg-neutral-100'}`}>Surligner</button>
                              <button onClick={clearAllHighlights} className={`flex-1 min-w-[80px] text-[10px] font-black py-3 rounded-xl uppercase transition-all ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-900 text-neutral-200' : 'bg-neutral-100 hover:bg-neutral-900 hover:text-white'}`}>Nettoyer</button>
                              <button onClick={() => saveSlideText(i)} className="flex-1 min-w-[80px] bg-green-600 text-white text-[10px] font-black py-3 rounded-xl uppercase flex items-center justify-center gap-2"><Check size={14} /> Sauver</button>
                              <button onClick={() => setEditingSlideIndex(null)} className="p-3 bg-red-50 text-red-500 rounded-xl"><X size={16} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="fixed -left-[9999px] top-0">
                  {selectedFormats.map((formatId) => {
                    const format = EXPORT_FORMATS.find((f) => f.id === formatId);
                    if (!format) return null;
                    return (
                      <div key={formatId}>
                        {slides.map((slide, i) => (
                          <div key={i} style={{ width: `${format.width}px`, height: `${format.height}px` }}>
                            {renderSlide(slide, i, { idSuffix: `-${formatId}`, layout: format.layout })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

              </div>
            ) : (
              <div className={`h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] italic text-[10px] font-black uppercase tracking-[0.4em] space-y-4 ${isDarkMode ? 'border-neutral-800 text-neutral-700' : 'border-neutral-200 text-neutral-300'}`}>
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl ${isDarkMode ? 'bg-neutral-900' : 'bg-neutral-100'}`}>🚀</div>
                <span>Studio Prêt</span>
              </div>
            )}
          </div>
        </div>
      ) : view === 'library' ? (
        <div className="flex-1 p-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black italic uppercase">Mes Projets</h2>
            <button
              onClick={handleRefreshLibrary}
              disabled={refreshingLibrary}
              title="Rafraîchir"
              className={`p-3 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800' : 'bg-white hover:bg-neutral-50 border border-neutral-200 shadow-sm'}`}
            >
              <RotateCw size={14} className={refreshingLibrary ? 'animate-spin' : ''} />
              Rafraîchir
            </button>
          </div>

          <div className={`flex gap-2 mb-8 border-b pb-2 overflow-x-auto ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
            {[
              { id: 'drafts', label: 'Brouillons', dot: 'bg-neutral-300' },
              { id: 'pending', label: 'En attente', dot: 'bg-orange-400' },
              { id: 'approved', label: 'Approuvés', dot: 'bg-green-500' },
              { id: 'archived', label: 'Archives', dot: 'bg-neutral-200' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setLibraryTab(tab.id as any)} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all ${libraryTab === tab.id ? 'bg-orange-500 text-white shadow-md' : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900' : 'text-neutral-500 hover:bg-neutral-100')}`}>
                <span className={`w-2 h-2 rounded-full ${tab.dot}`}></span>
                {tab.label}
                <span className="opacity-50">({projects.filter((p) => {
                  if (tab.id === 'archived') return p.archived;
                  if (p.archived) return false;
                  if (tab.id === 'drafts') return p.status === 'draft' || p.status === 'reviewed';
                  if (tab.id === 'pending') return p.status === 'pending';
                  if (tab.id === 'approved') return p.status === 'approved';
                  return false;
                }).length})</span>
              </button>
            ))}
          </div>

          {filteredProjects.length === 0 ? (
            <p className={`text-sm ${mutedText}`}>Aucun projet dans cet onglet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProjects.map((project) => {
                const projectHasAnnotations = (project.annotations || []).some((a: string) => a && a.trim().length > 0);
                return (
                  <div key={project.id} className={`p-6 rounded-[2.5rem] border flex flex-col justify-between space-y-4 ${cardBg} ${cardBorder} ${isDarkMode ? '' : 'shadow-xl'}`}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-black italic uppercase">{project.project_title}</h3>
                        {!project.archived && (
                          <button onClick={() => handleDeleteProject(project.id, project.project_title)} className="p-2 text-red-300 hover:text-red-500 transition-all" title="Supprimer">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      {statusDot(project.status, project.archived)}
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>
                        {project.slides?.length || 0} slides · {new Date(project.updated_at || project.created_at).toLocaleDateString('fr-FR')}
                      </p>
                      {projectHasAnnotations && (
                        <div className="flex items-center gap-1 text-[10px] font-black text-orange-500">
                          <MessageSquare size={10} />
                          Feedback patron disponible
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {!project.archived && (
                        <button onClick={() => openProject(project)} className="w-full bg-orange-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">
                          Ouvrir dans le Studio
                        </button>
                      )}
                      {project.archived && (
                        <button onClick={() => openProject(project)} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600'}`}>
                          Consulter (lecture seule)
                        </button>
                      )}

                      {(project.status === 'draft' || project.archived) && (
                        <button
                          onClick={() => router.push(`/video/${project.id}`)}
                          className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border-2 transition-all hover:shadow-md ${isDarkMode ? 'bg-neutral-900' : 'bg-white'}`}
                          style={{ borderColor: accentColor, color: accentColor }}
                        >
                          <FileVideo size={12} /> Créer une vidéo
                        </button>
                      )}

                      {!project.archived && project.status === 'approved' && (
                        <button onClick={() => handleArchiveProject(project.id)} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isDarkMode ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-900 text-white'}`}>
                          <Archive size={12} /> Archiver
                        </button>
                      )}

                      {project.archived && (
                        <button onClick={() => handleDeleteProject(project.id, project.project_title)} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'bg-red-950/40 text-red-300 hover:bg-red-900/50 border border-red-900' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'}`}>
                          <Trash2 size={12} /> Supprimer définitivement
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : view === 'publicity' ? (
        <PublicityModule brandKit={brandKit} isDarkMode={isDarkMode} />
      ) : (
        <div className="flex-1 p-12 bg-neutral-50 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-neutral-900">Médias</h2>
              <p className="text-xs text-neutral-500 font-medium mt-1">Tes photos disponibles pour les carrousels et publicités. Uploade un nouveau batch quand tu veux.</p>
            </div>
            <BrandLibrarySection
              clientEmail={brandKit?.client_email || ''}
              brandName={brandKit?.brand_name || ''}
              editingId="client-active"
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      )}

{/* MODAL CHANGEMENT D'IMAGE */}
{imageModalSlideIndex !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={closeImageModal}>
          <div className={`rounded-[2.5rem] p-8 max-w-3xl w-full shadow-2xl space-y-6 ${cardBg} ${cardBorder} border max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start sticky top-0 bg-inherit pb-2 -mb-2 z-10">
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Changer l&apos;image</h3>
                <p className={`text-sm font-medium ${mutedText}`}>Vignette {imageModalSlideIndex + 1}</p>
              </div>
              <button onClick={closeImageModal} className={`p-2 rounded-xl ${isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`}>
                <X size={20} />
              </button>
            </div>

            {/* OPTION 1 — Bibliothèque client (priorité absolue) */}
            <div className={`p-5 rounded-2xl border-2 ${isDarkMode ? 'border-blue-900/40 bg-blue-950/20' : 'border-blue-200 bg-blue-50/40'} space-y-3`}>
              <div className="flex items-center gap-2 flex-wrap">
                <FolderOpen size={16} className="text-blue-600" />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Médias officiels du client</h4>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">Recommandé · 0 €</span>
                {libraryImages.length > 0 && (
                  <span className="text-[9px] font-medium ml-auto opacity-60">{libraryImages.length} photo{libraryImages.length > 1 ? 's' : ''}</span>
                )}
              </div>

              {loadingLibrary ? (
                <div className="py-8 text-center text-xs opacity-60">Chargement des médias…</div>
              ) : libraryImages.length === 0 ? (
                <div className={`py-8 text-center text-xs rounded-xl ${isDarkMode ? 'bg-neutral-900/50' : 'bg-white/60'}`}>
                  <ImageIcon size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="opacity-70">Aucune photo officielle dans les médias pour l&apos;instant.</p>
                  <p className="opacity-50 mt-1 text-[10px]">Demande à ton admin d&apos;en ajouter via la charte de marque.</p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                    <input
                      type="text"
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder="Filtrer par mot-clé (ex: genève, jet d'eau, équipe...)"
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none ${isDarkMode ? 'bg-neutral-900 text-neutral-100 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
                    />
                  </div>
                  {(() => {
                    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const search = norm(librarySearch.trim());
                    const filtered = !search ? libraryImages : libraryImages.filter((img: any) => {
                      const haystack = norm([
                        Array.isArray(img.tags) ? img.tags.join(' ') : (img.tags || ''),
                        img.description || '', img.alt_text || '', img.keywords || '',
                        img.name || '', img.filename || '', img.title || ''
                      ].join(' '));
                      return haystack.includes(search);
                    });
                    if (filtered.length === 0) {
                      return <div className="py-4 text-center text-xs opacity-50">Aucune photo ne correspond à ta recherche.</div>;
                    }
                    return (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                        {filtered.map((img: any) => {
                          const tags = Array.isArray(img.tags) ? img.tags.join(', ') : (img.tags || '');
                          const label = img.description || img.name || img.filename || tags || 'Photo';
                          const thumbUrl: string | null = img._resolvedUrl || null;
                          return (
                            <button
                              key={img.id}
                              onClick={() => applyLibraryImage(img)}
                              disabled={!thumbUrl}
                              className="group relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={`${label}${tags ? '\n' + tags : ''}${!thumbUrl ? '\n⚠ URL introuvable' : ''}`}
                            >
                              {thumbUrl ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={thumbUrl}
                                    alt={label}
                                    loading="lazy"
                                    crossOrigin="anonymous"
                                    onError={(e) => {
                                      console.warn(`⚠ Échec chargement image bibliothèque : ${thumbUrl}`, img);
                                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                                    <Check size={20} className="text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity" />
                                  </div>
                                </>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-2 bg-red-50 text-red-500">
                                  <X size={20} />
                                  <span className="text-[8px] font-black uppercase mt-1 text-center leading-tight">URL invalide</span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* OPTION 2 — Stock */}
            <div className={`p-5 rounded-2xl border-2 ${isDarkMode ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-100 bg-neutral-50'} space-y-3`}>
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-green-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Banque d&apos;images libres de droit (Pexels)</h4>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-green-100 text-green-700 rounded-md">Gratuit & rapide</span>
              </div>
              <input
                type="text"
                value={stockKeyword}
                onChange={(e) => setStockKeyword(e.target.value)}
                placeholder="ex: stadium, nature, office..."
                className={`w-full p-3 rounded-xl text-sm outline-none ${isDarkMode ? 'bg-neutral-900 text-neutral-100 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
              />
              <button
                onClick={refreshStockImage}
                disabled={regeneratingImageIndex !== null}
                className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <RefreshCw size={12} className={regeneratingImageIndex !== null ? 'animate-spin' : ''} />
                {regeneratingImageIndex !== null ? 'Recherche...' : 'Nouvelle image stock'}
              </button>
            </div>

            {/* OPTION 3 — AI */}
            <div className={`p-5 rounded-2xl border-2 ${isDarkMode ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-100 bg-neutral-50'} space-y-3`}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-orange-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Générer avec IA (Nano Banana Pro)</h4>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md">~$0.04 · 30s</span>
              </div>
              <textarea
                value={customAiPrompt}
                onChange={(e) => setCustomAiPrompt(e.target.value)}
                placeholder="ex: deux mains qui se serrent, style éditorial moderne, fond bleu profond..."
                className={`w-full p-3 rounded-xl text-sm outline-none resize-none h-24 ${isDarkMode ? 'bg-neutral-900 text-neutral-100 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
              />
              <button
                onClick={generateCustomAiImage}
                disabled={generatingCustomImage || !customAiPrompt.trim()}
                className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-orange-500 text-white hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Sparkles size={12} className={generatingCustomImage ? 'animate-spin' : ''} />
                {generatingCustomImage ? 'Génération en cours...' : 'Générer avec IA'}
              </button>
            </div>
            </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowExportModal(false)}>
          <div className={`rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl space-y-6 ${cardBg} ${cardBorder} border`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Exporter</h3>
                <p className={`text-sm font-medium ${mutedText}`}>Sélectionne les formats voulus</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className={`p-2 rounded-xl ${isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`}>
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {EXPORT_FORMATS.map((f) => (
                <button key={f.id} onClick={() => toggleFormat(f.id)} className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedFormats.includes(f.id) ? 'border-orange-500 bg-orange-50' : (isDarkMode ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-100 hover:border-neutral-200')}`}>
                  <div className="flex justify-between items-start">
                    <span className={`text-sm font-black uppercase ${selectedFormats.includes(f.id) ? 'text-neutral-900' : ''}`}>{f.label}</span>
                    {selectedFormats.includes(f.id) && <Check size={16} className="text-orange-500" />}
                  </div>
                  <p className={`text-[10px] font-bold mt-1 ${selectedFormats.includes(f.id) ? 'text-neutral-500' : mutedText}`}>{f.ratio} · {f.width}×{f.height}</p>
                </button>
              ))}
            </div>

            <button onClick={downloadAllFormats} disabled={selectedFormats.length === 0} className="w-full bg-orange-500 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
              <Download size={16} /> Télécharger {selectedFormats.length} format(s) × {slides.length} slides
            </button>
          </div>
        </div>
      )}
    </div>
  );
}