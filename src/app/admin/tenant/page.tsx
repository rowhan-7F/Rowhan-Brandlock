"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Loader2, AlertCircle, CheckCircle2, Clock,
  Calendar, X, Eye, Trash2, ChevronDown, ChevronUp,
  FileText, Send, Library, Paperclip, ImagePlus, Download,
  File as FileIcon, Filter,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useCurrentTenant } from "@/lib/useCurrentTenant";
import StudioHeader from "@/components/StudioHeader";
import AdminTenantMenu from "@/components/admin/AdminTenantMenu";
import FeedbackWidget from "@/components/FeedbackWidget";
import AdminProjectCard from "@/components/projects/AdminProjectCard";
import ProjectFilters, { FilterType, FilterStatus, SortBy } from "@/components/studio/ProjectFilters";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";

// ⚠ SUPPRIMÉ : import LogoutButton, ArrowLeft (logout intégré dans AppHeader, back arrow via prop)
import { useIsMobile } from "@/hooks/useMediaQuery";
import AdminMobileFeed from "@/components/admin/AdminMobileFeed";

// ============================================================
//  TYPES
// ============================================================

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

type Project = {
  id: string;
  title: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "published";
  created_at: string;
  updated_at: string;
  created_by: string;
  task_id: string | null;
};

type UserProfile = {
  user_id: string;
  email: string;
  role: string;
  tenant_id: string | null;
};

type BriefAttachment = {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

type BriefImage = {
  id: string;
  public_url: string;
  thumbnail_url: string | null;
  filename: string;
  related_task_id: string;
  is_approved: boolean;
  created_at: string;
};


// ============================================================
//  PAGE PRINCIPALE
// ============================================================

export default function AdminTenantPage() {
  const router = useRouter();
  const tenantState = useCurrentTenant();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pendingImagesCount, setPendingImagesCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"briefs" | "pending" | "approved">("pending");
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ⭐ Module video + filtres + config
  const [videoProjects, setVideoProjects] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      const { data: profile, error: profErr } = await supabase
        .from("user_profiles")
        .select("user_id, email, role, tenant_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profErr || !profile) {
        const fallbackEmail = session.user.email || "";
        if (!profile && fallbackEmail) {
          setError(`Profil introuvable pour ${fallbackEmail}.`);
        } else {
          setError("Impossible de charger le profil");
        }
        setLoading(false);
        return;
      }

      if (profile.role !== "tenant_admin" && profile.role !== "super_admin") {
        setError("Accès réservé aux administrateurs");
        setLoading(false);
        return;
      }

      setUser(profile);

        // Fetch tenant name pour le header
        if (profile?.tenant_id) {
          const { data: tenantConfig } = await supabase
            .from("tenant_configs")
            .select("tenant_name")
            .eq("tenant_id", profile.tenant_id)
            .maybeSingle();
          if (tenantConfig?.tenant_name) {
            setTenantName(tenantConfig.tenant_name);
          }
        }

      const token = session.access_token;
      const tenantId = profile.tenant_id;

      if (!tenantId && profile.role !== "super_admin") {
        setError("Aucun tenant associé à votre compte");
        setLoading(false);
        return;
      }

      const tasksUrl = profile.role === "super_admin" && tenantId
        ? `/api/admin/tasks?tenant_id=${tenantId}`
        : `/api/admin/tasks`;

      const tasksRes = await fetch(tasksUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tasksRes.ok) {
        const { tasks: t } = await tasksRes.json();
        setTasks(t || []);
      }

      let projQuery = supabase
        .from("studio_projects")
        .select("id, title, status, created_at, updated_at, created_by, task_id, state_json")
        .order("updated_at", { ascending: false });

      if (tenantId) {
        projQuery = projQuery.eq("tenant_id", tenantId);
      }

      const { data: proj } = await projQuery;
      setProjects(proj || []);

      // ⭐ Fetch video projects (memes tenants)
      let videoQuery = supabase
        .from("studio_video_projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (tenantId) {
        videoQuery = videoQuery.eq("tenant_id", tenantId);
      }
      const { data: videos } = await videoQuery;
      setVideoProjects(videos || []);

      if (tenantId) {
        const { count } = await supabase
          .from("brand_images")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("is_approved", false);
        setPendingImagesCount(count || 0);
      }
    } catch (err: any) {
      setError(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Mobile responsive switch
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="animate-spin text-neutral-400" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-3 text-red-500" size={28} />
          <p className="text-sm text-neutral-700">{error}</p>
          <Link href="/" className="inline-block mt-4 text-xs font-bold text-orange-600 hover:underline">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const pendingProjects = [
    ...projects.filter((p) => p.status === "pending_approval"),
    ...videoProjects.filter((p) => p.status === "pending_approval"),
  ];
  const approvedProjects = [
    ...projects.filter((p) => p.status === "approved" || p.status === "published"),
    ...videoProjects.filter((p) => p.status === "approved" || p.status === "published"),
  ];
  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "in_progress");


  const handleLogout = async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d'accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // ─────────────────────────────────────────────────────────
  // MOBILE : feed vertical + boutons sticky + bottom sheet
  // ─────────────────────────────────────────────────────────
  if (isMobile && tenantState.status === "ready") {
    // Fusionner carousels + videos en un seul feed
    const allProjects = [
      ...projects.map((p) => ({ ...p, _type: "carousel" as const })),
      ...videoProjects.map((p) => ({
        ...p,
        _type: "video" as const,
        video_url: p.source_video_url,
        thumbnail_url: p.thumbnail_url || null,
      })),
    ].sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
    );

    return (
      <AdminMobileFeed
        projects={allProjects}
        tasks={tasks}
        config={tenantState.config}
        tenantName={tenantState.config?.tenant?.name || tenantName || "Brand"}
        brandPrimary={tenantState.config?.brandIdentity?.colors?.brandPrimary || "#B11E2F"}
        onRefresh={fetchData}
      />
    );
  }

  // ─────────────────────────────────────────────────────────
  // DESKTOP : interface admin classique
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ⭐ NOUVEAU AppHeader unifié */}
      <StudioHeader
        backHref="/"
        eyebrowMain="ADMINISTRATION"
        eyebrowSubtitle={tenantName}
        title="Tableau de bord"
        showAdminMenu={true}
        adminMenuActive="dashboard"
        tenantId={user?.tenant_id || null}
        showNotifications={true}
        showLogout={true}
        onLogout={handleLogout}
      />

      <div className="max-w-6xl mx-auto p-6">
        

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="flex border-b border-neutral-200">
            <TabButton active={activeTab === "briefs"} onClick={() => setActiveTab("briefs")} label="Briefs" count={openTasks.length} />
            <TabButton active={activeTab === "pending"} onClick={() => setActiveTab("pending")} label="À valider" count={pendingProjects.length} />
            <TabButton active={activeTab === "approved"} onClick={() => setActiveTab("approved")} label="Approuvés" count={approvedProjects.length} />
          </div>

          <div className="p-6">
            {activeTab === "briefs" && (
              <BriefsTab
                tasks={tasks}
                onCreateTask={() => setShowNewTaskForm(true)}
                onRefresh={fetchData}
                user={user!}
              />
            )}
            {activeTab === "pending" && (
              <ProjectsList projects={projects} videoProjects={videoProjects} config={tenantState.status === "ready" ? tenantState.config : null} emptyText="Aucun projet en attente de validation" allowedStatuses={["pending_approval"]} filterType={filterType} setFilterType={setFilterType} filterStatus={filterStatus} setFilterStatus={setFilterStatus} sortBy={sortBy} setSortBy={setSortBy} searchQuery={searchQuery} setSearchQuery={setSearchQuery} currentPage={currentPage} setCurrentPage={setCurrentPage} pageSize={PAGE_SIZE} />
            )}
            {activeTab === "approved" && (
              <ProjectsList projects={projects} videoProjects={videoProjects} config={tenantState.status === "ready" ? tenantState.config : null} emptyText="Aucun projet approuve pour le moment" allowedStatuses={["approved", "published"]} filterType={filterType} setFilterType={setFilterType} filterStatus={filterStatus} setFilterStatus={setFilterStatus} sortBy={sortBy} setSortBy={setSortBy} searchQuery={searchQuery} setSearchQuery={setSearchQuery} currentPage={currentPage} setCurrentPage={setCurrentPage} pageSize={PAGE_SIZE} />
            )}
          </div>
        </div>
      </div>

      {showNewTaskForm && (
        <NewTaskModal
          onClose={() => setShowNewTaskForm(false)}
          onCreated={() => {
            setShowNewTaskForm(false);
            fetchData();
          }}
        />
      )}

      {/* ⭐ FEEDBACK WIDGET */}
      <FeedbackWidget />
    </div>
  );
}


// ============================================================
//  STAT CARD
// ============================================================
function StatCard({ label, count, icon, color }: any) {
  const colorMap: Record<string, string> = {
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    green: "bg-green-50 text-green-600 border-green-100",
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{label}</div>
        <div className="text-2xl font-black text-neutral-900">{count}</div>
      </div>
    </div>
  );
}


// ============================================================
//  TAB BUTTON
// ============================================================
function TabButton({ active, onClick, label, count }: any) {
  const isPendingTab = label === "À valider" && count > 0;
  const badgeClass = isPendingTab
    ? "bg-[#B11E2F] text-white animate-pulse"
    : "bg-neutral-100 text-neutral-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
        active
          ? "border-orange-500 text-orange-600 bg-orange-50/50"
          : "border-transparent text-neutral-500 hover:text-neutral-700"
      }`}
    >
      {label}
      <span className={`ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black ${badgeClass}`}>
        {count}
      </span>
    </button>
  );
}


// ============================================================
//  BRIEFS TAB
// ============================================================
function BriefsTab({ tasks, onCreateTask, onRefresh, user }: any) {
  const [tasksWithStatus, setTasksWithStatus] = useState<(Task & { _projectStatus?: string })[]>([]);

  // ⭐ Enrichir chaque task avec le status du projet lie
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enriched = await Promise.all(
        tasks.map(async (t: Task) => {
          if (!t.linked_project_id) return t;
          const { data } = await supabase
            .from("studio_projects")
            .select("status")
            .eq("id", t.linked_project_id)
            .maybeSingle();
          return { ...t, _projectStatus: data?.status };
        })
      );
      if (!cancelled) setTasksWithStatus(enriched);
    })();
    return () => { cancelled = true; };
  }, [tasks]);

  // Filter : task active ET projet pas approuve/archive/publie
  const openTasks = tasksWithStatus.filter((t) => {
    const taskActive = t.status === "open" || t.status === "in_progress";
    const projectFinished = t._projectStatus === "approved" ||
                            t._projectStatus === "published" ||
                            t._projectStatus === "archived";
    return taskActive && !projectFinished;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-900">Vos briefs</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Vos utilisateurs verront automatiquement les briefs ouverts</p>
        </div>
        <button
          type="button"
          onClick={onCreateTask}
          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition shadow-sm"
        >
          <Plus size={14} strokeWidth={3} />
          Nouveau brief
        </button>
      </div>

      {openTasks.length === 0 ? (
        <div className="text-center py-12 text-sm text-neutral-400">
          Aucun brief pour le moment.
          <br />
          Crée ton premier brief pour commencer.
        </div>
      ) : (
        <div className="space-y-3">
          {openTasks.map((task: Task) => (
            <TaskCard key={task.id} task={task} onChange={onRefresh} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}


// ============================================================
//  TASK CARD ÔÇö Avec affichage des PDF + images
// ============================================================
function TaskCard({ task, onChange, user }: any) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [attachments, setAttachments] = useState<BriefAttachment[]>([]);
  const [briefImages, setBriefImages] = useState<BriefImage[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  const priorityColors: Record<string, string> = {
    low: "text-neutral-400 bg-neutral-50",
    normal: "text-blue-600 bg-blue-50",
    high: "text-orange-600 bg-orange-50",
    urgent: "text-red-600 bg-red-50",
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    open: { label: "En attenteÔÇª", color: "text-amber-600 bg-amber-50" },
    in_progress: { label: "En production", color: "text-blue-600 bg-blue-50" },
    completed: { label: "Terminé", color: "text-green-600 bg-green-50" },
    cancelled: { label: "Annulé", color: "text-neutral-400 bg-neutral-50" },
  };

  // ⭐ Statut du projet lié (pour afficher "À valider" quand soumis)
  const [linkedProjectStatus, setLinkedProjectStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!task.linked_project_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("studio_projects")
        .select("status")
        .eq("id", task.linked_project_id)
        .maybeSingle();
      if (!cancelled && data) {
        setLinkedProjectStatus(data.status);
      }
    })();
    return () => { cancelled = true; };
  }, [task.linked_project_id]);

  // ⭐ Statut effectif affiché (combine task.status + project.status)
  const effectiveStatus = (() => {
    if (linkedProjectStatus === "pending_approval") {
      return { label: "À valider", color: "text-purple-600 bg-purple-50" };
    }
    if (linkedProjectStatus === "approved" || linkedProjectStatus === "published") {
      return { label: "Approuvé", color: "text-green-600 bg-green-50" };
    }
    if (linkedProjectStatus === "rejected") {
      return { label: "À retravailler", color: "text-red-600 bg-red-50" };
    }
    return statusLabels[task.status];
  })();

  // Charger PDF + images quand on expand
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    (async () => {
      setLoadingAttachments(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session?.access_token}` };

        const [attRes, imgRes] = await Promise.all([
          fetch(`/api/admin/briefs/${task.id}/attachments`, { headers }),
          fetch(`/api/admin/briefs/${task.id}/images`, { headers }),
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
        console.error("[TaskCard] load attachments error:", err);
      } finally {
        if (!cancelled) setLoadingAttachments(false);
      }
    })();
    return () => { cancelled = true; };
  }, [expanded, task.id]);

  const handleDelete = async () => {
    const ok = await confirmDialog(`Supprimer le brief "${task.title}" ?`, {
      description: "Le brief sera définitivement supprimé.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Erreur suppression");
      toast.success("Brief supprimé");
      onChange();
    } catch (err: any) {
      toast.error("Suppression impossible", { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-neutral-50 rounded-lg border border-neutral-200 overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${effectiveStatus.color}`}>
              {effectiveStatus.label}
            </span>
            {task.deadline && (
              <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                <Calendar size={10} />
                {new Date(task.deadline).toLocaleDateString("fr-CH")}
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-neutral-900 truncate">{task.title}</div>
          {task.brief && !expanded && (
            <div className="text-xs text-neutral-500 mt-1 line-clamp-1">{task.brief}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white rounded transition"
            title={expanded ? "Réduire" : "Voir le brief"}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {task.linked_project_id && (
            <Link
              href={`/admin/tenant/projects/${task.linked_project_id}`}
              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition"
              title="Voir le projet"
            >
              <Eye size={14} />
            </Link>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-red-400 hover:bg-red-50 rounded transition disabled:opacity-30"
            title="Supprimer"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-neutral-200 bg-white">
          {task.brief && (
            <div className="px-4 py-3 text-xs text-neutral-700 whitespace-pre-wrap">
              {task.brief}
            </div>
          )}

          {loadingAttachments ? (
            <div className="px-4 py-3 text-center">
              <Loader2 size={14} className="animate-spin text-neutral-400 mx-auto" />
            </div>
          ) : (
            <>
              {/* PDF/fichiers */}
              {attachments.length > 0 && (
                <div className="px-4 py-3 border-t border-neutral-100">
                  <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-1">
                    <Paperclip size={10} />
                    Pièces jointes ({attachments.length})
                  </div>
                  <div className="space-y-1.5">
                    {attachments.map((a) => (
                      <AttachmentItem key={a.id} attachment={a} />
                    ))}
                  </div>
                </div>
              )}

              {/* Images du brief */}
              {briefImages.length > 0 && (
                <div className="px-4 py-3 border-t border-neutral-100">
                  <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-1">
                    <ImagePlus size={10} />
                    Images à utiliser ({briefImages.length})
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {briefImages.map((img) => (
                      <div key={img.id} className="relative aspect-square rounded overflow-hidden border border-neutral-200">
                        <img src={img.thumbnail_url || img.public_url} alt={img.filename} className="w-full h-full object-cover" />
                        <div className="absolute top-0 right-0 bg-orange-500 text-white text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded-bl">
                          Brief
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================
//  ATTACHMENT ITEM (PDF, Word, etc.)
// ============================================================
function AttachmentItem({ attachment }: { attachment: BriefAttachment }) {
  const sizeMB = attachment.file_size
    ? `${(attachment.file_size / 1024 / 1024).toFixed(1)} MB`
    : "";

  const iconType = attachment.file_type.includes("pdf") ? "­ƒôä" :
                   attachment.file_type.includes("word") ? "­ƒôØ" :
                   attachment.file_type.includes("excel") || attachment.file_type.includes("sheet") ? "­ƒôè" :
                   attachment.file_type.includes("image") ? "­ƒû╝´©Å" : "­ƒôÄ";

  return (
    <a
      href={attachment.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-50 hover:bg-orange-50 border border-neutral-200 hover:border-orange-200 rounded-lg transition group"
    >
      <span className="text-base">{iconType}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-neutral-900 truncate">{attachment.file_name}</div>
        {sizeMB && (
          <div className="text-[10px] text-neutral-400">{sizeMB}</div>
        )}
      </div>
      <Download size={12} className="text-neutral-400 group-hover:text-orange-600 shrink-0" />
    </a>
  );
}


// ============================================================
//  PROJECTS LIST
// ============================================================
function ProjectsList({
  projects,
  videoProjects,
  config,
  emptyText,
  allowedStatuses,
  filterType, setFilterType,
  filterStatus, setFilterStatus,
  sortBy, setSortBy,
  searchQuery, setSearchQuery,
  currentPage, setCurrentPage,
  pageSize,
}: any) {
  // Merge carrousels + videos en une liste unifiee
  const allProjects = [
    ...projects.map((p: any) => ({ ...p, _type: "carousel" as const })),
    ...videoProjects.map((vp: any) => ({ ...vp, _type: "video" as const })),
  ];

  // Filtre par allowedStatuses (pending / approved / etc)
  const statusBaseFiltered = allowedStatuses
    ? allProjects.filter((p: any) => allowedStatuses.includes(p.status))
    : allProjects;

  // Filtre par type (all / carousel / video)
  const typeFiltered = statusBaseFiltered.filter((p: any) => {
    if (filterType === "all") return true;
    return p._type === filterType;
  });

  // Filtre par statut detaille
  const statusFiltered = typeFiltered.filter((p: any) => {
    if (filterStatus === "all") return true;
    return p.status === filterStatus;
  });

  // Filtre par recherche
  const searchFiltered = statusFiltered.filter((p: any) => {
    if (!searchQuery.trim()) return true;
    return p.title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Tri
  const sorted = [...searchFiltered].sort((a: any, b: any) => {
    if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
    if (sortBy === "oldest") return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginatedProjects = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <ProjectFilters
        filterType={filterType}
        filterStatus={filterStatus}
        sortBy={sortBy}
        search={searchQuery}
        onTypeChange={(v: any) => { setFilterType(v); setCurrentPage(1); }}
        onStatusChange={(v: any) => { setFilterStatus(v); setCurrentPage(1); }}
        onSortChange={setSortBy}
        onSearchChange={(v: any) => { setSearchQuery(v); setCurrentPage(1); }}
        totalCount={sorted.length}
      />

      {sorted.length === 0 ? (
        (filterType !== "all" || filterStatus !== "all" || searchQuery.trim()) ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
            <Filter size={32} className="text-neutral-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900 mb-1">Aucun resultat</h3>
            <p className="text-sm text-neutral-500">Essaie de modifier ou reinitialiser les filtres.</p>
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-neutral-400">{emptyText}</div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
            {paginatedProjects.map((p: any) => (
              <AdminProjectCard
                key={p._type === "video" ? `v-${p.id}` : `c-${p.id}`}
                project={p}
                type={p._type}
                config={config}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button type="button" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed">Precedent</button>
              <span className="px-3 py-1.5 text-xs font-bold text-neutral-700">Page {currentPage} / {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed">Suivant</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ============================================================
//  NEW TASK MODAL ÔÇö Avec upload PDF + images
// ============================================================

type PendingFile = {
  id: string;        // local ID pour la liste
  file: File;
  type: "pdf" | "image";
};

function NewTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_FILE_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  const addFiles = (files: FileList | null, type: "pdf" | "image") => {
    if (!files) return;
    const newFiles: PendingFile[] = [];
    const allowed = type === "pdf" ? ALLOWED_FILE_TYPES : ALLOWED_IMAGE_TYPES;
    const maxSize = type === "pdf" ? 25 * 1024 * 1024 : 10 * 1024 * 1024;

    Array.from(files).forEach((f) => {
      if (!allowed.includes(f.type)) {
        setError(`Type non autorisé : ${f.name}`);
        return;
      }
      if (f.size > maxSize) {
        setError(`${f.name} trop volumineux (max ${maxSize / 1024 / 1024} MB)`);
        return;
      }
      newFiles.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        file: f,
        type,
      });
    });

    if (newFiles.length > 0) {
      setPendingFiles((prev) => [...prev, ...newFiles]);
      setError(null);
    }
  };

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Le titre est obligatoire");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 1) Créer le brief
      setProgress("Création du brief...");
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          brief: brief.trim() || null,
          deadline: deadline || null,
          priority,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur lors de la création");
      }
      const { task } = await res.json();
      const taskId = task.id;

      // 2) Upload PDF/fichiers
      const pdfFiles = pendingFiles.filter((f) => f.type === "pdf");
      const imageFiles = pendingFiles.filter((f) => f.type === "image");

      if (pdfFiles.length > 0) {
        for (let i = 0; i < pdfFiles.length; i++) {
          setProgress(`Envoi du fichier ${i + 1}/${pdfFiles.length}...`);
          const formData = new FormData();
          formData.append("file", pdfFiles[i].file);
          const uploadRes = await fetch(`/api/admin/briefs/${taskId}/attachments`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (!uploadRes.ok) {
            const j = await uploadRes.json().catch(() => ({}));
            console.error("Upload PDF failed:", j.error);
          }
        }
      }

      // 3) Upload images
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          setProgress(`Envoi de l'image ${i + 1}/${imageFiles.length}...`);
          const formData = new FormData();
          formData.append("file", imageFiles[i].file);
          const uploadRes = await fetch(`/api/admin/briefs/${taskId}/images`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (!uploadRes.ok) {
            const j = await uploadRes.json().catch(() => ({}));
            console.error("Upload image failed:", j.error);
          }
        }
      }

      setProgress(null);
      onCreated();
    } catch (err: any) {
      setError(err.message);
      setProgress(null);
    } finally {
      setSubmitting(false);
    }
  };

  const pdfCount = pendingFiles.filter((f) => f.type === "pdf").length;
  const imageCount = pendingFiles.filter((f) => f.type === "image").length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-neutral-900">Nouveau brief</h3>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">
              Titre du brief *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Article sur les primes maladie 2026"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
              maxLength={200}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">
              Instructions / Brief détaillé
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Ex: Article du Blick du 15 mai. Mettre en avant les chiffres clés. Ton militant."
              rows={5}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none resize-none"
              maxLength={5000}
            />
            <div className="text-[10px] text-neutral-400 mt-1">{brief.length} / 5000 caractères</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">
                Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">
                Priorité
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
              >
                <option value="low">Faible</option>
                <option value="normal">Normale</option>
                <option value="high">Élevée</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          {/* ⭐ UPLOAD PDF/FICHIERS */}
          <div className="border-t border-neutral-100 pt-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1">
              <Paperclip size={10} />
              Pièces jointes (PDF, Word, Excel...)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf"
              multiple
              onChange={(e) => addFiles(e.target.files, "pdf")}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-2 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-600 hover:border-orange-300 hover:bg-orange-50/30 transition flex items-center justify-center gap-2"
            >
              <FileIcon size={13} />
              Ajouter des fichiers
            </button>
            {pdfCount > 0 && (
              <div className="mt-2 space-y-1">
                {pendingFiles.filter((f) => f.type === "pdf").map((f) => (
                  <PendingFileItem key={f.id} pf={f} onRemove={() => removeFile(f.id)} />
                ))}
              </div>
            )}
          </div>

          {/* ⭐ UPLOAD IMAGES */}
          <div className="border-t border-neutral-100 pt-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1">
              <ImagePlus size={10} />
              Images à utiliser
            </label>
            <p className="text-[10px] text-neutral-500 mb-2">
              Les images que vous ajoutez sont automatiquement validées et visibles en priorité pour vos utilisateurs.
            </p>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={(e) => addFiles(e.target.files, "image")}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="w-full px-3 py-2 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-600 hover:border-orange-300 hover:bg-orange-50/30 transition flex items-center justify-center gap-2"
            >
              <ImagePlus size={13} />
              Ajouter des images
            </button>
            {imageCount > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {pendingFiles.filter((f) => f.type === "image").map((f) => (
                  <PendingImagePreview key={f.id} pf={f} onRemove={() => removeFile(f.id)} />
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}
          {progress && (
            <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              {progress}
            </div>
          )}
        </div>

        <div className="px-5 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-white rounded-lg transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Send size={12} />
                Créer le brief
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
//  PENDING FILE ITEM (avant upload)
// ============================================================
function PendingFileItem({ pf, onRemove }: { pf: PendingFile; onRemove: () => void }) {
  const sizeMB = (pf.file.size / 1024 / 1024).toFixed(1);
  const ext = pf.file.name.split(".").pop()?.toLowerCase();
  const icon = ext === "pdf" ? "­ƒôä" :
               ext === "doc" || ext === "docx" ? "­ƒôØ" :
               ext === "xls" || ext === "xlsx" ? "­ƒôè" : "­ƒôÄ";

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
      <span className="text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-neutral-900 truncate">{pf.file.name}</div>
        <div className="text-[10px] text-neutral-500">{sizeMB} MB</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 text-red-400 hover:bg-red-50 rounded transition shrink-0"
        title="Retirer"
      >
        <X size={12} />
      </button>
    </div>
  );
}


// ============================================================
//  PENDING IMAGE PREVIEW (avant upload)
// ============================================================
function PendingImagePreview({ pf, onRemove }: { pf: PendingFile; onRemove: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(pf.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pf.file]);

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-orange-200 group">
      {preview && <img src={preview} alt="" className="w-full h-full object-cover" />}
      <div className="absolute top-1 right-1 bg-orange-500 text-white text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded">
        Brief
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute bottom-1 right-1 p-1 bg-white/90 text-red-500 hover:bg-white rounded transition opacity-0 group-hover:opacity-100"
        title="Retirer"
      >
        <X size={10} />
      </button>
    </div>
  );
}
