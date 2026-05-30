"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, AlertCircle, Search, ImageIcon, Upload, X,
  Clock, CheckCircle2, Filter, FolderUp, FileImage,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import StudioHeader from "@/components/StudioHeader";
import StudioMenu from "@/components/studio/StudioMenu";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";

const BRAND_BORDEAUX = "#B11E2F";

type BrandImage = {
  id: string;
  public_url: string;
  thumbnail_url: string | null;
  filename: string | null;
  brand_name: string | null;
  tags: string[] | null;
  is_approved: boolean;
  uploaded_by: string | null;
  uploaded_at: string | null;
  approved_at: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  batch_name: string | null;
  description: string | null;
  client_email: string | null;
  created_at: string;
};

type Counts = { pending: number; approved: number; total: number };
type FilterStatus = "pending" | "approved" | "all";

export default function StudioLibraryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [images, setImages] = useState<BrandImage[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, total: 0 });
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [detailImage, setDetailImage] = useState<BrandImage | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const imagesRef = useRef<BrandImage[]>([]);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    async (currentTenantId: string | null, reset: boolean) => {
      if (!currentTenantId) return;
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (!reset) setLoadingMore(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push("/"); return; }

        const offset = reset ? 0 : imagesRef.current.length;
        const params = new URLSearchParams({ status: filter, limit: "60", offset: String(offset) });
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/library?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error("Erreur chargement", { description: data.error });
          return;
        }

        const data = await res.json();
        const batch: BrandImage[] = data.images || [];
        setImages((prev) => {
          const next = reset ? batch : [...prev, ...batch];
          imagesRef.current = next;
          return next;
        });
        setCounts(data.counts || { pending: 0, approved: 0, total: 0 });
        setHasMore(batch.length === 60);
      } finally {
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [filter, search, router]
  );

  const fetchImages = useCallback(
    (currentTenantId: string | null) => fetchPage(currentTenantId, true),
    [fetchPage]
  );

  // Scroll infini : charge le paquet suivant quand la sentinelle est visible
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          fetchPage(tenantId, false);
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, tenantId, fetchPage, images.length]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("tenant_id, role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile || !profile.tenant_id) {
        router.push("/");
        return;
      }

      setTenantId(profile.tenant_id);

      // Fetch tenant name pour le header
      const { data: tenantConfig } = await supabase
        .from("tenant_configs")
        .select("tenant_name")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();
      if (tenantConfig?.tenant_name) {
        setTenantName(tenantConfig.tenant_name);
      }
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (tenantId) {
      fetchImages(tenantId);
    }
  }, [tenantId, fetchImages]);

  if (loading) {
  const handleLogout = async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d'accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    window.location.href = "/";
  };

    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!tenantId) return null;
  const handleLogout = async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d'accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    window.location.href = "/";
  };


  return (
    <div className="min-h-screen bg-neutral-50">
      <StudioHeader
        backHref="/"
        eyebrowMain="STUDIO"
        eyebrowSubtitle={tenantName}
        title="Médias"
        showStudioMenu={true}
        studioMenuActive="library"
        tenantId={tenantId}
        showNotifications={true}
        showLogout={true}
        onLogout={handleLogout}
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header section */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <p className="text-sm text-neutral-600">
              Vos uploads d'images du tenant. Les images en <span className="font-bold text-orange-600">attente</span> seront validees par votre administrateur.
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {counts.total} image(s) au total · {counts.pending} en attente · {counts.approved} approuvees
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition hover:opacity-90 shrink-0"
            style={{ backgroundColor: BRAND_BORDEAUX }}
          >
            <Upload size={14} />
            Uploader
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label="Toutes" count={counts.total} />
          <FilterButton active={filter === "pending"} onClick={() => setFilter("pending")} label="En attente" count={counts.pending} variant="pending" />
          <FilterButton active={filter === "approved"} onClick={() => setFilter("approved")} label="Approuvees" count={counts.approved} variant="approved" />
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (nom de fichier, description)..."
                className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-xs focus:border-[#B11E2F] focus:outline-none focus:ring-2 focus:ring-[#B11E2F]/20"
              />
            </div>
          </div>
        </div>

        {/* Grid */}
        {images.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
            <ImageIcon size={32} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-500">Aucune image dans les médias.</p>
            <p className="text-xs text-neutral-400 mt-1">Cliquez sur "Uploader" pour commencer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((img) => (
              <ImageCard key={img.id} image={img} onClick={() => setDetailImage(img)} />
            ))}
          </div>
        )}
        {/* Sentinelle scroll infini */}
        {images.length > 0 && (
          <div ref={sentinelRef} className="py-6 flex items-center justify-center">
            {loadingMore ? (
              <span className="text-[11px] text-neutral-400">Chargement…</span>
            ) : !hasMore ? (
              <span className="text-[11px] text-neutral-400">Tous les médias sont affichés</span>
            ) : null}
          </div>
        )}
      </main>

      {detailImage && (
        <DetailModal image={detailImage} onClose={() => setDetailImage(null)} />
      )}

      {uploadOpen && tenantId && (
        <UploadModal
          tenantId={tenantId}
          onClose={() => setUploadOpen(false)}
          onSuccess={() => {
            setUploadOpen(false);
            fetchImages(tenantId);
          }}
        />
      )}
    </div>
  );
}

function FilterButton({
  active, onClick, label, count, variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  variant?: "default" | "pending" | "approved";
}) {
  const activeStyle = active
    ? { backgroundColor: BRAND_BORDEAUX, color: "white", borderColor: BRAND_BORDEAUX }
    : {};

  const badgeClass = variant === "pending"
    ? (active ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700")
    : variant === "approved"
    ? (active ? "bg-white/20 text-white" : "bg-green-100 text-green-700")
    : (active ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600");

  return (
    <button
      type="button"
      onClick={onClick}
      style={activeStyle}
      className={"px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition border flex items-center gap-1.5 " + (active ? "" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50")}
    >
      {label}
      <span className={"text-[9px] font-black px-1.5 py-0.5 rounded " + badgeClass}>
        {count}
      </span>
    </button>
  );
}

function ImageCard({ image, onClick }: { image: BrandImage; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative bg-white rounded-xl border border-neutral-200 overflow-hidden hover:border-neutral-300 transition text-left"
    >
      <div className="aspect-square bg-neutral-100 relative overflow-hidden">
        {image.thumbnail_url || image.public_url ? (
          <img
            src={image.thumbnail_url || image.public_url}
            alt={image.filename || ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileImage size={24} className="text-neutral-300" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          {image.is_approved ? (
            <span className="bg-green-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded flex items-center gap-1">
              <CheckCircle2 size={9} />
              Approuvee
            </span>
          ) : (
            <span className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded flex items-center gap-1 animate-pulse">
              <Clock size={9} />
              En attente
            </span>
          )}
        </div>
      </div>

      <div className="p-2">
        <div className="text-xs font-medium text-neutral-900 truncate">
          {image.filename || "Sans nom"}
        </div>
        {image.batch_name && (
          <div className="text-[10px] text-neutral-400 truncate mt-0.5">
            {image.batch_name}
          </div>
        )}
      </div>
    </button>
  );
}

function DetailModal({ image, onClose }: { image: BrandImage; onClose: () => void }) {
  const handleLogout = async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d'accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-900 truncate">{image.filename || "Image"}</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          <div className="bg-neutral-100 rounded-lg overflow-hidden flex items-center justify-center">
            <img src={image.public_url} alt={image.filename || ""} className="max-w-full max-h-[50vh] object-contain" />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <DetailField label="Statut" value={image.is_approved ? "Approuvee" : "En attente"} highlight={image.is_approved ? "green" : "orange"} />
            {image.batch_name && <DetailField label="Batch" value={image.batch_name} />}
            {image.width && image.height && <DetailField label="Dimensions" value={`${image.width}x${image.height}`} />}
            {image.size_bytes && <DetailField label="Taille" value={`${(image.size_bytes / 1024).toFixed(0)} ko`} />}
          </div>

          {image.description && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Description IA</div>
              <p className="text-xs text-neutral-700">{image.description}</p>
            </div>
          )}

          {image.tags && image.tags.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Tags</div>
              <div className="flex flex-wrap gap-1">
                {image.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "orange" }) {
  const valueClass = highlight === "green" ? "text-green-700" : highlight === "orange" ? "text-orange-700" : "text-neutral-900";
  const handleLogout = async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d'accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-0.5">{label}</div>
      <div className={`font-medium ${valueClass}`}>{value}</div>
    </div>
  );
}

function UploadModal({
  tenantId, onClose, onSuccess,
}: {
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [batchName, setBatchName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const arr = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...arr]);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Aucun fichier selectionne");
      return;
    }

    setUploading(true);
    setProgress({ done: 0, total: files.length });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      formData.append("batch_name", batchName.trim() || "Sans nom");

      const res = await fetch("/api/library/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur upload");

      toast.success("Upload reussi", {
        description: `${data.uploaded} image(s) en attente de validation.`,
      });
      onSuccess();
    } catch (err: any) {
      toast.error("Upload echoue", { description: err.message });
    } finally {
      setUploading(false);
    }
  };
  const handleLogout = async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d'accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    window.location.href = "/";
  };


  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Nouveau</div>
            <h3 className="text-base font-bold text-neutral-900">Upload médias</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">
              Nom du batch (optionnel)
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="Ex: Shooting printemps 2026"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-[#B11E2F] focus:outline-none focus:ring-2 focus:ring-[#B11E2F]/20"
              disabled={uploading}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="border-2 border-dashed border-neutral-300 rounded-lg p-4 hover:border-neutral-400 hover:bg-neutral-50 transition flex flex-col items-center gap-2 disabled:opacity-50"
            >
              <FileImage size={20} className="text-neutral-400" />
              <span className="text-xs font-bold text-neutral-700">Fichiers</span>
              <span className="text-[10px] text-neutral-400">Selection multiple</span>
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
              className="border-2 border-dashed border-neutral-300 rounded-lg p-4 hover:border-neutral-400 hover:bg-neutral-50 transition flex flex-col items-center gap-2 disabled:opacity-50"
            >
              <FolderUp size={20} className="text-neutral-400" />
              <span className="text-xs font-bold text-neutral-700">Dossier</span>
              <span className="text-[10px] text-neutral-400">Tout le dossier</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error - webkitdirectory n'est pas dans les types React standards
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          {files.length > 0 && (
            <div className="bg-neutral-50 rounded-lg p-3">
              <div className="text-xs font-bold text-neutral-700 mb-2">
                {files.length} image(s) selectionnee(s)
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {files.slice(0, 5).map((f, i) => (
                  <div key={i} className="text-xs text-neutral-600 truncate">{f.name}</div>
                ))}
                {files.length > 5 && (
                  <div className="text-xs text-neutral-400">+ {files.length - 5} autres...</div>
                )}
              </div>
            </div>
          )}

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="text-xs text-orange-900">
              <strong>Workflow validation :</strong> Vos uploads passeront en statut <em>"En attente"</em>. Votre administrateur les approuvera ensuite depuis son dashboard.
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-white rounded-lg transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="text-white text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-lg transition flex items-center gap-1.5 disabled:opacity-40"
            style={{ backgroundColor: BRAND_BORDEAUX }}
          >
            {uploading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Upload...
              </>
            ) : (
              <>
                <Upload size={12} />
                Uploader {files.length > 0 ? `(${files.length})` : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
