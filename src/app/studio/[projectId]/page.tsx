"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentTenant } from "../../../lib/useCurrentTenant";
import { supabase } from "../../../lib/supabase";
import {
  useStudioProject,
} from "../../../lib/useStudioProject";
import {
  ArrowLeft, Loader2, AlertCircle, ChevronDown, ChevronRight, GripVertical,
  Plus, Trash2, Check, Send, Download, LogOut, Clock,
  Image as ImageIcon, X, CheckCircle2, Pencil,
} from "lucide-react";
import SlideRenderer from "../../../components/studio/SlideRenderer";
import FormatTabs from "../../../components/studio/FormatTabs";
import SafeZoneOverlay from "../../../components/studio/SafeZoneOverlay";
import { countProjectManualOverrides, setInputOverride, getInputFinalValue, getResolvedInputs as getResolvedInputsFromHelper } from "../../../lib/formatOverrides";
import MediaPicker, { SelectedImage } from "../../../components/studio/MediaPicker";
import { exportCarouselAsZip, downloadBlob, ExportProgress } from "../../../lib/exportCarousel";
import NotificationsBell from "@/components/NotificationsBell";
import StudioHeader from "@/components/StudioHeader";
import ProjectMessagesIcon from "@/components/ProjectMessagesIcon";
import FeedbackWidget from "@/components/FeedbackWidget";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import { getAvailableVariants, getSubVariants, getDefaultSubVariant, getSubVariantConfig, variantLabel, createDefaultSlide, createEmptySlide, createSlideWithVariant, countFilledInputs } from "@/lib/studioHelpers";
import ErrorScreen from "@/components/studio/ErrorScreen";
import AddSlideButton from "@/components/studio/AddSlideButton";
import SlidePreview from "@/components/studio/SlidePreview";
import SlideAccordion from "@/components/studio/SlideAccordion";

// ⚠ SUPPRIMÉ : import LogoutButton (remplacé par icône custom directement dans le header)

type UserRole = "tenant_admin" | "graphist" | "super_admin" | "viewer";


// ============================================================
//  PAGE PRINCIPALE
// ============================================================

export default function StudioEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  const tenantState = useCurrentTenant();

  const tenantId =
    tenantState.status === "ready" ? tenantState.user.tenantId : null;

  const { state: projectState, updateStateJson } = useStudioProject(
    projectId,
    tenantId
  );

  // Sprint 3+4 : Multi-format state derivation
  const stateJsonRaw = projectState.project?.state_json;
  const primaryFormat = stateJsonRaw?.templateKey || "carrousel_instagram";
  // Phase 9.3.10 : Filtre les undefined/null (bug create_project depuis brief)
  const activeFormatsRaw = stateJsonRaw?.activeFormats || [primaryFormat];
  const activeFormats = (Array.isArray(activeFormatsRaw) ? activeFormatsRaw : [primaryFormat]).filter((f: any) => typeof f === "string" && f.length > 0);
  const activeEditingFormat = stateJsonRaw?.meta?.activeEditingFormat || primaryFormat;
  const allTemplates = (tenantState.status === "ready" ? (tenantState.config?.exportTemplates || {}) : {}) as Record<string, any>;

  const overridesCount = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!stateJsonRaw?.slides) return counts;
    for (const fmt of activeFormats) {
      counts[fmt] = countProjectManualOverrides(stateJsonRaw.slides, fmt);
    }
    return counts;
  }, [activeFormats, stateJsonRaw?.slides]);

  const handleSelectFormat = (key: string) => {
    updateStateJson((sj) => ({
      ...sj,
      meta: { ...sj.meta, activeEditingFormat: key },
    }));
  };

  const handleAddFormat = (key: string) => {
    updateStateJson((sj) => ({
      ...sj,
      activeFormats: [...(sj.activeFormats || [sj.templateKey]), key],
      meta: { ...sj.meta, activeEditingFormat: key },
    }));
    toast.success("Format ajoute", { description: "Tu peux maintenant l editer." });
  };

  const handleRemoveFormat = (key: string) => {
    if (key === stateJsonRaw?.templateKey) return;
    updateStateJson((sj) => {
      const newSlides = sj.slides.map((s: any) => {
        if (!s.formatOverrides?.[key]) return s;
        const newOverrides = { ...s.formatOverrides };
        delete newOverrides[key];
        return { ...s, formatOverrides: newOverrides };
      });
      return {
        ...sj,
        slides: newSlides,
        activeFormats: (sj.activeFormats || []).filter((f: string) => f !== key),
        meta: {
          ...sj.meta,
          activeEditingFormat:
            sj.meta?.activeEditingFormat === key
              ? sj.templateKey
              : sj.meta?.activeEditingFormat,
        },
      };
    });
    toast.success("Format supprime");
  };

  const [openSlideId, setOpenSlideId] = useState<string | null>(null);
  // Phase 9.3.25 : drag & drop des slides
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sprint 4 : Toggle Safe Zones avec persistance localStorage
  const [safeZonesEnabled, setSafeZonesEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("studio:safeZones");
    if (saved === "true") setSafeZonesEnabled(true);
  }, []);

  const toggleSafeZones = () => {
    setSafeZonesEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("studio:safeZones", next ? "true" : "false");
      } catch {}
      return next;
    });
  };
  const [submitting, setSubmitting] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [localTitle, setLocalTitle] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  // ⭐ GUARD : Tenant admin ne doit JAMAIS accéder au studio editor
  useEffect(() => {
    if (tenantState.status === "ready" && tenantState.user.role === "tenant_admin") {
      router.replace(`/admin/tenant/projects/${projectId}`);
    }
  }, [tenantState.status, projectId, router]);

  useEffect(() => {
    if (hasInitialized) return;
    if (projectState.status !== "ready" || !projectState.project) return;
    if (tenantState.status !== "ready") return;

    const slides = projectState.project.state_json.slides;

    if (slides.length === 0) {
      const newSlide = createDefaultSlide(tenantState.config);
      updateStateJson((prev) => ({ ...prev, slides: [newSlide] }));
      setOpenSlideId(newSlide.id);
    } else {
      setOpenSlideId(slides[0].id);
    }
    setHasInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectState.status, tenantState.status, hasInitialized]);

  // ⭐ Handler logout (remplace l'ancien LogoutButton, même comportement qu'AppHeader)
  const handleLogout = async () => {
    const ok = await confirmDialog("Se déconnecter ?", {
      description: "Tu vas être redirigé vers la page d'accueil.",
      confirmLabel: "Déconnexion",
    });
    if (!ok) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  if (tenantState.status === "loading" || projectState.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  // ⭐ Écran de redirection pour admin (évite le flash de contenu studio)
  if (tenantState.status === "ready" && tenantState.user.role === "tenant_admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto mb-3" />
          <p className="text-xs text-neutral-500">Redirection vers la page de validation...</p>
        </div>
      </div>
    );
  }

  if (tenantState.status !== "ready") {
    return <ErrorScreen title="Compte non configuré" message={tenantState.error || "Impossible de charger ta configuration."} />;
  }

  if (projectState.status === "not_found") {
    return <ErrorScreen title="Projet introuvable" message="Ce projet n'existe pas." />;
  }

  if (projectState.status === "error" || !projectState.project) {
    return <ErrorScreen title="Erreur" message={projectState.error || "Erreur inconnue"} />;
  }

  const { config, user } = tenantState;
  const project = projectState.project;
  const slides = project.state_json.slides;
  const brandColor = config.brandIdentity.colors.brandPrimary;
  const userRole = user.role as UserRole;
  const userTenantId = user.tenantId || "";

  const effectiveTitle = localTitle ?? project.title;

  const okCount = slides.filter((s: any) => s.review?.status === "ok").length;
  const needsChangesCount = slides.filter((s: any) => s.review?.status === "needs_changes").length;
  const hasReviews = okCount > 0 || needsChangesCount > 0;

  const addSlide = (variant: string, subVariant: string) => {
    const newSlide = createEmptySlide(variant, subVariant, config);
    updateStateJson((prev) => ({ ...prev, slides: [...prev.slides, newSlide] }));
    setOpenSlideId(newSlide.id);
  };

  const deleteSlide = async (slideId: string) => {
    const ok = await confirmDialog("Supprimer cette slide ?", {
      description: "Le contenu de cette slide sera perdu.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    updateStateJson((prev) => ({ ...prev, slides: prev.slides.filter((s) => s.id !== slideId) }));
    if (openSlideId === slideId) {
      const remaining = slides.filter((s) => s.id !== slideId);
      setOpenSlideId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Phase 9.3.25 : reordonner les slides (drag & drop)
  const moveSlide = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    updateStateJson((prev) => {
      const arr = [...prev.slides];
      if (from >= arr.length || to >= arr.length) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return { ...prev, slides: arr };
    });
  };

  // Sprint 3+4 : helper pour resoudre les inputs avec overrides du format actif
  const getResolvedInputs = (slide: any, formatKey: string): Record<string, any> => {
    if (!slide) return {};
    const result: Record<string, any> = { ...slide.inputs };
    const overrides = slide.formatOverrides?.[formatKey]?.inputs;
    if (overrides) {
      for (const [key, entry] of Object.entries(overrides)) {
        result[key] = (entry as any).value;
      }
    }
    return result;
  };

  const updateSlideVariantAndSub = (slideId: string, newVariant: string, newSubVariant: string) => {
    updateStateJson((prev) => ({
      ...prev,
      slides: prev.slides.map((s) =>
        s.id === slideId ? createSlideWithVariant(slideId, newVariant, newSubVariant, config, s) : s
      ),
    }));
  };

  const updateSlideInput = (slideId: string, inputKey: string, value: any) => {
    // Sprint 3+4 : detect format actif et stocker en override si non-primary
    updateStateJson((prev) => {
      const editingFormat = prev.meta?.activeEditingFormat || prev.templateKey;
      const isPrimary = editingFormat === prev.templateKey;
      return {
        ...prev,
        slides: prev.slides.map((s: any) => {
          if (s.id !== slideId) return s;
          // CAS 1 : edit dans le format primary -> base content
          if (isPrimary) {
            return { ...s, inputs: { ...s.inputs, [inputKey]: value } };
          }
          // CAS 2 : edit dans un format secondaire -> override manuel granulaire
          return setInputOverride(s, editingFormat, inputKey, value, "manual");
        }),
      };
    });
  };

  // Ancien comportement preserve pour les autres handlers (deprecated)
  const updateSlideInputLegacy = (slideId: string, inputKey: string, value: any) => {
    updateStateJson((prev) => ({
      ...prev,
      slides: prev.slides.map((s) =>
        s.id === slideId ? { ...s, inputs: { ...s.inputs, [inputKey]: value } } : s
      ),
    }));
  };

  const goToNextSlide = (currentSlideId: string) => {
    const idx = slides.findIndex((s) => s.id === currentSlideId);
    if (idx >= 0 && idx < slides.length - 1) {
      setOpenSlideId(slides[idx + 1].id);
    }
  };

  const handleSubmit = async () => {
    if (slides.length === 0) {
      toast.error("Aucune slide à soumettre", {
        description: "Ajoute au moins une slide avant de soumettre.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const stateJsonForSubmit = {
        ...project.state_json,
        slides: project.state_json.slides.map((s: any) => ({ ...s, review: null })),
      };

      const res = await fetch(`/api/studio/projects/${projectId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_json: stateJsonForSubmit, status: "pending_approval" }),
      });
      if (!res.ok) throw new Error("Erreur soumission");
      const isResubmit = project.status === "pending_approval";
      toast.success(isResubmit ? "Version mise à jour ✓" : "Projet soumis ✓", {
        description: isResubmit
          ? "L'admin verra la nouvelle version dès son prochain refresh."
          : "L'admin va le valider et te transmettre ses retours.",
      });
      setTimeout(() => { window.location.href = "/studio"; }, 1200);
    } catch (err: any) {
      toast.error("Soumission impossible", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    if (slides.length === 0) {
      toast.error("Aucune slide à exporter", {
        description: "Ajoute au moins une slide avant d'exporter.",
      });
      return;
    }
    setExporting(true);
    setExportProgress({ step: "preparing", message: "Initialisation..." });

    try {
      const container = document.getElementById("export-render-container");
      if (!container) throw new Error("Container d'export introuvable");
      await new Promise((r) => setTimeout(r, 500));

      const zipBlob = await exportCarouselAsZip({
        projectTitle: effectiveTitle,
        container,
        slideSelector: "[data-export-slide]",
        onProgress: (p) => setExportProgress(p),
        width: 1080,
        height: 1350,
      });

      const filename = `${effectiveTitle.replace(/[^a-zA-Z0-9-_]/g, "_")}.zip`;
      downloadBlob(zipBlob, filename);

      setTimeout(() => {
        setExporting(false);
        setExportProgress(null);
      }, 2000);
    } catch (err: any) {
      toast.error("Export impossible", { description: err.message || String(err) });
      setExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-neutral-50 overflow-hidden">
      {/* ⭐ HEADER UNIFIÉ — Style identique à AppHeader, mais avec features éditeur */}
      {/* Phase 12 peaufinage : Header universel StudioHeader */}
      <StudioHeader
        backHref="/studio"
        eyebrowMain="STUDIO"
        eyebrowSubtitle={config.tenant.name}
        title={effectiveTitle}
        editableTitle={{
          endpoint: `/api/studio/projects/${projectId}/save`,
          onUpdated: (newTitle) => {
            setLocalTitle(newTitle);
            if (projectState.status === "ready" && projectState.project) {
              projectState.project.title = newTitle;
            }
          },
        }}
        statusBadge={project.status as any}
        showStudioMenu={true}
        tenantId={tenantState.status === "ready" ? tenantState.user.tenantId : null}
        showMessages={true}
        projectId={projectId}
        showNotifications={true}
        exportAction={{
          onClick: handleExport,
          disabled: exporting || slides.length === 0,
          loading: exporting,
          title: "Exporter en PNG (ZIP)",
        }}
        submitAction={{
          onClick: handleSubmit,
          status: project.status as any,
          submitting: submitting,
          disabled: slides.length === 0,
        }}
        showLogout={true}
        onLogout={handleLogout}
      />

        {/* Sprint 3+4 : Tabs formats multi-format */}
        {projectState.status === "ready" && (
          <FormatTabs
            allTemplates={allTemplates}
            activeFormats={activeFormats}
            activeEditingFormat={activeEditingFormat}
            primaryFormat={primaryFormat}
            overridesCount={overridesCount}
            primaryColor={brandColor}
            onSelectFormat={handleSelectFormat}
            onAddFormat={handleAddFormat}
            onRemoveFormat={handleRemoveFormat}
            safeZonesEnabled={safeZonesEnabled}
            onToggleSafeZones={toggleSafeZones}
          />
        )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[340px] border-r border-neutral-200 bg-white overflow-y-auto flex flex-col shrink-0">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-white z-10">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Slides</div>
              <div className="text-sm font-bold text-neutral-900 mt-0.5">
                {slides.length} slide{slides.length > 1 ? "s" : ""}
              </div>
              {hasReviews && (
                <div className="flex items-center gap-2 mt-1 text-[10px]">
                  {okCount > 0 && (
                    <span className="text-green-600 font-bold flex items-center gap-0.5">
                      <CheckCircle2 size={9} /> {okCount} OK
                    </span>
                  )}
                  {needsChangesCount > 0 && (
                    <span className="text-amber-600 font-bold flex items-center gap-0.5">
                      <AlertCircle size={9} /> {needsChangesCount} à corriger
                    </span>
                  )}
                </div>
              )}
            </div>
            <AddSlideButton config={config} onAdd={addSlide} brandColor={brandColor} />
          </div>

          {/* SLIDES */}
          <div className="flex-1 px-3 py-3 space-y-2">
          {slides.map((slide: any, idx: number) => (
              <div
                key={slide.id}
                draggable={openSlideId !== slide.id}
                onDragStart={(e) => {
                  dragIndexRef.current = idx;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                  setDragOverIndex(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragIndexRef.current !== null && dragIndexRef.current !== idx) setDragOverIndex(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragIndexRef.current;
                  if (from !== null && from !== idx) moveSlide(from, idx);
                  setDragOverIndex(null);
                }}
                className={`rounded-xl transition-all ${openSlideId !== slide.id ? "cursor-grab active:cursor-grabbing" : ""} ${dragOverIndex === idx && dragIndexRef.current !== null && dragIndexRef.current !== idx ? "ring-2 ring-[#B11E2F] ring-offset-2" : ""}`}
              >
                <SlideAccordion
                slide={slide}
                index={idx}
                isOpen={openSlideId === slide.id}
                isLast={idx === slides.length - 1}
                onToggle={() => setOpenSlideId(openSlideId === slide.id ? null : slide.id)}
                onDelete={() => deleteSlide(slide.id)}
                onChangeVariant={(v: string, sv: string) => updateSlideVariantAndSub(slide.id, v, sv)}
                onChangeInput={(key: string, value: any) => updateSlideInput(slide.id, key, value)}
                onCompleteSlide={() => goToNextSlide(slide.id)}
                brandColor={brandColor}
                config={config}
                userRole={userRole}
                tenantId={userTenantId}
              activeEditingFormat={activeEditingFormat}
              />
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-8 bg-neutral-100">
          <div className="flex gap-5 min-w-max">
            {slides.length === 0 ? (
              <div className="text-center py-20 px-10 bg-white rounded-2xl border border-dashed border-neutral-300">
                <p className="text-sm text-neutral-500">Ajoute ta première slide depuis le panneau gauche</p>
              </div>
            ) : (
              slides.map((slide: any, idx: number) => (
                <SlidePreview
                  key={slide.id}
                  slide={slide}
                  index={idx}
                  isOpen={openSlideId === slide.id}
                  brandColor={brandColor}
                  config={config}
                  onClick={() => setOpenSlideId(slide.id)}
                  activeEditingFormat={activeEditingFormat}
                  allTemplates={allTemplates}
                  safeZonesEnabled={safeZonesEnabled}
                />
              ))
            )}
            {slides.length > 0 && (
              <div aria-hidden className="shrink-0 w-[50vw]" />
            )}
          </div>
        </main>
      </div>

      {/* CONTAINER CACHE pour l'export multi-format (1 groupe par format) */}
      <div
        id="export-render-container"
        style={{ position: "fixed", top: 0, left: -99999, opacity: 0, pointerEvents: "none", zIndex: -1 }}
        aria-hidden="true"
      >
        {activeFormats.map((fmt: string) => {
          const t = (allTemplates as any)[fmt];
          const fw = t?.dimensions?.width || t?.canvas?.widthPx || 1080;
          const fh = t?.dimensions?.height || t?.canvas?.heightPx || 1350;
          const flabel = t?.label || fmt;
          return (
            <div
              key={`fmtgrp-${fmt}`}
              data-export-format={fmt}
              data-format-label={flabel}
              data-format-w={fw}
              data-format-h={fh}
            >
              {slides.map((slide: any, idx: number) => {
                const subVariant = (slide as any).subVariant || undefined;
                return (
                  <div
                    key={`export-${fmt}-${slide.id}`}
                    data-export-slide
                    data-slide-index={idx}
                    style={{ width: fw, height: fh, backgroundColor: "#1A1A1A" }}
                  >
                    <SlideRenderer
                      config={config}
                      variant={slide.variant}
                      subVariant={subVariant}
                      inputValues={getResolvedInputs(slide, fmt)}
                      templateKey={fmt}
                      scale={1}
                      slide={slide as any}
                      activeFormat={fmt}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ⭐ FEEDBACK WIDGET — Visible pour tenant_admin + graphist uniquement */}
      <FeedbackWidget />
    </div>
  );
}
