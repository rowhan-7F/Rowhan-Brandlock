"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft, Film, Mic, Music, Layers, Scissors, Sparkles, Subtitles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import StudioHeader from "@/components/StudioHeader";
import VideoDropzone from "@/components/studio/video/VideoDropzone";
import VideoSubsPreview from "@/components/studio/video/VideoSubsPreview";
import MediaTimeline from "@/components/studio/video/MediaTimeline";
import RenderBar from "@/components/studio/video/RenderBar";
import BrandAssetsSelector from "@/components/studio/video/BrandAssetsSelector";
import SourceInfoPanel from "@/components/studio/video/SourceInfoPanel";
import AudioSubsPanel from "@/components/studio/video/AudioSubsPanel";
import MusicPanel from "@/components/studio/video/MusicPanel";
import BrollsPanel from "@/components/studio/video/BrollsPanel";
import VideoSectionAccordion from "@/components/studio/video/VideoSectionAccordion";
import SubtitleEditor from "@/components/studio/video/SubtitleEditor";
import {
  VideoProject,
  VIDEO_MODE_INFO_FULL,
  VIDEO_FORMAT_DIMENSIONS,
} from "@/lib/video/types";
import { formatDuration, formatFileSize } from "@/lib/video/thumbnail";

type UserProfile = { user_id: string; tenant_id: string; role: string };
type Tenant = { tenant_id: string; tenant_name: string };
type Seg = { start: number; end: number; text: string };

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
  const [openSection, setOpenSection] = useState<string | null>("03");
  const [submittingVideo, setSubmittingVideo] = useState(false);

  // Etape 2 : sous-titres editables live
  const [liveSegments, setLiveSegments] = useState<Seg[]>([]);
  const [subSaveStatus, setSubSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const subSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Signed URL pour la video source (bucket prive)
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
            setSignedSourceUrl(null);
          } else if (data?.signedUrl) {
            setSignedSourceUrl(data.signedUrl);
          }
        }
      } catch {
        if (!cancelled) setSignedSourceUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [project?.source_video_url]);

  // Sync liveSegments depuis le projet (au chargement / apres transcription)
  useEffect(() => {
    const segs = Array.isArray((project?.state_json as any)?.transcript?.segments)
      ? ((project!.state_json as any).transcript.segments as Seg[])
      : [];
    setLiveSegments(segs);
  }, [project?.state_json]);

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
        setError("Ce projet a ete archive.");
        setLoading(false);
        return;
      }
      if (projData.source_video_url && projData.source_format) {
        const sourcePath = `${projData.tenant_id}/${projData.id}/source.${projData.source_format}`;
        const { data: signedData } = await supabase.storage
          .from("video-sources")
          .createSignedUrl(sourcePath, 3600);
        if (signedData?.signedUrl) {
          projData.source_video_url = signedData.signedUrl;
        }
      }
      setProject(projData as VideoProject);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
        description: wasResubmit ? "L admin recevra la nouvelle version" : "L admin va etre notifie",
      });
      loadAll();
    } catch (err: any) {
      toast.error("Soumission impossible", { description: err.message });
    } finally {
      setSubmittingVideo(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const handleLogoutVideo = useCallback(async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  const handleExportVideo = useCallback(async () => {
    if (!project) return;
    if (project.status !== "completed") {
      toast.error("Pas encore rendu", { description: "Lance un rendu avant d exporter." });
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

  // Sauvegarde debounced des segments (sous-titres)
  const saveSegments = useCallback(async (segs: Seg[]) => {
    if (!project) return;
    setSubSaveStatus("saving");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expiree");
      const newStateJson = {
        ...((project.state_json as any) || {}),
        transcript: {
          ...(((project.state_json as any) || {}).transcript || {}),
          segments: segs,
          edited: segs.map((s) => s.text).join(" "),
          edited_at: new Date().toISOString(),
        },
      };
      const res = await fetch(`/api/studio/video/projects/${project.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ state_json: newStateJson }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setSubSaveStatus("saved");
      setTimeout(() => setSubSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (err: any) {
      setSubSaveStatus("error");
      toast.error("Erreur sauvegarde sous-titres", { description: err.message });
    }
  }, [project]);

  const handleSegmentsChange = (segs: Seg[]) => {
    setLiveSegments(segs);
    if (subSaveTimer.current) clearTimeout(subSaveTimer.current);
    subSaveTimer.current = setTimeout(() => saveSegments(segs), 1200);
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
        <div className="text-base font-bold text-neutral-900">{error || "Erreur inconnue"}</div>
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

  const sj: any = project.state_json || {};
  const hasTranscript = liveSegments.length > 0;
  const hasVoiceover = !!sj.voiceover_audio;
  const brollsCount = Array.isArray(sj.brolls) ? sj.brolls.length : 0;
  const hasMusic = !!sj.music_audio;
  const hasIntroOutro = !!sj.intro_id || !!sj.outro_id;
  const isDraft = project.status === "draft" || !project.source_video_url;
  const isReadOnly = project.status === "approved" || project.status === "archived";

  const toggle = (k: string) => setOpenSection((p) => (p === k ? null : k));
  const previewMaxW = project.format === "9_16" ? "360px" : project.format === "1_1" ? "480px" : "720px";

  return (
    <div className="h-screen flex flex-col bg-neutral-50 overflow-hidden">
      <StudioHeader
        backHref="/studio"
        eyebrowMain="STUDIO"
        eyebrowSubtitle={tenant?.tenant_name || ""}
        title={project.title || ""}
        editableTitle={{
          endpoint: `/api/studio/video/projects/${project.id}`,
          onUpdated: () => loadAll(),
        }}
        statusBadge={project.status as any}
        showStudioMenu={true}
        tenantId={profile?.tenant_id || null}
        showMessages={true}
        messagesProjectType="video"
        projectId={project.id}
        showNotifications={true}
        exportAction={{
          onClick: handleExportVideo,
          disabled: project.status !== "completed",
          title: project.status === "completed" ? "Telecharger le MP4" : "Lance un rendu d abord",
        }}
        submitAction={{
          onClick: handleSubmitVideo,
          status: project.status as any,
          submitting: submittingVideo,
          disabled: !project.source_video_url,
        }}
        showLogout={true}
        onLogout={handleLogoutVideo}
      />

      {isDraft ? (
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold text-neutral-900">Upload de la source</h2>
              <p className="text-sm text-neutral-500 mt-1">{modeInfo?.description}</p>
            </div>
            <VideoDropzone
              projectId={project.id}
              tenantId={project.tenant_id}
              format={project.format}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-[340px] border-r border-neutral-200 bg-white overflow-y-auto flex flex-col shrink-0">
            <div className="px-5 py-4 border-b border-neutral-200 sticky top-0 bg-white z-10">
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Montage</div>
              <div className="text-sm font-bold text-neutral-900 mt-0.5">Options video</div>
            </div>
            {isReadOnly && (
              <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 text-center">
                Projet approuve - lecture seule
              </div>
            )}
            <div className="flex-1 px-3 py-3 space-y-2">
              <VideoSectionAccordion number="01" title="Intro / Outro" icon={<Scissors size={13} />} subtitle={hasIntroOutro ? "Configure" : "Optionnel"} done={hasIntroOutro} isOpen={openSection === "01"} onToggle={() => toggle("01")}>
                <BrandAssetsSelector project={project} onSaved={loadAll} />
              </VideoSectionAccordion>

              <VideoSectionAccordion number="02" title="Source" icon={<Film size={13} />} subtitle={`${dims.label} - ${project.source_duration_seconds ? formatDuration(project.source_duration_seconds) : "--"}`} done={!!project.source_video_url} isOpen={openSection === "02"} onToggle={() => toggle("02")}>
                <div className="space-y-1.5 mb-3">
                  <SourceDetailRow label="Mode" value={modeInfo?.label} />
                  <SourceDetailRow label="Format" value={`${dims.width}x${dims.height} (${dims.label})`} />
                  {project.source_duration_seconds ? <SourceDetailRow label="Duree" value={formatDuration(project.source_duration_seconds)} /> : null}
                  {project.source_dimensions ? <SourceDetailRow label="Dimensions" value={`${project.source_dimensions.width}x${project.source_dimensions.height}${project.source_dimensions.width !== dims.width ? "  (ratio different)" : ""}`} /> : null}
                  {project.source_size_bytes ? <SourceDetailRow label="Taille" value={formatFileSize(project.source_size_bytes)} /> : null}
                </div>
                <SourceInfoPanel project={project} onProjectUpdated={loadAll} />
              </VideoSectionAccordion>

              <VideoSectionAccordion number="03" title={hasTranscript ? "Sous-titres" : "Audio & sous-titres"} icon={hasTranscript ? <Subtitles size={13} /> : <Mic size={13} />} subtitle={hasTranscript ? `${liveSegments.length} segments` : hasVoiceover ? "Voix-off ajoutee" : "Non transcrit"} done={hasTranscript} isOpen={openSection === "03"} onToggle={() => toggle("03")}>
                <AudioSubsPanel project={project} onProjectUpdated={loadAll} />
              </VideoSectionAccordion>

              <VideoSectionAccordion number="04" title="Musique" icon={<Music size={13} />} subtitle={hasMusic ? "Ajoutee" : "Optionnel"} done={hasMusic} isOpen={openSection === "04"} onToggle={() => toggle("04")}>
                <MusicPanel project={project} onProjectUpdated={loadAll} />
              </VideoSectionAccordion>

              <VideoSectionAccordion number="05" title="Elements" icon={<Layers size={13} />} subtitle={`${brollsCount} element${brollsCount > 1 ? "s" : ""}`} done={brollsCount > 0} isOpen={openSection === "05"} onToggle={() => toggle("05")}>
                <BrollsPanel project={project} onProjectUpdated={loadAll} />
              </VideoSectionAccordion>

              <VideoSectionAccordion number="06" title="Rendu final" icon={<Sparkles size={13} />} subtitle={project.status === "completed" ? "Video prete" : hasTranscript ? "Pret a rendre" : "Sous-titres requis"} done={project.status === "completed"} isOpen={openSection === "06"} onToggle={() => toggle("06")}>
                <RenderBar project={project} onProjectUpdated={loadAll} />
              </VideoSectionAccordion>
            </div>
          </aside>

          <main className="flex-1 overflow-auto p-6 bg-neutral-100">
            <div className="mx-auto" style={{ maxWidth: previewMaxW }}>
              <VideoSubsPreview
                videoUrl={signedSourceUrl}
                segments={liveSegments as any}
                format={project.format}
                externalVideoRef={videoPreviewRef}
              />
            </div>
            <div className="mt-6 max-w-[920px] mx-auto">
              <MediaTimeline project={project} videoRef={videoPreviewRef} segments={liveSegments} onSegmentsChange={handleSegmentsChange} readOnly={isReadOnly} onProjectUpdated={loadAll} />
            </div>
          </main>

          <aside className="w-[340px] border-l border-neutral-200 bg-white overflow-y-auto flex flex-col shrink-0">
            <div className="px-5 py-4 border-b border-neutral-200 sticky top-0 bg-white z-10 flex items-center gap-2">
              <Subtitles size={14} className="text-neutral-500" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Sous-titres</div>
                <div className="text-sm font-bold text-neutral-900 mt-0.5">{liveSegments.length} segment{liveSegments.length > 1 ? "s" : ""}</div>
              </div>
            </div>
            <div className="flex-1 px-3 py-3">
              <SubtitleEditor
                segments={liveSegments}
                onChange={handleSegmentsChange}
                readOnly={isReadOnly}
                saveStatus={subSaveStatus}
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function SourceDetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 shrink-0">{label}</span>
      <span className="text-xs font-bold text-neutral-900 text-right">{value || "--"}</span>
    </div>
  );
}