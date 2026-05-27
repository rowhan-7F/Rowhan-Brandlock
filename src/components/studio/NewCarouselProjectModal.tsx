// ============================================================
//  Modal de creation d un nouveau projet carousel.
//  Sprint 2 : selection du format (6 formats image)
//  Le templateKey choisi est envoye dans le POST.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Send, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";

// ============================================================
// TYPES
// ============================================================

type Task = {
  id: string;
  title: string;
  status: string;
};

type NewCarouselProjectModalProps = {
  open: boolean;
  onClose: () => void;
  brandColor?: string;
};

type CarouselFormat = {
  templateKey: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  platform: string;
  description: string;
};

// ============================================================
// FORMATS DISPONIBLES (correspondants aux templates DB)
// ============================================================

const CAROUSEL_FORMATS: CarouselFormat[] = [
  {
    templateKey: "carrousel_instagram",
    label: "IG Feed Portrait",
    width: 1080,
    height: 1350,
    aspectRatio: "4:5",
    platform: "Instagram",
    description: "Format historique, recommande pour le feed",
  },
  {
    templateKey: "carrousel_instagram_square",
    label: "IG Feed Square",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    platform: "Instagram",
    description: "Format carre, compatible Instagram + LinkedIn",
  },
  {
    templateKey: "carrousel_linkedin_square",
    label: "LinkedIn",
    width: 1200,
    height: 1200,
    aspectRatio: "1:1",
    platform: "LinkedIn",
    description: "Format professionnel, B2B / institutionnel",
  },


  {
    templateKey: "carrousel_facebook",
    label: "Facebook Link",
    width: 1200,
    height: 627,
    aspectRatio: "1.91:1",
    platform: "Facebook",
    description: "Format horizontal pour partage de lien",
  },
];

const DEFAULT_TEMPLATE_KEY = "carrousel_instagram";

// ============================================================
// COMPONENT
// ============================================================

export default function NewCarouselProjectModal({
  open,
  onClose,
  brandColor = "#B11E2F",
}: NewCarouselProjectModalProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [templateKey, setTemplateKey] = useState<string>(DEFAULT_TEMPLATE_KEY);
  const [taskId, setTaskId] = useState<string>("");

  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch tasks
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoadingTasks(true);
      const { data, error } = await supabase
        .from("studio_tasks")
        .select("id, title, status")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (error) console.error("[NewCarouselProjectModal] briefs error:", error);
        else setOpenTasks(data || []);
        setLoadingTasks(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  // Reset state au close
  useEffect(() => {
    if (!open) {
      setTitle("");
      setTemplateKey(DEFAULT_TEMPLATE_KEY);
      setTaskId("");
    }
  }, [open]);

  if (!open) return null;

  // Format selectionne
  const selectedFormat = CAROUSEL_FORMATS.find((f) => f.templateKey === templateKey) || CAROUSEL_FORMATS[0];

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const projectTitle = title.trim() || `Nouveau projet · ${new Date().toLocaleDateString("fr-CH")}`;

      const res = await fetch("/api/studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectTitle,
          templateKey,
          taskId: taskId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur creation");

      onClose();
      router.push(`/studio/${data.project.id}`);
    } catch (err: any) {
      toast.error("Impossible de creer le projet", { description: err.message });
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Nouveau projet carousel</h2>
            <p className="text-sm text-gray-500 mt-0.5">Choisis le format adapte a ta plateforme</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titre du projet
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Nouveau projet · ${new Date().toLocaleDateString("fr-CH")}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{ "--tw-ring-color": brandColor } as any}
            />
          </div>

          {/* Selecteur de format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CAROUSEL_FORMATS.map((fmt) => {
                const isSelected = templateKey === fmt.templateKey;
                return (
                  <button
                    key={fmt.templateKey}
                    type="button"
                    onClick={() => setTemplateKey(fmt.templateKey)}
                    className="relative p-3 border-2 rounded-lg text-left transition-all"
                    style={{
                      borderColor: isSelected ? brandColor : "#E5E7EB",
                      backgroundColor: isSelected ? `${brandColor}08` : "white",
                    }}
                  >
                    {/* Mini-preview du ratio */}
                    <div className="flex items-center justify-center h-12 mb-2">
                      <div
                        className="border-2 border-gray-300 bg-gray-50"
                        style={{
                          width: fmt.aspectRatio === "1.91:1" ? "48px" : 
                                 fmt.aspectRatio === "9:16" ? "20px" :
                                 fmt.aspectRatio === "4:5" ? "26px" :
                                 "32px",
                          height: fmt.aspectRatio === "1.91:1" ? "25px" :
                                  fmt.aspectRatio === "9:16" ? "36px" :
                                  fmt.aspectRatio === "4:5" ? "32px" :
                                  "32px",
                          borderColor: isSelected ? brandColor : "#D1D5DB",
                        }}
                      />
                    </div>

                    {/* Infos */}
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-gray-900 truncate">
                        {fmt.label}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {fmt.width}×{fmt.height} · {fmt.aspectRatio}
                      </div>
                    </div>

                    {/* Badge selectionne */}
                    {isSelected && (
                      <div
                        className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: brandColor }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Description du format selectionne */}
            <p className="mt-2 text-xs text-gray-600 italic">
              {selectedFormat.description}
            </p>
          </div>

          {/* Selecteur de brief (optionnel) */}
          {openTasks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lier a un brief (optionnel)
              </label>
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": brandColor } as any}
              >
                <option value="">Aucun brief</option>
                {openTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              {loadingTasks && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" />
                  Chargement des briefs...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creation...
              </>
            ) : (
              <>
                <Send size={16} />
                Creer le projet
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}