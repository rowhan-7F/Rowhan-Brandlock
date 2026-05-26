"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeft,
  Check,
  MessageSquare,
  Menu,
  Filter,
  Play,
  CheckCircle2,
  Send,
  X,
  Clock,
  Layers,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import SlideRenderer from "@/components/studio/SlideRenderer";
import type { BrandConfig } from "@/types/brandConfig";

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════
type ProjectType = "carousel" | "video";

type AdminMobileProject = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  task_id: string | null;
  state_json: any;
  _type: ProjectType;
  thumbnail_url?: string | null;
  video_url?: string | null;
};

type AdminMobileFeedProps = {
  projects: AdminMobileProject[];
  config: BrandConfig | null;
  tenantName: string;
  brandPrimary: string;
  onRefresh: () => void;
};

const COLORS = {
  ink: "#181614",
  cream: "#F5F1EA",
  gold: "#D4AF7A",
  bordeaux: "#B11E2F",
  nightBlue: "#1A2332",
  warmGray: "#807972",
};

// ═══════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function AdminMobileFeed({
  projects,
  config,
  tenantName,
  brandPrimary,
  onRefresh,
}: AdminMobileFeedProps) {
  const router = useRouter();

  // ─── State ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  // Track viewed slides/videos pour debloquer "Valider & Suivant"
  const [viewedStatus, setViewedStatus] = useState<Record<string, boolean>>({});

  // ─── Filtres tab ────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (activeTab === "pending") {
      return projects.filter((p) => p.status === "pending_approval");
    }
    return projects.filter(
      (p) => p.status === "approved" || p.status === "published"
    );
  }, [projects, activeTab]);

  const pendingCount = useMemo(
    () => projects.filter((p) => p.status === "pending_approval").length,
    [projects]
  );
  const approvedCount = useMemo(
    () =>
      projects.filter(
        (p) => p.status === "approved" || p.status === "published"
      ).length,
    [projects]
  );

  // ─── Set le 1er projet comme actif au mount ─────────────────
  useEffect(() => {
    if (!activeProjectId && filteredProjects.length > 0) {
      setActiveProjectId(filteredProjects[0].id);
    }
  }, [filteredProjects, activeProjectId]);

  // ─── Detection scroll auto pour changer activeProjectId ─────
  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.5) {
            const id = e.target.getAttribute("data-project-id");
            if (id) setActiveProjectId(id);
          }
        });
      },
      { threshold: [0.5] }
    );

    Object.values(cardRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [filteredProjects.length]);

  // ─── Handler : valider projet ───────────────────────────────
  const handleValidate = useCallback(
    async (project: AdminMobileProject) => {
      try {
        const table =
          project._type === "video" ? "studio_video_projects" : "studio_projects";
        const { error } = await supabase
          .from(table)
          .update({ status: "approved" })
          .eq("id", project.id);

        if (error) {
          toast.error("Erreur lors de la validation");
          return;
        }

        toast.success("Projet validé ✓");

        // Auto-scroll au projet suivant
        const currentIdx = filteredProjects.findIndex(
          (p) => p.id === project.id
        );
        const next = filteredProjects[currentIdx + 1];
        if (next) {
          const nextEl = cardRefs.current[next.id];
          if (nextEl) {
            nextEl.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveProjectId(next.id);
          }
        }

        onRefresh();
      } catch (err) {
        console.error(err);
        toast.error("Erreur");
      }
    },
    [filteredProjects, onRefresh]
  );

  // ─── Handler : envoyer commentaire ──────────────────────────
  const handleSendComment = useCallback(async () => {
    if (!activeProjectId || !commentText.trim()) return;

    // TODO : sauvegarder le commentaire dans la DB
    // Pour V1 on toast juste, on integrera la table comments plus tard
    toast.success("Commentaire envoyé");
    setCommentText("");
    setCommentSheetOpen(false);
  }, [activeProjectId, commentText]);

  const activeProject = filteredProjects.find((p) => p.id === activeProjectId);
  const isViewed = activeProjectId ? !!viewedStatus[activeProjectId] : false;

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#F5F1EA" }}
    >
      {/* ═══════════════════════════════════════════════════════ */}
      {/* HEADER STICKY                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b"
        style={{
          backgroundColor: "rgba(245, 241, 234, 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: COLORS.ink }}
          >
            {tenantName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 -m-2 rounded-full"
          aria-label="Menu"
        >
          <Menu size={20} style={{ color: COLORS.ink }} />
        </button>
      </header>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TABS STICKY                                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div
        className="sticky z-20 flex border-b"
        style={{
          top: "53px",
          backgroundColor: "rgba(245, 241, 234, 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className="flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative"
          style={{
            color:
              activeTab === "pending" ? COLORS.bordeaux : COLORS.warmGray,
          }}
        >
          À valider
          {pendingCount > 0 && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]"
              style={{
                backgroundColor:
                  activeTab === "pending" ? COLORS.bordeaux : COLORS.warmGray,
                color: "white",
              }}
            >
              {pendingCount}
            </span>
          )}
          {activeTab === "pending" && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: COLORS.bordeaux }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("approved")}
          className="flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative"
          style={{
            color:
              activeTab === "approved" ? COLORS.bordeaux : COLORS.warmGray,
          }}
        >
          Approuvés
          {approvedCount > 0 && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]"
              style={{
                backgroundColor:
                  activeTab === "approved" ? COLORS.bordeaux : COLORS.warmGray,
                color: "white",
              }}
            >
              {approvedCount}
            </span>
          )}
          {activeTab === "approved" && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: COLORS.bordeaux }}
            />
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FEED VERTICAL                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <main
        ref={feedRef}
        className="flex-1 overflow-y-auto pb-24"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {filteredProjects.length === 0 ? (
          <div className="flex items-center justify-center h-64 px-6 text-center">
            <div>
              <CheckCircle2
                size={48}
                className="mx-auto mb-3"
                style={{ color: COLORS.warmGray, opacity: 0.4 }}
              />
              <p
                className="text-sm font-semibold"
                style={{ color: COLORS.ink }}
              >
                {activeTab === "pending"
                  ? "Aucun projet à valider"
                  : "Aucun projet approuvé"}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: COLORS.warmGray }}
              >
                Vous êtes à jour 🎉
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 px-3 pt-3">
            {filteredProjects.map((project, idx) => (
              <ProjectCard
                key={project.id}
                project={project}
                config={config}
                isActive={activeProjectId === project.id}
                onTap={() => setActiveProjectId(project.id)}
                onAllViewed={() =>
                  setViewedStatus((s) => ({ ...s, [project.id]: true }))
                }
                cardRef={(el) => {
                  cardRefs.current[project.id] = el;
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* BOUTONS STICKY BOTTOM                                    */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeProject && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 px-3 py-3 border-t flex gap-2"
          style={{
            backgroundColor: "rgba(245, 241, 234, 0.95)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(0,0,0,0.06)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            onClick={() => setCommentSheetOpen(true)}
            className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
            style={{
              backgroundColor: "white",
              border: "1px solid rgba(0,0,0,0.1)",
              color: COLORS.ink,
            }}
          >
            <MessageSquare size={14} />
            Commenter
          </button>
          <button
            type="button"
            onClick={() => handleValidate(activeProject)}
            className="flex-[1.5] py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 text-white transition-all"
            style={{
              backgroundColor: isViewed ? "#10B981" : COLORS.bordeaux,
              boxShadow: isViewed
                ? "0 4px 12px rgba(16, 185, 129, 0.3)"
                : "0 4px 12px rgba(177, 30, 47, 0.25)",
            }}
          >
            <Check size={14} strokeWidth={3} />
            {isViewed ? "Valider & Suivant" : "Valider"}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* BURGER DRAWER                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      {drawerOpen && (
        <BurgerDrawer
          tenantName={tenantName}
          onClose={() => setDrawerOpen(false)}
          onNavigate={(path) => {
            setDrawerOpen(false);
            router.push(path);
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* COMMENT BOTTOM SHEET                                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      {commentSheetOpen && activeProject && (
        <CommentSheet
          project={activeProject}
          commentText={commentText}
          onChange={setCommentText}
          onSend={handleSendComment}
          onClose={() => setCommentSheetOpen(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SOUS-COMPOSANT : ProjectCard
//  Gère carousel + video + tracking des slides vues
// ═══════════════════════════════════════════════════════════
function ProjectCard({
  project,
  config,
  isActive,
  onTap,
  onAllViewed,
  cardRef,
}: {
  project: AdminMobileProject;
  config: BrandConfig | null;
  isActive: boolean;
  onTap: () => void;
  onAllViewed: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const slides = project.state_json?.slides || [];
  const isCarousel = project._type === "carousel";
  const isVideo = project._type === "video";

  // Embla carousel
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    containScroll: "trimSnaps",
  });
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [maxReachedSlide, setMaxReachedSlide] = useState(0);

  // ─── Scale dynamique pour SlideRenderer (1080x1350 -> width carte) ──
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [slideScale, setSlideScale] = useState(0.35);

  useEffect(() => {
    const el = slideContainerRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setSlideScale(width / 1080);
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isActive]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      setSelectedSlide(idx);
      setMaxReachedSlide((m) => Math.max(m, idx));
    };
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Detecter quand TOUTES les slides ont ete vues
  useEffect(() => {
    if (isCarousel && slides.length > 0 && maxReachedSlide >= slides.length - 1) {
      onAllViewed();
    }
  }, [maxReachedSlide, slides.length, isCarousel]);

  // Detecter fin de video
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div
      ref={cardRef}
      data-project-id={project.id}
      onClick={onTap}
      className="rounded-2xl overflow-hidden bg-white transition-all"
      style={{
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        border: isActive
          ? "2px solid " + COLORS.bordeaux
          : "1px solid rgba(0,0,0,0.06)",
        boxShadow: isActive
          ? "0 8px 24px rgba(177, 30, 47, 0.15)"
          : "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Header carte */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor:
                project._type === "video" ? "#7C3AED20" : "#3B82F620",
            }}
          >
            {isCarousel ? (
              <Layers
                size={13}
                style={{ color: "#3B82F6" }}
              />
            ) : (
              <Film size={13} style={{ color: "#7C3AED" }} />
            )}
          </div>
          <div className="min-w-0">
            <p
              className="text-xs font-bold truncate"
              style={{ color: COLORS.ink }}
            >
              {project.title || "Sans titre"}
            </p>
            <p
              className="text-[10px] flex items-center gap-1"
              style={{ color: COLORS.warmGray }}
            >
              <Clock size={9} />
              {formatRelativeTime(project.created_at)}
            </p>
          </div>
        </div>
        {isActive && (
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shrink-0"
            style={{
              backgroundColor: COLORS.bordeaux,
              color: "white",
            }}
          >
            Actif
          </span>
        )}
      </div>

      {/* Contenu (carousel ou video) */}
      {isCarousel && isActive && (
        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {slides.map((slide: any, idx: number) => (
                <div
                  key={idx}
                  ref={idx === 0 ? slideContainerRef : undefined}
                  className="flex-[0_0_100%] min-w-0 aspect-[4/5] bg-neutral-50 relative overflow-hidden"
                >
                  {config && (
                    <div
                      className="absolute top-0 left-0"
                      style={{
                        width: "1080px",
                        height: "1350px",
                        transform: `scale(${slideScale})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <SlideRenderer
                        config={config}
                        variant={slide.variant}
                        subVariant={slide.subVariant}
                        inputValues={slide.inputs || {}}
                        templateKey="carrousel_instagram"
                        scale={1}
                      />
                    </div>
                  )}
                  </div>
              ))}
            </div>
          </div>
          {/* Dots indicateur */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
            {slides.map((_: any, idx: number) => (
              <div
                key={idx}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor:
                    idx === selectedSlide
                      ? "white"
                      : "rgba(255,255,255,0.4)",
                  width: idx === selectedSlide ? "20px" : "6px",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Aperçu fermé : 1ere slide seule */}
      {isCarousel && !isActive && slides.length > 0 && (
        <div
          ref={slideContainerRef}
          className="aspect-[4/5] bg-neutral-50 relative overflow-hidden"
        >
          {config && (
            <div
              className="absolute top-0 left-0"
              style={{
                width: "1080px",
                height: "1350px",
                transform: `scale(${slideScale})`,
                transformOrigin: "top left",
              }}
            >
              <SlideRenderer
                config={config}
                variant={slides[0].variant}
                subVariant={slides[0].subVariant}
                inputValues={slides[0].inputs || {}}
                templateKey="carrousel_instagram"
                scale={1}
              />
            </div>
          )}
        </div>
      )}

      {/* Video */}
      {isVideo && (
        <div className="relative aspect-[9/16] bg-black">
          {project.video_url ? (
            <video
              ref={videoRef}
              src={project.video_url}
              className="w-full h-full object-contain"
              controls
              playsInline
              preload="metadata"
              onEnded={() => onAllViewed()}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Play size={40} style={{ color: "white", opacity: 0.5 }} />
            </div>
          )}
        </div>
      )}

      {/* Indicateur slides en bas (carousel) */}
      {isCarousel && isActive && (
        <div
          className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between"
          style={{
            color: COLORS.warmGray,
            backgroundColor: "#FAFAF8",
          }}
        >
          <span>
            Slide {selectedSlide + 1} / {slides.length}
          </span>
          {maxReachedSlide >= slides.length - 1 && (
            <span style={{ color: "#10B981" }}>
              <CheckCircle2 size={12} className="inline mr-1" />
              Toutes vues
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SOUS-COMPOSANT : BurgerDrawer
// ═══════════════════════════════════════════════════════════
function BurgerDrawer({
  tenantName,
  onClose,
  onNavigate,
}: {
  tenantName: string;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] flex flex-col"
        style={{ backgroundColor: COLORS.cream }}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-200">
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: COLORS.ink }}
          >
            {tenantName}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2"
            aria-label="Fermer"
          >
            <X size={20} style={{ color: COLORS.ink }} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          <DrawerItem
            label="Dashboard"
            onClick={() => onNavigate("/admin/tenant")}
            active
          />
          <DrawerItem
            label="Mon équipe"
            onClick={() => onNavigate("/admin/tenant/team")}
          />
          <DrawerItem
            label="Brand Assets"
            onClick={() => onNavigate("/admin/tenant/brand")}
          />
          <DrawerItem
            label="Bibliothèque"
            onClick={() => onNavigate("/admin/tenant/library")}
          />
        </nav>
        <div className="px-5 py-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: COLORS.ink,
              color: COLORS.cream,
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>
    </>
  );
}

function DrawerItem({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-5 py-3 text-left text-sm font-semibold transition-colors flex items-center justify-between"
      style={{
        color: active ? COLORS.bordeaux : COLORS.ink,
        backgroundColor: active ? "rgba(177,30,47,0.06)" : "transparent",
      }}
    >
      <span>{label}</span>
      {active && (
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: COLORS.bordeaux }}
        />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
//  SOUS-COMPOSANT : CommentSheet (bottom sheet)
// ═══════════════════════════════════════════════════════════
function CommentSheet({
  project,
  commentText,
  onChange,
  onSend,
  onClose,
}: {
  project: AdminMobileProject;
  commentText: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          backgroundColor: "white",
          maxHeight: "60vh",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-300" />
        </div>
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-neutral-100">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: COLORS.ink }}
            >
              Commentaire
            </p>
            <p className="text-[10px]" style={{ color: COLORS.warmGray }}>
              {project._type === "video"
                ? "Vidéo globale"
                : "Sur ce projet"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2"
            aria-label="Fermer"
          >
            <X size={18} style={{ color: COLORS.warmGray }} />
          </button>
        </div>
        {/* Textarea */}
        <div className="flex-1 p-4">
          <textarea
            ref={inputRef}
            value={commentText}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Votre retour..."
            className="w-full h-32 p-3 rounded-xl resize-none text-sm focus:outline-none"
            style={{
              backgroundColor: "#FAFAF8",
              color: COLORS.ink,
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          />
        </div>
        {/* Action */}
        <div className="px-4 pb-4 pt-1">
          <button
            type="button"
            onClick={onSend}
            disabled={!commentText.trim()}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 text-white transition-all disabled:opacity-40"
            style={{
              backgroundColor: COLORS.bordeaux,
            }}
          >
            <Send size={14} />
            Envoyer
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  HELPER : format relative time
// ═══════════════════════════════════════════════════════════
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d}j`;
  return new Date(iso).toLocaleDateString("fr-CH");
}
