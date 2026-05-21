"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentTenant } from "../../../lib/useCurrentTenant";
import { supabase } from "../../../lib/supabase";
import {
  useStudioProject,
  SlideState,
} from "../../../lib/useStudioProject";
import {
  ArrowLeft, Loader2, AlertCircle, ChevronDown, ChevronRight,
  Plus, Trash2, Check, Send, Download, LogOut, Clock,
  Image as ImageIcon, X, CheckCircle2, Pencil,
} from "lucide-react";
import SlideRenderer from "../../../components/studio/SlideRenderer";
import MediaPicker, { SelectedImage } from "../../../components/studio/MediaPicker";
import { exportCarouselAsZip, downloadBlob, ExportProgress } from "../../../lib/exportCarousel";
import NotificationsBell from "@/components/NotificationsBell";
import ProjectMessagesIcon from "@/components/ProjectMessagesIcon";
import FeedbackWidget from "@/components/FeedbackWidget";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";

// ⚠ SUPPRIMÉ : import LogoutButton (remplacé par icône custom directement dans le header)

type UserRole = "tenant_admin" | "graphist" | "super_admin" | "viewer";

function generateId(): string {
  return `slide_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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

  const [openSlideId, setOpenSlideId] = useState<string | null>(null);
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

  const updateSlideVariantAndSub = (slideId: string, newVariant: string, newSubVariant: string) => {
    updateStateJson((prev) => ({
      ...prev,
      slides: prev.slides.map((s) =>
        s.id === slideId ? createSlideWithVariant(slideId, newVariant, newSubVariant, config) : s
      ),
    }));
  };

  const updateSlideInput = (slideId: string, inputKey: string, value: any) => {
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
      <header className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">

          {/* Back arrow vers /studio */}
          <Link
            href="/studio"
            className="text-neutral-400 hover:text-neutral-700 transition shrink-0"
            title="Retour à mes projets"
          >
            <ArrowLeft size={18} />
          </Link>

          {/* Logo BrandLock + drapeau astérix (style AppHeader) */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group" title="Accueil">
            <img
              src="/media/logo.png"
              alt="BrandLock"
              className="h-7 w-auto object-contain transition-opacity group-hover:opacity-70"
            />
            <div className="flex items-baseline gap-1">
              <span
                className="font-black tracking-tighter text-sm italic hidden lg:inline text-[#181614]"
                style={{ letterSpacing: "-0.04em" }}
              >
                BrandLock
              </span>
              <svg
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
                className="h-2 w-2 shrink-0 hidden lg:block"
                aria-label="Suisse"
              >
                <rect width="32" height="32" fill="#B11E2F" rx="3" />
                <rect x="13" y="7" width="6" height="18" fill="white" />
                <rect x="7" y="13" width="18" height="6" fill="white" />
              </svg>
            </div>
          </Link>

          {/* Séparateur vertical */}
          <div className="h-7 w-px bg-neutral-200 shrink-0 hidden sm:block" />

          {/* Eyebrow STUDIO */}
          <div className="hidden md:block shrink-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#B11E2F]">
              STUDIO
            </div>
            <div className="text-[10px] text-neutral-400 -mt-0.5">{config.tenant.name}</div>
          </div>

          {/* Séparateur vertical */}
          <div className="h-7 w-px bg-neutral-200 shrink-0 hidden md:block" />

          {/* Brand color square (compact) */}
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-white font-black text-[10px] shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            {config.tenant.name.charAt(0)}
          </div>

          {/* Titre éditable + save indicator */}
          <div className="min-w-0 flex-1">
            <EditableProjectTitle
              title={effectiveTitle}
              projectId={projectId}
              onUpdated={(newTitle) => {
                setLocalTitle(newTitle);
                if (projectState.status === "ready" && projectState.project) {
                  projectState.project.title = newTitle;
                }
              }}
            />
            <div className="text-[10px] text-neutral-400 flex items-center gap-2">
              <SaveIndicator status={projectState.saveStatus} />
              {/* ⭐ Badge de statut projet */}
              {project.status === "pending_approval" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-black uppercase tracking-widest text-amber-700">
                  <Clock size={8} />
                  En attente de validation
                </span>
              )}
              {project.status === "approved" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-[9px] font-black uppercase tracking-widest text-green-700">
                  <CheckCircle2 size={8} />
                  Approuvé
                </span>
              )}
              {project.status === "rejected" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 border border-red-200 rounded text-[9px] font-black uppercase tracking-widest text-red-700">
                  <AlertCircle size={8} />
                  À retravailler
                </span>
              )}
            </div>
          </div>
        </div>

        {/* DROITE — Actions + Logout isolé */}
        <div className="flex items-center gap-2 shrink-0">
          <ProjectMessagesIcon projectId={projectId} brandColor={brandColor} />
          <NotificationsBell brandColor={brandColor} />

          <button
            onClick={handleExport}
            disabled={exporting || slides.length === 0}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exporter en PNG (ZIP)"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {exporting
              ? exportProgress?.step === "capturing"
                ? `${exportProgress.current}/${exportProgress.total}`
                : exportProgress?.step === "zipping" ? "ZIP..." : "Export..."
              : "Exporter"}
          </button>

          {/* ⭐ Bouton Soumettre / Re-soumettre selon statut */}
          {(() => {
            const isPending = project.status === "pending_approval";
            const isApproved = project.status === "approved";
            const isRejected = project.status === "rejected";

            const cfg = isApproved
              ? { label: "Approuvé", bgColor: "#16a34a", disabled: true, title: "Ce projet a été approuvé par l'admin" }
              : isPending
              ? { label: "Re-soumettre", bgColor: "#f59e0b", disabled: false, title: "Mettre à jour la version envoyée à l'admin" }
              : isRejected
              ? { label: "Re-soumettre", bgColor: brandColor, disabled: false, title: "Soumettre une nouvelle version" }
              : { label: "Soumettre", bgColor: brandColor, disabled: false, title: "Soumettre pour validation" };

            return (
              <button
                onClick={handleSubmit}
                disabled={submitting || slides.length === 0 || cfg.disabled}
                title={cfg.title}
                className="text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: cfg.bgColor }}
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : isApproved ? <CheckCircle2 size={12} /> : <Send size={12} />}
                {submitting ? "..." : cfg.label}
              </button>
            );
          })()}

          {/* ⭐ BOUTON DÉCONNEXION — Isolé avec séparateur (style AppHeader) */}
          <div className="border-l border-neutral-200 pl-3 ml-1">
            <button
              type="button"
              onClick={handleLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition group"
              title="Se déconnecter"
              aria-label="Déconnexion"
            >
              <LogOut size={15} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      </header>

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
              <SlideAccordion
                key={slide.id}
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
              />
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
                />
              ))
            )}
          </div>
        </main>
      </div>

      {/* CONTAINER CACHÉ pour l'export */}
      <div
        id="export-render-container"
        style={{
          position: "fixed", top: 0, left: -99999, width: 1080,
          opacity: 0, pointerEvents: "none", zIndex: -1,
        }}
        aria-hidden="true"
      >
        {slides.map((slide: any, idx: number) => {
          const subVariant = (slide as any).subVariant || undefined;
          const templateKey = config?.exportTemplates
            ? Object.keys(config.exportTemplates)[0]
            : "carrousel_instagram";
          return (
            <div
              key={`export-${slide.id}`}
              data-export-slide
              data-slide-index={idx}
              style={{ width: 1080, height: 1350, backgroundColor: "#1A1A1A" }}
            >
              <SlideRenderer
                config={config}
                variant={slide.variant}
                subVariant={subVariant}
                inputValues={slide.inputs}
                templateKey={templateKey}
                scale={1}
              />
            </div>
          );
        })}
      </div>

      {/* ⭐ FEEDBACK WIDGET — Visible pour tenant_admin + graphist uniquement */}
      <FeedbackWidget />
    </div>
  );
}

// ============================================================
//  EDITABLE PROJECT TITLE
// ============================================================

function EditableProjectTitle({
  title, projectId, onUpdated,
}: {
  title: string;
  projectId: string;
  onUpdated: (newTitle: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(title);
  }, [title, isEditing]);

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === title) {
      setIsEditing(false);
      setDraft(title);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error("Erreur sauvegarde titre");
      onUpdated(trimmed);
      setDraft(trimmed);
      setIsEditing(false);
    } catch (err: any) {
      toast.error("Renommage impossible", { description: err.message });
      setDraft(title);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(title);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") cancel();
          }}
          onBlur={save}
          autoFocus
          disabled={saving}
          className="text-sm font-bold text-neutral-900 bg-transparent border-b border-neutral-300 focus:border-neutral-700 outline-none w-full max-w-[400px] pb-0.5"
          maxLength={100}
        />
        {saving && <Loader2 size={11} className="animate-spin text-neutral-400 shrink-0" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="text-sm font-bold text-neutral-900 truncate text-left hover:text-[#B11E2F] transition flex items-center gap-1.5 group max-w-full"
      title="Cliquer pour renommer"
    >
      <span className="truncate">{title}</span>
      <Pencil size={11} className="text-neutral-300 group-hover:text-[#B11E2F] transition shrink-0" />
    </button>
  );
}

// ============================================================
//  SLIDE ACCORDION
// ============================================================

function SlideAccordion({
  slide, index, isOpen, onToggle, onDelete, onChangeVariant, onChangeInput,
  onCompleteSlide, config, userRole, tenantId,
}: any) {
  const variant = slide.variant;
  const subVariant = (slide as any).subVariant || getDefaultSubVariant(config, variant);
  const subVariantConfig = getSubVariantConfig(config, variant, subVariant);
  const inputs = subVariantConfig?.inputs || [];
  const filled = countFilledInputs(slide, inputs);
  const isComplete = filled === inputs.length && inputs.length > 0;

  const review = (slide as any).review;
  const reviewStatus = review?.status;
  const reviewComment = review?.comment;

  const borderClass = reviewStatus === "needs_changes"
    ? "border-amber-300 ring-1 ring-amber-200"
    : reviewStatus === "ok"
      ? "border-green-300"
      : isOpen
        ? "border-neutral-300 shadow-sm bg-white"
        : "border-neutral-200 bg-neutral-50/50 hover:bg-white hover:border-neutral-300";

  return (
    <div className={`rounded-xl border transition-all ${borderClass} ${isOpen ? "bg-white shadow-sm" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left cursor-pointer select-none"
      >
        {isOpen ? <ChevronDown size={14} className="text-neutral-400 shrink-0" /> : <ChevronRight size={14} className="text-neutral-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-neutral-900 truncate flex items-center gap-1.5">
            Slide {index + 1} · {variantLabel(config, variant)}
            {reviewStatus === "ok" && <CheckCircle2 size={11} className="text-green-600 shrink-0" />}
            {reviewStatus === "needs_changes" && <AlertCircle size={11} className="text-amber-600 shrink-0" />}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {filled}/{inputs.length} champs remplis
          </div>
        </div>
        {isComplete && !reviewStatus && <CheckCircle2 size={14} className="text-green-600 shrink-0" />}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 transition shrink-0"
          title="Supprimer cette slide"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* ⭐ Slide approuvée (status ok) */}
      {reviewStatus === "ok" && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-green-600 shrink-0" />
          <span className="font-bold uppercase tracking-wider text-[9px] text-green-700">
            Slide approuvée
          </span>
        </div>
      )}
      {/* Feedback admin (status needs_changes + commentaire) */}
      {/* ⭐ Slide approuvée (status ok) */}
      {reviewStatus === "ok" && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-green-600 shrink-0" />
          <span className="font-bold uppercase tracking-wider text-[9px] text-green-700">
            Slide approuvée
          </span>
        </div>
      )}
      {/* Feedback admin (status needs_changes + commentaire) */}
      {/* ⭐ Slide approuvée (status ok) */}
      {reviewStatus === "ok" && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-green-600 shrink-0" />
          <span className="font-bold uppercase tracking-wider text-[9px] text-green-700">
            Slide approuvée
          </span>
        </div>
      )}
      {/* Feedback admin (status needs_changes + commentaire) */}
      {reviewStatus === "needs_changes" && reviewComment?.trim() && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-900">
          <div className="font-bold uppercase tracking-wider text-[9px] text-amber-700 mb-0.5">
            ⚠ Feedback admin
          </div>
          {reviewComment}
        </div>
      )}

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-neutral-100">
          <Field label="Type de slide">
            <select
              value={variant}
              onChange={(e) => {
                const newVariant = e.target.value;
                const newSubVariant = getDefaultSubVariant(config, newVariant);
                onChangeVariant(newVariant, newSubVariant);
              }}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white"
            >
              {getAvailableVariants(config).map((v: any) => (
                <option key={v.key} value={v.key}>{v.label || v.key}</option>
              ))}
            </select>
          </Field>

          {getSubVariants(config, variant).length > 1 && (
            <Field label="Variante">
              <select
                value={subVariant}
                onChange={(e) => onChangeVariant(variant, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white"
              >
                {getSubVariants(config, variant).map((sv: any) => (
                  <option key={sv.key} value={sv.key}>
                    {sv.label} — {sv.description}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {inputs.map((input: any, idx: number) => (
            <DynamicInput
              key={`${variant}-${subVariant}-${input.key}`}
              input={input}
              value={slide.inputs[input.key]}
              onChange={(v: any) => onChangeInput(input.key, v)}
              isLast={idx === inputs.length - 1}
              onCompleteLast={onCompleteSlide}
              autoFocus={idx === 0 && isOpen}
              userRole={userRole}
              tenantId={tenantId}
            />
          ))}

          {inputs.length === 0 && (
            <div className="text-[10px] text-neutral-400 italic text-center py-2">
              Aucun champ défini pour ce type de slide
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  DYNAMIC INPUT
// ============================================================

function DynamicInput({
  input, value, onChange, isLast, onCompleteLast, autoFocus, userRole, tenantId,
}: any) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isLast) {
      e.preventDefault();
      onCompleteLast();
    }
  };

  const inputType = input.type || "text";
  const label = input.label || input.key;
  const placeholder = input.placeholder || "";

  if (inputType === "select") {
    return (
      <Field label={label} required={input.required}>
        <select
          value={value?.value || ""}
          onChange={(e) => onChange({ kind: "select", value: e.target.value })}
          autoFocus={autoFocus}
          className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white"
        >
          <option value="">— Choisir —</option>
          {(input.options || []).map((opt: any) => {
            const optValue = typeof opt === "string" ? opt : opt.value;
            const optLabel = typeof opt === "string" ? opt : opt.label || opt.value;
            return <option key={optValue} value={optValue}>{optLabel}</option>;
          })}
        </select>
        {input.hint && <div className="text-[9px] text-neutral-400 italic mt-1">{input.hint}</div>}
      </Field>
    );
  }

  if (inputType === "image") {
    return (
      <ImageFieldWithPicker
        input={input} value={value} onChange={onChange}
        userRole={userRole} tenantId={tenantId}
      />
    );
  }

  if (inputType === "textarea" || inputType === "richText") {
    return (
      <Field label={label} required={input.required}>
        <textarea
          value={value?.value || ""}
          onChange={(e) => onChange({ kind: inputType === "richText" ? "richText" : "text", value: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white resize-none"
        />
        {input.maxLength && (
          <div className="text-[9px] text-neutral-400 text-right mt-0.5">
            {(value?.value || "").length} / {input.maxLength}
          </div>
        )}
        {input.hint && <div className="text-[9px] text-neutral-400 italic mt-1">{input.hint}</div>}
      </Field>
    );
  }

  return (
    <Field label={label} required={input.required}>
      <input
        type="text"
        value={value?.value || ""}
        onChange={(e) => onChange({ kind: "text", value: e.target.value })}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={input.maxLength}
        className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white"
      />
      {input.maxLength && (
        <div className="text-[9px] text-neutral-400 text-right mt-0.5">
          {(value?.value || "").length} / {input.maxLength}
        </div>
      )}
      {input.hint && <div className="text-[9px] text-neutral-400 italic mt-1">{input.hint}</div>}
    </Field>
  );
}

// ============================================================
//  IMAGE FIELD AVEC PICKER
// ============================================================

function ImageFieldWithPicker({
  input, value, onChange, userRole, tenantId,
}: any) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actualIsApproved, setActualIsApproved] = useState<boolean | null>(null);
  const imgValue = value?.value;

  useEffect(() => {
    if (!imgValue?.id) {
      setActualIsApproved(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("brand_images")
        .select("is_approved")
        .eq("id", imgValue.id)
        .maybeSingle();
      if (!cancelled) {
        setActualIsApproved(data?.is_approved ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [imgValue?.id]);

  const mediaPickerRole: "tenant_admin" | "graphist" | "super_admin" =
    userRole === "tenant_admin" || userRole === "super_admin" ? userRole : "graphist";

  const isReallyApproved = actualIsApproved === true ||
    (actualIsApproved === null && imgValue?.isApproved === true);
  const isReallyNotApproved = actualIsApproved === false ||
    (actualIsApproved === null && imgValue && imgValue.isApproved === false);

  return (
    <Field label={input.label || input.key} required={input.required}>
      {imgValue ? (
        <div className="relative rounded-lg overflow-hidden border border-neutral-200 group">
          <img src={imgValue.url} alt="" className="w-full h-32 object-cover" crossOrigin="anonymous" />
          {isReallyNotApproved && (
            <div className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
              ⚠ Non validée
            </div>
          )}
          {isReallyApproved && (
            <div className="absolute top-1 left-1 bg-green-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
              ✓ Validée
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="px-3 py-1.5 bg-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-100 transition"
            >
              Changer
            </button>
            <button
              type="button"
              onClick={() => onChange({ kind: "image", value: null })}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-red-600 transition"
            >
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full px-3 py-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-center hover:border-orange-400 hover:bg-orange-50/30 transition group"
        >
          <ImageIcon size={18} className="text-neutral-400 group-hover:text-orange-500 mx-auto mb-1 transition" />
          <div className="text-[11px] font-bold text-neutral-600 group-hover:text-orange-600 transition">
            Choisir une image
          </div>
          <div className="text-[9px] text-neutral-400 mt-0.5">
            Bibliothèque ou import depuis votre PC
          </div>
        </button>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(img: SelectedImage) => onChange({ kind: "image", value: img })}
        tenantId={tenantId}
        userRole={mediaPickerRole}
      />
    </Field>
  );
}

// ============================================================
//  FIELD + ADD SLIDE
// ============================================================

function Field({ label, required, children }: any) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}

function AddSlideButton({ config, onAdd, brandColor }: any) {
  const [open, setOpen] = useState(false);
  const variants = getAvailableVariants(config);

  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition shadow-sm"
        style={{ backgroundColor: brandColor }}
        title="Ajouter une slide"
      >
        <Plus size={16} strokeWidth={3} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute top-full right-0 mt-2 w-64 z-40 bg-white rounded-xl border border-neutral-200 shadow-lg overflow-hidden max-h-96 overflow-y-auto">
            <div className="px-3 py-2 border-b border-neutral-100 text-[10px] font-black uppercase tracking-widest text-neutral-400 bg-neutral-50">
              Type de slide
            </div>
            {variants.map((v: any) => {
              const subs = getSubVariants(config, v.key);
              const defaultSub = subs[0]?.key || "default";
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => { onAdd(v.key, defaultSub); close(); }}
                  className="w-full px-3 py-2.5 text-left hover:bg-neutral-50 transition border-b border-neutral-50 last:border-b-0"
                >
                  <div className="text-xs font-bold text-neutral-900">
                    {v.label || v.key}
                  </div>
                  {v.description && (
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      {v.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
//  SLIDE PREVIEW
// ============================================================

function SlidePreview({
  slide, index, isOpen, brandColor, config, onClick,
}: any) {
  const templateKey = config?.exportTemplates
    ? Object.keys(config.exportTemplates)[0]
    : "carrousel_instagram";

  const subVariant = (slide as any).subVariant || getDefaultSubVariant(config, slide.variant);
  const subVariantConfig = getSubVariantConfig(config, slide.variant, subVariant);
  const review = (slide as any).review;

  const SCALE = 0.27;
  const FIXED_WIDTH = 1080 * SCALE;

  const outline = review?.status === "ok"
    ? "3px solid #16a34a"
    : review?.status === "needs_changes"
      ? "3px solid #f59e0b"
      : "3px solid transparent";

      return (
        <div
          onClick={onClick}
          className={`rounded-2xl overflow-hidden bg-white shrink-0 transition-all cursor-pointer ${
            isOpen ? "shadow-xl scale-100" : "opacity-50 scale-[0.97] hover:opacity-75"
          }`}
          style={{
            width: FIXED_WIDTH,
            outline,
            outlineOffset: "2px",
          }}
        >
      <div
        className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white truncate flex items-center justify-between"
        style={{ backgroundColor: brandColor, width: FIXED_WIDTH }}
      >
        <span className="truncate">
          Slide {index + 1} · {variantLabel(config, slide.variant)}
          {subVariantConfig?.label && (
            <span className="font-normal opacity-80"> · {subVariantConfig.label}</span>
          )}
        </span>
        {review?.status === "ok" && <CheckCircle2 size={11} />}
        {review?.status === "needs_changes" && <AlertCircle size={11} />}
      </div>
      <SlideRenderer
        config={config}
        variant={slide.variant}
        subVariant={subVariant}
        inputValues={slide.inputs}
        templateKey={templateKey}
        scale={SCALE}
      />
      {/* ⭐ Slide approuvée (status ok) */}
      {review?.status === "ok" && (
        <div className="px-3 py-2 bg-green-50 border-t border-green-200 flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-green-600 shrink-0" />
          <span className="font-bold uppercase tracking-wider text-[9px] text-green-700">
            Slide approuvée
          </span>
        </div>
      )}
      {/* À corriger (status needs_changes + commentaire) */}
      {review?.status === "needs_changes" && review.comment?.trim() && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-[10px] text-amber-900">
          <div className="font-bold uppercase tracking-wider text-[9px] text-amber-700 mb-0.5">
            ⚠ À corriger
          </div>
          {review.comment}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  SAVE INDICATOR + ERROR SCREEN
// ============================================================

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-neutral-400">
        <Loader2 size={9} className="animate-spin" />
        Sauvegarde...
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-green-600">
        <Check size={9} />
        Sauvegardé
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-red-500">
        <X size={9} />
        Erreur
      </span>
    );
  }
  return null;
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-8">
      <div className="bg-white rounded-2xl border border-neutral-200 p-8 max-w-md text-center">
        <AlertCircle className="w-10 h-10 text-orange-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold mb-2">{title}</h2>
        <p className="text-sm text-neutral-500 mb-4">{message}</p>
        <Link href="/studio" className="text-sm font-medium text-orange-600 hover:text-orange-700">
          ← Retour à mes projets
        </Link>
      </div>
    </div>
  );
}

// ============================================================
//  HELPERS
// ============================================================

function getAvailableVariants(config: any): Array<{ key: string; label?: string; description?: string }> {
  const variants = config?.exportTemplates?.carrousel_instagram?.slideVariants || {};
  return Object.entries(variants).map(([key, v]: [string, any]) => ({
    key, label: v.label || key, description: v.description,
  }));
}

function getSubVariants(config: any, variantKey: string): Array<{ key: string; label: string; description: string }> {
  const variant = config?.exportTemplates?.carrousel_instagram?.slideVariants?.[variantKey];
  if (!variant?.subVariants) return [];
  return Object.entries(variant.subVariants).map(([key, sv]: [string, any]) => ({
    key, label: sv.label || key, description: sv.description || "",
  }));
}

function getDefaultSubVariant(config: any, variantKey: string): string {
  const subs = getSubVariants(config, variantKey);
  return subs[0]?.key || "default";
}

function getSubVariantConfig(config: any, variantKey: string, subVariantKey: string): any {
  return config?.exportTemplates?.carrousel_instagram?.slideVariants?.[variantKey]?.subVariants?.[subVariantKey];
}

function variantLabel(config: any, variantKey: string): string {
  const variant = config?.exportTemplates?.carrousel_instagram?.slideVariants?.[variantKey];
  return variant?.label || variantKey.charAt(0).toUpperCase() + variantKey.slice(1);
}

function createDefaultSlide(config: any): SlideState {
  const variants = getAvailableVariants(config);
  const introVariant = variants.find((v) => v.key === "intro") || variants[0];
  const variantKey = introVariant?.key || "intro";
  const subVariantKey = getDefaultSubVariant(config, variantKey);
  return createEmptySlide(variantKey, subVariantKey, config);
}

function createEmptySlide(variantKey: string, subVariantKey: string, config: any): SlideState {
  const subConfig = getSubVariantConfig(config, variantKey, subVariantKey);
  const inputs: Record<string, any> = {};

  (subConfig?.inputs || []).forEach((input: any) => {
    const t = input.type || "text";
    if (t === "select") inputs[input.key] = { kind: "select", value: "" };
    else if (t === "image") inputs[input.key] = { kind: "image", value: null };
    else if (t === "richText") inputs[input.key] = { kind: "richText", value: "" };
    else inputs[input.key] = { kind: "text", value: "" };
  });

  return {
    id: generateId(), variant: variantKey, subVariant: subVariantKey, inputs,
  } as any;
}

function createSlideWithVariant(slideId: string, variantKey: string, subVariantKey: string, config: any): SlideState {
  const fresh = createEmptySlide(variantKey, subVariantKey, config);
  return { ...fresh, id: slideId };
}

function countFilledInputs(slide: SlideState, inputs: any[]): number {
  let count = 0;
  inputs.forEach((input) => {
    const v = slide.inputs[input.key];
    if (!v) return;
    if (v.kind === "image" && v.value) count++;
    else if (v.kind !== "image" && v.value && String(v.value).trim()) count++;
  });
  return count;
}
