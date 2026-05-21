// ============================================================
//  Page éditeur vidéo /studio/video/[id]
//  - Si status === 'draft' → affiche la dropzone d'upload
//  - Sinon → preview + placeholder éditeur "Phase 2+"
//  Inclut le route guard : redirige tenant_admin vers /admin/tenant
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft, Film, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";
import VideoDropzone from "@/components/studio/video/VideoDropzone";
import {
  VideoProject,
  VIDEO_MODE_INFO,
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

      // ⛔ ROUTE GUARD : tenant_admin redirigé hors du studio
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

  const modeInfo = VIDEO_MODE_INFO[project.mode];
  const dims = VIDEO_FORMAT_DIMENSIONS[project.format];

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader
  backHref="/studio"
  eyebrow={`STUDIO · VIDÉO · ${modeInfo.label.toUpperCase()} · ${dims.width}×${dims.height}`}
  title={project.title}
/>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {project.status === "draft" && (
          <div className="space-y-6">
            <div className="text-center max-w-md mx-auto">
              <div className="text-3xl mb-2">{modeInfo.icon}</div>
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

                <div className="bg-neutral-900 flex items-center justify-center p-4">
                  {project.source_video_url ? (
                    <video
                      src={project.source_video_url}
                      controls
                      className="w-full max-h-[60vh] rounded-lg"
                      style={{
                        aspectRatio:
                          project.format === "9_16"
                            ? "9/16"
                            : project.format === "1_1"
                            ? "1/1"
                            : "16/9",
                      }}
                    />
                  ) : (
                    <div className="text-neutral-500 text-sm">Pas de source</div>
                  )}
                </div>

                <div className="p-6 space-y-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                      Mode
                    </div>
                    <div className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <span className="text-lg">{modeInfo.icon}</span>
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

            <div className="bg-gradient-to-br from-[#B11E2F]/5 to-amber-50 border-2 border-dashed border-[#B11E2F]/30 rounded-2xl p-8 text-center">
              <Sparkles size={32} className="text-[#B11E2F] mx-auto mb-3" />
              <h3 className="text-base font-bold text-neutral-900 mb-1">
                Éditeur vidéo en préparation
              </h3>
              <p className="text-xs text-neutral-600 max-w-md mx-auto">
                La transcription Whisper, la composition (b-rolls, intros/outros) et le rendu final
                arrivent dans les prochaines phases du module vidéo.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                <Film size={11} />
                Phase 1 : Scaffolding ✓
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}