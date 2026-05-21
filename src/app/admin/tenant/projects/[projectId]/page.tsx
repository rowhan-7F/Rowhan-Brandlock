"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, AlertCircle, CheckCircle2, XCircle,
  RefreshCcw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";
import FeedbackWidget from "@/components/FeedbackWidget";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import SlideRenderer from "@/components/studio/SlideRenderer";
import PendingImagesValidation from "@/components/admin/PendingImagesValidation";
import ProjectMessagesIcon from "@/components/ProjectMessagesIcon";

// ⚠ SUPPRIMÉ : import LogoutButton, ArrowLeft (gérés par AppHeader)

// ============================================================
//  TYPES
// ============================================================

type Project = {
  id: string;
  title: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "published" | "archived";
  tenant_id: string;
  state_json: any;
  created_by: string;
  created_at: string;
  updated_at: string;
  task_id: string | null;
};

type Task = {
  id: string;
  title: string;
  brief: string | null;
  priority: string;
  deadline: string | null;
};

type SlideReview = {
  status?: "ok" | "needs_changes";
  comment?: string;
  reviewedAt?: string;
};


// ============================================================
//  PAGE
// ============================================================

export default function AdminProjectReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [creatorEmail, setCreatorEmail] = useState<string>("");

  const [slideReviews, setSlideReviews] = useState<Record<string, SlideReview>>({});

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);

  // ============================================================
  //  Charger les données
  // ============================================================
  const fetchAll = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      const { data: proj, error: projErr } = await supabase
        .from("studio_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (projErr || !proj) {
        setError("Projet introuvable");
        setLoading(false);
        return;
      }
      setProject(proj as Project);

      // Initialise les reviews
      const slides = proj.state_json?.slides || [];
      const reviews: Record<string, SlideReview> = {};
      slides.forEach((s: any) => {
        if (s.review) reviews[s.id] = s.review;
      });
      setSlideReviews(reviews);

      if (proj.created_by) {
        const { data: creator } = await supabase
          .from("user_profiles")
          .select("email")
          .eq("user_id", proj.created_by)
          .maybeSingle();
        setCreatorEmail(creator?.email || "Inconnu");
      }

      const { data: cfg } = await supabase
        .from("tenant_configs")
        .select("config_json")
        .eq("tenant_id", proj.tenant_id)
        .maybeSingle();
      setConfig(cfg?.config_json || null);

      if (proj.task_id) {
        const { data: t } = await supabase
          .from("studio_tasks")
          .select("id, title, brief, priority, deadline")
          .eq("id", proj.task_id)
          .maybeSingle();
        if (t) setTask(t as Task);
      }
    } catch (err: any) {
      setError(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ============================================================
  //  Sauvegarde des reviews
  // ============================================================
  const saveSlideReviews = useCallback(async (newReviews: Record<string, SlideReview>) => {
    if (!project) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const updatedStateJson = {
        ...project.state_json,
        slides: (project.state_json?.slides || []).map((s: any) => ({
          ...s,
          review: newReviews[s.id] || null,
        })),
      };

      await fetch(`/api/studio/projects/${projectId}/save`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ state_json: updatedStateJson }),
      });
    } catch (err) {
      console.error("[saveSlideReviews]", err);
    }
  }, [project, projectId]);

  const handleSlideStatusChange = (slideId: string, status: "ok" | "needs_changes") => {
    const newReviews = {
      ...slideReviews,
      [slideId]: {
        ...slideReviews[slideId],
        status,
        // ⭐ Clear le commentaire si on passe à "ok" (sinon il reste affiché côté studio)
        comment: status === "ok" ? "" : slideReviews[slideId]?.comment,
        reviewedAt: new Date().toISOString(),
      },
    };
    setSlideReviews(newReviews);
    saveSlideReviews(newReviews);
  };

  const handleSlideCommentChange = (slideId: string, comment: string) => {
    const newReviews = {
      ...slideReviews,
      [slideId]: {
        ...slideReviews[slideId],
        comment,
        reviewedAt: new Date().toISOString(),
      },
    };
    setSlideReviews(newReviews);
  };

  const handleSlideCommentBlur = () => {
    saveSlideReviews(slideReviews);
  };

  // ============================================================
  //  Actions de validation
  // ============================================================
  const handleAction = async (action: "approve" | "reject" | "request_changes", message: string) => {
    setActionLoading(action);
    try {
      await saveSlideReviews(slideReviews);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/studio/projects/${projectId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action, message }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur");
      }
      setShowApproveModal(false);
      const successMsg =
        action === "approve" ? "Projet approuvé ✓"
        : action === "reject" ? "Projet refusé"
        : "Corrections demandées ✓";
      const successDesc =
        action === "approve" ? "Le studio est notifié."
        : action === "reject" ? "Le studio en est informé."
        : "Le studio peut maintenant retravailler les slides.";
      toast.success(successMsg, { description: successDesc });
      await fetchAll();
    } catch (err: any) {
      toast.error("Action impossible", { description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // ⭐ Demander corrections : action directe sans popup
  const handleRequestChanges = async () => {
    // Plus de message global construit à partir des slides
    // L'admin peut envoyer un message via l'icône Messages s'il veut
    await handleAction("request_changes", "");
  };

  const handleReject = async () => {
    const ok = await confirmDialog("Refuser ce projet ?", {
      description: "Le studio devra repartir de zéro. Cette action est définitive.",
      confirmLabel: "Refuser",
      destructive: true,
    });
    if (!ok) return;
    await handleAction("reject", "");
  };

  // ============================================================
  //  Rendering
  // ============================================================

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="animate-spin text-neutral-400" size={28} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-3 text-red-500" size={28} />
          <p className="text-sm text-neutral-700">{error || "Projet introuvable"}</p>
          <Link href="/admin/tenant" className="inline-block mt-4 text-xs font-bold text-orange-600 hover:underline">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  const slides = project.state_json?.slides || [];
  const templateKey = project.state_json?.template || "carrousel_instagram";

  const statusBadge = {
    draft: { label: "Brouillon", color: "bg-neutral-100 text-neutral-700" },
    pending_approval: { label: "En attente", color: "bg-amber-100 text-amber-700" },
    approved: { label: "Approuvé", color: "bg-green-100 text-green-700" },
    rejected: { label: "Refusé", color: "bg-red-100 text-red-700" },
    published: { label: "Publié", color: "bg-blue-100 text-blue-700" },
    archived: { label: "Archivé", color: "bg-neutral-100 text-neutral-500" },
  };

  const canReview = project.status === "pending_approval";

  const okCount = Object.values(slideReviews).filter(r => r.status === "ok").length;
  const needsChangesCount = Object.values(slideReviews).filter(r => r.status === "needs_changes").length;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ⭐ NOUVEAU AppHeader unifié */}
      <AppHeader
        eyebrow="VALIDATION"
        title={project.title}
        backHref="/admin/tenant"
        rightSlot={
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded ${statusBadge[project.status].color}`}>
              {statusBadge[project.status].label}
            </span>
            <ProjectMessagesIcon projectId={projectId} brandColor="#B11E2F" />
          </div>
        }
      />

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* MAIN */}
        <main>
          {/* Infos projet */}
          <section className="bg-white border border-neutral-200 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Studio</div>
                <div className="font-bold text-neutral-900 mt-0.5">{creatorEmail}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Soumis le</div>
                <div className="font-bold text-neutral-900 mt-0.5">
                  {new Date(project.updated_at).toLocaleString("fr-CH")}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Nombre de slides</div>
                <div className="font-bold text-neutral-900 mt-0.5">{slides.length}</div>
              </div>
              {task && (
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Brief lié</div>
                  <div className="font-bold text-neutral-900 mt-0.5 truncate">{task.title}</div>
                </div>
              )}
            </div>

            {task?.brief && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">
                  Brief original
                </div>
                <div className="text-xs text-neutral-700 whitespace-pre-wrap bg-neutral-50 rounded-lg px-3 py-2">
                  {task.brief}
                </div>
              </div>
            )}
          </section>

          {/* Images à valider */}
          {slides.length > 0 && (
            <section className="mb-6">
              <PendingImagesValidation
                projectId={projectId}
                slides={slides}
                brandColor="#B11E2F"
                onImagesValidated={fetchAll}
              />
            </section>
          )}

          {/* Slides avec review */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                Slides du carrousel ({slides.length})
              </h2>
              {canReview && (
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  {okCount > 0 && (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      {okCount} OK
                    </span>
                  )}
                  {needsChangesCount > 0 && (
                    <span className="text-amber-600 flex items-center gap-1">
                      <AlertCircle size={11} />
                      {needsChangesCount} à corriger
                    </span>
                  )}
                </div>
              )}
            </div>
            {slides.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-400">
                Aucune slide dans ce projet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slides.map((slide: any, idx: number) => (
                  <SlideReviewCard
                    key={slide.id || idx}
                    slide={slide}
                    index={idx}
                    config={config}
                    templateKey={templateKey}
                    review={slideReviews[slide.id]}
                    canReview={canReview}
                    onStatusChange={(status) => handleSlideStatusChange(slide.id, status)}
                    onCommentChange={(comment) => handleSlideCommentChange(slide.id, comment)}
                    onCommentBlur={handleSlideCommentBlur}
                  />
                ))}
              </div>
            )}
          </section>
        </main>

        {/* SIDEBAR — Actions uniquement (plus de Discussion) */}
        <aside className="space-y-4">
          {canReview && (
            <section className="bg-white border-2 border-orange-200 rounded-xl p-4 sticky top-24">
              <h3 className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-3">
                Actions
              </h3>

              {needsChangesCount > 0 && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700 flex items-start gap-1.5">
                  <AlertCircle size={11} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>{needsChangesCount}</strong> slide{needsChangesCount > 1 ? "s" : ""} marquée{needsChangesCount > 1 ? "s" : ""} à corriger
                  </span>
                </div>
              )}

              <div className="space-y-2 mb-3">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(true)}
                  disabled={!!actionLoading}
                  className="w-full bg-green-500 hover:bg-green-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <CheckCircle2 size={13} />
                  Approuver
                </button>
                <button
                  type="button"
                  onClick={handleRequestChanges}
                  disabled={!!actionLoading || needsChangesCount === 0}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  title={needsChangesCount === 0 ? "Marque au moins une slide à corriger d'abord" : ""}
                >
                  {actionLoading === "request_changes" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RefreshCcw size={13} />
                  )}
                  Demander corrections
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!!actionLoading}
                  className="w-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  {actionLoading === "reject" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <XCircle size={13} />
                  )}
                  Refuser
                </button>
              </div>

              <div className="text-[10px] text-neutral-500 bg-neutral-50 p-2 rounded">
                💡 Besoin d'ajouter un message au studio ? Utilise l'icône 💬 dans le header.
              </div>
            </section>
          )}

          {!canReview && (
            <section className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-xs text-neutral-500">
                {project.status === "approved" && "Ce projet a déjà été approuvé."}
                {project.status === "rejected" && "Ce projet a été refusé."}
                {project.status === "draft" && "Le studio travaille encore sur ce projet."}
                {project.status === "published" && "Ce projet est publié."}
                {project.status === "archived" && "Ce projet est archivé."}
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* MODAL APPROUVER (message d'encouragement optionnel) */}
      {showApproveModal && (
        <ActionModal
          title="Approuver ce projet ?"
          description="Le studio sera notifié. Message d'encouragement optionnel."
          color="green"
          icon={<CheckCircle2 size={20} />}
          confirmLabel="Approuver"
          onConfirm={(msg) => handleAction("approve", msg)}
          onCancel={() => setShowApproveModal(false)}
          loading={actionLoading === "approve"}
        />
      )}

      {/* ⭐ FEEDBACK WIDGET */}
      <FeedbackWidget />
    </div>
  );
}


// ============================================================
//  SLIDE REVIEW CARD
// ============================================================
function SlideReviewCard({
  slide, index, config, templateKey, review, canReview,
  onStatusChange, onCommentChange, onCommentBlur,
}: {
  slide: any;
  index: number;
  config: any;
  templateKey: string;
  review: SlideReview | undefined;
  canReview: boolean;
  onStatusChange: (status: "ok" | "needs_changes") => void;
  onCommentChange: (comment: string) => void;
  onCommentBlur: () => void;
}) {
  const subVariant = slide.subVariant;
  const scale = 0.27;
  const status = review?.status;
  const showCommentBox = status === "needs_changes";

  const borderClass =
    status === "ok"
      ? "border-green-300 ring-2 ring-green-200"
      : status === "needs_changes"
        ? "border-amber-300 ring-2 ring-amber-200"
        : "border-neutral-200 hover:border-neutral-300";

  return (
    <div className={`bg-white rounded-lg border transition overflow-hidden ${borderClass}`}>
      <div className="px-3 py-2 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
            Slide {index + 1}
          </div>
          <div className="text-[9px] text-neutral-400">{slide.variant}</div>
        </div>
        {status === "ok" && (
          <span className="text-[9px] font-black uppercase tracking-wider text-green-600 flex items-center gap-1">
            <CheckCircle2 size={10} />
            OK
          </span>
        )}
        {status === "needs_changes" && (
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 flex items-center gap-1">
            <AlertCircle size={10} />
            À corriger
          </span>
        )}
      </div>

      <div className="bg-neutral-100 p-3 flex justify-center">
        {config ? (
          <SlideRenderer
            config={config}
            variant={slide.variant}
            subVariant={subVariant}
            inputValues={slide.inputs}
            templateKey={templateKey}
            scale={scale}
          />
        ) : (
          <div className="bg-neutral-200 rounded" style={{ width: 1080 * scale, height: 1350 * scale }} />
        )}
      </div>

      {canReview && (
        <div className="px-3 py-2 border-t border-neutral-100 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onStatusChange("ok")}
              className={`flex-1 text-[10px] font-black uppercase tracking-wider py-2 rounded-lg flex items-center justify-center gap-1 transition ${
                status === "ok"
                  ? "bg-green-500 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-green-50 hover:text-green-700"
              }`}
            >
              <CheckCircle2 size={11} />
              OK
            </button>
            <button
              type="button"
              onClick={() => onStatusChange("needs_changes")}
              className={`flex-1 text-[10px] font-black uppercase tracking-wider py-2 rounded-lg flex items-center justify-center gap-1 transition ${
                status === "needs_changes"
                  ? "bg-amber-500 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-amber-50 hover:text-amber-700"
              }`}
            >
              <AlertCircle size={11} />
              À corriger
            </button>
          </div>

          {showCommentBox && (
            <textarea
              value={review?.comment || ""}
              onChange={(e) => onCommentChange(e.target.value)}
              onBlur={onCommentBlur}
              placeholder="Que faut-il corriger sur cette slide ?"
              rows={2}
              maxLength={500}
              className="w-full px-2 py-1.5 border border-amber-200 bg-amber-50/30 rounded-lg text-[11px] focus:border-amber-400 focus:outline-none resize-none"
            />
          )}
        </div>
      )}

      {!canReview && review?.comment && (
        <div className="px-3 py-2 border-t border-neutral-100 bg-amber-50/30">
          <div className="text-[9px] font-black uppercase tracking-widest text-amber-700 mb-1">
            Feedback admin
          </div>
          <div className="text-[11px] text-amber-900 whitespace-pre-wrap">{review.comment}</div>
        </div>
      )}
    </div>
  );
}


// ============================================================
//  ACTION MODAL (utilisé UNIQUEMENT pour Approuver)
// ============================================================
function ActionModal({
  title, description, color, icon, confirmLabel,
  onConfirm, onCancel, loading,
}: {
  title: string;
  description: string;
  color: "green" | "amber" | "red";
  icon: React.ReactNode;
  confirmLabel: string;
  onConfirm: (message: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [message, setMessage] = useState("");

  const colorClasses = {
    green: "bg-green-500 hover:bg-green-600",
    amber: "bg-amber-500 hover:bg-amber-600",
    red: "bg-red-500 hover:bg-red-600",
  };
  const iconBg = {
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
    red: "bg-red-100 text-red-600",
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg[color]}`}>
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
              <p className="text-xs text-neutral-500 mt-1">{description}</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">
              Message d&apos;encouragement (optionnel)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Bon travail ! Ce sera publié bientôt..."
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none resize-none"
              maxLength={2000}
              autoFocus
            />
          </div>
        </div>

        <div className="px-5 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-white rounded-lg transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(message)}
            disabled={loading}
            className={`${colorClasses[color]} text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50`}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
