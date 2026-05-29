"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import {
  X, Search, Upload, Image as ImageIcon, Check, Loader2,
  AlertCircle, ShieldCheck, ShieldAlert, Library, Sparkles,
} from "lucide-react";

// ============================================================
//  TYPES
// ============================================================

export type LibraryImage = {
  id: string;
  public_url: string;
  thumbnail_url: string | null;
  filename: string | null;
  brand_name: string | null;
  tags: string[] | null;
  is_approved: boolean;
  uploaded_by: string | null;
  approved_at: string | null;
  width: number | null;
  height: number | null;
  dominant_colors: string[] | null;
  related_task_id?: string | null; // ⭐ Lien optionnel avec un brief
};

export type SelectedImage = {
  id: string;
  url: string;
  isApproved: boolean;
};

type MediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (image: SelectedImage) => void;
  tenantId: string;
  userRole: "tenant_admin" | "graphist" | "super_admin";
  taskId?: string | null; // ⭐ Si fourni, les images liées remontent en premier
};

// ============================================================
//  COMPOSANT PRINCIPAL
// ============================================================

export default function MediaPicker({
  open,
  onClose,
  onSelect,
  tenantId,
  userRole,
  taskId,
}: MediaPickerProps) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadLibrary = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("brand_images")
      .select(
        "id, public_url, thumbnail_url, filename, brand_name, tags, is_approved, uploaded_by, approved_at, width, height, dominant_colors, related_task_id"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement bibliothèque:", error);
    } else {
      setImages((data as LibraryImage[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantId]);

  const filtered = images.filter((img) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      img.filename?.toLowerCase().includes(q) ||
      img.brand_name?.toLowerCase().includes(q) ||
      img.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  // ⭐ Sépare les images du brief courant et les autres
  const briefImages = taskId
    ? filtered.filter((img) => img.related_task_id === taskId)
    : [];
  const otherImages = taskId
    ? filtered.filter((img) => img.related_task_id !== taskId)
    : filtered;

  const handleSelect = (img: LibraryImage) => {
    onSelect({
      id: img.id,
      url: img.public_url,
      isApproved: img.is_approved,
    });
    onClose();
  };

  const handleUploaded = (newImg: LibraryImage) => {
    setImages((prev) => [newImg, ...prev]);
    setTab("library");
    onSelect({
      id: newImg.id,
      url: newImg.public_url,
      isApproved: newImg.is_approved,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-black italic uppercase tracking-tighter">
            Choisir une image
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pt-3 flex items-center gap-1 border-b border-neutral-200 shrink-0">
          <TabButton
            active={tab === "library"}
            onClick={() => setTab("library")}
            icon={<Library size={14} />}
            label={`Médias (${images.length})`}
          />
          <TabButton
            active={tab === "upload"}
            onClick={() => setTab("upload")}
            icon={<Upload size={14} />}
            label="Importer"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "library" ? (
            <LibraryTab
              briefImages={briefImages}
              otherImages={otherImages}
              loading={loading}
              search={search}
              setSearch={setSearch}
              onSelect={handleSelect}
              hasBriefContext={!!taskId}
            />
          ) : (
            <UploadTab
              tenantId={tenantId}
              userRole={userRole}
              onUploaded={handleUploaded}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition ${
        active
          ? "border-orange-500 text-orange-600"
          : "border-transparent text-neutral-500 hover:text-neutral-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ============================================================
//  LIBRARY TAB — Avec section "Images du brief" en haut
// ============================================================
function LibraryTab({
  briefImages,
  otherImages,
  loading,
  search,
  setSearch,
  onSelect,
  hasBriefContext,
}: {
  briefImages: LibraryImage[];
  otherImages: LibraryImage[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onSelect: (img: LibraryImage) => void;
  hasBriefContext: boolean;
}) {
  const totalImages = briefImages.length + otherImages.length;

  return (
    <>
      <div className="relative mb-5">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, tag, marque..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 text-sm outline-none focus:border-orange-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto" />
        </div>
      ) : totalImages === 0 ? (
        <div className="text-center py-16 px-8 rounded-2xl border border-dashed border-neutral-300">
          <ImageIcon size={36} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 mb-1">
            {search
              ? "Aucun résultat pour cette recherche"
              : "Médias vides pour ce tenant"}
          </p>
          <p className="text-[11px] text-neutral-400">
            Utilise l&apos;onglet &quot;Importer&quot; pour ajouter ta première image
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ⭐ SECTION IMAGES DU BRIEF */}
          {hasBriefContext && briefImages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <Sparkles size={11} />
                  Images de ce brief
                </div>
                <span className="text-[11px] text-neutral-500">
                  {briefImages.length} image{briefImages.length > 1 ? "s" : ""} ajoutée{briefImages.length > 1 ? "s" : ""} par l&apos;admin
                </span>
              </div>
              <div className="bg-gradient-to-br from-orange-50/50 to-amber-50/50 border-2 border-orange-200 rounded-2xl p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {briefImages.map((img) => (
                    <ImageCard
                      key={img.id}
                      img={img}
                      onClick={() => onSelect(img)}
                      isBriefImage
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BIBLIOTHÈQUE GÉNÉRALE */}
          {otherImages.length > 0 && (
            <div>
              {hasBriefContext && briefImages.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                    <Library size={11} />
                    Médias
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    {otherImages.length} autre{otherImages.length > 1 ? "s" : ""} image{otherImages.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {otherImages.map((img) => (
                  <ImageCard key={img.id} img={img} onClick={() => onSelect(img)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ============================================================
//  IMAGE CARD — Avec ribbon "BRIEF" diagonal
// ============================================================
function ImageCard({
  img,
  onClick,
  isBriefImage = false,
}: {
  img: LibraryImage;
  onClick: () => void;
  isBriefImage?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border-2 transition ${
        isBriefImage
          ? "border-orange-300 hover:border-orange-500 hover:shadow-xl shadow-orange-100"
          : "border-neutral-200 hover:border-orange-400 hover:shadow-lg"
      }`}
    >
      <img
        src={img.thumbnail_url || img.public_url}
        alt={img.filename || ""}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        crossOrigin="anonymous"
      />

      {/* ⭐ RIBBON DIAGONAL "BRIEF" */}
      {isBriefImage && (
        <div className="absolute top-0 right-0 overflow-hidden w-16 h-16 pointer-events-none">
          <div
            className="absolute bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[8px] font-black uppercase tracking-widest py-0.5 shadow-md"
            style={{
              right: "-22px",
              top: "10px",
              width: "80px",
              transform: "rotate(45deg)",
              textAlign: "center",
            }}
          >
            BRIEF
          </div>
        </div>
      )}

      {/* Badge approuvée / en attente */}
      {img.is_approved ? (
        <div className="absolute top-2 left-2 bg-green-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1">
          <ShieldCheck size={10} />
          Validée
        </div>
      ) : (
        <div className="absolute top-2 left-2 bg-orange-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1">
          <ShieldAlert size={10} />
          En attente
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition">
        <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
          <div className="text-[10px] font-bold truncate">
            {img.filename || "Sans nom"}
          </div>
          {img.tags && img.tags.length > 0 && (
            <div className="text-[9px] opacity-80 truncate mt-0.5">
              {img.tags.slice(0, 3).join(" · ")}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================
//  UPLOAD TAB (inchangé)
// ============================================================
function UploadTab({
  tenantId,
  userRole,
  onUploaded,
}: {
  tenantId: string;
  userRole: "tenant_admin" | "graphist" | "super_admin";
  onUploaded: (img: LibraryImage) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const willBeApproved = userRole === "tenant_admin" || userRole === "super_admin";

  const handleFileChange = (f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("Seules les images sont autorisées (JPG, PNG, WebP, etc.)");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Image trop volumineuse (max 10 Mo)");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    handleFileChange(f || null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenantId", tenantId);

      const res = await fetch("/api/studio/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur upload");

      onUploaded(data.image as LibraryImage);
      setFile(null);
      setPreview(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        className={`mb-5 p-3 rounded-xl border text-xs flex items-start gap-2 ${
          willBeApproved
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-orange-50 border-orange-200 text-orange-800"
        }`}
      >
        {willBeApproved ? (
          <ShieldCheck size={14} className="shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
        )}
        <div className="leading-relaxed">
          {willBeApproved ? (
            <>
              <strong>Validation automatique :</strong> en tant qu&apos;administrateur,
              ton import est directement marqué comme validé.
            </>
          ) : (
            <>
              <strong>Validation requise :</strong> ton import sera marqué comme{" "}
              <strong>&quot;en attente&quot;</strong> jusqu&apos;à ce qu&apos;un administrateur le valide.
              Tu peux quand même l&apos;utiliser immédiatement dans tes projets.
            </>
          )}
        </div>
      </div>

      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-neutral-300 rounded-2xl p-12 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition"
        >
          <Upload size={32} className="text-neutral-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-neutral-700 mb-1">
            Glisse une image ici, ou clique pour parcourir
          </p>
          <p className="text-[11px] text-neutral-400">
            JPG, PNG, WebP · 10 Mo max
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>
      ) : (
        <div>
          <div className="rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50 mb-4">
            <img
              src={preview!}
              alt="Aperçu"
              className="w-full max-h-80 object-contain"
            />
          </div>

          <div className="flex items-center justify-between mb-4 px-1">
            <div>
              <div className="text-sm font-bold text-neutral-900">
                {file.name}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                {(file.size / 1024).toFixed(0)} Ko · {file.type}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleFileChange(null)}
              className="text-xs text-neutral-500 hover:text-red-500"
            >
              Annuler
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Import en cours...
              </>
            ) : (
              <>
                <Check size={14} /> Importer dans les médias
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
