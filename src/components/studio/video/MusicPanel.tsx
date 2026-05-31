"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Upload, Loader2, Trash2, Volume2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import {
  VideoProject,
  MAX_MUSIC_SIZE_BYTES,
  MAX_MUSIC_DURATION_SECONDS,
  ACCEPTED_AUDIO_MIME_TYPES,
  DEFAULT_MUSIC_VOLUME,
} from "@/lib/video/types";

type Props = { project: VideoProject; onProjectUpdated: () => void };

const BRAND_BORDEAUX = "#B11E2F";
const VOLUME_SAVE_DEBOUNCE_MS = 800;

export default function MusicPanel({ project, onProjectUpdated }: Props) {
  const musicAudio = (project.state_json as any)?.music_audio;
  const audioMix = (project.state_json as any)?.audio_mix;
  const isReadOnly = project.status === "approved" || project.status === "archived";

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localVolume, setLocalVolume] = useState<number>(audioMix?.music_volume ?? DEFAULT_MUSIC_VOLUME);

  useEffect(() => {
    if (typeof audioMix?.music_volume === "number") setLocalVolume(audioMix.music_volume);
  }, [audioMix?.music_volume]);

  useEffect(() => {
    if (!musicAudio) return;
    if (localVolume === (audioMix?.music_volume ?? DEFAULT_MUSIC_VOLUME)) return;
    const timer = setTimeout(() => { void saveVolume(localVolume); }, VOLUME_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localVolume]);

  const saveVolume = async (vol: number) => {
    try {
      const existing = (project.state_json as any)?.audio_mix || {};
      const { error } = await supabase
        .from("studio_video_projects")
        .update({
          state_json: {
            ...(project.state_json as any),
            audio_mix: {
              main_volume: existing.main_volume ?? 1.0,
              voiceover_volume: existing.voiceover_volume ?? 1.0,
              music_volume: vol,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id);
      if (error) { toast.error("Erreur sauvegarde volume", { description: error.message }); return; }
      onProjectUpdated();
    } catch (err: any) {
      toast.error("Erreur sauvegarde", { description: err.message });
    }
  };

  const getAudioDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => { resolve(audio.duration); URL.revokeObjectURL(audio.src); };
      audio.onerror = () => { reject(new Error("Lecture duree impossible")); URL.revokeObjectURL(audio.src); };
      audio.src = URL.createObjectURL(file);
    });

  const handleFileSelect = async (file: File) => {
    const acceptedMimes = ACCEPTED_AUDIO_MIME_TYPES as readonly string[];
    if (!acceptedMimes.includes(file.type)) { toast.error("Format non supporte", { description: "Utilise MP3, WAV ou M4A." }); return; }
    if (file.size > MAX_MUSIC_SIZE_BYTES) { const maxMB = Math.round(MAX_MUSIC_SIZE_BYTES / 1024 / 1024); toast.error("Fichier trop volumineux", { description: `Maximum ${maxMB} MB.` }); return; }
    setIsUploading(true); setUploadProgress(0);
    try {
      const duration = await getAudioDuration(file);
      if (duration > MAX_MUSIC_DURATION_SECONDS) { const maxMin = Math.round(MAX_MUSIC_DURATION_SECONDS / 60); toast.error("Musique trop longue", { description: `Maximum ${maxMin} minutes.` }); setIsUploading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Session expiree", { description: "Reconnecte-toi." }); setIsUploading(false); return; }
      setUploadProgress(10);
      const urlRes = await fetch(`/api/studio/video/projects/${project.id}/music/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, fileType: file.type }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || "Erreur generation URL");
      setUploadProgress(25);
      const uploadRes = await fetch(urlData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadRes.ok) throw new Error(`Erreur upload: ${uploadRes.statusText}`);
      setUploadProgress(80);
      const confirmRes = await fetch(`/api/studio/video/projects/${project.id}/music`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ publicUrl: urlData.publicUrl, fileName: file.name, fileSize: file.size, fileType: file.type, duration_seconds: duration }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || "Erreur confirmation");
      setUploadProgress(100);
      toast.success("Musique ajoutee !", { description: `${file.name} (${Math.round(duration)}s)` });
      onProjectUpdated();
    } catch (err: any) {
      toast.error("Erreur upload musique", { description: err.message || String(err) });
    } finally {
      setIsUploading(false); setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    const ok = await confirmDialog("Supprimer la musique ?", { description: "Le fichier sera definitivement supprime.", confirmLabel: "Supprimer", destructive: true });
    if (!ok) return;
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Session expiree"); return; }
      const res = await fetch(`/api/studio/video/projects/${project.id}/music`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur suppression");
      toast.success("Musique supprimee");
      onProjectUpdated();
    } catch (err: any) {
      toast.error("Erreur", { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const fmtDur = (s: number) => { const m = Math.floor(s / 60); const ss = Math.floor(s % 60); return `${m}:${ss.toString().padStart(2, "0")}`; };

  if (isUploading) {
    return (
      <div className="rounded-xl border border-neutral-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: BRAND_BORDEAUX }} />
          <span className="text-xs font-bold text-neutral-900">Upload... {uploadProgress}%</span>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
          <div className="h-full transition-all duration-300" style={{ width: `${uploadProgress}%`, backgroundColor: BRAND_BORDEAUX }} />
        </div>
      </div>
    );
  }

  if (!musicAudio) {
    if (isReadOnly) return <div className="text-[11px] text-neutral-400 italic py-2 text-center">Aucune musique.</div>;
    return (
      <div>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-5 rounded-xl border-2 border-dashed border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition flex flex-col items-center gap-2">
          <Upload className="w-5 h-5 text-neutral-400" />
          <div className="text-xs font-medium text-neutral-700">Ajouter une musique</div>
          <div className="text-[10px] text-neutral-400">MP3, WAV ou M4A - max 50 MB</div>
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} className="hidden" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND_BORDEAUX}15`, color: BRAND_BORDEAUX }}>
          <Music className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-neutral-900 truncate">{musicAudio.filename}</div>
          <div className="text-[10px] text-neutral-400">{fmtDur(musicAudio.duration_seconds)}</div>
        </div>
        {!isReadOnly && (
          <button type="button" onClick={handleDelete} disabled={isDeleting} className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50" title="Supprimer">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      <audio src={musicAudio.url} controls className="w-full mb-3" preload="metadata" />

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            <Volume2 className="w-3 h-3" /> Volume musique
          </label>
          <span className="text-[10px] font-bold text-neutral-700 tabular-nums">{Math.round(localVolume * 100)}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.05} value={localVolume} disabled={isReadOnly}
          onChange={(e) => setLocalVolume(parseFloat(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          style={{ background: `linear-gradient(to right, ${BRAND_BORDEAUX} 0%, ${BRAND_BORDEAUX} ${localVolume * 100}%, #f3f4f6 ${localVolume * 100}%, #f3f4f6 100%)` }}
        />
      </div>

      {!isReadOnly && (
        <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-3 w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition flex items-center justify-center gap-1.5">
          <Upload className="w-3 h-3" /> Remplacer la musique
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} className="hidden" />
    </div>
  );
}