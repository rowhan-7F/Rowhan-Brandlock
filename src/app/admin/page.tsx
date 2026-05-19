"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getInsightTextClass, getInsightInlineStyle } from "../../lib/insightStyles";
import AdminAnalytics from "../../components/AdminAnalytics";
import BrandLibrarySection from "../../components/BrandLibrarySection";
import {
    Plus, Save, Trash2, Upload, Eye, Layout, AlignLeft, AlignCenter, AlignRight,
    LogOut, X, FileText, Link as LinkIcon, Tag, ChevronDown, ChevronUp, ChevronsUp, ChevronsDown,
    Building2, BookOpen, Megaphone, Palette, Image as ImageIcon, Inbox, Mail, Phone, Type, RotateCcw, Star, Bug, MessageCircle
  } from "lucide-react";

const FONT_FAMILIES = [
  { value: "Inter, system-ui, sans-serif", label: "Inter (Moderne)" },
  { value: "Georgia, serif", label: "Georgia (Classique)" },
  { value: "'Times New Roman', Times, serif", label: "Times (Formel)" },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica (Neutre)" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana (Web)" },
  { value: "'Courier New', Courier, monospace", label: "Courier (Mono)" },
  { value: "Impact, sans-serif", label: "Impact (Display)" },
  { value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif", label: "Palatino (Raffiné)" },
  { value: "'Brush Script MT', cursive", label: "Brush Script (Calligraphie)" },
  { value: "'Comic Sans MS', cursive", label: "Comic Sans (Décontracté)" }
];

const TEXT_SIZES = [
  { value: "small", label: "Petit (Discret)" },
  { value: "medium", label: "Moyen (Standard)" },
  { value: "large", label: "Grand (Confortable)" },
  { value: "xl", label: "Extra Large (Titre)" }
];

const TONES = [
  { value: "Expert", label: "👨‍🏫 Expert (Sérieux & Analytique)" },
  { value: "Créatif", label: "🎨 Créatif (Inspirant & Imagé)" },
  { value: "Audacieux", label: "⚡ Audacieux (Direct & Percutant)" },
  { value: "Minimaliste", label: "💎 Minimaliste (Épuré & Luxe)" },
  { value: "Enthousiaste", label: "🚀 Enthousiaste (Énergique & Fun)" }
];

const SLIDE_TEMPLATE_LIST: Array<{ id: TemplateKey; label: string; description: string }> = [
  { id: 'intro',       label: 'Intro',       description: "1ère vignette : accroche + sous-titre/insight" },
  { id: 'explanation', label: 'Explication', description: "Vignettes intermédiaires de développement" },
  { id: 'stat',        label: 'Statistique', description: "Vignette chiffrée avec graphique" },
  { id: 'quote',       label: 'Citation',    description: "Citation, témoignage, parole forte" },
  { id: 'conclusion',  label: 'Conclusion',  description: "Avant-dernière vignette de synthèse" },
  { id: 'end',         label: 'Outro / CTA', description: "Dernière vignette d'appel à l'action" }
];

const getFontSizeCqw = (size: string): string => {
  switch (size) {
    case 'small': return '2.5cqw';
    case 'medium': return '3.5cqw';
    case 'large': return '4.5cqw';
    case 'xl': return '5.5cqw';
    default: return '3.5cqw';
  }
};

type TemplateKey = 'intro' | 'explanation' | 'stat' | 'quote' | 'conclusion' | 'end';

type Typography = { id: string; label: string; family: string; is_default: boolean };
type SecondaryColor = { id: string; hex: string; label: string };
type TemplateConfig = {
  font_id?: string;
  text_size?: string;
  color_ref?: string; // 'main' | 'text' | 'bg' | <secondary-id>
  h_align?: 'left' | 'center' | 'right';
  v_align?: 'top' | 'center' | 'bottom';
};
type TemplatesMap = Partial<Record<TemplateKey, TemplateConfig>>;

type Insight = { id: string; label: string; badge_url: string | null };
type Prospect = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  message: string;
  read: boolean;
  created_at: string;
};

type Feedback = {
  id: string;
  client_email: string;
  brand_name: string | null;
  message: string;
  page_origin: string | null;
  read: boolean;
  created_at: string;
};

const ALL_SECTIONS = ['general', 'brand', 'insights', 'library', 'publicity', 'design'];

const randomId = () => Math.random().toString(36).substring(2, 10);

// === Pré-remplissage intelligent des 6 templates par vignette (Option A) ===
const buildDefaultTemplates = (
  defaultFontId: string,
  globalAlignment: 'left' | 'center' | 'right' = 'center',
  globalSize: string = 'medium',
  introSize: string = 'xl',
  endSize: string = 'xl'
): TemplatesMap => ({
  intro:       { font_id: defaultFontId, text_size: introSize,  color_ref: 'text', h_align: globalAlignment, v_align: 'bottom' },
  explanation: { font_id: defaultFontId, text_size: globalSize, color_ref: 'text', h_align: globalAlignment, v_align: 'bottom' },
  stat:        { font_id: defaultFontId, text_size: globalSize, color_ref: 'text', h_align: globalAlignment, v_align: 'bottom' },
  quote:       { font_id: defaultFontId, text_size: globalSize, color_ref: 'text', h_align: globalAlignment, v_align: 'bottom' },
  conclusion:  { font_id: defaultFontId, text_size: globalSize, color_ref: 'text', h_align: globalAlignment, v_align: 'bottom' },
  end:         { font_id: defaultFontId, text_size: endSize,    color_ref: 'text', h_align: globalAlignment, v_align: 'bottom' }
});

export default function AdminDashboard() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);

  const [activeTab, setActiveTab] = useState<'create' | 'clients' | 'analytics' | 'prospects' | 'feedback'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['general']));

  // === STATES — Général ===
  const [clientEmail, setClientEmail] = useState("");
  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPosition, setLogoPosition] = useState<'left' | 'center' | 'right'>('left');

  // === STATES — Identité de Marque ===
  const [positioning, setPositioning] = useState("");
  const [forbiddenWords, setForbiddenWords] = useState("");
  const [tone, setTone] = useState("Expert");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([]);
  const [existingKnowledgeFiles, setExistingKnowledgeFiles] = useState<Array<{name: string; path: string; size: number; uploaded_at: string}>>([]);
  const [uploadingKnowledge, setUploadingKnowledge] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // === STATES — Insights ===
  const [insights, setInsights] = useState<Insight[]>([]);
  const [newInsightLabel, setNewInsightLabel] = useState("");
  const [newInsightBadgeFile, setNewInsightBadgeFile] = useState<File | null>(null);
  const [uploadingBadge, setUploadingBadge] = useState(false);

  // === STATES — Publicité ===
  const [publicityEnabled, setPublicityEnabled] = useState(false);
  const [publicityContext, setPublicityContext] = useState("");

  // === STATES — Design ===
  const [fontFamily, setFontFamily] = useState("Inter, system-ui, sans-serif");
  const [textSize, setTextSize] = useState("medium");
  const [introTextSize, setIntroTextSize] = useState("xl");
  const [endTextSize, setEndTextSize] = useState("xl");
  const [textAlignment, setTextAlignment] = useState<'left' | 'center' | 'right'>("center");
  const [highlightStyle, setHighlightStyle] = useState("bg_color");
  const [bgColor, setBgColor] = useState("#F8F8F8");
  const [mainColor, setMainColor] = useState("#f97316");
  const [textColor, setTextColor] = useState("#0a0a0a");
  const [insightFontFamily, setInsightFontFamily] = useState("Inter, system-ui, sans-serif");
  const [insightStyle, setInsightStyle] = useState("plain");

  // === STATES — NEW : Typos multiples + couleurs secondaires + templates ===
  const [typographies, setTypographies] = useState<Typography[]>([]);
  const [secondaryColors, setSecondaryColors] = useState<SecondaryColor[]>([]);
  const [templates, setTemplates] = useState<TemplatesMap>({});
  const [openTemplate, setOpenTemplate] = useState<TemplateKey | null>(null);

  const [brandKits, setBrandKits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // === STATES — Prospects ===
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loadingProspects, setLoadingProspects] = useState(false);
  const [expandedProspectId, setExpandedProspectId] = useState<string | null>(null);

  const unreadProspectCount = prospects.filter((p) => !p.read).length;

  // === STATES — Feedback / Bug reports ===
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  const unreadFeedbackCount = feedbacks.filter((f) => !f.read).length;

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (sessionReady) {
      fetchProspects();
    }
  }, [sessionReady]);

  useEffect(() => {
    if (sessionReady && activeTab === 'prospects') {
      fetchProspects();
    }
  }, [activeTab, sessionReady]);

  useEffect(() => {
    if (sessionReady) {
      fetchFeedbacks();
    }
  }, [sessionReady]);

  useEffect(() => {
    if (sessionReady && activeTab === 'feedback') {
      fetchFeedbacks();
    }
  }, [activeTab, sessionReady]);

  const checkSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }
    setSessionReady(true);
    await fetchBrandKits();
  };

  const fetchBrandKits = async () => {
    const { data: kitsData, error } = await supabase.from('brand_kits').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Erreur lecture brand_kits:", error);
      return;
    }
    if (!kitsData) return;

    const { data: imagesData } = await supabase
      .from('brand_images')
      .select('client_email');

    const countsByEmail: Record<string, number> = {};
    (imagesData || []).forEach((img: any) => {
      const email = img.client_email?.toLowerCase();
      if (email) countsByEmail[email] = (countsByEmail[email] || 0) + 1;
    });

    const kitsWithCounts = kitsData.map((kit: any) => ({
      ...kit,
      _image_count: countsByEmail[kit.client_email?.toLowerCase()] || 0
    }));

    setBrandKits(kitsWithCounts);
  };

  const fetchProspects = async () => {
    setLoadingProspects(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/prospects", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) {
        console.error("Erreur fetch prospects:", res.status);
        return;
      }
      const data = await res.json();
      if (data.prospects) setProspects(data.prospects);
    } catch (err) {
      console.error("Erreur fetch prospects:", err);
    } finally {
      setLoadingProspects(false);
    }
  };

  const markProspectAsRead = async (id: string, read: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch("/api/prospects", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id, read })
      });
      setProspects((prev) => prev.map((p) => p.id === id ? { ...p, read } : p));
    } catch (err) {
      console.error("Erreur mark read:", err);
    }
  };

  const deleteProspect = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer le message de ${name} ? Action irréversible.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/prospects?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) {
        alert("Erreur suppression");
        return;
      }
      setProspects((prev) => prev.filter((p) => p.id !== id));
      if (expandedProspectId === id) setExpandedProspectId(null);
    } catch (err) {
      console.error("Erreur delete:", err);
    }
  };

  const handleToggleExpand = (prospect: Prospect) => {
    if (expandedProspectId === prospect.id) {
      setExpandedProspectId(null);
    } else {
      setExpandedProspectId(prospect.id);
      if (!prospect.read) {
        markProspectAsRead(prospect.id, true);
      }
    }
  };

  // === Feedback / Bug reports ===
  const fetchFeedbacks = async () => {
    setLoadingFeedbacks(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/feedback", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) {
        console.error("Erreur fetch feedbacks:", res.status);
        return;
      }
      const data = await res.json();
      if (data.feedbacks) setFeedbacks(data.feedbacks);
    } catch (err) {
      console.error("Erreur fetch feedbacks:", err);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const markFeedbackAsRead = async (id: string, read: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch("/api/feedback", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id, read })
      });
      setFeedbacks((prev) => prev.map((f) => f.id === id ? { ...f, read } : f));
    } catch (err) {
      console.error("Erreur mark feedback read:", err);
    }
  };

  const deleteFeedback = async (id: string) => {
    if (!window.confirm("Supprimer ce feedback ? Action irréversible.")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/feedback?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) {
        alert("Erreur suppression");
        return;
      }
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
      if (expandedFeedbackId === id) setExpandedFeedbackId(null);
    } catch (err) {
      console.error("Erreur delete feedback:", err);
    }
  };

  const handleToggleExpandFeedback = (feedback: Feedback) => {
    if (expandedFeedbackId === feedback.id) {
      setExpandedFeedbackId(null);
    } else {
      setExpandedFeedbackId(feedback.id);
      if (!feedback.read) {
        markFeedbackAsRead(feedback.id, true);
      }
    }
  };

  const handleLogout = async () => {
    if (!window.confirm("Te déconnecter ?")) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleStaleSessionRecovery = async () => {
    const shouldRelogin = window.confirm(
      "Ta session admin semble expirée (l'enregistrement est bloqué par les permissions). Te reconnecter maintenant ?"
    );
    if (shouldRelogin) {
      await supabase.auth.signOut();
      router.push("/");
    }
  };

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOpen = openSections.size === ALL_SECTIONS.length;
  const toggleAll = () => {
    if (allOpen) setOpenSections(new Set());
    else setOpenSections(new Set(ALL_SECTIONS));
  };

  // === Helpers Typographies (nouvelles, illimité, option C) ===
  const addTypography = () => {
    const newTypo: Typography = {
      id: `typo-${randomId()}`,
      label: `Typographie ${typographies.length + 1}`,
      family: "Inter, system-ui, sans-serif",
      is_default: typographies.length === 0
    };
    setTypographies([...typographies, newTypo]);
  };

  const removeTypography = (id: string) => {
    if (typographies.length <= 1) {
      return alert("Il faut au moins 1 typographie (la principale).");
    }
    const wasDefault = typographies.find(t => t.id === id)?.is_default;
    const updated = typographies.filter(t => t.id !== id);
    if (wasDefault && updated.length > 0) {
      updated[0].is_default = true;
    }
    setTypographies(updated);
    // Reset les templates qui pointaient sur cette typo → fallback default
    const newDefaultId = updated.find(t => t.is_default)?.id || updated[0]?.id;
    const cleanedTemplates: TemplatesMap = { ...templates };
    (Object.keys(cleanedTemplates) as TemplateKey[]).forEach((k) => {
      if (cleanedTemplates[k]?.font_id === id) {
        cleanedTemplates[k] = { ...cleanedTemplates[k], font_id: newDefaultId };
      }
    });
    setTemplates(cleanedTemplates);
  };

  const updateTypography = (id: string, field: keyof Typography, value: any) => {
    setTypographies(typographies.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const setDefaultTypography = (id: string) => {
    setTypographies(typographies.map(t => ({ ...t, is_default: t.id === id })));
  };

  // === Helpers Couleurs secondaires (max 4) ===
  const addSecondaryColor = () => {
    if (secondaryColors.length >= 4) {
      return alert("Maximum 4 couleurs secondaires.");
    }
    const newColor: SecondaryColor = {
      id: `col-${randomId()}`,
      hex: "#3b82f6",
      label: `Couleur ${secondaryColors.length + 2}`
    };
    setSecondaryColors([...secondaryColors, newColor]);
  };

  const removeSecondaryColor = (id: string) => {
    setSecondaryColors(secondaryColors.filter(c => c.id !== id));
    // Reset les templates qui pointaient sur cette couleur
    const cleanedTemplates: TemplatesMap = { ...templates };
    (Object.keys(cleanedTemplates) as TemplateKey[]).forEach((k) => {
      if (cleanedTemplates[k]?.color_ref === id) {
        cleanedTemplates[k] = { ...cleanedTemplates[k], color_ref: 'text' };
      }
    });
    setTemplates(cleanedTemplates);
  };

  const updateSecondaryColor = (id: string, field: keyof SecondaryColor, value: any) => {
    setSecondaryColors(secondaryColors.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // === Helpers Templates (par type de vignette) ===
  const updateTemplate = (slideType: TemplateKey, field: keyof TemplateConfig, value: any) => {
    setTemplates({
      ...templates,
      [slideType]: { ...(templates[slideType] || {}), [field]: value }
    });
  };

  const resetTemplate = (slideType: TemplateKey) => {
    const defaults = buildDefaultTemplates(
      typographies.find(t => t.is_default)?.id || typographies[0]?.id || '',
      textAlignment,
      textSize,
      introTextSize,
      endTextSize
    );
    setTemplates({ ...templates, [slideType]: defaults[slideType] });
  };

  const resetForm = () => {
    setEditingId(null);
    setClientEmail("");
    setBrandName("");
    setLogoUrl("");
    setLogoPosition('left');
    setPositioning("");
    setForbiddenWords("");
    setTone("Expert");
    setReferenceUrls([]);
    setKnowledgeFiles([]);
    setExistingKnowledgeFiles([]);
    setInsights([]);
    setNewInsightLabel("");
    setNewInsightBadgeFile(null);
    setPublicityEnabled(false);
    setPublicityContext("");
    setInsightFontFamily("Inter, system-ui, sans-serif");
    setInsightStyle("plain");
    setFontFamily("Inter, system-ui, sans-serif");
    setTextSize("medium");
    setIntroTextSize("xl");
    setEndTextSize("xl");
    setTextAlignment("center");
    setHighlightStyle("bg_color");
    setBgColor("#F8F8F8");
    setMainColor("#f97316");
    setTextColor("#0a0a0a");

    // NEW : pré-remplissage intelligent (option A)
    const defaultTypo: Typography = {
      id: `typo-${randomId()}`,
      label: "Principale",
      family: "Inter, system-ui, sans-serif",
      is_default: true
    };
    setTypographies([defaultTypo]);
    setSecondaryColors([]);
    setTemplates(buildDefaultTemplates(defaultTypo.id, "center", "medium", "xl", "xl"));
    setOpenTemplate(null);

    setOpenSections(new Set(['general']));
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!brandName.trim() || !clientEmail.trim()) {
      setOpenSections(prev => new Set([...prev, 'general']));
      alert("Renseigne au moins le nom de marque et l'email avant d'enregistrer.");
      return;
    }

    // Vérifie qu'il y a au moins une typo par défaut
    let finalTypos = [...typographies];
    if (finalTypos.length === 0) {
      finalTypos = [{ id: `typo-${randomId()}`, label: "Principale", family: fontFamily, is_default: true }];
    } else if (!finalTypos.find(t => t.is_default)) {
      finalTypos[0].is_default = true;
    }

    setLoading(true);

    // Upload des nouveaux fichiers de connaissance dans le bucket Supabase
    let finalKnowledgeFiles = [...existingKnowledgeFiles];
    if (knowledgeFiles.length > 0) {
      setUploadingKnowledge(true);
      const cleanEmail = clientEmail.toLowerCase().trim();
      for (const file of knowledgeFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${cleanEmail}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('brand-knowledge')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          console.warn(`Erreur upload ${file.name}:`, uploadError);
          continue;
        }
        finalKnowledgeFiles.push({
          name: file.name,
          path,
          size: file.size,
          uploaded_at: new Date().toISOString()
        });
      }
      setUploadingKnowledge(false);
    }

    // La font_family globale est synchronisée sur la typo par défaut (back-compat)
    const defaultTypo = finalTypos.find(t => t.is_default) || finalTypos[0];
    const syncedFontFamily = defaultTypo?.family || fontFamily;

    const payload = {
      client_email: clientEmail.toLowerCase().trim(),
      brand_name: brandName,
      forbidden_words: forbiddenWords,
      positioning,
      tone,
      text_alignment: textAlignment,
      highlight_style: highlightStyle,
      bg_color: bgColor,
      main_color: mainColor,
      font_family: syncedFontFamily,
      text_size: textSize,
      logo_url: logoUrl,
      logo_position: logoPosition,
      text_color: textColor,
      intro_text_size: introTextSize,
      end_text_size: endTextSize,
      insights: insights,
      reference_urls: referenceUrls.filter(u => u.trim().length > 0),
      publicity_enabled: publicityEnabled,
      publicity_context: publicityContext,
      insight_font_family: insightFontFamily,
      insight_style: insightStyle,
      knowledge_files: finalKnowledgeFiles,
      // NEW
      typographies: finalTypos,
      secondary_colors: secondaryColors,
      templates: templates
    };

    try {
      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('brand_kits')
          .update(payload)
          .eq('id', editingId)
          .select();
        if (updateError) throw updateError;
        if (!data || data.length === 0) {
          setLoading(false);
          await handleStaleSessionRecovery();
          return;
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('brand_kits')
          .insert([payload])
          .select();
        if (insertError) throw insertError;
        if (!data || data.length === 0) {
          setLoading(false);
          await handleStaleSessionRecovery();
          return;
        }
      }
      alert("Client enregistré !");
      resetForm();
      await fetchBrandKits();
      setActiveTab('clients');
    } catch (error: any) {
      console.error("Erreur sauvegarde brand_kit:", error);
      alert("Erreur : " + (error.message || "Inconnue") + "\n\nDétails dans la console (F12).");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (kit: any) => {
    setEditingId(kit.id);
    setClientEmail(kit.client_email);
    setBrandName(kit.brand_name);
    setForbiddenWords(kit.forbidden_words || "");
    setPositioning(kit.positioning || "");
    setTone(kit.tone || "Expert");
    setTextAlignment((kit.text_alignment as any) || "center");
    setHighlightStyle(kit.highlight_style || "bg_color");
    setBgColor(kit.bg_color || "#F8F8F8");
    setMainColor(kit.main_color || "#f97316");
    setLogoUrl(kit.logo_url || "");
    setFontFamily(kit.font_family || "Inter, system-ui, sans-serif");
    setTextSize(kit.text_size || "medium");
    setLogoPosition((kit.logo_position as any) || 'left');
    setTextColor(kit.text_color || "#0a0a0a");
    setIntroTextSize(kit.intro_text_size || "xl");
    setEndTextSize(kit.end_text_size || "xl");
    setInsights(kit.insights || []);
    setReferenceUrls(kit.reference_urls || []);
    setExistingKnowledgeFiles(kit.knowledge_files || []);
    setKnowledgeFiles([]);
    setPublicityEnabled(kit.publicity_enabled || false);
    setPublicityContext(kit.publicity_context || "");
    setInsightFontFamily(kit.insight_font_family || kit.font_family || "Inter, system-ui, sans-serif");
    setInsightStyle(kit.insight_style || "plain");

    // === NEW : migration auto des anciens kits ===
    let kitTypos: Typography[] = Array.isArray(kit.typographies) ? kit.typographies : [];
    if (kitTypos.length === 0) {
      kitTypos = [{
        id: `typo-${randomId()}`,
        label: "Principale",
        family: kit.font_family || "Inter, system-ui, sans-serif",
        is_default: true
      }];
    } else if (!kitTypos.find(t => t.is_default)) {
      kitTypos[0].is_default = true;
    }
    setTypographies(kitTypos);

    setSecondaryColors(Array.isArray(kit.secondary_colors) ? kit.secondary_colors : []);

    const defaultTypoId = kitTypos.find(t => t.is_default)?.id || kitTypos[0]?.id || '';
    const kitTemplates = (kit.templates && typeof kit.templates === 'object' && Object.keys(kit.templates).length > 0)
      ? kit.templates
      : buildDefaultTemplates(defaultTypoId, kit.text_alignment, kit.text_size, kit.intro_text_size, kit.end_text_size);
    setTemplates(kitTemplates);
    setOpenTemplate(null);

    setOpenSections(new Set(['general']));
    setActiveTab('create');
  };

  // === Helpers Insights ===
  const addInsight = async () => {
    if (!newInsightLabel.trim()) return alert("Donne un nom à l'insight (ex: 'Tendance du mois').");

    let badgeUrl: string | null = null;
    if (newInsightBadgeFile) {
      setUploadingBadge(true);
      try {
        const fileExt = newInsightBadgeFile.name.split('.').pop();
        const fileName = `badges/badge-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('slide-images')
          .upload(fileName, newInsightBadgeFile);
        if (uploadError) {
          alert("Erreur upload badge : " + uploadError.message);
          setUploadingBadge(false);
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from('slide-images').getPublicUrl(fileName);
        badgeUrl = publicUrl;
      } catch (err: any) {
        alert("Erreur upload : " + err.message);
        setUploadingBadge(false);
        return;
      }
      setUploadingBadge(false);
    }

    const newInsight: Insight = {
      id: Math.random().toString(36).substring(2, 10),
      label: newInsightLabel.trim(),
      badge_url: badgeUrl
    };
    setInsights([...insights, newInsight]);
    setNewInsightLabel("");
    setNewInsightBadgeFile(null);
  };

  const removeInsight = (id: string) => {
    if (!window.confirm("Supprimer cet insight ? (le badge reste sur le storage)")) return;
    setInsights(insights.filter(i => i.id !== id));
  };

  // === Helpers URLs ===
  const addUrl = () => {
    if (referenceUrls.length >= 10) return alert("Maximum 10 URLs.");
    setReferenceUrls([...referenceUrls, '']);
  };
  const updateUrl = (index: number, value: string) => {
    const updated = [...referenceUrls];
    updated[index] = value;
    setReferenceUrls(updated);
  };
  const removeUrl = (index: number) => {
    setReferenceUrls(referenceUrls.filter((_, i) => i !== index));
  };

  // === Drag & drop fichiers ===
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    setKnowledgeFiles((prev) => [...prev, ...files]);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setKnowledgeFiles((prev) => [...prev, ...files]);
    }
  };
  const removeFile = (index: number) => {
    setKnowledgeFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const deleteExistingKnowledgeFile = async (index: number) => {
    const file = existingKnowledgeFiles[index];
    if (!window.confirm(`Supprimer "${file.name}" définitivement ?\nLe fichier sera enlevé du storage et de la mémoire du client.`)) return;

    const { error } = await supabase.storage.from('brand-knowledge').remove([file.path]);
    if (error) {
      alert("Erreur suppression : " + error.message);
      return;
    }

    const newList = existingKnowledgeFiles.filter((_, i) => i !== index);
    setExistingKnowledgeFiles(newList);

    if (editingId) {
      await supabase.from('brand_kits').update({ knowledge_files: newList }).eq('id', editingId);
    }
  };

  // === Indicateurs de remplissage par section ===
  const sectionStatus = {
    general: !!(brandName.trim() && clientEmail.trim()),
    brand: !!(positioning.trim() || tone || referenceUrls.filter(u => u.trim()).length > 0),
    insights: insights.length > 0,
    publicity: publicityEnabled,
    design: true
  };

  // === Section accordion renderer ===
  const renderSection = (
    id: string,
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode,
    isFilled: boolean
  ) => {
    const open = openSections.has(id);
    return (
      <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="w-full p-5 flex items-center justify-between hover:bg-neutral-50 transition-all"
        >
          <div className="flex items-center gap-3">
            {icon}
            <span className="text-sm font-black uppercase italic tracking-tight">{title}</span>
            {isFilled && (
              <span className="w-2 h-2 rounded-full bg-green-400" title="Section remplie"></span>
            )}
          </div>
          <ChevronDown size={16} className={`transition-transform opacity-40 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="p-6 border-t border-neutral-100 space-y-6">
            {content}
          </div>
        )}
      </div>
    );
  };

  // === Couleurs disponibles pour les templates (main + text + bg + secondaires) ===
  const availableColors = [
    { ref: 'main', label: 'Principale', hex: mainColor },
    { ref: 'text', label: 'Texte', hex: textColor },
    { ref: 'bg',   label: 'Fond',     hex: bgColor },
    ...secondaryColors.map(c => ({ ref: c.id, label: c.label || 'Secondaire', hex: c.hex }))
  ];

  // === Render UI d'un template (intro, explication, etc.) ===
  const renderTemplateConfig = (slideType: TemplateKey, label: string, description: string) => {
    const isOpen = openTemplate === slideType;
    const config = templates[slideType] || {};
    const currentTypo = typographies.find(t => t.id === config.font_id);
    const currentColor = availableColors.find(c => c.ref === config.color_ref);

    return (
      <div key={slideType} className="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenTemplate(isOpen ? null : slideType)}
          className="w-full p-4 flex items-center justify-between hover:bg-white transition-all"
        >
          <div className="flex items-center gap-3 text-left">
            <span className="text-[11px] font-black uppercase italic tracking-tight">{label}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 hidden sm:inline">{description}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {currentColor && (
              <span className="w-3 h-3 rounded-full border border-neutral-200" style={{ backgroundColor: currentColor.hex }} title={currentColor.label}></span>
            )}
            {currentTypo && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 max-w-[80px] truncate hidden md:inline" title={currentTypo.label}>
                {currentTypo.label}
              </span>
            )}
            <ChevronDown size={14} className={`opacity-40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {isOpen && (
          <div className="p-5 border-t border-neutral-100 bg-white space-y-4">
            {/* Typo */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase opacity-40 px-1">Typographie</label>
              <select
                value={config.font_id || ''}
                onChange={(e) => updateTemplate(slideType, 'font_id', e.target.value)}
                className="w-full p-3 border border-neutral-100 rounded-xl bg-neutral-50 text-sm outline-none focus:border-orange-500"
                style={{ fontFamily: currentTypo?.family }}
              >
                {typographies.length === 0 && <option value="">(Aucune typo définie)</option>}
                {typographies.map(t => (
                  <option key={t.id} value={t.id} style={{ fontFamily: t.family }}>
                    {t.label}{t.is_default ? ' (par défaut)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Taille texte */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase opacity-40 px-1">Taille du texte</label>
              <div className="grid grid-cols-4 gap-2">
                {TEXT_SIZES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => updateTemplate(slideType, 'text_size', s.value)}
                    className={`p-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                      config.text_size === s.value
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:border-orange-200'
                    }`}
                  >
                    {s.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Couleur */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase opacity-40 px-1">Couleur du texte</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableColors.map(c => (
                  <button
                    key={c.ref}
                    type="button"
                    onClick={() => updateTemplate(slideType, 'color_ref', c.ref)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                      config.color_ref === c.ref
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-neutral-100 bg-neutral-50 hover:border-orange-200'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full border border-neutral-300 shrink-0" style={{ backgroundColor: c.hex }}></span>
                    <span className="text-[10px] font-black uppercase tracking-tight truncate">{c.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-neutral-400 px-1">Sur les vignettes avec image de fond, la couleur est forcée en blanc pour la lisibilité.</p>
            </div>

            {/* Alignement horizontal */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase opacity-40 px-1">Alignement horizontal</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'left',   Icon: AlignLeft,   label: 'Gauche' },
                  { v: 'center', Icon: AlignCenter, label: 'Centre' },
                  { v: 'right',  Icon: AlignRight,  label: 'Droite' }
                ] as const).map(({ v, Icon, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => updateTemplate(slideType, 'h_align', v)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      config.h_align === v
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:border-orange-200'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Alignement vertical */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase opacity-40 px-1">Alignement vertical</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'top',    Icon: ChevronsUp,   label: 'Haut' },
                  { v: 'center', Icon: AlignCenter,  label: 'Centre' },
                  { v: 'bottom', Icon: ChevronsDown, label: 'Bas' }
                ] as const).map(({ v, Icon, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => updateTemplate(slideType, 'v_align', v)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      config.v_align === v
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:border-orange-200'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-neutral-400 px-1">Haut = sous le logo · Centre = milieu de la vignette · Bas = ancré en pied (par défaut).</p>
            </div>

            {/* Reset */}
            <button
              type="button"
              onClick={() => resetTemplate(slideType)}
              className="w-full mt-2 py-2 rounded-xl border border-neutral-200 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:bg-neutral-100 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={12} /> Réinitialiser aux valeurs globales
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!sessionReady) {
    return <div className="h-screen flex items-center justify-center text-orange-500 font-black italic">CHARGEMENT...</div>;
  }

  // === Preview vignette ===
  const previewSlideRender = () => {
    const alignment = textAlignment;
    const textAlignClass = alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center';
    const flexAlignClass = alignment === 'left' ? 'items-start' : alignment === 'right' ? 'items-end' : 'items-center';

    const logoPositionClass =
      logoPosition === 'center' ? 'top-[6%] left-1/2 -translate-x-1/2' :
      logoPosition === 'right' ? 'top-[6%] right-[6%]' :
      'top-[6%] left-[6%]';

    const slideFontSize = getFontSizeCqw(introTextSize);
    const previewTextColor = '#ffffff';

    const highlightStyleObj: any = { borderRadius: '0.5cqw', fontWeight: 900 };
    if (highlightStyle === 'bg_color') {
      Object.assign(highlightStyleObj, { backgroundColor: mainColor, color: bgColor, padding: '0 1cqw' });
    } else if (highlightStyle === 'underline') {
      Object.assign(highlightStyleObj, {
        textDecoration: 'underline',
        textDecorationColor: mainColor,
        textDecorationThickness: '0.6cqw',
        textUnderlineOffset: '0.5cqw'
      });
    } else {
      Object.assign(highlightStyleObj, { color: mainColor });
    }

    const previewSubtitle = insights.length > 0 ? insights[0].label : "Insight Hebdomadaire";
    const previewBadge = insights.length > 0 ? insights[0].badge_url : null;

    return (
      <div
        className="aspect-square relative flex flex-col p-[8%] rounded-[2rem] overflow-hidden border-[6px] border-white shadow-2xl justify-end"
        style={{ backgroundColor: bgColor, fontFamily, containerType: 'inline-size' }}
      >
        <div className="absolute inset-0 z-0">
          <img src="https://loremflickr.com/800/800/abstract,business" className="w-full h-full object-cover" alt="preview-bg" />
          <div className="absolute inset-0 bg-black/25"></div>
        </div>

        <div className={`absolute z-20 ${logoPositionClass}`}>
          {logoUrl ? (
            <img src={logoUrl} className="h-[5cqw] object-contain opacity-90" alt="logo" />
          ) : (
            <span className="text-[2cqw] font-black uppercase tracking-widest" style={{ color: previewTextColor, opacity: 0.7 }}>
              {brandName || "Logo"}
            </span>
          )}
        </div>

        <div className={`relative z-10 w-full flex flex-col ${flexAlignClass}`} style={{ textAlign: alignment }}>
        <div className={`flex items-center gap-[1.5cqw] mb-[3%] ${alignment === 'right' ? 'justify-end flex-row-reverse' : alignment === 'center' ? 'justify-center' : 'justify-start'}`}>
            {previewBadge ? (
              <img src={previewBadge} className="h-[9cqw] object-contain" alt="badge" />
            ) : (
              <span
                className={getInsightTextClass(insightStyle)}
                style={{
                  fontFamily: insightFontFamily,
                  ...getInsightInlineStyle(insightStyle, mainColor, bgColor, previewTextColor)
                }}
              >
                {previewSubtitle}
              </span>
            )}
          </div>

          <p
            className={`leading-[1.32] font-black ${textAlignClass}`}
            style={{ fontSize: slideFontSize, color: previewTextColor }}
          >
            Voici comment {brandName || "la marque"} <span style={highlightStyleObj}>révolutionne</span> votre secteur.
          </p>

          <div
            className={`h-[1cqw] mt-[5%] rounded-full ${alignment === 'right' ? 'ml-auto' : alignment === 'center' ? 'mx-auto' : ''}`}
            style={{ backgroundColor: mainColor, width: '15cqw' }}
          ></div>
        </div>
      </div>
    );
  };

  // === Format date helper ===
  const formatProspectDate = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 24) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffHours < 24 * 7) {
      return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 font-sans">

      <aside className="w-72 bg-white border-r border-neutral-200 p-8 flex flex-col justify-between shadow-sm sticky h-screen top-0">
        <div className="space-y-10">
          <div className="flex items-center gap-3">
          <div className="flex items-center gap-2"><img src="/media/logo.png" alt="BrandLock" className="h-10 w-auto object-contain" /><svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 shrink-0" aria-label="Suisse"><rect width="32" height="32" fill="#FF0000" rx="3" /><rect x="13" y="7" width="6" height="18" fill="white" /><rect x="7" y="13" width="18" height="6" fill="white" /></svg></div>
             <span className="font-bold tracking-tighter text-lg uppercase italic leading-none">BrandLock <br/><span className="text-[9px] text-neutral-400 not-italic tracking-widest uppercase">Console Admin</span></span>
          </div>
          <nav className="space-y-2">
            <button onClick={() => { resetForm(); setActiveTab('create'); }} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'create' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-100'}`}>
              <Plus size={18} /> Nouveau Client
            </button>
            <button onClick={() => setActiveTab('clients')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'clients' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-100'}`}>
              <Layout size={18} /> Clients
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-100'}`}>
              📊 Analytics
            </button>
          </nav>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setActiveTab('prospects')}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 relative ${activeTab === 'prospects' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-100'}`}
          >
            <Inbox size={18} />
            Prospects
            {unreadProspectCount > 0 && (
              <span className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black ${activeTab === 'prospects' ? 'bg-white text-orange-500' : 'bg-orange-500 text-white'}`}>
                {unreadProspectCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('feedback')}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 relative ${activeTab === 'feedback' ? 'bg-orange-500 text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-100'}`}
          >
            <Bug size={18} />
            Feedback / Bugs
            {unreadFeedbackCount > 0 && (
              <span className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black ${activeTab === 'feedback' ? 'bg-white text-orange-500' : 'bg-orange-500 text-white'}`}>
                {unreadFeedbackCount}
              </span>
            )}
          </button>

          <button onClick={handleLogout} className="w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 text-neutral-500 hover:bg-red-50 hover:text-red-500 transition-all">
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 p-16 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
        {activeTab === 'analytics' ? (
            <AdminAnalytics />
          ) : activeTab === 'prospects' ? (
            <section className="space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter">Prospects</h2>
                  <p className="text-sm text-neutral-400 font-medium mt-1">
                    {prospects.length} demande{prospects.length > 1 ? 's' : ''} de démo · {unreadProspectCount} non lue{unreadProspectCount > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={fetchProspects}
                  disabled={loadingProspects}
                  className="px-4 py-2 rounded-xl bg-white border border-neutral-200 hover:bg-orange-500 hover:text-white hover:border-orange-500 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  {loadingProspects ? 'Chargement...' : 'Rafraîchir'}
                </button>
              </div>

              {loadingProspects && prospects.length === 0 ? (
                <p className="text-neutral-400 text-sm">Chargement...</p>
              ) : prospects.length === 0 ? (
                <div className="bg-white border border-dashed border-neutral-200 rounded-[2rem] p-16 text-center">
                  <Inbox size={48} className="mx-auto text-neutral-300 mb-4" />
                  <p className="text-sm text-neutral-400 font-medium">Aucune demande de démo pour l'instant.</p>
                  <p className="text-xs text-neutral-300 font-medium mt-2">
                    Les prospects qui remplissent le formulaire sur la page d'accueil apparaîtront ici.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prospects.map((prospect) => {
                    const isExpanded = expandedProspectId === prospect.id;
                    const isUnread = !prospect.read;
                    return (
                      <div
                        key={prospect.id}
                        className={`bg-white rounded-[2rem] border overflow-hidden transition-all ${isUnread ? 'border-orange-200 shadow-md' : 'border-neutral-100 shadow-sm'}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(prospect)}
                          className="w-full p-6 text-left hover:bg-neutral-50/50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isUnread ? 'bg-orange-500' : 'bg-neutral-200'}`}></span>
                                <h3 className={`text-lg italic uppercase tracking-tight truncate ${isUnread ? 'font-black' : 'font-bold text-neutral-700'}`}>
                                  {prospect.name}
                                </h3>
                                {prospect.company && (
                                  <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest shrink-0">
                                    · {prospect.company}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2 flex-wrap">
                                <span className="flex items-center gap-1.5">
                                  <Mail size={11} /> {prospect.email}
                                </span>
                                {prospect.phone && (
                                  <span className="flex items-center gap-1.5">
                                    <Phone size={11} /> {prospect.phone}
                                  </span>
                                )}
                              </div>
                              {!isExpanded && (
                                <p className="text-sm text-neutral-500 line-clamp-1">
                                  {prospect.message}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">
                                {formatProspectDate(prospect.created_at)}
                              </span>
                              <ChevronDown size={16} className={`text-neutral-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-6 pb-6 space-y-4 border-t border-neutral-100 pt-5 bg-neutral-50/30">
                            <div className="bg-white rounded-2xl border border-neutral-100 p-5">
                              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2">Message</p>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{prospect.message}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={`mailto:${prospect.email}?subject=Re: Votre demande de démo BrandLock`}
                                className="px-5 py-3 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-orange-600 transition-all flex items-center gap-2"
                              >
                                <Mail size={12} /> Répondre par email
                              </a>
                              {prospect.phone && (
                                <a
                                  href={`tel:${prospect.phone}`}
                                  className="px-5 py-3 bg-white border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-100 transition-all flex items-center gap-2"
                                >
                                  <Phone size={12} /> Appeler
                                </a>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); markProspectAsRead(prospect.id, !prospect.read); }}
                                className="px-5 py-3 bg-white border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-100 transition-all"
                              >
                                {prospect.read ? "Marquer non lu" : "Marquer lu"}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteProspect(prospect.id, prospect.name); }}
                                className="px-5 py-3 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2 ml-auto"
                              >
                                <Trash2 size={12} /> Supprimer
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : activeTab === 'feedback' ? (
            <section className="space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter">Feedback & Bugs</h2>
                  <p className="text-sm text-neutral-400 font-medium mt-1">
                    {feedbacks.length} message{feedbacks.length > 1 ? 's' : ''} · {unreadFeedbackCount} non lu{unreadFeedbackCount > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={fetchFeedbacks}
                  disabled={loadingFeedbacks}
                  className="px-4 py-2 rounded-xl bg-white border border-neutral-200 hover:bg-orange-500 hover:text-white hover:border-orange-500 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  {loadingFeedbacks ? 'Chargement...' : 'Rafraîchir'}
                </button>
              </div>

              {loadingFeedbacks && feedbacks.length === 0 ? (
                <p className="text-neutral-400 text-sm">Chargement...</p>
              ) : feedbacks.length === 0 ? (
                <div className="bg-white border border-dashed border-neutral-200 rounded-[2rem] p-16 text-center">
                  <Bug size={48} className="mx-auto text-neutral-300 mb-4" />
                  <p className="text-sm text-neutral-400 font-medium">Aucun feedback / bug signalé.</p>
                  <p className="text-xs text-neutral-300 font-medium mt-2">
                    Les clients peuvent envoyer un message depuis le bouton flottant dans le studio.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbacks.map((feedback) => {
                    const isExpanded = expandedFeedbackId === feedback.id;
                    const isUnread = !feedback.read;
                    return (
                      <div
                        key={feedback.id}
                        className={`bg-white rounded-[2rem] border overflow-hidden transition-all ${isUnread ? 'border-orange-200 shadow-md' : 'border-neutral-100 shadow-sm'}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleExpandFeedback(feedback)}
                          className="w-full p-6 text-left hover:bg-neutral-50/50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isUnread ? 'bg-orange-500' : 'bg-neutral-200'}`}></span>
                                <h3 className={`text-lg italic uppercase tracking-tight truncate ${isUnread ? 'font-black' : 'font-bold text-neutral-700'}`}>
                                  {feedback.brand_name || feedback.client_email}
                                </h3>
                                {feedback.page_origin && (
                                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md shrink-0">
                                    {feedback.page_origin}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2 flex-wrap">
                                <span className="flex items-center gap-1.5">
                                  <Mail size={11} /> {feedback.client_email}
                                </span>
                              </div>
                              {!isExpanded && (
                                <p className="text-sm text-neutral-500 line-clamp-2">
                                  {feedback.message}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">
                                {formatProspectDate(feedback.created_at)}
                              </span>
                              <ChevronDown size={16} className={`text-neutral-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-6 pb-6 space-y-4 border-t border-neutral-100 pt-5 bg-neutral-50/30">
                            <div className="bg-white rounded-2xl border border-neutral-100 p-5">
                              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2">Message</p>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{feedback.message}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={`mailto:${feedback.client_email}?subject=Re: Ton feedback BrandLock`}
                                className="px-5 py-3 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-orange-600 transition-all flex items-center gap-2"
                              >
                                <Mail size={12} /> Répondre par email
                              </a>
                              <button
                                onClick={(e) => { e.stopPropagation(); markFeedbackAsRead(feedback.id, !feedback.read); }}
                                className="px-5 py-3 bg-white border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-100 transition-all"
                              >
                                {feedback.read ? "Marquer non lu" : "Marquer lu"}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteFeedback(feedback.id); }}
                                className="px-5 py-3 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2 ml-auto"
                              >
                                <Trash2 size={12} /> Supprimer
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : activeTab === 'create' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

              <section className="lg:col-span-7 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                    {editingId ? "Modifier le Client" : "Nouveau Client"}
                  </h2>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-white border border-neutral-200 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all"
                  >
                    {allOpen ? "Tout fermer" : "Tout ouvrir"}
                  </button>
                </div>

                <form onSubmit={handleSaveClient} className="space-y-3">

                  {/* === SECTION : GÉNÉRAL === */}
                  {renderSection('general', 'Général', <Building2 size={16} className="text-orange-500" />, (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase opacity-40 px-2">Nom de Marque</label>
                          <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Marque..." className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl p-4 text-sm outline-none focus:border-orange-500" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase opacity-40 px-2">Email du client</label>
                          <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="email@..." className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl p-4 text-sm outline-none focus:border-orange-500" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40 px-2">URL du logo</label>
                        <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl p-4 text-sm outline-none focus:border-orange-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40 px-2">Position du logo sur la vignette</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['left', 'center', 'right'] as const).map((pos) => (
                            <button key={pos} type="button" onClick={() => setLogoPosition(pos)} className={`p-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${logoPosition === pos ? 'bg-orange-500 text-white border-orange-500' : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:border-orange-200'}`}>
                              {pos === 'left' ? 'Gauche' : pos === 'center' ? 'Centre' : 'Droite'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ), sectionStatus.general)}

                  {/* === SECTION : IDENTITÉ DE MARQUE === */}
                  {renderSection('brand', 'Identité de marque', <BookOpen size={16} className="text-orange-500" />, (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40 px-2">ADN & Positionnement</label>
                        <textarea value={positioning} onChange={(e) => setPositioning(e.target.value)} placeholder="Valeurs, cible, mission, ce qui rend la marque unique..." className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl p-4 text-sm outline-none focus:border-orange-500 h-24 resize-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40 px-2">Mots interdits (séparés par virgule)</label>
                        <input type="text" value={forbiddenWords} onChange={(e) => setForbiddenWords(e.target.value)} placeholder="ex: cheap, problème, échec..." className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl p-4 text-sm outline-none focus:border-orange-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase opacity-40 px-2">Ton de voix</label>
                        <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-4 border border-neutral-100 rounded-2xl bg-neutral-50 text-sm outline-none focus:border-orange-500">
                          {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase opacity-40 px-2 flex items-center gap-2">
                            <LinkIcon size={12} /> Liens de référence pour l&apos;IA
                            <span className="text-orange-500">{referenceUrls.length}/10</span>
                          </label>
                          <button
                            type="button"
                            onClick={addUrl}
                            disabled={referenceUrls.length >= 10}
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-100 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1 disabled:opacity-40"
                          >
                            <Plus size={12} /> Ajouter
                          </button>
                        </div>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest px-2">
                          URLs que l&apos;IA peut consulter pour comprendre la marque (site, blog, presse, etc.)
                        </p>
                        {referenceUrls.length === 0 ? (
                          <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl p-4 text-center">
                            <p className="text-xs text-neutral-400 font-medium">Aucune URL pour l&apos;instant</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {referenceUrls.map((url, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[10px] font-black opacity-30 w-6">{i + 1}.</span>
                                <input
                                  type="url"
                                  value={url}
                                  onChange={(e) => updateUrl(i, e.target.value)}
                                  placeholder="https://..."
                                  className="flex-1 bg-neutral-50 border border-neutral-100 rounded-xl p-3 text-xs outline-none focus:border-orange-500"
                                />
                                <button type="button" onClick={() => removeUrl(i)} className="p-2 text-neutral-300 hover:text-red-500 transition-all">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-black uppercase opacity-40 px-2 flex justify-between">
                          <span>Fichiers de référence (PDF, JPEG, PNG)</span>
                          <span className="text-orange-500">{knowledgeFiles.length} fichier(s)</span>
                        </label>
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-2xl p-6 transition-all ${isDragging ? 'border-orange-500 bg-orange-50' : 'border-neutral-200 bg-neutral-50 hover:border-orange-300'}`}
                        >
                          <div className="flex flex-col items-center justify-center text-center gap-2">
                            <Upload size={24} className={isDragging ? 'text-orange-500' : 'text-neutral-300'} />
                            <p className="text-xs font-bold text-neutral-500">
                              {isDragging ? "Lâche les fichiers ici" : "Glisse tes fichiers ici, ou clique pour parcourir"}
                            </p>
                            <label className="cursor-pointer mt-2 px-4 py-2 bg-white border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all">
                              Parcourir
                              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} className="hidden" />
                            </label>
                          </div>
                        </div>

                        {existingKnowledgeFiles.length > 0 && (
                          <div className="bg-green-50 rounded-2xl border border-green-100 p-3 space-y-1 max-h-48 overflow-y-auto">
                            <p className="text-[9px] font-black uppercase tracking-widest text-green-600 mb-1 px-1">
                              ✓ Fichiers sauvegardés ({existingKnowledgeFiles.length})
                            </p>
                            {existingKnowledgeFiles.map((file, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-white rounded-xl border border-green-100">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText size={14} className="text-green-500 shrink-0" />
                                  <span className="text-xs font-medium truncate">{file.name}</span>
                                  <span className="text-[9px] text-neutral-400 font-bold shrink-0">{(file.size / 1024 / 1024).toFixed(2)} Mo</span>
                                </div>
                                <button type="button" onClick={() => deleteExistingKnowledgeFile(i)} className="p-1 text-neutral-300 hover:text-red-500 transition-all" title="Supprimer définitivement">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {knowledgeFiles.length > 0 && (
                          <div className="bg-orange-50 rounded-2xl border border-orange-100 p-3 space-y-1 max-h-48 overflow-y-auto">
                            <p className="text-[9px] font-black uppercase tracking-widest text-orange-600 mb-1 px-1">
                              ⏳ En attente d&apos;upload (au prochain enregistrement)
                            </p>
                            {knowledgeFiles.map((file, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-white rounded-xl border border-orange-100">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText size={14} className="text-orange-500 shrink-0" />
                                  <span className="text-xs font-medium truncate">{file.name}</span>
                                  <span className="text-[9px] text-neutral-400 font-bold shrink-0">{(file.size / 1024 / 1024).toFixed(2)} Mo</span>
                                </div>
                                <button type="button" onClick={() => removeFile(i)} className="p-1 text-neutral-300 hover:text-red-500 transition-all">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-[9px] text-neutral-400 font-medium px-2">
                          ℹ️ Les fichiers PDF sont utilisés par l&apos;IA comme contexte global de la marque à chaque génération de carrousel.
                        </p>
                      </div>
                    </>
                  ), sectionStatus.brand)}

                  {/* === SECTION : INSIGHTS === */}
                  {renderSection('insights', 'Sous-titres / Insights', <Tag size={16} className="text-orange-500" />, (
                    <>
                      <p className="text-[10px] text-neutral-400 font-medium px-2">
                        Le sous-titre apparaît sur la vignette intro (ex : « Insight Hebdomadaire »). Définis-en plusieurs et le client choisira lequel utiliser à la génération. Tu peux associer un petit badge PNG.
                      </p>

                      {insights.length > 0 && (
                        <div className="space-y-2">
                          {insights.map((insight) => (
                            <div key={insight.id} className="flex items-center gap-3 bg-neutral-50 border border-neutral-100 rounded-2xl p-3">
                              {insight.badge_url ? (
                                <img src={insight.badge_url} className="w-10 h-10 object-contain rounded-lg bg-white p-1 border border-neutral-100" alt="badge" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                                  <Tag size={14} className="text-neutral-300" />
                                </div>
                              )}
                              <span className="flex-1 text-sm font-bold">{insight.label}</span>
                              <button
                                type="button"
                                onClick={() => removeInsight(insight.id)}
                                className="p-2 text-neutral-300 hover:text-red-500 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-5 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">Ajouter un sous-titre</p>
                        <input
                          type="text"
                          value={newInsightLabel}
                          onChange={(e) => setNewInsightLabel(e.target.value)}
                          placeholder="ex : Insight Hebdomadaire, Tendance du mois, Actu marque..."
                          className="w-full bg-white border border-neutral-100 rounded-xl p-3 text-sm outline-none focus:border-orange-500"
                        />
                        <div className="flex items-center gap-3">
                          <label className="cursor-pointer flex-1 px-4 py-3 bg-white border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center justify-center gap-2">
                            <Upload size={12} />
                            {newInsightBadgeFile ? newInsightBadgeFile.name.substring(0, 25) : "Badge PNG (optionnel)"}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/svg+xml"
                              onChange={(e) => setNewInsightBadgeFile(e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                          {newInsightBadgeFile && (
                            <button
                              type="button"
                              onClick={() => setNewInsightBadgeFile(null)}
                              className="p-2 text-neutral-300 hover:text-red-500"
                            >
                              <X size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={addInsight}
                            disabled={uploadingBadge || !newInsightLabel.trim()}
                            className="px-5 py-3 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-orange-600 disabled:opacity-40 flex items-center gap-2"
                          >
                            <Plus size={12} /> {uploadingBadge ? "Upload..." : "Ajouter"}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-neutral-100">
                        <div className="space-y-1 px-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Style des sous-titres en texte</p>
                          <p className="text-[10px] text-neutral-400 font-medium">
                            S&apos;applique uniquement aux sous-titres sans badge PNG. Avec badge, seule l&apos;image est affichée.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase opacity-40 px-2">Typographie</label>
                          <select
                            value={insightFontFamily}
                            onChange={(e) => setInsightFontFamily(e.target.value)}
                            className="w-full p-4 border border-neutral-100 rounded-2xl bg-neutral-50 text-sm outline-none focus:border-orange-500"
                            style={{ fontFamily: insightFontFamily }}
                          >
                            {FONT_FAMILIES.map((f) => (
                              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase opacity-40 px-2">Encadrement</label>
                          <div className="grid grid-cols-5 gap-2">
                            {[
                              { id: 'plain', label: 'Aucun' },
                              { id: 'underline', label: 'Souligné' },
                              { id: 'boxed', label: 'Encadré' },
                              { id: 'pill_rounded', label: 'Pastille' },
                              { id: 'pill_squared', label: 'Carré plein' }
                            ].map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setInsightStyle(s.id)}
                                className={`p-3 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${insightStyle === s.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:border-orange-200'}`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ), sectionStatus.insights)}

                  {/* === SECTION : BIBLIOTHÈQUE VISUELLE === */}
                  {renderSection('library', 'Bibliothèque visuelle', <ImageIcon size={16} className="text-orange-500" />, (
                    <BrandLibrarySection
                      clientEmail={clientEmail}
                      brandName={brandName}
                      editingId={editingId}
                    />
                  ), false)}

                  {/* === SECTION : PUBLICITÉ === */}
                  {renderSection('publicity', 'Module Publicité', <Megaphone size={16} className="text-orange-500" />, (
                    <>
                      <p className="text-[10px] text-neutral-400 font-medium px-2">
                        Active le module pour que le client puisse générer des publicités (posts, stories, bannières). L&apos;IA agira comme un copywriter vendeur, séparé du module carrousel classique.
                      </p>

                      <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                        <button
                          type="button"
                          onClick={() => setPublicityEnabled(!publicityEnabled)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all flex-shrink-0 ${publicityEnabled ? 'bg-orange-500' : 'bg-neutral-300'}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-all ${publicityEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <div>
                          <p className="text-xs font-black uppercase tracking-tight">{publicityEnabled ? "Module activé" : "Module désactivé"}</p>
                          <p className="text-[10px] text-neutral-400 font-medium">Apparaît dans le studio du client comme un onglet supplémentaire</p>
                        </div>
                      </div>

                      {publicityEnabled && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase opacity-40 px-2">Contexte commercial</label>
                          <textarea
                            value={publicityContext}
                            onChange={(e) => setPublicityContext(e.target.value)}
                            placeholder="Ce que le client vend : produits, services, gammes, points de différenciation, prix, promos habituelles, arguments clés..."
                            className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl p-4 text-sm outline-none focus:border-orange-500 h-32 resize-none"
                          />
                          <p className="text-[10px] text-neutral-400 font-medium px-2">
                            L&apos;IA utilise ces infos pour rédiger des accroches publicitaires pertinentes. Plus tu détailles, mieux elle vendra.
                          </p>
                        </div>
                      )}
                    </>
                  ), sectionStatus.publicity)}

                  {/* === SECTION : DESIGN SYSTEM === */}
                  {renderSection('design', 'Design System', <Palette size={16} className="text-orange-500" />, (
                    <>
                      {/* ====== TYPOGRAPHIES MULTIPLES (NEW) ====== */}
                      <div className="space-y-3 pb-4 border-b border-neutral-100">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2 flex items-center gap-2">
                            <Type size={12} /> Typographies
                            <span className="text-orange-500">{typographies.length} défini{typographies.length > 1 ? 'es' : 'e'}</span>
                          </label>
                          <button
                            type="button"
                            onClick={addTypography}
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-100 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1"
                          >
                            <Plus size={12} /> Ajouter
                          </button>
                        </div>
                        <p className="text-[9px] text-neutral-400 font-medium px-2">
                          Ajoute autant de typographies que tu veux. Marque-en une par défaut (utilisée comme fallback global). Chaque template de vignette peut choisir laquelle utiliser.
                        </p>

                        {typographies.length === 0 ? (
                          <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl p-4 text-center">
                            <p className="text-xs text-neutral-400 font-medium">Aucune typo · clique sur Ajouter</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {typographies.map((typo) => (
                              <div key={typo.id} className="bg-neutral-50 rounded-2xl border border-neutral-100 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setDefaultTypography(typo.id)}
                                    title={typo.is_default ? "Typo par défaut" : "Définir comme défaut"}
                                    className={`p-2 rounded-lg transition-all ${typo.is_default ? 'bg-orange-500 text-white' : 'bg-white text-neutral-300 hover:bg-neutral-100 hover:text-orange-500'}`}
                                  >
                                    <Star size={12} fill={typo.is_default ? 'currentColor' : 'none'} />
                                  </button>
                                  <input
                                    type="text"
                                    value={typo.label}
                                    onChange={(e) => updateTypography(typo.id, 'label', e.target.value)}
                                    placeholder="Nom (ex: Headline)"
                                    className="flex-1 bg-white border border-neutral-100 rounded-lg p-2 text-xs outline-none focus:border-orange-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeTypography(typo.id)}
                                    disabled={typographies.length <= 1}
                                    className="p-2 text-neutral-300 hover:text-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={typographies.length <= 1 ? "Garde au moins une typo" : "Supprimer"}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <select
                                  value={typo.family}
                                  onChange={(e) => updateTypography(typo.id, 'family', e.target.value)}
                                  className="w-full p-2.5 border border-neutral-100 rounded-lg bg-white text-xs outline-none focus:border-orange-500"
                                  style={{ fontFamily: typo.family }}
                                >
                                  {FONT_FAMILIES.map((f) => (
                                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ====== TAILLES GLOBALES (fallback templates) ====== */}
                      <div className="space-y-3 pb-4 border-b border-neutral-100">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2">Tailles globales (fallback)</label>
                        <p className="text-[9px] text-neutral-400 font-medium px-2">Tailles utilisées si un template par vignette n&apos;est pas configuré explicitement.</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase opacity-40 px-1">Standard</label>
                            <select value={textSize} onChange={(e) => setTextSize(e.target.value)} className="w-full p-3 border border-neutral-100 rounded-xl bg-neutral-50 text-sm outline-none focus:border-orange-500">
                              {TEXT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase opacity-40 px-1">Intro</label>
                            <select value={introTextSize} onChange={(e) => setIntroTextSize(e.target.value)} className="w-full p-3 border border-neutral-100 rounded-xl bg-neutral-50 text-sm outline-none focus:border-orange-500">
                              {TEXT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase opacity-40 px-1">Outro</label>
                            <select value={endTextSize} onChange={(e) => setEndTextSize(e.target.value)} className="w-full p-3 border border-neutral-100 rounded-xl bg-neutral-50 text-sm outline-none focus:border-orange-500">
                              {TEXT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* ====== ALIGNEMENT GLOBAL ====== */}
                      <div className="space-y-3 pb-4 border-b border-neutral-100">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2">Alignement par défaut</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button type="button" onClick={() => setTextAlignment('left')} className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all ${textAlignment === 'left' ? 'bg-orange-500 text-white border-orange-500' : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:border-orange-200'}`}>
                            <AlignLeft size={16} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Gauche</span>
                          </button>
                          <button type="button" onClick={() => setTextAlignment('center')} className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all ${textAlignment === 'center' ? 'bg-orange-500 text-white border-orange-500' : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:border-orange-200'}`}>
                            <AlignCenter size={16} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Centre</span>
                          </button>
                          <button type="button" onClick={() => setTextAlignment('right')} className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all ${textAlignment === 'right' ? 'bg-orange-500 text-white border-orange-500' : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:border-orange-200'}`}>
                            <AlignRight size={16} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Droite</span>
                          </button>
                        </div>
                      </div>

                      {/* ====== COULEURS PRINCIPALES ====== */}
                      <div className="space-y-3 pb-4 border-b border-neutral-100">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2">Couleurs principales</label>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase opacity-40 px-1">Fond</label>
                            <div className="flex items-center gap-3 bg-neutral-50 p-2 rounded-2xl border border-neutral-100">
                              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none" />
                              <span className="text-[10px] font-mono uppercase">{bgColor}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase opacity-40 px-1">Accent</label>
                            <div className="flex items-center gap-3 bg-neutral-50 p-2 rounded-2xl border border-neutral-100">
                              <input type="color" value={mainColor} onChange={(e) => setMainColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none" />
                              <span className="text-[10px] font-mono uppercase">{mainColor}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase opacity-40 px-1">Texte</label>
                            <div className="flex items-center gap-3 bg-neutral-50 p-2 rounded-2xl border border-neutral-100">
                              <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none" />
                              <span className="text-[10px] font-mono uppercase">{textColor}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ====== COULEURS SECONDAIRES (NEW, max 4) ====== */}
                      <div className="space-y-3 pb-4 border-b border-neutral-100">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2 flex items-center gap-2">
                            <Palette size={12} /> Couleurs secondaires
                            <span className="text-orange-500">{secondaryColors.length}/4</span>
                          </label>
                          <button
                            type="button"
                            onClick={addSecondaryColor}
                            disabled={secondaryColors.length >= 4}
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-100 hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all flex items-center gap-1 disabled:opacity-40"
                          >
                            <Plus size={12} /> Ajouter
                          </button>
                        </div>
                        <p className="text-[9px] text-neutral-400 font-medium px-2">
                          Utilisées dans les graphiques (camembert, barres, courbes) et accessibles dans chaque template de vignette comme couleur de texte.
                        </p>

                        {secondaryColors.length === 0 ? (
                          <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl p-4 text-center">
                            <p className="text-xs text-neutral-400 font-medium">Aucune couleur secondaire</p>
                            <p className="text-[10px] text-neutral-300 font-medium mt-1">Sans secondaires, la palette graphique est dérivée auto de la couleur principale.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {secondaryColors.map((color) => (
                              <div key={color.id} className="bg-neutral-50 rounded-2xl border border-neutral-100 p-3 flex items-center gap-2">
                                <input
                                  type="color"
                                  value={color.hex}
                                  onChange={(e) => updateSecondaryColor(color.id, 'hex', e.target.value)}
                                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none shrink-0"
                                />
                                <input
                                  type="text"
                                  value={color.label}
                                  onChange={(e) => updateSecondaryColor(color.id, 'label', e.target.value)}
                                  placeholder="Label"
                                  className="flex-1 bg-white border border-neutral-100 rounded-lg p-2 text-xs outline-none focus:border-orange-500 min-w-0"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSecondaryColor(color.id)}
                                  className="p-2 text-neutral-300 hover:text-red-500 transition-all shrink-0"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ====== STYLE HIGHLIGHT ====== */}
                      <div className="space-y-3 pb-4 border-b border-neutral-100">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2">Style des mots surlignés</label>
                        <select value={highlightStyle} onChange={(e) => setHighlightStyle(e.target.value)} className="w-full p-4 border border-neutral-100 rounded-2xl bg-neutral-50 text-sm outline-none focus:border-orange-500">
                          <option value="text_color">Texte coloré</option>
                          <option value="bg_color">Surlignage (Mark)</option>
                          <option value="underline">Souligné</option>
                        </select>
                      </div>

                      {/* ====== TEMPLATES PAR VIGNETTE (NEW) ====== */}
                      <div className="space-y-3 pt-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2 flex items-center gap-2">
                          <Layout size={12} /> Templates par vignette
                        </label>
                        <p className="text-[9px] text-neutral-400 font-medium px-2">
                          Personnalise chaque type de vignette indépendamment. Si une vignette n&apos;a pas de template configuré, elle utilise les valeurs globales ci-dessus. Click sur un template pour le déplier.
                        </p>

                        <div className="space-y-2">
                          {SLIDE_TEMPLATE_LIST.map(({ id, label, description }) => renderTemplateConfig(id, label, description))}
                        </div>
                      </div>
                    </>
                  ), sectionStatus.design)}

                  <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white font-black py-6 rounded-[2rem] shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 mt-6">
                  <Save size={20} /> {uploadingKnowledge ? "Upload des fichiers..." : loading ? "Enregistrement..." : editingId ? "Enregistrer les modifications" : "Créer le client"}
                  </button>
                </form>
              </section>

              <section className="lg:col-span-5 sticky top-16 h-fit space-y-6">
                <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-neutral-400">
                  <Eye size={24} /> Aperçu de la Vignette
                </h3>

                {previewSlideRender()}

                <div className="bg-orange-50 border border-orange-100 p-6 rounded-3xl">
                  <h4 className="text-[10px] font-black uppercase text-orange-600 mb-3">Résumé de la Charte</h4>
                  <ul className="text-xs space-y-2 font-bold text-orange-900/60">
                    <li>• Ton : <span className="text-orange-600">{tone}</span></li>
                    <li>• Typos : <span className="text-orange-600">{typographies.length} défini{typographies.length > 1 ? 'es' : 'e'}</span></li>
                    <li>• Couleurs secondaires : <span className="text-orange-600">{secondaryColors.length}/4</span></li>
                    <li>• Templates configurés : <span className="text-orange-600">{Object.keys(templates).length}/6</span></li>
                    <li>• Alignement : <span className="text-orange-600 uppercase">{textAlignment}</span></li>
                    <li>• Logo : <span className="text-orange-600 uppercase">{logoPosition}</span></li>
                    <li>• Sous-titres : <span className="text-orange-600">{insights.length} défini(s)</span></li>
                    <li>• Liens IA : <span className="text-orange-600">{referenceUrls.filter(u => u.trim()).length} actif(s)</span></li>
                    <li>• Module pub : <span className="text-orange-600 uppercase">{publicityEnabled ? "Activé" : "Désactivé"}</span></li>
                  </ul>
                </div>
              </section>

            </div>
          ) : (
            <section className="space-y-8 animate-in fade-in duration-500">
              <h2 className="text-4xl font-black italic uppercase tracking-tighter">Répertoire Clients</h2>
              {brandKits.length === 0 ? (
                <p className="text-neutral-400 text-sm">Aucun client pour l&apos;instant.</p>
              ) : (
                <div className="grid gap-4">
                  {brandKits.map((kit) => {
                    const photoCount = kit._image_count || 0;
                    const hasPhotos = photoCount > 0;
                    const hasPub = !!kit.publicity_enabled;
                    return (
                      <div key={kit.id} className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm flex items-center justify-between group hover:border-orange-200 transition-all">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-2xl border border-neutral-50 flex items-center justify-center overflow-hidden" style={{ backgroundColor: kit.bg_color }}>
                            {kit.logo_url ? <img src={kit.logo_url} className="w-10 h-10 object-contain" alt="logo" /> : <div className="w-4 h-4 rounded-full" style={{ backgroundColor: kit.main_color }}/>}
                          </div>
                          <div>
                            <h3 className="text-xl font-black italic uppercase text-black">{kit.brand_name}</h3>
                            <div className="flex gap-2 items-center mt-1 flex-wrap">
                              <span
                                className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest flex items-center gap-1.5 ${hasPub ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-400'}`}
                                title={hasPub ? "Module publicité activé" : "Module publicité désactivé"}
                              >
                                <Megaphone size={10} /> Pub
                              </span>
                              <span
                                className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest flex items-center gap-1.5 ${hasPhotos ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-400'}`}
                                title={`${photoCount} photo(s) dans la bibliothèque visuelle`}
                              >
                                <ImageIcon size={10} /> {photoCount} photo{photoCount > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(kit)} className="px-5 py-2 bg-neutral-50 hover:bg-orange-500 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all">Gérer la Charte</button>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Supprimer ${kit.brand_name} ?`)) {
                                const { error } = await supabase.from('brand_kits').delete().eq('id', kit.id);
                                if (error) {
                                  alert("Erreur suppression : " + error.message);
                                  return;
                                }
                                fetchBrandKits();
                              }
                            }}
                            className="p-3 text-red-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
