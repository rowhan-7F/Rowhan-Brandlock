"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, AlertCircle, Search, ImageIcon, Check, CheckSquare,
  CheckCircle2, XCircle, Trash2, ShieldCheck, ShieldAlert,
  Library, Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import StudioHeader from "@/components/StudioHeader";
import AdminTenantMenu from "@/components/admin/AdminTenantMenu";
import FeedbackWidget from "@/components/FeedbackWidget";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import AdminMobileHeader from "@/components/admin/AdminMobileHeader";

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

function AdminLibraryPageInner() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, total: 0 });
  const [filter, setFilter] = useState<FilterStatus>("pending"); // ⭐ Par défaut : à valider
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<LibraryImage | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const imagesRef = useRef<LibraryImage[]>([]);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ============================================================
  //  Charger les images
  // ============================================================
  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (reset) setLoading(true); else setLoadingMore(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push("/"); return; }

        const offset = reset ? 0 : imagesRef.current.length;
        const params = new URLSearchParams({
          status: filter,
          limit: "60",
          offset: String(offset),
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
        const batch: LibraryImage[] = data.images || [];
        setImages((prev) => {
          const next = reset ? batch : [...prev, ...batch];
          imagesRef.current = next;
          return next;
        });
        setCounts(data.counts || { pending: 0, approved: 0, total: 0 });
        setHasMore(batch.length === 60);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [filter, search, router]
  );

  const fetchImages = useCallback(() => fetchPage(true), [fetchPage]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Scroll infini : charge le paquet suivant quand la sentinelle est visible
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          fetchPage(false);
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, fetchPage]);

  // ============================================================
  //  Actions
  // ============================================================
  const handleAction = async (
    imageId: string,
    action: "approve" | "reject" | "delete"
  ) => {
    if (action === "reject") {
      const ok = await confirmDialog("Refuser cette image ?", {
        description: "Elle sera retirée définitivement des médias.",
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
  //  Phase 9.4.x : Selection multiple + suppression groupee (video-ready)
  // ============================================================
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => setSelectedIds(new Set(images.map((i) => i.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelectMode = () => { setSelectMode(false); clearSelection(); };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const ok = await confirmDialog(`Supprimer ${ids.length} média(s) ?`, {
      description: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    setActionLoading("__batch__");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/admin/library/${id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
          }).then((r) => r.ok)
        )
      );
      const okCount = results.filter(Boolean).length;
      const failCount = ids.length - okCount;
      if (failCount === 0) toast.success(`${okCount} média(s) supprimé(s)`);
      else toast.error(`${failCount} échec(s)`, { description: `${okCount}/${ids.length} supprimé(s)` });
      await fetchImages();
      exitSelectMode();
    } catch (err: any) {
      toast.error("Suppression impossible", { description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================
  //  Tout approuver (bulk) — Phase 9.3.23
  // ============================================================
  const handleApproveAll = async () => {
    const pendingImgs = images.filter((img) => !img.is_approved);
    if (pendingImgs.length === 0) return;
    const ok = await confirmDialog(
      `Approuver les ${pendingImgs.length} images en attente ?`,
      { confirmLabel: "Tout approuver" }
    );
    if (!ok) return;

    setActionLoading("__all__");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      for (const img of pendingImgs) {
        await fetch(`/api/admin/library/${img.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "approve" }),
        });
      }
      toast.success(`${pendingImgs.length} images approuvees`);
      await fetchImages();
    } catch (err: any) {
      toast.error("Erreur", { description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================
  //  Rendering
  // ============================================================

  const handleLogout = async () => {
    const ok = await confirmDialog("Se deconnecter ?", {
      description: "Tu vas etre redirige vers la page d'accueil.",
      confirmLabel: "Deconnexion",
    });
    if (!ok) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <AdminMobileHeader title="Médias" tenantName="Brand" />
      {/* ⭐ NOUVEAU AppHeader unifié */}
        <div className="hidden md:block">
      <StudioHeader
        backHref="/admin/tenant"
        eyebrowMain="ADMINISTRATION"
        eyebrowSubtitle={tenantName}
        title="Médias"
        showAdminMenu={true}
        adminMenuActive="library"
        tenantId={tenantId}
        showNotifications={true}
        showLogout={true}
        onLogout={handleLogout}
      />
        </div>

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

          {/* Phase 9.3.23 : Tout approuver (visible si filtre pending) */}
          {filter === "pending" && counts.pending > 0 && (
            <button
              type="button"
              onClick={handleApproveAll}
              disabled={actionLoading === "__all__"}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50"
              style={{ backgroundColor: "#16a34a" }}
            >
              {actionLoading === "__all__" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Tout approuver ({counts.pending})
            </button>
          )}

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

        {/* Phase 9.4.x : Barre selection multiple (video-ready) */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            disabled={images.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition disabled:opacity-40"
            style={selectMode ? { backgroundColor: "#B11E2F", color: "white", borderColor: "#B11E2F" } : { backgroundColor: "white", color: "#525252", borderColor: "#e5e5e5" }}
          >
            <CheckSquare size={14} />
            {selectMode ? "Annuler la sélection" : "Sélectionner"}
          </button>
          {selectMode && (
            <>
              <span className="text-xs font-bold text-neutral-600">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={selectedIds.size === images.length ? clearSelection : selectAllVisible}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 transition"
              >
                {selectedIds.size === images.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0 || actionLoading === "__batch__"}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-40"
                style={{ backgroundColor: "#dc2626" }}
              >
                {actionLoading === "__batch__" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Supprimer la sélection
              </button>
            </>
          )}
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
                selectMode={selectMode}
                selected={selectedIds.has(img.id)}
                onToggleSelect={() => toggleSelect(img.id)}
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

        {/* Sentinelle scroll infini */}
        {!loading && images.length > 0 && (
          <div ref={sentinelRef} className="py-6 flex items-center justify-center">
            {loadingMore ? (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            ) : !hasMore ? (
              <span className="text-[11px] text-neutral-400">Tous les médias sont affichés</span>
            ) : null}
          </div>
        )}

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
  selectMode, selected, onToggleSelect,
}: {
  img: LibraryImage;
  onClick: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  actionLoading: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <div className={`group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border transition ${selected ? "border-[#B11E2F] ring-2 ring-[#B11E2F]" : "border-neutral-200 hover:border-neutral-300"}`}>
      {selectMode && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className="absolute inset-0 z-20 flex items-start justify-end p-2"
          style={{ backgroundColor: selected ? "rgba(177,30,47,0.22)" : "rgba(0,0,0,0.04)" }}
          aria-label="Sélectionner"
        >
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center border-2"
            style={selected ? { backgroundColor: "#B11E2F", borderColor: "#B11E2F" } : { backgroundColor: "rgba(255,255,255,0.92)", borderColor: "#ffffff" }}
          >
            {selected && <Check size={14} className="text-white" />}
          </span>
        </button>
      )}
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
        {filter === "all" && "Médias vides"}
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

export default function AdminLibraryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-neutral-400" size={28} /></div>}>
      <AdminLibraryPageInner />
    </Suspense>
  );
}
