"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentTenant } from "../../lib/useCurrentTenant";
import { supabase } from "../../lib/supabase";
import TasksCapsule from "@/components/studio/TasksCapsule";
import SkeletonCard from "@/components/studio/SkeletonCard";
import {
  Plus, Loader2, FileText, Clock, CheckCircle2,
  AlertCircle, Pencil, Trash2, Paperclip, ImageIcon, Download, X, Film, Filter,
} from "lucide-react";
import StudioHeader from "@/components/StudioHeader";
import NotificationsBell from "@/components/NotificationsBell";
import StudioMenu from "@/components/studio/StudioMenu";
import FeedbackWidget from "@/components/FeedbackWidget";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
// ⭐ Module vidéo
import NewVideoProjectModal from "@/components/studio/video/NewVideoProjectModal";
import NewCarouselProjectModal from "@/components/studio/NewCarouselProjectModal";
import ProjectExporter from "@/components/studio/ProjectExporter";
import StudioProjectCard from "@/components/projects/StudioProjectCard";
import ProjectFilters, { FilterType, FilterStatus, SortBy } from "@/components/studio/ProjectFilters";
import type { VideoProject } from "@/lib/video/types";

type ProjectRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: "draft" | "pending_approval" | "approved" | "archived" | "rejected";
  state_json: any;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  task_id: string | null;
};

type BriefAttachment = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
};

type BriefImage = {
  id: string;
  public_url: string;
  thumbnail_url: string | null;
  filename: string;
};

export default function StudioHomePage() {
  const router = useRouter();
  const tenantState = useCurrentTenant();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [exportingProject, setExportingProject] = useState<any | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creating, setCreating] = useState(false);
  // ⭐ Module vidéo
  const [videoProjects, setVideoProjects] = useState<VideoProject[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [showNewVideoModal, setShowNewVideoModal] = useState(false);
  const [showNewCarouselModal, setShowNewCarouselModal] = useState(false);

  // Phase 12 peaufinage : filtres unifies dashboard
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (tenantState.status === "unauthenticated") {
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  }, [tenantState.status]);

  // ⭐ GUARD : Tenant admin ne doit JAMAIS accéder au studio
  useEffect(() => {
    if (tenantState.status === "ready" && tenantState.user.role === "tenant_admin") {
      router.replace("/admin/tenant");
    }
  }, [tenantState.status, router]);

  useEffect(() => {
    if (tenantState.status !== "ready") return;

    let cancelled = false;
    (async () => {
      setLoadingProjects(true);
      setLoadingVideos(true);

      // Carrousels
      const carrouselsPromise = supabase
        .from("studio_projects")
        .select("*")
        .eq("tenant_id", tenantState.user.tenantId!)
        .neq("status", "archived")
        .order("updated_at", { ascending: false });

      // ⭐ Vidéos
      const videosPromise = supabase
        .from("studio_video_projects")
        .select("*")
        .eq("tenant_id", tenantState.user.tenantId!)
        .is("archived_at", null)
        .order("updated_at", { ascending: false });

      const [carrouselsRes, videosRes] = await Promise.all([carrouselsPromise, videosPromise]);

      if (!cancelled) {
        if (carrouselsRes.error) console.error("Erreur chargement projets:", carrouselsRes.error);
        else setProjects((carrouselsRes.data as ProjectRow[]) || []);
        setLoadingProjects(false);

        if (videosRes.error) console.error("Erreur chargement vidéos:", videosRes.error);
        else setVideoProjects((videosRes.data as VideoProject[]) || []);
        setLoadingVideos(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantState.status, tenantState.status === "ready" ? tenantState.user.tenantId : null]);

  // ⭐ Fonction de reload des vidéos (utilisée après suppression card)
  const reloadVideos = async () => {
    if (tenantState.status !== "ready") return;
    const { data } = await supabase
      .from("studio_video_projects")
      .select("*")
      .eq("tenant_id", tenantState.user.tenantId!)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    setVideoProjects((data as VideoProject[]) || []);
  };

  // Phase 12 peaufinage : reload carrousels apres delete
  const reloadProjects = async () => {
    if (tenantState.status !== "ready") return;
    const { data } = await supabase
      .from("studio_projects")
      .select("*")
      .eq("tenant_id", tenantState.user.tenantId!)
      .neq("status", "archived")
      .order("updated_at", { ascending: false });
    setProjects((data as ProjectRow[]) || []);
  };

  const handleCreate = async () => {
    if (tenantState.status !== "ready") return;
    setCreating(true);

    try {
      const res = await fetch("/api/studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Nouveau projet · ${new Date().toLocaleDateString("fr-CH")}`,
          templateKey: "carrousel_instagram",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur création");
      router.push(`/studio/${data.project.id}`);
    } catch (err: any) {
      toast.error("Impossible de créer le projet", { description: err.message });
      setCreating(false);
    }
  };

  // Conservé pour l'état d'erreur (fallback déconnexion)
  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  if (tenantState.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (tenantState.status === "unauthenticated") {
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
          <p className="text-xs text-neutral-500">Redirection vers le tableau de bord admin...</p>
        </div>
      </div>
    );
  }

  if (tenantState.status === "no_tenant" || tenantState.status === "no_profile" || tenantState.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-8">
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 max-w-md text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-orange-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-neutral-900 mb-2">Compte non configuré</h2>
          <p className="text-sm text-neutral-500 mb-4">
            {tenantState.error || "Impossible de charger ta configuration."}
          </p>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const { user, config } = tenantState;
  // Phase 12 peaufinage : merge videos + carrousels en une liste unifiee
  const allProjects = [
    ...projects.map((p) => ({ ...p, _type: "carousel" as const })),
    ...videoProjects.map((vp) => ({ ...vp, _type: "video" as const })),
  ];

  // Filtre par type
  const typeFiltered = allProjects.filter((p) => {
    if (filterType === "all") return true;
    return p._type === filterType;
  });

  // Filtre par statut
  const statusFiltered = typeFiltered.filter((p) => {
    if (filterStatus === "all") return true;
    return p.status === filterStatus;
  });

  // Filtre par recherche
  const searchFiltered = statusFiltered.filter((p) => {
    if (!searchQuery.trim()) return true;
    return p.title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Tri
  const sorted = [...searchFiltered].sort((a, b) => {
    if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
    if (sortBy === "oldest") return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginatedProjects = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const brandColor = config.brandIdentity.colors.brandPrimary;

  // ⭐ Eyebrow dynamique selon le rôle
  const roleLabel = user.role === "tenant_admin" ? "DIRECTION" : "CRÉATION";

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ⭐ NOUVEAU AppHeader unifié */}
      {/* Phase 12 peaufinage : Header universel StudioHeader */}
      <StudioHeader
        backHref="/"
        eyebrowMain="STUDIO"
        eyebrowSubtitle={config.tenant.name}
        title="Mes projets"
        showStudioMenu={true}
        tenantId={config.tenant.id || null}
        showNotifications={true}
        showLogout={true}
        onLogout={handleLogout}
      />

      <main className="max-w-6xl mx-auto px-8 py-8">
        {user.role === "graphist" && (
          <div className="">
            <TasksCapsule brandColor={brandColor} />
          </div>
        )}

        <div className="mb-6">

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setShowNewCarouselModal(true)}
              disabled={creating}
              className="text-white text-sm font-bold uppercase tracking-wider px-6 py-3.5 rounded-xl transition flex items-center gap-2 disabled:opacity-40 shadow-sm hover:shadow-md"
              style={{ backgroundColor: "#B11E2F" }}
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {creating ? "Création..." : "Nouveau carrousel"}
            </button>

            {/* ⭐ NOUVEAU bouton vidéo */}
            <button
              onClick={() => setShowNewVideoModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-white border-2 text-sm font-bold uppercase tracking-wider rounded-xl transition shadow-sm hover:shadow-md"
              style={{ borderColor: "#B11E2F", color: "#B11E2F" }}
            >
              <Film size={16} />
              Nouveau projet vidéo
            </button>
          </div>
        </div>

        {/* Phase 12 peaufinage : Filtres unifies + grille fusionnee */}
        <ProjectFilters
          filterType={filterType}
          filterStatus={filterStatus}
          sortBy={sortBy}
          search={searchQuery}
          onTypeChange={(v) => { setFilterType(v); setCurrentPage(1); }}
          onStatusChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}
          onSortChange={setSortBy}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          totalCount={sorted.length}
        />

        {(loadingProjects || loadingVideos) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          (filterType !== "all" || filterStatus !== "all" || searchQuery.trim()) ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
              <Filter size={32} className="text-neutral-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-neutral-900 mb-1">Aucun resultat</h3>
              <p className="text-sm text-neutral-500">Essaie de modifier ou reinitialiser les filtres.</p>
            </div>
          ) : (
            <EmptyState brandColor={brandColor} onCreate={() => setShowNewCarouselModal(true)} creating={creating} />
          )
        ) : (
          <>
            {exportingProject && (
              <ProjectExporter project={exportingProject} config={config} onDone={() => setExportingProject(null)} />
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {paginatedProjects.map((p: any) => (
                  <StudioProjectCard
                    key={p._type === "video" ? `v-${p.id}` : `c-${p.id}`}
                    project={p}
                    type={p._type}
                    config={config}
                    onExport={() => setExportingProject(p)}
                    onDelete={p._type === "video" ? reloadVideos : reloadProjects}
                  />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Precedent
                </button>
                <span className="px-3 py-1.5 text-xs font-bold text-neutral-700">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ⭐ FEEDBACK WIDGET — Visible pour tenant_admin + graphist uniquement */}
      <FeedbackWidget />

      {/* ⭐ MODAL création vidéo */}
      <NewVideoProjectModal
        open={showNewVideoModal}
        onClose={() => setShowNewVideoModal(false)}
        brandColor={brandColor}
      />

      {/* MODAL creation carrousel (SPRINT 2 - multi-format) */}
      <NewCarouselProjectModal
        open={showNewCarouselModal}
        onClose={() => setShowNewCarouselModal(false)}
        brandColor={brandColor}
      />
    </div>
  );
}

function EmptyState({
  brandColor, onCreate, creating,
}: {
  brandColor: string;
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-16 text-center">
      <FileText size={36} className="text-neutral-300 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-neutral-900 mb-1">Aucun projet pour l&apos;instant</h3>
      <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
        Crée ton premier carrousel Instagram. Tous les éléments graphiques seront
        automatiquement appliqués selon la charte officielle.
      </p>
      <button
        onClick={onCreate}
        disabled={creating}
        className="text-white text-sm font-bold uppercase tracking-wider px-6 py-3 rounded-xl transition inline-flex items-center gap-2 disabled:opacity-40"
        style={{ backgroundColor: brandColor }}
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        {creating ? "Création..." : "Créer mon premier projet"}
      </button>
    </div>
  );
}

function ProjectSection({
  title, icon, color, bgColor, projects, brandColor,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  projects: ProjectRow[];
  brandColor: string;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${bgColor} ${color}`}>
          {icon} {title}
        </span>
        <span className="text-[11px] text-neutral-400">{projects.length}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} brandColor={brandColor} />
        ))}
      </div>
    </section>
  );
}

// ============================================================
//  CARTE PROJET — Avec icônes PDF + images du brief
// ============================================================

function ProjectCard({ project, brandColor }: { project: ProjectRow; brandColor: string }) {
  const router = useRouter();
  const slidesCount = project.state_json?.slides?.length || 0;

  // ⭐ Détecter les retours admin (slides marquées "à corriger")
  const slidesNeedingWork = project.state_json?.slides?.filter(
    (s: any) => s?.review?.status === "needs_changes"
  ).length || 0;
  const hasAdminFeedback = slidesNeedingWork > 0;
  const [attachments, setAttachments] = useState<BriefAttachment[]>([]);
  const [briefImages, setBriefImages] = useState<BriefImage[]>([]);
  const [showImagesPopover, setShowImagesPopover] = useState(false);

  // ⭐ Charge les attachments/images du brief si le projet est lié à une task
  useEffect(() => {
    if (!project.task_id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session?.access_token}` };

        const [attRes, imgRes] = await Promise.all([
          fetch(`/api/admin/briefs/${project.task_id}/attachments`, { headers }),
          fetch(`/api/admin/briefs/${project.task_id}/images`, { headers }),
        ]);

        if (!cancelled) {
          if (attRes.ok) {
            const { attachments: a } = await attRes.json();
            setAttachments(a || []);
          }
          if (imgRes.ok) {
            const { images: i } = await imgRes.json();
            setBriefImages(i || []);
          }
        }
      } catch (err) {
        console.error("[ProjectCard] error loading brief data:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [project.task_id]);

  const handleClick = () => {
    router.push(`/studio/${project.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDialog(`Supprimer "${project.title}" ?`, {
      description: "Cette action est définitive et ne peut pas être annulée.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/studio/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Projet supprimé");
      window.location.reload();
    } else {
      toast.error("Suppression impossible", { description: "Réessaye dans un instant." });
    }
  };

  const formattedDate = new Date(project.updated_at).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasAttachments = attachments.length > 0;
  const hasImages = briefImages.length > 0;
  const hasBriefAssets = hasAttachments || hasImages;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`rounded-xl border hover:shadow-sm transition p-4 text-left group relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-300 ${
        hasAdminFeedback
          ? "bg-amber-50/40 border-amber-300 ring-2 ring-amber-100 hover:border-amber-400"
          : "bg-white border-neutral-200 hover:border-neutral-300"
      }`}
    >
      {hasAdminFeedback && (
        <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black uppercase tracking-widest animate-pulse">
          <AlertCircle size={9} strokeWidth={3} />
          Retours admin · {slidesNeedingWork} à corriger
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-bold text-neutral-900 line-clamp-2 pr-6">{project.title}</h4>
        <button
          type="button"
          onClick={handleDelete}
          className="absolute top-3 right-3 p-1.5 rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
          title="Supprimer"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-neutral-400">
        <span className="flex items-center gap-1">
          <FileText size={11} /> {slidesCount} slide{slidesCount > 1 ? "s" : ""}
        </span>
        <span>·</span>
        <span>{formattedDate}</span>
      </div>

      {/* ⭐ ICÔNES BRIEF — PDF + IMAGES */}
      {hasBriefAssets && (
        <div
          className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-1.5 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[9px] font-black uppercase tracking-widest text-orange-600 mr-1">
            BRIEF :
          </span>

          {/* Icônes PDF inline */}
          {attachments.map((a) => (
            <AttachmentIcon key={a.id} attachment={a} />
          ))}

          {/* Icône Images (s'il y en a) */}
          {hasImages && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImagesPopover(!showImagesPopover);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 hover:bg-orange-100 border border-orange-200 transition text-orange-700"
                title={`${briefImages.length} image${briefImages.length > 1 ? "s" : ""} du brief`}
              >
                <ImageIcon size={11} />
                <span className="text-[10px] font-black">{briefImages.length}</span>
              </button>

              {showImagesPopover && (
                <BriefImagesPopover
                  images={briefImages}
                  onClose={() => setShowImagesPopover(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition"
        style={{ backgroundColor: brandColor }}
      />
    </div>
  );
}

// ============================================================
//  ATTACHMENT ICON (PDF, Word, etc.) — inline + click télécharge
// ============================================================
function AttachmentIcon({ attachment }: { attachment: BriefAttachment }) {
  const sizeMB = attachment.file_size
    ? `${(attachment.file_size / 1024 / 1024).toFixed(1)} MB`
    : "";

  const icon = attachment.file_type.includes("pdf") ? "📄" :
               attachment.file_type.includes("word") ? "📝" :
               attachment.file_type.includes("excel") || attachment.file_type.includes("sheet") ? "📊" :
               attachment.file_type.includes("powerpoint") || attachment.file_type.includes("presentation") ? "📑" :
               "📎";

  return (
    <a
      href={attachment.file_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-50 hover:bg-orange-50 border border-neutral-200 hover:border-orange-200 transition group/file"
      title={`${attachment.file_name}${sizeMB ? ` · ${sizeMB}` : ""}`}
    >
      <span className="text-xs">{icon}</span>
      <span className="text-[10px] font-bold text-neutral-700 group-hover/file:text-orange-700 max-w-[80px] truncate">
        {attachment.file_name}
      </span>
    </a>
  );
}

// ============================================================
//  BRIEF IMAGES POPOVER — Mini grille au click
// ============================================================
function BriefImagesPopover({
  images, onClose,
}: { images: BriefImage[]; onClose: () => void }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <>
      {/* Backdrop léger pour fermer en cliquant à l'extérieur */}
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-xl border border-orange-200 shadow-xl z-50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-orange-100 bg-orange-50 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-700">
            Images du brief ({images.length})
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-neutral-400 hover:text-neutral-700"
          >
            <X size={12} />
          </button>
        </div>
        <div className="p-2 max-h-64 overflow-y-auto">
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((img) => (
              <a
                key={img.id}
                href={img.public_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="relative aspect-square rounded overflow-hidden border border-neutral-200 hover:border-orange-400 transition"
                title={img.filename}
              >
                <img
                  src={img.thumbnail_url || img.public_url}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
              </a>
            ))}
          </div>
        </div>
        <div className="px-3 py-1.5 bg-neutral-50 border-t border-neutral-100 text-[9px] text-neutral-500 text-center">
          ⚠ Images obligatoires à utiliser dans ce projet
        </div>
      </div>
    </>
  );
}
