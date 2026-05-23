"use client";

import { useCallback, useEffect, useState } from "react";
import { Film, Loader2, Check, Plus, X, AlertCircle, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { VideoProject } from "@/lib/video/types";

const BRAND_BORDEAUX = "#B11E2F";

type Background = {
  id: string;
  name: string;
  bg_url: string;
  bg_kind: "video" | "image";
  bg_format: string;
  width: number;
  height: number;
  is_approved: boolean;
};

type Asset = {
  id: string;
  asset_type: "intro" | "outro";
  name: string;
  overlay_url: string;
  overlay_format: string;
  duration_seconds: number;
  default_bg_url: string | null;
  default_bg_kind: "video" | "image" | null;
  backgrounds: Background[];
};

type Props = {
  project: VideoProject;
  onSaved?: () => void;
};

export default function BrandAssetsSelector({ project, onSaved }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [userRole, setUserRole] = useState<string>("graphist");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<Asset | null>(null);

  const stateJson = (project.state_json as any) || {};
  const [introId, setIntroId] = useState<string>(stateJson.intro_id || "");
  const [introBgId, setIntroBgId] = useState<string>(stateJson.intro_background_id || "");
  const [outroId, setOutroId] = useState<string>(stateJson.outro_id || "");
  const [outroBgId, setOutroBgId] = useState<string>(stateJson.outro_background_id || "");

  const fetchAssets = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (profile?.role) setUserRole(profile.role);

      const url = "/api/studio/video/projects/" + project.id + "/brand-assets";
      const res = await fetch(url, {
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur fetch");
      setAssets(data.assets || []);
    } catch (err: any) {
      console.error("[BrandAssetsSelector]", err);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Pas de session");

      const newStateJson = {
        ...(project.state_json || {}),
        intro_id: introId || undefined,
        intro_background_id: introBgId || undefined,
        outro_id: outroId || undefined,
        outro_background_id: outroBgId || undefined,
      };

      const url = "/api/studio/video/projects/" + project.id;
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + session.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state_json: newStateJson }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || ("HTTP " + res.status));
      }

      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
      onSaved?.();
    } catch (err: any) {
      toast.error("Erreur sauvegarde", { description: err.message });
    } finally {
      setSaving(false);
    }
  }, [project.id, project.state_json, introId, introBgId, outroId, outroBgId, onSaved]);

  useEffect(() => {
    if (loading) return;
    const initial =
      introId === (stateJson.intro_id || "") &&
      introBgId === (stateJson.intro_background_id || "") &&
      outroId === (stateJson.outro_id || "") &&
      outroBgId === (stateJson.outro_background_id || "");
    if (initial) return;

    const timer = setTimeout(handleSave, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introId, introBgId, outroId, outroBgId, loading]);

  const intros = assets.filter((a) => a.asset_type === "intro");
  const outros = assets.filter((a) => a.asset_type === "outro");
  const intro = intros.find((a) => a.id === introId);
  const outro = outros.find((a) => a.id === outroId);

  if (loading) {
    return (
      <div className="bg-neutral-50 rounded-xl p-4 flex items-center gap-2 text-xs text-neutral-500">
        <Loader2 size={12} className="animate-spin" />
        Chargement des brand assets...
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs text-neutral-500 flex items-center gap-2">
        <Film size={13} className="text-neutral-400" />
        Aucun brand asset configure pour ce tenant
      </div>
    );
  }

  return (
    <>
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-neutral-700 flex items-center gap-1.5">
            <Film size={11} className="text-orange-500" />
            Brand Assets (Intro / Outro)
          </div>
          {saving ? (
            <span className="text-[10px] text-neutral-500 flex items-center gap-1">
              <Loader2 size={9} className="animate-spin" /> Sauvegarde...
            </span>
          ) : justSaved ? (
            <span className="text-[10px] text-green-600 flex items-center gap-1 font-bold">
              <Check size={10} /> Sauvegarde
            </span>
          ) : null}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <AssetSelector
            label="Intro"
            color="#3B82F6"
            assets={intros}
            selectedId={introId}
            selectedBgId={introBgId}
            onSelectAsset={(id) => { setIntroId(id); setIntroBgId(""); }}
            onSelectBg={setIntroBgId}
            currentAsset={intro}
            onAddBg={(asset) => setUploadingFor(asset)}
          />
          <AssetSelector
            label="Outro"
            color="#8B5CF6"
            assets={outros}
            selectedId={outroId}
            selectedBgId={outroBgId}
            onSelectAsset={(id) => { setOutroId(id); setOutroBgId(""); }}
            onSelectBg={setOutroBgId}
            currentAsset={outro}
            onAddBg={(asset) => setUploadingFor(asset)}
          />
        </div>

        <p className="text-[10px] text-neutral-400 mt-3 text-center">
          La selection est sauvegardee auto. Sera appliquee au prochain render.
        </p>
      </div>

      {uploadingFor && (
        <UploadBgModal
          asset={uploadingFor}
          userRole={userRole}
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

function AssetSelector({
  label, color, assets, selectedId, selectedBgId,
  onSelectAsset, onSelectBg, currentAsset, onAddBg,
}: {
  label: string;
  color: string;
  assets: Asset[];
  selectedId: string;
  selectedBgId: string;
  onSelectAsset: (id: string) => void;
  onSelectBg: (id: string) => void;
  currentAsset?: Asset;
  onAddBg: (asset: Asset) => void;
}) {
  const approvedBgs = currentAsset?.backgrounds.filter((bg) => bg.is_approved) || [];
  const pendingBgs = currentAsset?.backgrounds.filter((bg) => !bg.is_approved) || [];
  const hasAnyBg = approvedBgs.length > 0 || pendingBgs.length > 0 || currentAsset?.default_bg_url;

  return (
    <div>
      <label
        className="text-[10px] font-black uppercase tracking-widest block mb-1.5"
        style={{ color }}
      >
        {label}
      </label>
      <select
        value={selectedId}
        onChange={(e) => onSelectAsset(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 bg-white"
      >
        <option value="">-- Aucune --</option>
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.duration_seconds}s)
          </option>
        ))}
      </select>

      {currentAsset && hasAnyBg && (
        <select
          value={selectedBgId}
          onChange={(e) => onSelectBg(e.target.value)}
          className="w-full mt-1.5 px-2 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 bg-white"
        >
          {currentAsset.default_bg_url ? (
            <option value="">-- BG par defaut de la charte --</option>
          ) : (
            <option value="">-- Selectionner un BG --</option>
          )}
          {approvedBgs.map((bg) => (
            <option key={bg.id} value={bg.id}>
              {bg.name} ({bg.bg_kind})
            </option>
          ))}
          {pendingBgs.map((bg) => (
            <option key={bg.id} value={bg.id} disabled>
              {bg.name} -- en attente d&apos;approbation
            </option>
          ))}
        </select>
      )}

      {currentAsset && (
        <button
          type="button"
          onClick={() => onAddBg(currentAsset)}
          className="w-full mt-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-dashed border-neutral-300 hover:border-neutral-500 rounded-lg text-neutral-600 hover:text-neutral-900 transition flex items-center justify-center gap-1"
        >
          <Plus size={10} />
          Ajouter un BG
        </button>
      )}

      {pendingBgs.length > 0 && (
        <div className="mt-1.5 text-[10px] text-amber-700 flex items-center gap-1">
          <Clock size={9} />
          {pendingBgs.length} BG(s) en attente d&apos;approbation
        </div>
      )}
    </div>
  );
}

function UploadBgModal({
  asset, userRole, onClose, onSuccess,
}: {
  asset: Asset;
  userRole: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const willBeAutoApproved = userRole === "super_admin" || userRole === "tenant_admin";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.[^/.]+$/, "").slice(0, 60));

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
      const storagePath = asset.id + "/" + uuid + "." + ext;

      const { error: uploadErr } = await supabase.storage
        .from("brand-video-asset-backgrounds")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadErr) throw new Error("Upload Storage: " + uploadErr.message);

      const { data: publicData } = supabase.storage
        .from("brand-video-asset-backgrounds")
        .getPublicUrl(storagePath);

      const apiUrl = "/api/admin/brand-assets/" + asset.id + "/backgrounds";
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + session.access_token,
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
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur API");

      toast.success("BG " + name + " uploade", {
        description: data.background?.is_approved
          ? "Auto-approuve (votre role admin)"
          : "En attente d'approbation par l'admin client",
      });
      onSuccess();
    } catch (err: any) {
      toast.error("Erreur upload", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const alertClass = willBeAutoApproved
    ? "flex items-center gap-3 p-3 rounded-lg border bg-green-50 border-green-200"
    : "flex items-center gap-3 p-3 rounded-lg border bg-amber-50 border-amber-200";

  const alertTextClass = willBeAutoApproved
    ? "text-[11px] text-green-800"
    : "text-[11px] text-amber-800";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest">
            Ajouter un BG pour {asset.name}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-700 block mb-1.5">
              Fichier (MP4, PNG, JPG, WEBP -- max 200MB)
            </label>
            <input
              type="file"
              accept="video/mp4,image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="w-full text-xs"
            />
            {dims && (
              <div className="text-[10px] text-neutral-500 mt-1">
                Dimensions detectees : {dims.width}x{dims.height}px
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
              placeholder="ex: Vue lac Leman drone"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div className={alertClass}>
            <AlertCircle size={14} className={willBeAutoApproved ? "text-green-600" : "text-amber-600"} />
            <p className={alertTextClass}>
              {willBeAutoApproved
                ? "Sera auto-approuve (votre role admin)."
                : "Sera envoye en attente d&apos;approbation par l&apos;admin client."}
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