// ============================================================
//  VoiceoverPanel — Upload + gestion de la voix-off
//  3 états :
//  1. Pas de voice-off → bouton "Importer voice-off"
//  2. Upload en cours → progress bar
//  3. Voice-off uploadée → player + sliders volume + delete
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Upload,
  Loader2,
  Trash2,
  Volume2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import {
  VideoProject,
  MAX_VOICEOVER_SIZE_BYTES,
  MAX_VOICEOVER_DURATION_SECONDS,
  ACCEPTED_AUDIO_MIME_TYPES,
  DEFAULT_MAIN_VOLUME_WITH_VOICEOVER,
  DEFAULT_MAIN_VOLUME_WITHOUT_VOICEOVER,
  DEFAULT_VOICEOVER_VOLUME,
} from "@/lib/video/types";

type Props = {
  project: VideoProject;
  onProjectUpdated: () => void;
};

const BRAND_BORDEAUX = "#B11E2F";
const VOLUME_SAVE_DEBOUNCE_MS = 800;

export default function VoiceoverPanel({ project, onProjectUpdated }: Props) {
  const voiceoverAudio = project.state_json?.voiceover_audio;
  const audioMix = project.state_json?.audio_mix;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for volume sliders (avec debounced save)
  const [localMainVolume, setLocalMainVolume] = useState(
    audioMix?.main_volume ??
      (voiceoverAudio
        ? DEFAULT_MAIN_VOLUME_WITH_VOICEOVER
        : DEFAULT_MAIN_VOLUME_WITHOUT_VOICEOVER)
  );
  const [localVoiceoverVolume, setLocalVoiceoverVolume] = useState(
    audioMix?.voiceover_volume ?? DEFAULT_VOICEOVER_VOLUME
  );

  // Sync local state quand le projet change (après upload/delete)
  useEffect(() => {
    if (audioMix) {
      setLocalMainVolume(audioMix.main_volume);
      setLocalVoiceoverVolume(audioMix.voiceover_volume);
    }
  }, [audioMix?.main_volume, audioMix?.voiceover_volume]);

  // Debounced save de audio_mix
  useEffect(() => {
    if (!voiceoverAudio || !audioMix) return;
    if (
      localMainVolume === audioMix.main_volume &&
      localVoiceoverVolume === audioMix.voiceover_volume
    ) {
      return;
    }
    const timer = setTimeout(async () => {
      await saveAudioMix(localMainVolume, localVoiceoverVolume);
    }, VOLUME_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMainVolume, localVoiceoverVolume]);

  const saveAudioMix = async (mainVol: number, voVol: number) => {
    try {
      const { error } = await supabase
        .from("studio_video_projects")
        .update({
          state_json: {
            ...project.state_json,
            audio_mix: {
              main_volume: mainVol,
              voiceover_volume: voVol,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id);

      if (error) {
        toast.error("Erreur sauvegarde mix audio", {
          description: error.message,
        });
        return;
      }
      onProjectUpdated();
    } catch (err: any) {
      toast.error("Erreur sauvegarde", { description: err.message });
    }
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        reject(new Error("Impossible de lire la durée du fichier audio"));
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    // Validate MIME
    const acceptedMimes = ACCEPTED_AUDIO_MIME_TYPES as readonly string[];
    if (!acceptedMimes.includes(file.type)) {
      toast.error("Format non supporté", {
        description: "Utilise MP3, WAV ou M4A.",
      });
      return;
    }

    // Validate size
    if (file.size > MAX_VOICEOVER_SIZE_BYTES) {
      const maxMB = Math.round(MAX_VOICEOVER_SIZE_BYTES / 1024 / 1024);
      toast.error("Fichier trop volumineux", {
        description: `Maximum ${maxMB} MB.`,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Get audio duration
      const duration = await getAudioDuration(file);
      if (duration > MAX_VOICEOVER_DURATION_SECONDS) {
        const maxMin = Math.round(MAX_VOICEOVER_DURATION_SECONDS / 60);
        toast.error("Audio trop long", {
          description: `Maximum ${maxMin} minutes.`,
        });
        setIsUploading(false);
        return;
      }

      // Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée", {
          description: "Reconnecte-toi.",
        });
        setIsUploading(false);
        return;
      }

      // Step 1: Request signed upload URL
      setUploadProgress(10);
      const urlRes = await fetch(
        `/api/studio/video/projects/${project.id}/voiceover/upload-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          }),
        }
      );
      const urlData = await urlRes.json();
      if (!urlRes.ok) {
        throw new Error(urlData.error || "Erreur génération URL");
      }

      // Step 2: Upload file to signed URL
      setUploadProgress(25);
      const uploadRes = await fetch(urlData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error(`Erreur upload: ${uploadRes.statusText}`);
      }

      // Step 3: Confirm upload + update state_json
      setUploadProgress(80);
      const confirmRes = await fetch(
        `/api/studio/video/projects/${project.id}/voiceover`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            publicUrl: urlData.publicUrl,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            duration_seconds: duration,
          }),
        }
      );
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(confirmData.error || "Erreur confirmation");
      }

      setUploadProgress(100);
      toast.success("Voice-off ajoutée !", {
        description: `${file.name} (${Math.round(duration)}s)`,
      });
      onProjectUpdated();
    } catch (err: any) {
      toast.error("Erreur upload voice-off", {
        description: err.message || String(err),
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    const ok = await confirmDialog("Supprimer la voix-off ?", {
      description: "Le fichier audio sera définitivement supprimé.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        return;
      }
      const res = await fetch(
        `/api/studio/video/projects/${project.id}/voiceover`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur suppression");
      }
      toast.success("Voice-off supprimée");
      onProjectUpdated();
    } catch (err: any) {
      toast.error("Erreur", { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDuration = (s: number) => {
    const minutes = Math.floor(s / 60);
    const seconds = Math.floor(s % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  // ============================================================
  //  STATE : Upload en cours
  // ============================================================
  if (isUploading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: `${BRAND_BORDEAUX}15`,
              color: BRAND_BORDEAUX,
            }}
          >
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900">
              Upload en cours
            </h3>
            <p className="text-[10px] text-neutral-400 uppercase tracking-widest">
              Voice-off · {uploadProgress}%
            </p>
          </div>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${uploadProgress}%`,
              backgroundColor: BRAND_BORDEAUX,
            }}
          />
        </div>
      </div>
    );
  }

  // ============================================================
  //  STATE : Vide (pas de voice-off)
  // ============================================================
  if (!voiceoverAudio) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: `${BRAND_BORDEAUX}15`,
              color: BRAND_BORDEAUX,
            }}
          >
            <Mic className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-neutral-900">Voice-off</h3>
            <p className="text-[10px] text-neutral-400 uppercase tracking-widest">
              Optionnel — narration externe
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-4 py-6 rounded-xl border-2 border-dashed border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-colors flex flex-col items-center gap-2"
        >
          <Upload className="w-6 h-6 text-neutral-400" />
          <div className="text-xs font-medium text-neutral-700">
            Importer une voix-off
          </div>
          <div className="text-[10px] text-neutral-400">
            MP3, WAV ou M4A — max 50 MB · 10 min
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
          className="hidden"
        />
      </div>
    );
  }

  // ============================================================
  //  STATE : Voice-off uploadée
  // ============================================================
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: `${BRAND_BORDEAUX}15`,
            color: BRAND_BORDEAUX,
          }}
        >
          <Mic className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-neutral-900 truncate">
            {voiceoverAudio.filename}
          </h3>
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest">
            {formatDuration(voiceoverAudio.duration_seconds)} ·{" "}
            {formatBytes(voiceoverAudio.size_bytes)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-2 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
          title="Supprimer la voix-off"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Audio player */}
      <audio
        src={voiceoverAudio.url}
        controls
        className="w-full mb-4"
        preload="metadata"
      />

      {/* Volume sliders */}
      <div className="space-y-3">
        {/* Voice-off volume */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              <Mic className="w-3 h-3" />
              Volume voix-off
            </label>
            <span className="text-[10px] font-bold text-neutral-700 tabular-nums">
              {Math.round(localVoiceoverVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={localVoiceoverVolume}
            onChange={(e) =>
              setLocalVoiceoverVolume(parseFloat(e.target.value))
            }
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${BRAND_BORDEAUX} 0%, ${BRAND_BORDEAUX} ${
                localVoiceoverVolume * 100
              }%, #f3f4f6 ${localVoiceoverVolume * 100}%, #f3f4f6 100%)`,
            }}
          />
        </div>

        {/* Main audio volume */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              <Volume2 className="w-3 h-3" />
              Volume audio original
            </label>
            <span className="text-[10px] font-bold text-neutral-700 tabular-nums">
              {Math.round(localMainVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={localMainVolume}
            onChange={(e) => setLocalMainVolume(parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${BRAND_BORDEAUX} 0%, ${BRAND_BORDEAUX} ${
                localMainVolume * 100
              }%, #f3f4f6 ${localMainVolume * 100}%, #f3f4f6 100%)`,
            }}
          />
        </div>
      </div>

      {/* Replace button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="mt-4 w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition flex items-center justify-center gap-1.5"
      >
        <Upload className="w-3 h-3" />
        Remplacer la voix-off
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
        className="hidden"
      />
    </div>
  );
}