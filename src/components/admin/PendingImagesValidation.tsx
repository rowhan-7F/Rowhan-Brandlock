"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle, ShieldAlert, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  PENDING IMAGES VALIDATION — Inline dans la page validation projet
//  Extrait les images non-validées des slides du projet
//  et permet à l'admin de les valider d'un click
// ============================================================

type PendingImage = {
  id: string;
  public_url: string;
  filename: string | null;
  slideIndex: number;
};

type Props = {
  projectId: string;
  slides: any[];
  brandColor?: string;
  onImagesValidated?: () => void;
};

export default function PendingImagesValidation({
  projectId,
  slides,
  brandColor = "#F26522",
  onImagesValidated,
}: Props) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ============================================================
  //  Extraire les images des slides
  // ============================================================
  const extractImagesFromSlides = useCallback(() => {
    const imageRefs: Array<{ slideIndex: number; imageData: any }> = [];

    slides.forEach((slide, idx) => {
      const inputs = slide.inputs || {};
      Object.entries(inputs).forEach(([key, val]: [string, any]) => {
        if (val?.kind === "image" && val.value) {
          imageRefs.push({
            slideIndex: idx,
            imageData: val.value,
          });
        }
      });
    });

    return imageRefs;
  }, [slides]);

  // ============================================================
  //  Filtrer celles qui sont en attente (interroge la DB)
  // ============================================================
  const fetchPendingStatus = useCallback(async () => {
    setLoading(true);
    try {
      const imageRefs = extractImagesFromSlides();
      if (imageRefs.length === 0) {
        setPendingImages([]);
        setLoading(false);
        return;
      }

      const imageIds = imageRefs.map((r) => r.imageData.id).filter(Boolean);
      if (imageIds.length === 0) {
        setPendingImages([]);
        setLoading(false);
        return;
      }

      // Récupère les status depuis la DB
      const { data, error } = await supabase
        .from("brand_images")
        .select("id, public_url, filename, is_approved")
        .in("id", imageIds);

      if (error) {
        console.error("[PendingImagesValidation] fetch error:", error);
        setPendingImages([]);
        setLoading(false);
        return;
      }

      // Combine : garde uniquement les non-validées
      const pendingMap = new Map<string, PendingImage>();
      imageRefs.forEach((ref) => {
        const dbImage = data?.find((d: any) => d.id === ref.imageData.id);
        if (dbImage && !dbImage.is_approved) {
          // Évite les doublons (une image peut être dans plusieurs slides)
          if (!pendingMap.has(dbImage.id)) {
            pendingMap.set(dbImage.id, {
              id: dbImage.id,
              public_url: dbImage.public_url,
              filename: dbImage.filename,
              slideIndex: ref.slideIndex,
            });
          }
        }
      });

      setPendingImages(Array.from(pendingMap.values()));
    } finally {
      setLoading(false);
    }
  }, [extractImagesFromSlides]);

  useEffect(() => {
    fetchPendingStatus();
  }, [fetchPendingStatus]);

  // ============================================================
  //  Actions
  // ============================================================
  const handleAction = async (imageId: string, action: "approve" | "reject") => {
    if (action === "reject" && !confirm("Refuser et supprimer cette image ?")) return;

    setActionLoading(imageId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/library/${imageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur");
      }

      // Refresh
      await fetchPendingStatus();
      onImagesValidated?.();
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAll = async () => {
    if (!confirm(`Approuver les ${pendingImages.length} images en attente ?`)) return;

    setActionLoading("__all__");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Sequential pour éviter rate limit
      for (const img of pendingImages) {
        await fetch(`/api/admin/library/${img.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "approve" }),
        });
      }
      await fetchPendingStatus();
      onImagesValidated?.();
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================
  //  Rendering
  // ============================================================
  if (loading) {
    return (
      <section className="bg-white border border-neutral-200 rounded-xl p-4 text-center">
        <Loader2 size={14} className="animate-spin text-neutral-400 mx-auto" />
      </section>
    );
  }

  if (pendingImages.length === 0) {
    return (
      <section className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2 text-xs text-green-700">
        <CheckCircle2 size={14} className="shrink-0" />
        Toutes les images de ce projet sont validées
      </section>
    );
  }

  return (
    <section className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-orange-700 flex items-center gap-1.5">
          <ShieldAlert size={12} />
          Images à valider ({pendingImages.length})
        </h3>
        {pendingImages.length > 1 && (
          <button
            type="button"
            onClick={handleApproveAll}
            disabled={actionLoading === "__all__"}
            className="text-[10px] font-bold uppercase tracking-wider text-orange-700 hover:text-orange-900 transition disabled:opacity-50 flex items-center gap-1"
          >
            {actionLoading === "__all__" ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <CheckCircle2 size={10} />
            )}
            Tout approuver
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {pendingImages.map((img) => (
          <div
            key={img.id}
            className="relative aspect-square rounded-lg overflow-hidden bg-white border border-orange-200 group"
          >
            <img
              src={img.public_url}
              alt={img.filename || ""}
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
            />

            {/* Badge slide */}
            <div className="absolute top-1 left-1 bg-white/95 text-neutral-700 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
              Slide {img.slideIndex + 1}
            </div>

            {/* Actions hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-1.5">
              {actionLoading === img.id ? (
                <div className="text-center py-1">
                  <Loader2 size={12} className="animate-spin text-white mx-auto" />
                </div>
              ) : (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleAction(img.id, "approve")}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white text-[9px] font-black uppercase tracking-wider py-1 rounded flex items-center justify-center gap-0.5 transition"
                  >
                    <CheckCircle2 size={9} />
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(img.id, "reject")}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white text-[9px] font-black uppercase tracking-wider py-1 rounded flex items-center justify-center gap-0.5 transition"
                  >
                    <XCircle size={9} />
                    NON
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[10px] text-orange-700/80">
        💡 Ces images ont été uploadées par le graphiste et nécessitent ta validation.
      </div>
    </section>
  );
}
