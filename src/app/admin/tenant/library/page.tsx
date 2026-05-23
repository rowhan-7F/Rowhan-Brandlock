"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, AlertCircle, Search, ImageIcon,
  CheckCircle2, XCircle, Trash2, ShieldCheck, ShieldAlert,
  Library, Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";
import AdminTenantMenu from "@/components/admin/AdminTenantMenu";
import FeedbackWidget from "@/components/FeedbackWidget";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";

// ⚠ SUPPRIMÉ : import LogoutButton, ArrowLeft (gérés par AppHeader)

type LibraryImage = {
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
  size_bytes: number | null;
  created_at: string;
  client_email: string | null;
};

type Counts = {
  pending: number;
  approved: number;
  total: number;
};

type FilterStatus = "pending" | "approved" | "all";

export default function AdminLibraryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, total: 0 });
  const [filter, setFilter] = useState<FilterStatus>("pending"); // ⭐ Par défaut : à valider
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<LibraryImage | null>(null);

  // ============================================================
  //  Charger les images
  // ============================================================
  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      const params = new URLSearchParams({
        status: filter,
        limit: "100",
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/library?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur chargement");
      }

      const data = await res.json();
      setImages(data.images || []);
      setCounts(data.counts || { pending: 0, approved: 0, total: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, search, router]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // ============================================================
  //  Actions
  // ============================================================
  const handleAction = async (
    imageId: string,
    action: "approve" | "reject" | "delete"
  ) => {
    if (action === "reject") {
      const ok = await confirmDialog("Refuser cette image ?", {
        description: "Elle sera retirée définitivement de la bibliothèque.",
        confirmLabel: "Refuser",
        destructive: true,
      });
      if (!ok) return;
    }
    if (action === "delete") {
      const ok = await confirmDialog("Supprimer définitivement ?", {
        description: "Cette action est irréversible.",
        confirmLabel: "Supprimer",
        destructive: true,
      });
      if (!ok) return;
    }

    setActionLoading(imageId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const method = action === "delete" ? "DELETE" : "PATCH";
      const body = action === "delete" ? undefined : JSON.stringify({ action });

      const res = await fetch(`/api/admin/library/${imageId}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body,
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur");
      }

      const successMsg =
        action === "approve" ? "Image approuvée ✓"
        : action === "reject" ? "Image refusée"
        : "Image supprimée";
      toast.success(successMsg);
      await fetchImages();
      setSelectedImage(null);
    } catch (err: any) {
      toast.error("Action impossible", { description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================
  //  Rendering
  // ============================================================
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ⭐ NOUVEAU AppHeader unifié */}
      <AppHeader
        eyebrow="ADMINISTRATION"
        title="Bibliothèque d'images"
        backHref="/admin/tenant"
      />

      <div className="max-w-7xl mx-auto p-6">
        {/* FILTRES + RECHERCHE */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Boutons filtres */}
          <div className="flex items-center gap-1.5 bg-white rounded-xl border border-neutral-200 p-1 shrink-0">
            <FilterButton
              active={filter === "pending"}
              onClick={() => setFilter("pending")}
              icon={<ShieldAlert size={13} />}
              label="À valider"
              count={counts.pending}
              urgent={counts.pending > 0}
            />
            <FilterButton
              active={filter === "approved"}
              onClick={() => setFilter("approved")}
              icon={<ShieldCheck size={13} />}
              label="Approuvées"
              count={counts.approved}
            />
            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              icon={<Library size={13} />}
              label="Toutes"
              count={counts.total}
            />
          </div>

          {/* Recherche */}
          <div className="relative flex-1 min-w-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, marque..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* CONTENU */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto" />
          </div>
        ) : images.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((img) => (
              <ImageCard
                key={img.id}
                img={img}
                onClick={() => setSelectedImage(img)}
                onApprove={() => handleAction(img.id, "approve")}
                onReject={() => handleAction(img.id, "reject")}
                onDelete={() => handleAction(img.id, "delete")}
                actionLoading={actionLoading === img.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* MODAL DÉTAIL */}
      {selectedImage && (
        <ImageDetailModal
          img={selectedImage}
          onClose={() => setSelectedImage(null)}
          onApprove={() => handleAction(selectedImage.id, "approve")}
          onReject={() => handleAction(selectedImage.id, "reject")}
          onDelete={() => handleAction(selectedImage.id, "delete")}
          actionLoading={actionLoading === selectedImage.id}
        />
      )}

      {/* ⭐ FEEDBACK WIDGET */}
      <FeedbackWidget />
    </div>
  );
}


// ============================================================
//  FILTER BUTTON
// ============================================================
function FilterButton({
  active, onClick, icon, label, count, urgent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  urgent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition ${
        active
          ? "bg-neutral-900 text-white"
          : "text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            active
              ? "bg-white/20"
              : urgent
              ? "bg-orange-100 text-orange-700"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}


// ============================================================
//  IMAGE CARD
// ============================================================
function ImageCard({
  img, onClick, onApprove, onReject, onDelete, actionLoading,
}: {
  img: LibraryImage;
  onClick: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  actionLoading: boolean;
}) {
  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 hover:border-neutral-300 transition">
      <img
        src={img.thumbnail_url || img.public_url}
        alt={img.filename || ""}
        className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
        crossOrigin="anonymous"
        onClick={onClick}
      />

      {/* Badge status */}
      <div className="absolute top-2 left-2 pointer-events-none">
        {img.is_approved ? (
          <span className="bg-green-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1">
            <ShieldCheck size={9} />
            Validée
          </span>
        ) : (
          <span className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
            <ShieldAlert size={9} />
            À valider
          </span>
        )}
      </div>

      {/* Hover overlay avec actions */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-2">
        <div className="text-[10px] text-white font-bold truncate mb-1">
          {img.filename || "Sans nom"}
        </div>
        <div className="text-[9px] text-white/70 truncate mb-2">
          {img.client_email}
        </div>

        {/* Actions */}
        {actionLoading ? (
          <div className="text-center py-2">
            <Loader2 size={14} className="animate-spin text-white mx-auto" />
          </div>
        ) : !img.is_approved ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase tracking-wider py-1.5 rounded flex items-center justify-center gap-1 transition"
              title="Approuver"
            >
              <CheckCircle2 size={11} />
              OK
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider py-1.5 rounded flex items-center justify-center gap-1 transition"
              title="Refuser et supprimer"
            >
              <XCircle size={11} />
              NON
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-full bg-neutral-700/80 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-wider py-1.5 rounded flex items-center justify-center gap-1 transition"
            title="Supprimer"
          >
            <Trash2 size={11} />
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}


// ============================================================
//  EMPTY STATE
// ============================================================
function EmptyState({ filter }: { filter: FilterStatus }) {
  return (
    <div className="text-center py-20 px-8 rounded-2xl border border-dashed border-neutral-300 bg-white">
      <ImageIcon size={40} className="text-neutral-300 mx-auto mb-3" />
      <h3 className="text-base font-bold text-neutral-900 mb-1">
        {filter === "pending" && "Aucune image à valider"}
        {filter === "approved" && "Aucune image approuvée"}
        {filter === "all" && "Bibliothèque vide"}
      </h3>
      <p className="text-sm text-neutral-500">
        {filter === "pending" && "Tout est à jour ! Le studio n'a pas d'image en attente."}
        {filter === "approved" && "Aucune image n'a encore été validée."}
        {filter === "all" && "Aucune image n'a été uploadée pour ce tenant."}
      </p>
    </div>
  );
}


// ============================================================
//  IMAGE DETAIL MODAL
// ============================================================
function ImageDetailModal({
  img, onClose, onApprove, onReject, onDelete, actionLoading,
}: {
  img: LibraryImage;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  actionLoading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-neutral-900 truncate">
              {img.filename || "Sans nom"}
            </h3>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {img.client_email} · {new Date(img.created_at).toLocaleDateString("fr-CH")}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition shrink-0"
            title="Fermer"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Image */}
        <div className="flex-1 overflow-y-auto bg-neutral-50 flex items-center justify-center p-6">
          <img
            src={img.public_url}
            alt={img.filename || ""}
            crossOrigin="anonymous"
            className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
          />
        </div>

        {/* Metadata + Actions */}
        <div className="px-5 py-4 border-t border-neutral-200 bg-white">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs">
            <Meta label="Statut" value={
              img.is_approved
                ? <span className="text-green-600 font-bold">✓ Validée</span>
                : <span className="text-orange-600 font-bold">⚠ À valider</span>
            } />
            <Meta label="Dimensions" value={img.width && img.height ? `${img.width} × ${img.height}` : "—"} />
            <Meta label="Taille" value={img.size_bytes ? `${Math.round(img.size_bytes / 1024)} Ko` : "—"} />
            <Meta label="Uploadeur" value={img.client_email || "—"} />
          </div>

          <div className="flex items-center justify-end gap-2">
            {actionLoading ? (
              <Loader2 size={16} className="animate-spin text-neutral-400" />
            ) : !img.is_approved ? (
              <>
                <button
                  type="button"
                  onClick={onReject}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition"
                >
                  <XCircle size={13} />
                  Refuser & supprimer
                </button>
                <button
                  type="button"
                  onClick={onApprove}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition"
                >
                  <CheckCircle2 size={13} />
                  Approuver
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition"
              >
                <Trash2 size={13} />
                Supprimer définitivement
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
        {label}
      </div>
      <div className="text-xs text-neutral-700 truncate mt-0.5">{value}</div>
    </div>
  );
}
