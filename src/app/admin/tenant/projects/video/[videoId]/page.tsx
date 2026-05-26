"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, CheckCircle2, XCircle, RefreshCcw, RotateCcw, Play,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import StudioHeader from "@/components/StudioHeader";
import FeedbackWidget from "@/components/FeedbackWidget";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";

// ============================================================
//  TYPES
// ============================================================

type VideoProject = {
  id: string;
  title: string | null;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "published" | "archived" | "completed";
  tenant_id: string;
  source_video_url: string | null;
  source_format: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// ============================================================
//  PAGE
// ============================================================

export default function AdminVideoReviewPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = use(params);
  const router = useRouter();

  // === State === (MIRROIR carousel)
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<VideoProject | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [creatorEmail, setCreatorEmail] = useState<string>("");
  const [signedSourceUrl, setSignedSourceUrl] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRequestChangesModal, setShowRequestChangesModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // === Fetch all (MIRROIR carousel) ===
  const fetchAll = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      // 1. Project
      const { data: proj, error: projErr } = await supabase
        .from("studio_video_projects")
        .select("*")
        .eq("id", videoId)
        .maybeSingle();

      if (projErr || !proj) {
        toast.error("Projet introuvable");
        router.push("/admin/tenant");
        return;
      }

      setProject(proj as VideoProject);

      // 2. Creator email
      if (proj.created_by) {
        const { data: creator } = await supabase
          .from("user_profiles")
          .select("email")
          .eq("user_id", proj.created_by)
          .maybeSingle();
        setCreatorEmail(creator?.email || "Inconnu");
      }

      // 3. Tenant config (pour avoir tenant.name)
      const { data: cfg } = await supabase
        .from("tenant_configs")
        .select("config_json")
        .eq("tenant_id", proj.tenant_id)
        .maybeSingle();
      setConfig(cfg?.config_json || null);

    } catch (err: any) {
      console.error("[AdminVideoReview] fetch error:", err);
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [videoId, router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // === Generer signed URL pour la video source (MIRROIR studio) ===
  useEffect(() => {
    if (!project?.source_video_url) {
      setSignedSourceUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(project.source_video_url!);
        const pathParts = url.pathname.split("/video-sources/");
        if (pathParts.length !== 2) {
          setSignedSourceUrl(project.source_video_url || null);
          return;
        }
        const path = decodeURIComponent(pathParts[1]);
        const { data, error } = await supabase.storage
          .from("video-sources")
          .createSignedUrl(path, 3600);
        if (!cancelled) {
          if (error) {
            console.warn("[signed URL] error:", error.message);
            setSignedSourceUrl(null);
          } else if (data?.signedUrl) {
            setSignedSourceUrl(data.signedUrl);
          }
        }
      } catch (err: any) {
        console.warn("[signed URL] parsing error:", err?.message);
        if (!cancelled) setSignedSourceUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [project?.source_video_url]);

  // === Logout handler ===
  const handleLogout = async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Vous serez redirige vers la page d'accueil.",
    });
    if (!ok) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  // === Action handlers ===
  const handleAction = async (
    action: "approve" | "reject" | "request_changes" | "unapprove",
    message: string
  ) => {
    setActionLoading(action);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/studio/video/projects/${videoId}/review`, {
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
      setShowRequestChangesModal(false);
      setShowRejectModal(false);
      const successMsg =
        action === "approve" ? "Projet approuvé ✓"
        : action === "reject" ? "Projet refusé"
        : action === "unapprove" ? "Projet remis en attente"
        : "Corrections demandées ✓";
      const successDesc =
        action === "approve" ? "Le studio est notifié."
        : action === "reject" ? "Le studio en est informé."
        : action === "unapprove" ? "Le projet repasse en pending."
        : "Le studio peut maintenant retravailler.";
      toast.success(successMsg, { description: successDesc });
      await fetchAll();
    } catch (err: any) {
      toast.error("Action impossible", { description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestChanges = async (msg: string) => {
    await handleAction("request_changes", msg);
  };

  const handleReject = async (msg: string) => {
    await handleAction("reject", msg);
  };

  const handleUnapprove = async () => {
    const ok = await confirmDialog("Annuler l'approbation de cette video ?", {
      description: "La video repassera en 'À valider'. Le studio sera notifié.",
      confirmLabel: "Annuler l'approbation",
    });
    if (!ok) return;
    await handleAction("unapprove", "");
  };

  // === Render ===
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const canReview = project.status === "pending_approval";

  // Durée formatée
  const duration = project.duration_seconds
    ? `${Math.floor(project.duration_seconds / 60)}:${String(Math.floor(project.duration_seconds % 60)).padStart(2, "0")}`
    : "—";

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* HEADER (MIRROIR carousel) */}
      <StudioHeader
        backHref="/admin/tenant"
        eyebrowMain="VALIDATION"
        eyebrowSubtitle={config?.tenant?.name || ""}
        title={project.title || "Vidéo sans titre"}
        statusBadge={project.status as any}
        showMessages={true}
        messagesProjectType="video"
        projectId={videoId}
        showNotifications={true}
        showLogout={true}
        onLogout={handleLogout}
      />

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* ═══════════════════════════════════════════════════════ */}
        {/* MAIN (MIRROIR carousel)                                  */}
        {/* ═══════════════════════════════════════════════════════ */}
        <main>
          {/* Infos projet (MIRROIR carousel) */}
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
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Durée</div>
                <div className="font-bold text-neutral-900 mt-0.5">{duration}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Format</div>
                <div className="font-bold text-neutral-900 mt-0.5">{project.source_format || "—"}</div>
              </div>
            </div>
          </section>

          {/* Player video */}
          <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="aspect-video bg-black relative">
              {signedSourceUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={signedSourceUrl}
                    controls
                    playsInline
                    className="w-full h-full"
                    poster={project.thumbnail_url || undefined}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onClick={(e) => {
                      // Click sur la video : toggle play/pause
                      const v = e.currentTarget;
                      if (v.paused) v.play(); else v.pause();
                    }}
                  />
                  {!isPlaying && (
                    <button
                      type="button"
                      onClick={() => videoRef.current?.play()}
                      className="absolute inset-0 flex items-center justify-center group cursor-pointer bg-black/0 hover:bg-black/10 transition-colors"
                      aria-label="Lire la video"
                    >
                      <div className="w-20 h-20 rounded-full bg-white/95 shadow-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play size={32} className="text-neutral-900 ml-1" strokeWidth={2.5} fill="currentColor" />
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-300">
                  <div className="text-center">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                    <p className="text-xs">Chargement de la vidéo...</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SIDEBAR — Actions (MIRROIR carousel)                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        <aside className="space-y-4">
          {canReview && (
            <section className="bg-white border-2 border-orange-200 rounded-xl p-4 sticky top-24">
              <h3 className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-3">
                Actions
              </h3>

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
                  onClick={() => setShowRequestChangesModal(true)}
                  disabled={!!actionLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50"
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
                  onClick={() => setShowRejectModal(true)}
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

              <p className="text-[10px] text-neutral-500 leading-relaxed">
                💡 Besoin d'ajouter un message au studio ? Utilise l'icône 💬 dans le header.
              </p>
            </section>
          )}

          {!canReview && (
            <section className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-xs text-neutral-500">
                {project.status === "approved" && "Cette vidéo a déjà été approuvée."}
                {project.status === "rejected" && "Cette vidéo a été refusée."}
                {project.status === "draft" && "Le studio travaille encore sur cette vidéo."}
                {project.status === "published" && "Cette vidéo est publiée."}
                {project.status === "archived" && "Cette vidéo est archivée."}
                {project.status === "completed" && "Cette vidéo est complétée."}
              </div>

              {project.status === "approved" && (
                <button
                  type="button"
                  onClick={handleUnapprove}
                  disabled={actionLoading === "unapprove"}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition disabled:opacity-50"
                  style={{
                    backgroundColor: "white",
                    border: "1.5px solid #F59E0B",
                    color: "#B45309",
                  }}
                >
                  <RotateCcw size={14} strokeWidth={2.5} />
                  {actionLoading === "unapprove" ? "Annulation..." : "Annuler l'approbation"}
                </button>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* MODAL APPROUVER */}
      {showApproveModal && (
        <ActionModal
          title="Approuver cette vidéo ?"
          description="Le studio sera notifié. Message d'encouragement optionnel."
          color="green"
          icon={<CheckCircle2 size={20} />}
          confirmLabel="Approuver"
          confirmColor="bg-emerald-500 hover:bg-emerald-600"
          onConfirm={(msg) => handleAction("approve", msg)}
          onCancel={() => setShowApproveModal(false)}
          loading={actionLoading === "approve"}
        />
      )}

      {/* MODAL DEMANDER CORRECTIONS */}
      {showRequestChangesModal && (
        <ActionModal
          title="Demander des corrections ?"
          description="Message explicatif pour le studio."
          color="amber"
          icon={<RefreshCcw size={20} />}
          confirmLabel="Envoyer"
          confirmColor="bg-amber-500 hover:bg-amber-600"
          requireMessage
          onConfirm={(msg) => handleRequestChanges(msg)}
          onCancel={() => setShowRequestChangesModal(false)}
          loading={actionLoading === "request_changes"}
        />
      )}

      {/* MODAL REFUSER */}
      {showRejectModal && (
        <ActionModal
          title="Refuser cette vidéo ?"
          description="Le studio devra repartir de zéro. Message obligatoire."
          color="red"
          icon={<XCircle size={20} />}
          confirmLabel="Refuser"
          confirmColor="bg-red-500 hover:bg-red-600"
          requireMessage
          onConfirm={(msg) => handleReject(msg)}
          onCancel={() => setShowRejectModal(false)}
          loading={actionLoading === "reject"}
        />
      )}

      <FeedbackWidget />
    </div>
  );
}

// ============================================================
//  ACTION MODAL (reusable)
// ============================================================

function ActionModal({
  title, description, color, icon, confirmLabel, confirmColor,
  requireMessage = false, onConfirm, onCancel, loading,
}: {
  title: string;
  description: string;
  color: "green" | "amber" | "red";
  icon: React.ReactNode;
  confirmLabel: string;
  confirmColor: string;
  requireMessage?: boolean;
  onConfirm: (message: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [message, setMessage] = useState("");
  const canConfirm = !requireMessage || message.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            color === "green" ? "bg-emerald-100 text-emerald-600"
            : color === "amber" ? "bg-amber-100 text-amber-600"
            : "bg-red-100 text-red-600"
          }`}>
            {icon}
          </div>
          <div>
            <h2 className="text-base font-bold">{title}</h2>
            <p className="text-xs text-neutral-500">{description}</p>
          </div>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={requireMessage ? "Votre message (obligatoire)" : "Message optionnel"}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none"
        />

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-600 hover:bg-neutral-100 rounded-lg disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(message.trim())}
            disabled={!canConfirm || loading}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-lg transition disabled:opacity-50 ${confirmColor}`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
