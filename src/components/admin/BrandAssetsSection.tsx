"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Film, Image as ImageIcon, Loader2, Plus, Trash2, X, Upload,
  CheckCircle2, Clock, AlertCircle, Video, FileImage,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  BrandAssetsSection — section luxury Intro/Outro pour 1 tenant
//  Pattern : 2 cards (Intro + Outro), chacune avec son overlay + N BGs
// ============================================================

type Background = {
  id: string;
  name: string;
  bg_url: string;
  bg_filename: string;
  bg_format: string;
  bg_kind: "video" | "image";
  width: number;
  height: number;
  is_approved: boolean;
  uploaded_by_role: string | null;
  created_at: string;
};

type Asset = {
  id: string;
  tenant_id: string;
  asset_type: "intro" | "outro";
  name: string;
  overlay_url: string;
  overlay_filename: string;
  overlay_format: "png" | "gif" | "mov" | "webm";
  overlay_width: number;
  overlay_height: number;
  duration_seconds: number;
  default_bg_url: string | null;
  default_bg_kind: "video" | "image" | null;
  position_x: number;
  position_y: number;
  is_active: boolean;
  created_at: string;
  backgrounds?: Background[];
};

type Props = { tenantId: string };

const OVERLAY_ACCEPT = "image/png,image/gif,video/quicktime,video/webm,.mov";
const BG_ACCEPT = "video/mp4,image/png,image/jpeg,image/webp";
const MAX_OVERLAY_MB = 50;
const MAX_BG_MB = 200;

export default function BrandAssetsSection({ tenantId }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<"intro" | "outro" | null>(null);
  const [bgUploadAsset, setBgUploadAsset] = useState<Asset | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");

      const res = await fetch(`/api/super-admin/clients/${tenantId}/brand-assets`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur fetch");
      setAssets(data.assets || []);
    } catch (err: any) {
      console.error("[BrandAssetsSection]", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const intro = assets.find((a) => a.asset_type === "intro");
  const outro = assets.find((a) => a.asset_type === "outro");

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-neutral-900 flex items-center gap-2">
          <Film size={14} className="text-orange-500" />
          Brand Assets (Intro / Outro)
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          {assets.length}/2 configurés
        </span>
      </div>

      {loading ? (
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-10 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <AssetCard
            type="intro"
            asset={intro}
            tenantId={tenantId}
            onUploadClick={() => setUploadingType("intro")}
            onAddBg={(a) => setBgUploadAsset(a)}
            onChanged={fetchAssets}
          />
          <AssetCard
            type="outro"
            asset={outro}
            tenantId={tenantId}
            onUploadClick={() => setUploadingType("outro")}
            onAddBg={(a) => setBgUploadAsset(a)}
            onChanged={fetchAssets}
          />
        </div>
      )}

      {uploadingType && (
        <UploadOverlayModal
          tenantId={tenantId}
          assetType={uploadingType}
          onClose={() => setUploadingType(null)}
          onUploaded={() => { setUploadingType(null); fetchAssets(); }}
        />
      )}

      {bgUploadAsset && (
        <UploadBackgroundModal
          tenantId={tenantId}
          asset={bgUploadAsset}
          onClose={() => setBgUploadAsset(null)}
          onUploaded={() => { setBgUploadAsset(null); fetchAssets(); }}
        />
      )}
    </section>
  );
}

// ============================================================
//  AssetCard — Card pour 1 asset (intro OU outro)
// ============================================================
function AssetCard({
  type, asset, tenantId, onUploadClick, onAddBg, onChanged,
}: {
  type: "intro" | "outro";
  asset?: Asset;
  tenantId: string;
  onUploadClick: () => void;
  onAddBg: (a: Asset) => void;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showBgs, setShowBgs] = useState(false);
  const label = type === "intro" ? "Intro" : "Outro";
  const accentColor = type === "intro" ? "#3B82F6" : "#8B5CF6";

  const handleDelete = async () => {
    if (!asset) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/super-admin/clients/${tenantId}/brand-assets/${asset.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur suppression");
      }
      onChanged();
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (!asset) {
    return (
      <button
        type="button"
        onClick={onUploadClick}
        className="group bg-white border-2 border-dashed border-neutral-200 rounded-2xl p-6 hover:border-neutral-900 transition text-left"
      >
        <div className="flex items-center justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: accentColor + "15" }}
          >
            <Film size={18} style={{ color: accentColor }} />
          </div>
          <Plus size={16} className="text-neutral-400 group-hover:text-neutral-900 transition" />
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: accentColor }}>
          {label}
        </div>
        <div className="text-sm font-bold text-neutral-700 mb-1">
          Pas encore configuré
        </div>
        <div className="text-xs text-neutral-500">
          Click pour uploader le template overlay (PNG-α / GIF / MOV-α / WebM-α)
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: accentColor + "15" }}
          >
            <Film size={18} style={{ color: accentColor }} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: accentColor }}>
              {label}
            </div>
            <div className="text-sm font-bold text-neutral-900">{asset.name}</div>
          </div>
        </div>
        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="px-2 py-1 text-[10px] font-bold text-neutral-600 hover:bg-neutral-100 rounded transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1 text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded transition flex items-center gap-1"
            >
              {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
              Confirmer
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="w-8 h-8 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 flex items-center justify-center transition"
            title="Supprimer cet asset"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Preview overlay */}
      <div className="aspect-video bg-neutral-100 rounded-xl overflow-hidden mb-3 relative">
        <div
          className="absolute inset-0 bg-[linear-gradient(45deg,#e5e5e5_25%,transparent_25%,transparent_75%,#e5e5e5_75%),linear-gradient(45deg,#e5e5e5_25%,transparent_25%,transparent_75%,#e5e5e5_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]"
        />
        {asset.overlay_format === "png" || asset.overlay_format === "gif" ? (
          <img
            src={asset.overlay_url}
            alt={asset.name}
            className="relative w-full h-full object-contain"
          />
        ) : (
          <video
            src={asset.overlay_url}
            autoPlay loop muted playsInline
            className="relative w-full h-full object-contain"
          />
        )}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-3">
        <Meta label="Format" value={asset.overlay_format.toUpperCase()} />
        <Meta label="Taille" value={`${asset.overlay_width}×${asset.overlay_height}`} />
        <Meta label="Durée" value={`${asset.duration_seconds}s`} />
      </div>

      {/* Backgrounds */}
      <div className="border-t border-neutral-100 pt-3">
        <button
          type="button"
          onClick={() => setShowBgs((v) => !v)}
          className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition mb-2"
        >
          <span className="flex items-center gap-1.5">
            <ImageIcon size={11} />
            Backgrounds ({asset.backgrounds?.length || 0})
          </span>
          {showBgs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {showBgs && (
          <div className="space-y-1.5">
            {(asset.backgrounds || []).map((bg) => (
              <BackgroundRow
                key={bg.id}
                bg={bg}
                tenantId={tenantId}
                assetId={asset.id}
                onChanged={onChanged}
              />
            ))}
            <button
              type="button"
              onClick={() => onAddBg(asset)}
              className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-neutral-200 hover:border-neutral-900 rounded-lg text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-900 transition"
            >
              <Plus size={11} />
              Ajouter un background
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-50 rounded-lg px-2 py-1.5">
      <div className="text-[8px] font-black uppercase tracking-widest text-neutral-400">
        {label}
      </div>
      <div className="text-[11px] font-bold text-neutral-900 tabular-nums">{value}</div>
    </div>
  );
}

function BackgroundRow({
  bg, tenantId, assetId, onChanged,
}: {
  bg: Background;
  tenantId: string;
  assetId: string;
  onChanged: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-neutral-50 rounded-lg p-2">
      <div className="w-10 h-10 rounded bg-neutral-200 overflow-hidden shrink-0">
        {bg.bg_kind === "image" ? (
          <img src={bg.bg_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <video src={bg.bg_url} muted className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-neutral-900 truncate">{bg.name}</div>
        <div className="text-[10px] text-neutral-500 flex items-center gap-1.5">
          {bg.bg_kind === "video" ? <Video size={9} /> : <FileImage size={9} />}
          {bg.bg_format.toUpperCase()} • {bg.width}×{bg.height}
        </div>
      </div>
      {bg.is_approved ? (
        <CheckCircle2 size={13} className="text-green-600 shrink-0" />
      ) : (
        <Clock size={13} className="text-amber-500 shrink-0" />
      )}
    </div>
  );
}

// ============================================================
//  UploadOverlayModal — Modal upload du template overlay
// ============================================================
function UploadOverlayModal({
  tenantId, assetType, onClose, onUploaded,
}: {
  tenantId: string;
  assetType: "intro" | "outro";
  onClose: () => void;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<number>(3);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleFileChange = async (f: File) => {
    setError(null);
    if (f.size > MAX_OVERLAY_MB * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${MAX_OVERLAY_MB} MB)`);
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    if (!name) setName(`${assetType === "intro" ? "Intro" : "Outro"} — ${f.name.replace(/\.[^.]+$/, "")}`);

    const isVideo = f.type.startsWith("video/");
    if (isVideo) {
      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      await new Promise<void>((resolve) => {
        v.onloadedmetadata = () => {
          setDimensions({ w: v.videoWidth, h: v.videoHeight });
          setDuration(parseFloat(v.duration.toFixed(2)) || 3);
          resolve();
        };
        v.onerror = () => resolve();
      });
    } else {
      const img = document.createElement("img");
      img.src = url;
      await new Promise<void>((resolve) => {
        img.onload = () => {
          setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
          resolve();
        };
        img.onerror = () => resolve();
      });
    }
  };

  const detectFormat = (f: File): "png" | "gif" | "mov" | "webm" | null => {
    const ext = f.name.toLowerCase().split(".").pop();
    if (ext === "png") return "png";
    if (ext === "gif") return "gif";
    if (ext === "mov") return "mov";
    if (ext === "webm") return "webm";
    if (f.type === "image/png") return "png";
    if (f.type === "image/gif") return "gif";
    if (f.type === "video/quicktime") return "mov";
    if (f.type === "video/webm") return "webm";
    return null;
  };

  const handleUpload = async () => {
    if (!file || !dimensions || !name.trim()) {
      setError("Fichier, nom et dimensions requis");
      return;
    }
    const format = detectFormat(file);
    if (!format) {
      setError("Format non supporté (PNG, GIF, MOV, WebM uniquement)");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");

      // 1. Upload Storage
      const ext = file.name.split(".").pop()?.toLowerCase() || format;
      const storagePath = `${tenantId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brand-video-overlays")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("brand-video-overlays").getPublicUrl(storagePath);

      // 2. POST API
      const res = await fetch(`/api/super-admin/clients/${tenantId}/brand-assets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asset_type: assetType,
          name: name.trim(),
          overlay_url: urlData.publicUrl,
          overlay_filename: file.name,
          overlay_format: format,
          overlay_width: dimensions.w,
          overlay_height: dimensions.h,
          duration_seconds: duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur création");

      onUploaded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell title={`Nouveau template ${assetType === "intro" ? "Intro" : "Outro"}`} onClose={onClose}>
      {previewUrl && file && (
        <div className="aspect-video bg-neutral-100 rounded-xl overflow-hidden mb-4 relative">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,#e5e5e5_25%,transparent_25%,transparent_75%,#e5e5e5_75%),linear-gradient(45deg,#e5e5e5_25%,transparent_25%,transparent_75%,#e5e5e5_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]" />
          {file.type.startsWith("video/") ? (
            <video src={previewUrl} autoPlay loop muted playsInline className="relative w-full h-full object-contain" />
          ) : (
            <img src={previewUrl} alt="" className="relative w-full h-full object-contain" />
          )}
        </div>
      )}

      <div className="space-y-3">
        <FormField label="Fichier overlay" required>
          <input
            ref={fileInputRef}
            type="file"
            accept={OVERLAY_ACCEPT}
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-3 py-3 border-2 border-dashed border-neutral-200 hover:border-neutral-900 rounded-lg text-xs font-bold text-neutral-700 flex items-center justify-center gap-2 transition"
          >
            <Upload size={13} />
            {file ? file.name : "Sélectionner PNG-α / GIF / MOV-α / WebM-α"}
          </button>
          <Hint>Max {MAX_OVERLAY_MB} MB</Hint>
        </FormField>

        <FormField label="Nom" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Intro Standard 2026"
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Dimensions">
            <div className="px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg font-mono">
              {dimensions ? `${dimensions.w} × ${dimensions.h}` : "—"}
            </div>
          </FormField>
          <FormField label="Durée (s)" required>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono focus:outline-none focus:border-neutral-900"
            />
          </FormField>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={13} className="text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700">{error}</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-neutral-200">
        <button
          type="button"
          onClick={onClose}
          disabled={uploading}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-600 hover:bg-neutral-100 rounded-lg transition disabled:opacity-40"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !file || !name.trim() || !dimensions}
          className="inline-flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? "Upload..." : "Uploader"}
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
//  UploadBackgroundModal — upload BG variant
// ============================================================
function UploadBackgroundModal({
  tenantId, asset, onClose, onUploaded,
}: {
  tenantId: string;
  asset: Asset;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleFileChange = async (f: File) => {
    setError(null);
    if (f.size > MAX_BG_MB * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${MAX_BG_MB} MB)`);
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));

    const isVideo = f.type.startsWith("video/");
    if (isVideo) {
      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      await new Promise<void>((resolve) => {
        v.onloadedmetadata = () => {
          setDimensions({ w: v.videoWidth, h: v.videoHeight });
          resolve();
        };
        v.onerror = () => resolve();
      });
    } else {
      const img = document.createElement("img");
      img.src = url;
      await new Promise<void>((resolve) => {
        img.onload = () => {
          setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
          resolve();
        };
        img.onerror = () => resolve();
      });
    }
  };

  const detectFormat = (f: File): { fmt: string; kind: "video" | "image" } | null => {
    const ext = f.name.toLowerCase().split(".").pop();
    if (ext === "mp4" || f.type === "video/mp4") return { fmt: "mp4", kind: "video" };
    if (ext === "png" || f.type === "image/png") return { fmt: "png", kind: "image" };
    if (ext === "jpg" || ext === "jpeg" || f.type === "image/jpeg") return { fmt: "jpg", kind: "image" };
    if (ext === "webp" || f.type === "image/webp") return { fmt: "webp", kind: "image" };
    return null;
  };

  const handleUpload = async () => {
    if (!file || !dimensions || !name.trim()) {
      setError("Fichier, nom et dimensions requis");
      return;
    }
    const detected = detectFormat(file);
    if (!detected) {
      setError("Format non supporté (MP4, PNG, JPG, WEBP)");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");

      const ext = file.name.split(".").pop()?.toLowerCase() || detected.fmt;
      const storagePath = `${tenantId}/${asset.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brand-video-asset-backgrounds")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("brand-video-asset-backgrounds")
        .getPublicUrl(storagePath);

      const res = await fetch(
        `/api/super-admin/clients/${tenantId}/brand-assets/${asset.id}/backgrounds`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            bg_url: urlData.publicUrl,
            bg_filename: file.name,
            bg_format: detected.fmt,
            bg_kind: detected.kind,
            width: dimensions.w,
            height: dimensions.h,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur création");

      onUploaded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell title={`Nouveau background pour ${asset.name}`} onClose={onClose}>
      {previewUrl && file && (
        <div className="aspect-video bg-neutral-100 rounded-xl overflow-hidden mb-4">
          {file.type.startsWith("video/") ? (
            <video src={previewUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          ) : (
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      )}

      <div className="space-y-3">
        <FormField label="Fichier background" required>
          <input
            ref={fileInputRef}
            type="file"
            accept={BG_ACCEPT}
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-3 py-3 border-2 border-dashed border-neutral-200 hover:border-neutral-900 rounded-lg text-xs font-bold text-neutral-700 flex items-center justify-center gap-2 transition"
          >
            <Upload size={13} />
            {file ? file.name : "Sélectionner MP4 / PNG / JPG / WEBP"}
          </button>
          <Hint>Max {MAX_BG_MB} MB</Hint>
        </FormField>

        <FormField label="Nom" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nature Léman"
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900"
          />
        </FormField>

        <FormField label="Dimensions">
          <div className="px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg font-mono">
            {dimensions ? `${dimensions.w} × ${dimensions.h}` : "—"}
          </div>
        </FormField>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={13} className="text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700">{error}</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-5 mt-5 border-t border-neutral-200">
        <button
          type="button"
          onClick={onClose}
          disabled={uploading}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-600 hover:bg-neutral-100 rounded-lg transition disabled:opacity-40"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !file || !name.trim() || !dimensions}
          className="inline-flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? "Upload..." : "Ajouter"}
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
//  Helpers UI
// ============================================================
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-xl w-full my-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-bold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition">
            <X size={16} className="text-neutral-600" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block mb-1">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] text-neutral-400 mt-1">{children}</div>;
}