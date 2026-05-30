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
  AlertCircle,
  Send,
  X,
  Clock,
  Layers,
  Film,
  RotateCcw,
  Loader2,
  Plus,
  ClipboardList,
  ChevronUp,
  ChevronDown,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import SlideRenderer from "@/components/studio/SlideRenderer";
import NotificationsBell from "@/components/NotificationsBell";
import ProjectMessagesIcon from "@/components/ProjectMessagesIcon";
import type { BrandConfig } from "@/types/brandConfig";
import { useScrollSnap } from "@/hooks/useScrollSnap";

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════
type ProjectType = "carousel" | "video";

type SlideReview = { status?: "ok" | "needs_changes"; comment?: string };

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

type Task = {
  id: string;
  tenant_id: string;
  title: string;
  brief: string | null;
  deadline: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  created_by: string;
  assigned_to: string | null;
  linked_project_id: string | null;
  created_at: string;
};

type AdminMobileFeedProps = {
  projects: AdminMobileProject[];
  tasks?: Task[];
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
  tasks = [],
  config,
  tenantName,
  brandPrimary,
  onRefresh,
}: AdminMobileFeedProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"briefs" | "pending" | "approved">("pending");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNewBriefModal, setShowNewBriefModal] = useState(false);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);

  // Sprint 9.3 : Reviews par slide
  const [slideReviews, setSlideReviews] = useState<Record<string, SlideReview>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [viewedStatus, setViewedStatus] = useState<Record<string, boolean>>({});

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

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status === "open" || t.status === "in_progress"),
    [tasks]
  );

  // Phase 9.3.11 : Briefs archives (completed) - mobile
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === "completed"),
    [tasks]
  );
  const [archivesOpenMobile, setArchivesOpenMobile] = useState(false);

  const approvedCount = useMemo(
    () =>
      projects.filter(
        (p) => p.status === "approved" || p.status === "published"
      ).length,
    [projects]
  );

  useEffect(() => {
    const existsInTab = activeProjectId && filteredProjects.some((p) => p.id === activeProjectId);
    if (!existsInTab && filteredProjects.length > 0) {
      setActiveProjectId(filteredProjects[0].id);
    }
  }, [filteredProjects, activeProjectId]);

  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Phase 9.3.20 : Snap JS garanti (iOS Safari ignore scroll-snap-stop)
  useScrollSnap(feedRef, cardRefs);

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

        const currentIdx = filteredProjects.findIndex((p) => p.id === project.id);
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

  const handleUnapprove = useCallback(
    async (project: AdminMobileProject) => {
      try {
        const table =
          project._type === "video" ? "studio_video_projects" : "studio_projects";
        const { error } = await supabase
          .from(table)
          .update({ status: "pending_approval" })
          .eq("id", project.id);

        if (error) {
          toast.error("Erreur lors de l'annulation");
          return;
        }

        toast.success("Projet remis en attente");
        onRefresh();
      } catch (err) {
        console.error(err);
        toast.error("Erreur");
      }
    },
    [onRefresh]
  );

  const handleSendComment = useCallback(async () => {
    if (!activeProjectId || !commentText.trim()) return;
    toast.success("Commentaire envoyé");
    setCommentText("");
    setCommentSheetOpen(false);
  }, [activeProjectId, commentText]);

  const activeProject = filteredProjects.find((p) => p.id === activeProjectId);

  // Sprint 9.3 : Charger reviews quand active project change
  useEffect(() => {
    if (!activeProject?.state_json?.slides) {
      setSlideReviews({});
      return;
    }
    const initial: Record<string, SlideReview> = {};
    activeProject.state_json.slides.forEach((s: any) => {
      if (s.review) initial[s.id] = s.review;
    });
    setSlideReviews(initial);
  }, [activeProjectId]);

  const handleSlideStatusChange = useCallback((slideId: string, status: "ok" | "needs_changes") => {
    setSlideReviews((prev) => ({
      ...prev,
      [slideId]: { ...prev[slideId], status, comment: status === "ok" ? "" : prev[slideId]?.comment },
    }));
  }, []);

  const handleSlideCommentChange = useCallback((slideId: string, comment: string) => {
    setSlideReviews((prev) => ({
      ...prev,
      [slideId]: { ...prev[slideId], status: "needs_changes", comment },
    }));
  }, []);

  const saveSlideReviewsToDB = useCallback(async () => {
    if (!activeProject) return;
    try {
      const updatedSlides = activeProject.state_json.slides.map((s: any) => ({
        ...s,
        review: slideReviews[s.id] || s.review,
      }));
      const newStateJson = { ...activeProject.state_json, slides: updatedSlides };
      const table = activeProject._type === "video" ? "studio_video_projects" : "studio_projects";
      await supabase.from(table).update({ state_json: newStateJson }).eq("id", activeProject.id);
    } catch (err) {
      console.error("[saveSlideReviewsToDB]", err);
    }
  }, [activeProject, slideReviews]);

  const handleReviewAction = useCallback(async (action: "approve" | "reject" | "request_changes") => {
    if (!activeProject) return;
    setActionLoading(action);
    try {
      await saveSlideReviewsToDB();
      const { data: { session } } = await supabase.auth.getSession();
      const endpoint = activeProject._type === "video"
        ? `/api/studio/video/projects/${activeProject.id}/review`
        : `/api/studio/projects/${activeProject.id}/review`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action, message: "" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur");
      }
      const msg = action === "approve" ? "Projet approuvé ✓"
        : action === "reject" ? "Projet refusé"
        : "Corrections demandées ✓";
      toast.success(msg);
      onRefresh();
    } catch (err: any) {
      toast.error("Action impossible", { description: err.message });
    } finally {
      setActionLoading(null);
    }
  }, [activeProject, saveSlideReviewsToDB, onRefresh]);

  const totalSlides = activeProject?.state_json?.slides?.length || 0;
  const okCount = Object.values(slideReviews).filter(r => r.status === "ok").length;
  const needsChangesCount = Object.values(slideReviews).filter(r => r.status === "needs_changes").length;
  const allReviewed = totalSlides > 0 && okCount + needsChangesCount === totalSlides;
  const canApproveAll = allReviewed && needsChangesCount === 0;
  const canRequestChanges = needsChangesCount > 0;
  const isViewed = activeProjectId ? !!viewedStatus[activeProjectId] : false;

  return (
    <div className="h-dvh flex flex-col" style={{ backgroundColor: "#F5F1EA" }}>
      <header
        className="sticky top-0 z-30 px-4 py-3 border-b"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img src="/media/logo.png" alt="ROWHAN" className="h-7 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: COLORS.bordeaux }}>
                  ADMINISTRATION
                </span>
                <span className="text-[9px] shrink-0" style={{ color: COLORS.warmGray }}>•</span>
                <span className="text-xs font-black tracking-tight truncate" style={{ color: COLORS.ink }}>
                  Tableau de bord
                </span>
              </div>
              <p className="text-[10px] truncate -mt-0.5" style={{ color: COLORS.warmGray }}>
                {tenantName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationsBell brandColor={brandPrimary} />
            <button type="button" onClick={() => setDrawerOpen(true)} className="p-2 -m-2 rounded-full" aria-label="Menu">
              <Menu size={20} style={{ color: COLORS.ink }} />
            </button>
          </div>
        </div>
      </header>

      <div
        className="sticky z-20 flex border-b"
        style={{
          top: "60px",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("briefs")}
          className="w-1/4 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
          style={{
            color: activeTab === "briefs" ? COLORS.bordeaux : COLORS.warmGray,
            borderBottom: activeTab === "briefs" ? `2px solid ${COLORS.bordeaux}` : "2px solid transparent",
          }}
        >
          <ClipboardList size={18} className="md:hidden" />
          <span className="hidden md:inline">Briefs</span>
          {openTasks.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: activeTab === "briefs" ? COLORS.bordeaux : COLORS.warmGray, color: "white" }}>
              {openTasks.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className="w-1/2 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center justify-center gap-1"
          style={{ color: activeTab === "pending" ? COLORS.bordeaux : COLORS.warmGray }}
        >
          À valider
          {pendingCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: activeTab === "pending" ? COLORS.bordeaux : COLORS.warmGray, color: "white" }}>
              {pendingCount}
            </span>
          )}
          {activeTab === "pending" && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: COLORS.bordeaux }} />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("approved")}
          className="w-1/4 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center justify-center gap-1"
          style={{ color: activeTab === "approved" ? COLORS.bordeaux : COLORS.warmGray }}
        >
          <CheckCircle2 size={18} className="md:hidden" />
          <span className="hidden md:inline">Approuvés</span>
          {approvedCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: activeTab === "approved" ? COLORS.bordeaux : COLORS.warmGray, color: "white" }}>
              {approvedCount}
            </span>
          )}
          {activeTab === "approved" && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: COLORS.bordeaux }} />}
        </button>
      </div>

      <main ref={feedRef} className="flex-1 min-h-0 overflow-y-auto pb-24" style={{ scrollSnapType: "y mandatory" }}>
        {activeTab === "briefs" ? (
          openTasks.length === 0 ? (
            <div className="flex items-center justify-center h-64 px-6 text-center">
              <div>
                <Clock size={48} className="mx-auto mb-3" style={{ color: COLORS.warmGray, opacity: 0.4 }} />
                <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Aucun brief en cours</p>
                <p className="text-xs mt-1" style={{ color: COLORS.warmGray }}>Les briefs sont créés depuis le desktop</p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-3 space-y-3">
              {openTasks.map((task) => <BriefCardMobile key={task.id} task={task} />)}
              {/* Phase 9.3.11 : Section archives mobile */}
              {completedTasks.length > 0 && (
                <div className="mt-6 border-t pt-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                  <button
                    type="button"
                    onClick={() => setArchivesOpenMobile(!archivesOpenMobile)}
                    className="w-full flex items-center justify-between px-3 py-3 text-xs font-bold uppercase tracking-wider rounded-lg"
                    style={{ color: COLORS.warmGray, backgroundColor: archivesOpenMobile ? "rgba(0,0,0,0.04)" : "transparent" }}
                  >
                    <span className="flex items-center gap-2">
                      {archivesOpenMobile ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      Briefs archives ({completedTasks.length})
                    </span>
                  </button>
                  {archivesOpenMobile && (
                    <div className="mt-3 space-y-2">
                      {completedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="px-3 py-2.5 rounded-lg opacity-75"
                          style={{ backgroundColor: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)" }}
                        >
                          <div className="text-xs font-bold truncate" style={{ color: COLORS.ink }}>
                            {task.title}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: COLORS.warmGray }}>
                            {new Date(task.created_at).toLocaleDateString("fr-CH")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          filteredProjects.length === 0 ? (
            <div className="flex items-center justify-center h-64 px-6 text-center">
              <div>
                <CheckCircle2 size={48} className="mx-auto mb-3" style={{ color: COLORS.warmGray, opacity: 0.4 }} />
                <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                  {activeTab === "pending" ? "Aucun projet à valider" : "Aucun projet approuvé"}
                </p>
                <p className="text-xs mt-1" style={{ color: COLORS.warmGray }}>
                  {activeTab === "pending" ? "Tous les projets ont été traités" : "Les projets approuvés apparaîtront ici"}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  config={config}
                  isActive={project.id === activeProjectId}
                  onTap={() => setActiveProjectId(project.id)}
                  onAllViewed={() => setViewedStatus((s) => ({ ...s, [project.id]: true }))}
                  cardRef={(el) => { cardRefs.current[project.id] = el; }}
                  slideReviews={project.id === activeProjectId ? slideReviews : {}}
                  onSlideStatusChange={handleSlideStatusChange}
                  onSlideCommentChange={handleSlideCommentChange}
                  onSlideCommentBlur={saveSlideReviewsToDB}
                  canReview={activeTab === "pending"}
                />
              ))}
            </div>
          )
        )}
      </main>

      {activeProject && activeTab !== "briefs" && (activeTab === "approved" || canApproveAll || canRequestChanges) && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 px-3 py-3 border-t flex gap-2"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(0,0,0,0.06)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          {activeTab === "approved" ? (
            <button
              type="button"
              onClick={() => handleUnapprove(activeProject)}
              className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              style={{ backgroundColor: "white", border: "1.5px solid #F59E0B", color: "#B45309" }}
            >
              <RotateCcw size={14} strokeWidth={2.5} />
              Remettre en attente
            </button>
          ) : (
            <>
              {/* Sprint 9.3 : Bouton DEMANDER CORRECTIONS */}
              <button
                type="button"
                onClick={() => handleReviewAction("request_changes")}
                disabled={!!actionLoading || !canRequestChanges}
                className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ display: canRequestChanges ? "flex" : "none", backgroundColor: "#F59E0B" }}
              >
                {actionLoading === "request_changes" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} strokeWidth={2.5} />}
                  Renvoyer en prod
              </button>

              {/* Sprint 9.3 : Bouton APPROUVER */}
              <button
                type="button"
                onClick={() => handleReviewAction("approve")}
                disabled={!!actionLoading || !canApproveAll}
                className="flex-[1.5] py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ display: canApproveAll ? "flex" : "none",
                  backgroundColor: canApproveAll ? "#10B981" : "#D1D5DB",
                  boxShadow: canApproveAll ? "0 4px 12px rgba(16, 185, 129, 0.3)" : "none",
                }}
              >
                {actionLoading === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                Approuver
              </button>
            </>
          )}
        </div>
      )}

      {activeTab === "briefs" && (
        <button
          type="button"
          onClick={() => setShowNewBriefModal(true)}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-95"
          style={{ backgroundColor: COLORS.bordeaux, boxShadow: "0 8px 24px rgba(177,30,47,0.5), 0 2px 8px rgba(0,0,0,0.15)" }}
          aria-label="Creer un brief"
        >
          <Plus size={24} color="white" strokeWidth={3} />
        </button>
      )}

      {showNewBriefModal && (
        <NewBriefMobileModal
          onClose={() => setShowNewBriefModal(false)}
          onCreated={() => { setShowNewBriefModal(false); onRefresh(); }}
        />
      )}

      {drawerOpen && (
        <BurgerDrawer
          tenantName={tenantName}
          onClose={() => setDrawerOpen(false)}
          onNavigate={(path) => { setDrawerOpen(false); router.push(path); }}
        />
      )}

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
//  Sprint 9.3 : SlideReviewOverlay (par slide)
// ═══════════════════════════════════════════════════════════
function SlideReviewOverlay({
  review,
  onStatusChange,
  onCommentChange,
  onCommentBlur,
}: {
  review: SlideReview | undefined;
  onStatusChange: (status: "ok" | "needs_changes") => void;
  onCommentChange: (comment: string) => void;
  onCommentBlur: () => void;
}) {
  const status = review?.status;
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-10 p-2"
      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStatusChange("ok"); }}
          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition shadow-lg ${
            status === "ok" ? "bg-green-500 text-white" : "bg-white text-neutral-700"
          }`}
        >
          <CheckCircle2 size={11} />
          OK
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStatusChange("needs_changes"); }}
          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition shadow-lg ${
            status === "needs_changes" ? "bg-amber-500 text-white" : "bg-white text-neutral-700"
          }`}
        >
          <AlertCircle size={11} />
          A corriger
        </button>
      </div>
      {status === "needs_changes" && (
        <textarea
          value={review?.comment || ""}
          onChange={(e) => { e.stopPropagation(); onCommentChange(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          onBlur={onCommentBlur}
          placeholder="Que faut-il corriger ?"
          rows={2}
          maxLength={500}
          style={{ fontSize: "16px" }}
          className="w-full mt-2 px-2 py-1.5 border border-amber-200 bg-white rounded-lg text-[11px] focus:border-amber-400 focus:outline-none resize-none"
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SOUS-COMPOSANT : ProjectCard
// ═══════════════════════════════════════════════════════════
function ProjectCard({
  project,
  config,
  isActive,
  onTap,
  onAllViewed,
  cardRef,
  slideReviews,
  onSlideStatusChange,
  onSlideCommentChange,
  onSlideCommentBlur,
  canReview,
}: {
  project: AdminMobileProject;
  config: BrandConfig | null;
  isActive: boolean;
  onTap: () => void;
  onAllViewed: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
  slideReviews: Record<string, SlideReview>;
  onSlideStatusChange: (slideId: string, status: "ok" | "needs_changes") => void;
  onSlideCommentChange: (slideId: string, comment: string) => void;
  onSlideCommentBlur: () => void;
  canReview: boolean;
}) {
  const slides = project.state_json?.slides || [];
  const isCarousel = project._type === "carousel";
  const isVideo = project._type === "video";

  const videoRef = useRef<HTMLVideoElement>(null);
  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoAspect, setVideoAspect] = useState<"portrait" | "landscape" | "square">("portrait");

  useEffect(() => {
    if (!isVideo || !project.video_url) {
      setSignedVideoUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(project.video_url!);
        const pathParts = url.pathname.split("/video-sources/");
        if (pathParts.length !== 2) {
          setSignedVideoUrl(project.video_url || null);
          return;
        }
        const path = decodeURIComponent(pathParts[1]);
        const { data, error } = await supabase.storage
          .from("video-sources")
          .createSignedUrl(path, 3600);
        if (!cancelled) {
          if (error) {
            console.warn("[mobile signed URL] error:", error.message);
            setSignedVideoUrl(null);
          } else if (data?.signedUrl) {
            setSignedVideoUrl(data.signedUrl);
          }
        }
      } catch (err: any) {
        console.warn("[mobile signed URL] parsing error:", err?.message);
        if (!cancelled) setSignedVideoUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isVideo, project.video_url]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    containScroll: "trimSnaps",
  });
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [maxReachedSlide, setMaxReachedSlide] = useState(0);

  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [slideScale, setSlideScale] = useState(0.35);

  useEffect(() => {
    const el = slideContainerRef.current;
    if (!el) return;
    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0) setSlideScale(width / 1080);
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
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (isCarousel && slides.length > 0 && maxReachedSlide >= slides.length - 1) {
      onAllViewed();
    }
  }, [maxReachedSlide, slides.length, isCarousel]);

  return (
    <div
      ref={cardRef}
      data-project-id={project.id}
      onClick={onTap}
      className="rounded-2xl overflow-hidden bg-white transition-all min-h-[calc(100dvh-130px)] flex flex-col justify-center"
      style={{
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        border: isActive ? "2px solid " + COLORS.bordeaux : "1px solid rgba(0,0,0,0.06)",
        boxShadow: isActive ? "0 8px 24px rgba(177, 30, 47, 0.15)" : "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: project._type === "video" ? "#7C3AED20" : "#3B82F620" }}>
            {isCarousel ? <Layers size={13} style={{ color: "#3B82F6" }} /> : <Film size={13} style={{ color: "#7C3AED" }} />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate" style={{ color: COLORS.ink }}>
              {project.title || "Sans titre"}
            </p>
            <p className="text-[10px] flex items-center gap-1" style={{ color: COLORS.warmGray }}>
              <Clock size={9} />
              {formatRelativeTime(project.created_at)}
            </p>
          </div>
        </div>
        {/* Sprint 9.3.5 : Icone Messages + Badge Actif dans wrapper flex */}
        <div className="flex items-center gap-2 shrink-0">
          <ProjectMessagesIcon
            projectId={project.id}
            projectType={project._type}
          />
        </div>
      </div>

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

                  {/* Sprint 9.3 : Overlay actions par slide */}
                  {canReview && (
                    <SlideReviewOverlay
                      review={slideReviews?.[slide.id]}
                      onStatusChange={(status) => onSlideStatusChange(slide.id, status)}
                      onCommentChange={(comment) => onSlideCommentChange(slide.id, comment)}
                      onCommentBlur={onSlideCommentBlur}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
            {slides.map((_: any, idx: number) => (
              <div
                key={idx}
                className="h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: idx === selectedSlide ? "white" : "rgba(255,255,255,0.4)",
                  width: idx === selectedSlide ? "20px" : "6px",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {isCarousel && !isActive && slides.length > 0 && (
        <div ref={slideContainerRef} className="aspect-[4/5] bg-neutral-50 relative overflow-hidden">
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

      {isVideo && (
        <div className={`relative ${videoAspect === "landscape" ? "aspect-video" : videoAspect === "square" ? "aspect-square" : "aspect-[9/16]"} bg-black`}>
          {signedVideoUrl ? (
            <>
              <video
                ref={videoRef}
                src={signedVideoUrl}
                className="w-full h-full object-contain"
                controls
                playsInline
                preload="metadata"
                poster={project.thumbnail_url || undefined}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => { setIsPlaying(false); onAllViewed(); }}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) {
                    const ratio = v.videoWidth / v.videoHeight;
                    if (ratio > 1.1) setVideoAspect("landscape");
                    else if (ratio < 0.9) setVideoAspect("portrait");
                    else setVideoAspect("square");
                  }
                }}
              />
              {!isPlaying && (
                <button
                  type="button"
                  onClick={() => videoRef.current?.play()}
                  className="absolute inset-0 flex items-center justify-center group cursor-pointer bg-black/0 hover:bg-black/20 transition-colors z-10"
                  aria-label="Lire la video"
                >
                  <div className="w-20 h-20 rounded-full bg-white/95 shadow-2xl flex items-center justify-center group-active:scale-95 transition-transform">
                    <Play size={32} className="text-neutral-900 ml-1" strokeWidth={2.5} fill="currentColor" />
                  </div>
                </button>
              )}
            </>
          ) : project.video_url ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={32} className="animate-spin" style={{ color: "white", opacity: 0.5 }} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Play size={40} style={{ color: "white", opacity: 0.5 }} />
            </div>
          )}
        </div>
      )}

      {isCarousel && isActive && (
        <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between" style={{ color: COLORS.warmGray, backgroundColor: "#FAFAF8" }}>
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
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] flex flex-col" style={{ backgroundColor: COLORS.cream }}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-200">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.ink }}>
            {tenantName}
          </span>
          <button type="button" onClick={onClose} className="p-2 -m-2" aria-label="Fermer">
            <X size={20} style={{ color: COLORS.ink }} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          <DrawerItem label="Dashboard" onClick={() => onNavigate("/admin/tenant")} active />
          <DrawerItem label="Mon équipe" onClick={() => onNavigate("/admin/tenant/team")} />
          <DrawerItem label="Brand Assets" onClick={() => onNavigate("/admin/tenant/brand-assets")} />
          <DrawerItem label="Médias" onClick={() => onNavigate("/admin/tenant/library")} />
        </nav>
        <div className="px-5 py-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
            style={{ backgroundColor: COLORS.ink, color: COLORS.cream }}
          >
            Déconnexion
          </button>
        </div>
      </div>
    </>
  );
}

function DrawerItem({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
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
      {active && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.bordeaux }} />}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
//  SOUS-COMPOSANT : CommentSheet
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
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl shadow-2xl flex flex-col"
        style={{ backgroundColor: "white", maxHeight: "60vh", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-300" />
        </div>
        <div className="px-5 py-3 flex items-center justify-between border-b border-neutral-100">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.ink }}>
              Commentaire
            </p>
            <p className="text-[10px]" style={{ color: COLORS.warmGray }}>
              {project._type === "video" ? "Vidéo globale" : "Sur ce projet"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2" aria-label="Fermer">
            <X size={18} style={{ color: COLORS.warmGray }} />
          </button>
        </div>
        <div className="flex-1 p-4">
          <textarea
            ref={inputRef}
            value={commentText}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Votre retour..."
            className="w-full h-32 p-3 rounded-xl resize-none text-sm focus:outline-none"
            style={{ backgroundColor: "#FAFAF8", color: COLORS.ink, border: "1px solid rgba(0,0,0,0.08)", fontSize: "16px" }}
          />
        </div>
        <div className="px-4 pb-4 pt-1">
          <button
            type="button"
            onClick={onSend}
            disabled={!commentText.trim()}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: COLORS.bordeaux }}
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

// ═══════════════════════════════════════════════════════════
//  BRIEF CARD MOBILE
// ═══════════════════════════════════════════════════════════
function BriefCardMobile({ task }: { task: Task }) {
  const priorityColors: Record<string, { bg: string; text: string; label: string }> = {
    low: { bg: "#F5F5F4", text: "#71717A", label: "BASSE" },
    normal: { bg: "#DBEAFE", text: "#1D4ED8", label: "NORMALE" },
    high: { bg: "#FED7AA", text: "#C2410C", label: "HAUTE" },
    urgent: { bg: "#FEE2E2", text: "#B91C1C", label: "URGENT" },
  };
  const statusLabels: Record<string, { label: string; color: string }> = {
    open: { label: "En attente", color: "#B45309" },
    in_progress: { label: "En production", color: "#1D4ED8" },
    completed: { label: "Terminé", color: "#15803D" },
    cancelled: { label: "Annulé", color: "#71717A" },
  };

  const prio = priorityColors[task.priority] || priorityColors.normal;
  const stat = statusLabels[task.status] || statusLabels.open;

  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="bg-white rounded-2xl p-4 border border-neutral-200">
      <div className="flex items-center justify-between mb-3">
        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded" style={{ backgroundColor: prio.bg, color: prio.text }}>
          {prio.label}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: stat.color }}>
          {stat.label}
        </span>
      </div>

      <h3 className="text-sm font-bold mb-2" style={{ color: "#181614" }}>
        {task.title}
      </h3>

      {task.brief && (
        <p
          className="text-xs leading-relaxed mb-3"
          style={{
            color: "#807972",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {task.brief}
        </p>
      )}

      {deadline && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-100">
          <Clock size={11} style={{ color: "#807972" }} />
          <span className="text-[10px]" style={{ color: "#807972" }}>
            Deadline : <strong style={{ color: "#181614" }}>{deadline}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  NEW BRIEF MOBILE MODAL
// ═══════════════════════════════════════════════════════════
function NewBriefMobileModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const priorityOptions: { value: "low" | "normal" | "high" | "urgent"; label: string; color: string }[] = [
    { value: "low", label: "Basse", color: "#71717A" },
    { value: "normal", label: "Normale", color: "#1D4ED8" },
    { value: "high", label: "Haute", color: "#C2410C" },
    { value: "urgent", label: "Urgent", color: "#B91C1C" },
  ];

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          brief: brief.trim() || null,
          priority,
          deadline: deadline || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur creation");
      }
      const { task } = await res.json();

      let uploaded = 0;
      let failed = 0;
      if (task?.id && files.length > 0) {
        for (const file of files) {
          try {
            const fd = new FormData();
            fd.append("file", file);
            const up = await fetch(`/api/admin/briefs/${task.id}/attachments`, {
              method: "POST",
              headers: { Authorization: `Bearer ${session?.access_token}` },
              body: fd,
            });
            if (up.ok) { uploaded++; } else { failed++; }
          } catch {
            failed++;
          }
        }
      }

      if (failed > 0) {
        toast.success("Brief cree", { description: `${uploaded} fichier(s) ajoute(s), ${failed} echec(s).` });
      } else if (uploaded > 0) {
        toast.success("Brief cree", { description: `Le studio est notifie. ${uploaded} piece(s) jointe(s).` });
      } else {
        toast.success("Brief cree", { description: "Le studio est notifie." });
      }
      onCreated();
    } catch (err: any) {
      toast.error("Erreur", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[90vh]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: COLORS.ink }}>
            Nouveau brief
          </h2>
          <button type="button" onClick={onClose} disabled={submitting} className="p-2 -m-2 rounded-full disabled:opacity-50">
            <X size={20} style={{ color: COLORS.warmGray }} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 block">
              Titre *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Post LinkedIn Q1"
              style={{ fontSize: "16px" }}
              className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
              maxLength={200}
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 block">
              Description
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Description du brief, ton, objectifs..."
              rows={4}
              style={{ fontSize: "16px" }}
              className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
              maxLength={5000}
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 block">
              Priorité
            </label>
            <div className="grid grid-cols-4 gap-2">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className="py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all"
                  style={{
                    backgroundColor: priority === opt.value ? opt.color : "#F5F5F4",
                    color: priority === opt.value ? "white" : opt.color,
                    border: priority === opt.value ? `1px solid ${opt.color}` : "1px solid transparent",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 block">
              Deadline (optionnel)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{ fontSize: "16px" }}
              className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 block">
              Pièces jointes (PDF / images)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                if (picked.length) setFiles((prev) => [...prev, ...picked]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="w-full py-2.5 rounded-lg border border-dashed border-neutral-300 text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Paperclip size={14} /> Ajouter PDF / image
            </button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-neutral-50 border border-neutral-200">
                    <span className="text-[11px] text-neutral-700 truncate flex-1">{f.name}</span>
                    <span className="text-[10px] text-neutral-400 shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} disabled={submitting} className="p-1 -m-1 text-neutral-400 shrink-0" aria-label="Retirer">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-100 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg disabled:opacity-50"
            style={{ color: COLORS.warmGray, backgroundColor: "#F5F5F4" }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition disabled:opacity-50"
            style={{ backgroundColor: COLORS.bordeaux, color: "white" }}
          >
            {submitting ? "Creation..." : "Creer"}
          </button>
        </div>
      </div>
    </div>
  );
}
