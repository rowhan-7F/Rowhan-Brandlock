// ============================================================
//  Page éditeur vidéo /studio/video/[id]
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft, Film, Sparkles, Clock, CheckCircle2, AlertCircle, Download, Send, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import AppHeader from "@/components/AppHeader";
import StudioMenu from "@/components/studio/StudioMenu";
import NotificationsBell from "@/components/NotificationsBell";
import ProjectMessagesIcon from "@/components/ProjectMessagesIcon";
import EditableProjectTitle from "@/components/studio/EditableProjectTitle";
import VideoDropzone from "@/components/studio/video/VideoDropzone";
import TranscriptPanel from "@/components/studio/video/TranscriptPanel";
import RenderPanel from "@/components/studio/video/RenderPanel";
import VoiceoverPanel from "@/components/studio/video/VoiceoverPanel";
import BrollsPanel from "@/components/studio/video/BrollsPanel";
import AudioSubsPanel from "@/components/studio/video/AudioSubsPanel";
import SourceInfoPanel from "@/components/studio/video/SourceInfoPanel";
import MusicPanel from "@/components/studio/video/MusicPanel";
import VideoSubsPreview from "@/components/studio/video/VideoSubsPreview";
import BrollsTimeline from "@/components/studio/video/BrollsTimeline";
import RenderBar from "@/components/studio/video/RenderBar";
import StudioActionsSidebar, { ActionKey } from "@/components/studio/video/StudioActionsSidebar";
import StudioDrawer from "@/components/studio/video/StudioDrawer";
import {
  VideoProject,
  VIDEO_MODE_INFO,
  VIDEO_MODE_INFO_FULL,
  VIDEO_FORMAT_DIMENSIONS,
} from "@/lib/video/types";
import { formatDuration, formatFileSize } from "@/lib/video/thumbnail";

type UserProfile = {
  user_id: string;
  tenant_id: string;
  role: string;
};

type Tenant = {
  tenant_id: string;
  tenant_name: string;
};

export default function StudioVideoPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<VideoProject | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [signedSourceUrl, setSignedSourceUrl] = useState<string | null>(null);
  // Phase 12.D : generer signed URL pour la video source (bucket prive)
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
          // URL pas standard, on essaie d'utiliser directement
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
  const [activeDrawer, setActiveDrawer] = useState<ActionKey | null>(null);

  const loadAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profileData, error: profileErr } = await supabase
        .from("user_profiles")
        .select("user_id, tenant_id, role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileErr || !profileData) {
        setError("Profil introuvable");
        setLoading(false);
        return;
      }

      if (profileData.role === "tenant_admin") {
        router.replace("/admin/tenant");
        return;
      }

      setProfile(profileData as UserProfile);

      if (profileData.tenant_id) {
        const { data: tenantData } = await supabase
          .from("tenant_configs")
          .select("tenant_id, tenant_name")
          .eq("tenant_id", profileData.tenant_id)
          .maybeSingle();
        if (tenantData) setTenant(tenantData as Tenant);
      }

      const { data: projData, error: projErr } = await supabase
        .from("studio_video_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (projErr || !projData) {
        setError("Projet introuvable");
        setLoading(false);
        return;
      }

      if (projData.archived_at) {
        setError("Ce projet a été archivé.");
        setLoading(false);
        return;
      }

      // ⭐ Génère une signed URL temporaire (1h) pour lire la vidéo du bucket privé
      if (projData.source_video_url && projData.source_format) {
        const sourcePath = `${projData.tenant_id}/${projData.id}/source.${projData.source_format}`;
        const { data: signedData } = await supabase.storage
          .from("video-sources")
          .createSignedUrl(sourcePath, 3600); // 1h

        if (signedData?.signedUrl) {
          projData.source_video_url = signedData.signedUrl;
        }
      }

      setProject(projData as VideoProject);
      setLoading(false);
    } catch (err: any) {
      console.error("[/studio/video/[id]] load error:", err);
      setError(err.message || "Erreur de chargement");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Phase 12 peaufinage #6+7 : Handlers header video (submit / logout / export)
  const [submittingVideo, setSubmittingVideo] = useState(false);

  const handleSubmitVideo = useCallback(async () => {
    if (!project) return;
    if (!project.source_video_url) {
      toast.error("Aucune source video", { description: "Uploadez la source avant de soumettre." });
      return;
    }
    setSubmittingVideo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expiree, reconnecte-toi");
        return;
      }
      const res = await fetch(`/api/studio/video/projects/${project.id}/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur soumission");
      const wasResubmit = project.status === "pending_approval";
      toast.success(wasResubmit ? "Version mise a jour" : "Projet soumis", {
        description: wasResubmit ? "L\u0027admin recevra la nouvelle version" : "L\u0027admin va etre notifie",
      });
      loadAll();
    } catch (err: any) {
      toast.error("Soumission impossible", { description: err.message });
    } finally {
      setSubmittingVideo(false);
    }
  }, [project]);

  const handleLogoutVideo = useCallback(async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d\u0027accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  const handleExportVideo = useCallback(async () => {
    if (!project) return;
    if (project.status !== "completed") {
      toast.error("Pas encore rendu", { description: "Lance un rendu avant d\u0027exporter." });
      return;
    }
    try {
      const path = project.tenant_id + "/" + project.id + "/final.mp4";
      const { data } = await supabase.storage
        .from("video-exports")
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = (project.title || "video") + ".mp4";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Telechargement lance");
      } else {
        toast.error("Fichier introuvable");
      }
    } catch (err: any) {
      toast.error("Export impossible", { description: err.message });
    }
  }, [project]);

  const handleUploadComplete = async () => {
    await loadAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 size={28} className="text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (error || !project || !profile) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-4">
        <div className="text-base font-bold text-neutral-900">
          {error || "Erreur inconnue"}
        </div>
        <button
          type="button"
          onClick={() => router.push("/studio")}
          className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-700 transition flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          Retour au studio
        </button>
      </div>
    );
  }

  const modeInfo = VIDEO_MODE_INFO_FULL[project.mode];
  const dims = VIDEO_FORMAT_DIMENSIONS[project.format];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Phase 12 peaufinage #6+7 : Header custom luxury */}
      <header className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href="/studio" className="text-neutral-400 hover:text-neutral-700 transition shrink-0" title="Retour au studio">
            <ArrowLeft size={18} />
          </Link>
          <Link href="/" className="flex items-center gap-2 shrink-0 group" title="Accueil">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "#B11E2F" }}>
              <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" fill="#B11E2F" rx="3" />
                <rect x="13" y="7" width="6" height="18" fill="white" />
                <rect x="7" y="13" width="18" height="6" fill="white" />
              </svg>
            </div>
          </Link>
          <div className="h-7 w-px bg-neutral-200 shrink-0 hidden sm:block" />
          <div className="hidden md:block shrink-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#B11E2F]">STUDIO</div>
            <div className="text-[10px] text-neutral-400 -mt-0.5">Video {modeInfo.label} - {dims.width}x{dims.height}</div>
          </div>
          <div className="h-7 w-px bg-neutral-200 shrink-0 hidden md:block" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <EditableProjectTitle
                title={project.title || ""}
                endpoint={`/api/studio/video/projects/${project.id}`}
                onUpdated={() => loadAll()}
              />
              {project.status === "pending_approval" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-black uppercase tracking-widest text-amber-700 shrink-0">
                  <Clock size={9} />
                  En attente de validation
                </span>
              )}
              {project.status === "approved" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded text-[9px] font-black uppercase tracking-widest text-green-700 shrink-0">
                  <CheckCircle2 size={9} />
                  Approuve
                </span>
              )}
              {project.status === "rejected" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded text-[9px] font-black uppercase tracking-widest text-red-700 shrink-0">
                  <AlertCircle size={9} />
                  A retravailler
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              {project.status === "completed" ? "Video rendue" : project.status === "transcribed" ? "Transcription prete" : project.status === "uploaded" ? "Source uploadee" : "Brouillon"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StudioMenu active="projects" tenantId={profile?.tenant_id || null} />
          <ProjectMessagesIcon projectId={project.id} brandColor="#B11E2F" />
          <NotificationsBell brandColor="#B11E2F" />
          <button
            onClick={handleExportVideo}
            disabled={project.status !== "completed"}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title={project.status === "completed" ? "Telecharger la video MP4" : "Lance d'abord un rendu"}
          >
            <Download size={13} />
            Exporter
          </button>
          {(() => {
            const isPending = project.status === "pending_approval";
            const isApproved = project.status === "approved";
            const isRejected = project.status === "rejected";
            const cfg = isApproved
              ? { label: "Approuve", bgColor: "#16a34a", disabled: true, title: "Approuve" }
              : isPending
              ? { label: "Re-soumettre", bgColor: "#f59e0b", disabled: false, title: "Mettre a jour" }
              : isRejected
              ? { label: "Re-soumettre", bgColor: "#B11E2F", disabled: false, title: "Nouvelle version" }
              : { label: "Soumettre", bgColor: "#B11E2F", disabled: false, title: "Soumettre pour validation" };
            return (
              <button
                onClick={handleSubmitVideo}
                disabled={submittingVideo || cfg.disabled || !project.source_video_url}
                title={cfg.title}
                className="text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: cfg.bgColor }}
              >
                {submittingVideo ? <Loader2 size={12} className="animate-spin" /> : isApproved ? <CheckCircle2 size={12} /> : <Send size={12} />}
                {submittingVideo ? "..." : cfg.label}
              </button>
            );
          })()}
          <div className="border-l border-neutral-200 pl-3 ml-1">
            <button
              type="button"
              onClick={handleLogoutVideo}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition group"
              title="Se deconnecter"
              aria-label="Deconnexion"
            >
              <LogOut size={15} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {project.status === "draft" && (
          <div className="space-y-6">
            <div className="text-center max-w-md mx-auto">
              <div className="text-3xl mb-2">{(() => { const I = modeInfo?.icon; return I ? <I size={16} /> : null; })()}</div>
              <h2 className="text-lg font-bold text-neutral-900">
                Upload de la source
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                {modeInfo.description}
              </p>
            </div>

            <VideoDropzone
              projectId={project.id}
              tenantId={project.tenant_id}
              format={project.format}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        )}

        {project.status !== "draft" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-neutral-200 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

                                <div className="bg-neutral-900 p-4 flex items-center justify-center" style={{ minHeight: "300px" }}>
                  <div className="w-full" style={{ maxWidth: project.format === "9_16" ? "400px" : project.format === "1_1" ? "500px" : "100%" }}>
                    <VideoSubsPreview
                      videoUrl={signedSourceUrl}
                      segments={(project.state_json?.transcript?.segments as any) || []}
                      format={project.format}
                      externalVideoRef={videoPreviewRef}
                    />
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                      Mode
                    </div>
                    <div className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <span className="text-lg">{(() => { const I = modeInfo?.icon; return I ? <I size={16} /> : null; })()}</span>
                      {modeInfo.label}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                      Format
                    </div>
                    <div className="text-sm font-bold text-neutral-900">
                      {dims.width}×{dims.height} ({dims.label})
                    </div>
                  </div>

                  {project.source_duration_seconds && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                        Durée
                      </div>
                      <div className="text-sm font-bold text-neutral-900">
                        {formatDuration(project.source_duration_seconds)}
                      </div>
                    </div>
                  )}

                  {project.source_dimensions && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                        Dimensions source
                      </div>
                      <div className="text-sm font-bold text-neutral-900">
                        {project.source_dimensions.width}×{project.source_dimensions.height}
                        {project.source_dimensions.width !== dims.width && (
                          <span className="ml-2 text-[10px] text-amber-600 font-normal">
                            ⚠ ratio différent du format cible
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {project.source_size_bytes && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                        Taille
                      </div>
                      <div className="text-sm font-bold text-neutral-900">
                        {formatFileSize(project.source_size_bytes)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* ⭐ Phase 12 — Timeline visuelle des b-rolls */}
            <BrollsTimeline
              project={project}
              videoRef={videoPreviewRef}
              onProjectUpdated={loadAll}
            />

            {/* ⭐ Phase 12 — Boutons rendu/telechargement sous la timeline */}
            <RenderBar
              project={project}
              onProjectUpdated={loadAll}
            />

            {/* ⭐ Phase 12 — Sidebar + Drawer luxury (panels en slide-in) */}
            <StudioActionsSidebar
              project={project}
              active={activeDrawer}
              onSelect={(key) => setActiveDrawer((prev) => (prev === key ? null : key))}
            />

            {/* ⭐ Phase 12.D - 4 drawers reorganises */}
            <StudioDrawer
              isOpen={activeDrawer === "source"}
              onClose={() => setActiveDrawer(null)}
              eyebrow="01 - SOURCE"
              title="Video source"
            >
              <SourceInfoPanel project={project} onProjectUpdated={loadAll} />
            </StudioDrawer>

            <StudioDrawer
              isOpen={activeDrawer === "audio"}
              onClose={() => setActiveDrawer(null)}
              eyebrow="02 - AUDIO & SUBS"
              title="Voix-off et transcription"
            >
              <AudioSubsPanel project={project} onProjectUpdated={loadAll} />
            </StudioDrawer>

            <StudioDrawer
              isOpen={activeDrawer === "brolls"}
              onClose={() => setActiveDrawer(null)}
              eyebrow="03 - B-ROLLS"
              title="B-Rolls"
            >
              <BrollsPanel project={project} onProjectUpdated={loadAll} />
            </StudioDrawer>

            <StudioDrawer
              isOpen={activeDrawer === "music"}
              onClose={() => setActiveDrawer(null)}
              eyebrow="04 - MUSIQUE"
              title="Musique de fond"
            >
              <MusicPanel project={project} onProjectUpdated={loadAll} />
            </StudioDrawer>

          </div>
        )}
      </main>
    </div>
  );
}
