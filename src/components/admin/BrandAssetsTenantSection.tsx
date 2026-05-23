"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Film,
  Loader2,
  Check,
  X,
  Plus,
  Trash2,
  Clock,
  Lock,
  AlertCircle,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";

const BRAND_BORDEAUX = "#B11E2F";
const INTRO_COLOR = "#3B82F6";
const OUTRO_COLOR = "#8B5CF6";

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
  uploaded_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type Asset = {
  id: string;
  asset_type: "intro" | "outro";
  name: string;
  overlay_url: string;
  overlay_format: string;
  overlay_width: number;
  overlay_height: number;
  duration_seconds: number;
  default_bg_url: string | null;
  default_bg_kind: "video" | "image" | null;
  backgrounds: Background[];
};

type Props = {
  tenantId: string;
};

export default function BrandAssetsTenantSection({ tenantId }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<Asset | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");

      const res = await fetch(`/api/admin/brand-assets`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur fetch");
      setAssets(data.assets || []);
    } catch (err: any) {
      console.error("[BrandAssetsTenantSection]", err);
      toast.error("Erreur chargement brand assets", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleApprove = useCallback(
    async (asset: Asset, bg: Background) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Pas de session");

        const res = await fetch(
          `/api/admin/brand-assets/${asset.id}/backgrounds/${bg.id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "approve" }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur");
        toast.success(`BG "${bg.name}" approuvé [OK]`);
        await fetchAssets();
      } catch (err: any) {
        toast.error("Erreur approbation", { description: err.message });
      }
    },
    [fetchAssets]
  );

  const handleReject = useCallback(
    async (asset: Asset, bg: Background) => {
      const reason = prompt(`Pourquoi rejeter "${bg.name}" ?`, "Ne respecte pas la charte");
      if (!reason) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Pas de session");

        const res = await fetch(
          `/api/admin/brand-assets/${asset.id}/backgrounds/${bg.id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "reject", reason }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur");
        toast.success(`BG "${bg.name}" rejeté`);
        await fetchAssets();
      } catch (err: any) {
        toast.error("Erreur rejet", { description: err.message });
      }
    },
    [fetchAssets]
  );

  const handleDelete = useCallback(
    async (asset: Asset, bg: Background) => {
      if (!confirm(`Supprimer le background "${bg.name}" ?\n\nCette action est irréversible.`))
        return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Pas de session");

        const res = await fetch(
          `/api/admin/brand-assets/${asset.id}/backgrounds/${bg.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        toast.success(`BG "${bg.name}" supprimé`);
        await fetchAssets();
      } catch (err: any) {
        toast.error("Erreur suppression", { description: err.message });
      }
    },
    [fetchAssets]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-8 flex items-center justify-center gap-3 text-neutral-500">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Chargement des brand assets...</span>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
        <Film size={32} className="text-neutral-300 mx-auto mb-4" />
        <h3 className="text-sm font-black uppercase tracking-widest text-neutral-600 mb-2">
          Aucun template configuré
        </h3>
        <p className="text-xs text-neutral-500">
          Votre BrandLock manager doit d'abord uploader les templates intro/outro pour votre charte.
        </p>
      </div>
    );
  }

  const intros = assets.filter((a) => a.asset_type === "intro");
  const outros = assets.filter((a) => a.asset_type === "outro");

  return (
    <>
      <div className="space-y-6">
        {intros.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            color={INTRO_COLOR}
            onAddBg={() => setUploadingFor(asset)}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
          />
        ))}
        {outros.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            color={OUTRO_COLOR}
            onAddBg={() => setUploadingFor(asset)}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {uploadingFor && (
        <UploadBgModal
          asset={uploadingFor}
          onClose={() => setUploadingFor(null)}
          onSuccess={() => {
            setUploadingFor(null);
            fetchAssets();
          }}
        />
      )}
    </>
  );
}

// ============================================================
//  AssetCard : 1 template (intro OU outro) avec ses BGs
// ============================================================

function AssetCard({
  asset,
  color,
  onAddBg,
  onApprove,
  onReject,
  onDelete,
}: {
  asset: Asset;
  color: string;
  onAddBg: () => void;
  onApprove: (asset: Asset, bg: Background) => void;
  onReject: (asset: Asset, bg: Background) => void;
  onDelete: (asset: Asset, bg: Background) => void;
}) {
  const approved = asset.backgrounds.filter((bg) => bg.is_approved);
  const pending = asset.backgrounds.filter((bg) => !bg.is_approved && !bg.rejected_at);
  const rejected = asset.backgrounds.filter((bg) => bg.rejected_at);

  const [showRejected, setShowRejected] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${color}15` }}
          >
            <Film size={18} style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-0.5"
              style={{ color }}
            >
              {asset.asset_type === "intro" ? "Intro" : "Outro"}
              <span className="ml-2 text-neutral-400 font-normal normal-case tracking-normal inline-flex items-center gap-1">
                <Lock size={9} /> verrouillé charte
              </span>
            </div>
            <div className="text-sm font-bold text-neutral-900 truncate">{asset.name}</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {asset.duration_seconds}s * {asset.overlay_format.toUpperCase()} {asset.overlay_width}×{asset.overlay_height}
            </div>
          </div>
        </div>

        {/* Overlay preview */}
        <div
          className="w-16 h-16 rounded-lg flex-shrink-0 border border-neutral-200"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #f5f5f5 25%, transparent 25%), linear-gradient(-45deg, #f5f5f5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f5f5f5 75%), linear-gradient(-45deg, transparent 75%, #f5f5f5 75%)',
            backgroundSize: '12px 12px',
            backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
          }}
        >
          {asset.overlay_format !== "mov" && asset.overlay_format !== "webm" ? (
            <img src={asset.overlay_url} alt="" className="w-full h-full object-contain rounded-lg" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400">
              <VideoIcon size={20} />
            </div>
          )}
        </div>
      </div>

      {/* Body : BGs */}
      <div className="p-5 space-y-4">
        {/* Pending */}
        {pending.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock size={11} className="text-amber-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                En attente d'approbation ({pending.length})
              </span>
            </div>
            <div className="space-y-2">
              {pending.map((bg) => (
                <BgRow
                  key={bg.id}
                  bg={bg}
                  status="pending"
                  onApprove={() => onApprove(asset, bg)}
                  onReject={() => onReject(asset, bg)}
                  onDelete={() => onDelete(asset, bg)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Approved */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Check size={11} className="text-green-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-green-700">
              Approuvés ({approved.length})
            </span>
          </div>
          {approved.length === 0 ? (
            <div className="text-xs text-neutral-400 italic px-2 py-2">
              Aucun background approuvé pour le moment
            </div>
          ) : (
            <div className="space-y-2">
              {approved.map((bg) => (
                <BgRow
                  key={bg.id}
                  bg={bg}
                  status="approved"
                  onDelete={() => onDelete(asset, bg)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Rejected (collapsable) */}
        {rejected.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowRejected(!showRejected)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-neutral-700 transition"
            >
              <X size={11} />
              Rejetés ({rejected.length}) {showRejected ? "▼" : "▶"}
            </button>
            {showRejected && (
              <div className="space-y-2 mt-2">
                {rejected.map((bg) => (
                  <BgRow
                    key={bg.id}
                    bg={bg}
                    status="rejected"
                    onDelete={() => onDelete(asset, bg)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add BG button */}
        <button
          type="button"
          onClick={onAddBg}
          className="w-full px-4 py-3 border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition"
        >
          <Plus size={14} />
          Ajouter un background
        </button>
      </div>
    </div>
  );
}

// ============================================================
//  BgRow : 1 ligne BG
// ============================================================

function BgRow({
  bg,
  status,
  onApprove,
  onReject,
  onDelete,
}: {
  bg: Background;
  status: "approved" | "pending" | "rejected";
  onApprove?: () => void;
  onReject?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-neutral-50 rounded-lg border border-neutral-100">
      {/* Preview thumb */}
      <div className="w-12 h-12 rounded flex-shrink-0 bg-neutral-200 overflow-hidden flex items-center justify-center">
        {bg.bg_kind === "image" ? (
          <img src={bg.bg_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <VideoIcon size={16} className="text-neutral-500" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-neutral-900 truncate">{bg.name}</div>
        <div className="text-[10px] text-neutral-500 flex items-center gap-2">
          {bg.bg_kind === "image" ? <ImageIcon size={9} /> : <VideoIcon size={9} />}
          {bg.bg_format.toUpperCase()} * {bg.width}×{bg.height}
          {bg.uploaded_by_role && (
            <span className="ml-1 text-neutral-400">
              par {bg.uploaded_by_role}
            </span>
          )}
        </div>
        {status === "rejected" && bg.rejection_reason && (
          <div className="text-[10px] text-red-600 italic mt-0.5">
            Raison : {bg.rejection_reason}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {status === "pending" && (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider rounded transition flex items-center gap-1"
            >
              <Check size={11} /> Approuver
            </button>
            <button
              type="button"
              onClick={onReject}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider rounded transition flex items-center gap-1"
            >
              <X size={11} /> Rejeter
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-neutral-400 hover:text-red-600 transition"
          title="Supprimer"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
//  UploadBgModal : modal upload BG
// ============================================================

function UploadBgModal({
  asset,
  onClose,
  onSuccess,
}: {
  asset: Asset;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.[^/.]+$/, "").slice(0, 60));

    // Auto-detect dimensions
    const isVideo = f.type.startsWith("video/");
    const url = URL.createObjectURL(f);
    if (isVideo) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        setDims({ width: v.videoWidth, height: v.videoHeight });
        URL.revokeObjectURL(url);
      };
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => {
        setDims({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const handleUpload = async () => {
    if (!file || !name || !dims) {
      toast.error("Fichier ou nom manquant");
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");

      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const bgKind: "video" | "image" = file.type.startsWith("video/") ? "video" : "image";
      const uuid = crypto.randomUUID();
      const storagePath = `${asset.id}/${uuid}.${ext}`;

      // Upload to Storage
      const { error: uploadErr } = await supabase.storage
        .from("brand-video-asset-backgrounds")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadErr) throw new Error(`Upload Storage: ${uploadErr.message}`);

      const { data: publicData } = supabase.storage
        .from("brand-video-asset-backgrounds")
        .getPublicUrl(storagePath);

      // POST API
      const res = await fetch(
        `/api/admin/brand-assets/${asset.id}/backgrounds`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            bg_url: publicData.publicUrl,
            bg_filename: file.name,
            bg_format: ext,
            bg_kind: bgKind,
            width: dims.width,
            height: dims.height,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur API");

      toast.success(`BG "${name}" uploadé [OK]`, {
        description: data.background?.is_approved
          ? "Auto-approuvé (votre rôle admin)"
          : "En attente d'approbation par l'admin",
      });
      onSuccess();
    } catch (err: any) {
      toast.error("Erreur upload", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest">
            Ajouter un BG pour "{asset.name}"
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-700 block mb-1.5">
              Fichier (MP4, PNG, JPG, WEBP — max 200MB)
            </label>
            <input
              type="file"
              accept="video/mp4,image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="w-full text-xs"
            />
            {dims && (
              <div className="text-[10px] text-neutral-500 mt-1">
                Dimensions détectées : {dims.width}×{dims.height}px
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-700 block mb-1.5">
              Nom interne
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Vue lac Léman drone"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
            <p className="text-[11px] text-amber-800">
              Le BG sera <strong>auto-approuvé</strong> car vous êtes administrateur.
            </p>
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || !name || !dims || uploading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition disabled:opacity-40"
            style={{ backgroundColor: BRAND_BORDEAUX }}
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Upload en cours...
              </>
            ) : (
              <>
                <Plus size={14} /> Uploader le background
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}