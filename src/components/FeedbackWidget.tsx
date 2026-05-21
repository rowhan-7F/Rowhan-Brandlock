"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bug, X, Camera, Upload, CheckCircle2, AlertCircle, Loader2,
  Flame, AlertOctagon, AlertTriangle, Info, ImageIcon, Trash2,
  Send, Sparkles, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  FeedbackWidget LUXURY V3
//  - Modal scrollable et alignée en haut (jamais coupée)
//  - html-to-image pour Tailwind 4 (lab/oklch)
//  - Visible UNIQUEMENT pour tenant_admin + graphist
// ============================================================

type Role = "tenant_admin" | "graphist" | "super_admin";

type Priority = "critical" | "high" | "medium" | "low";

const PRIORITY_CONFIG: Record<Priority, { label: string; description: string; color: string; icon: any }> = {
  critical: {
    label: "Critique",
    description: "Bloque totalement le travail",
    color: "bg-red-100 text-red-800 border-red-300",
    icon: Flame,
  },
  high: {
    label: "Haute",
    description: "Gêne importante mais contournable",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    icon: AlertOctagon,
  },
  medium: {
    label: "Moyenne",
    description: "Bug normal à signaler",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: AlertTriangle,
  },
  low: {
    label: "Basse",
    description: "Amélioration ou détail",
    color: "bg-neutral-50 text-neutral-600 border-neutral-200",
    icon: Info,
  },
};

export default function FeedbackWidget() {
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [autoScreenshotPending, setAutoScreenshotPending] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  //  Détection rôle (visible UNIQUEMENT tenant_admin ou graphist)
  // ============================================================
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (cancelled) return;
        if (profile && ["tenant_admin", "graphist"].includes(profile.role)) {
          setUserRole(profile.role as Role);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ============================================================
  //  Bloquer le scroll du body quand le modal est ouvert
  // ============================================================
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ============================================================
  //  Capture d'écran AUTO via html-to-image
  // ============================================================
  const captureScreenshot = useCallback(async () => {
    try {
      setAutoScreenshotPending(true);
      setScreenshotError(null);

      const modalEl = document.getElementById("feedback-widget-modal");
      const wasDisplay = modalEl?.style.display;
      if (modalEl) modalEl.style.display = "none";

      await new Promise((r) => setTimeout(r, 150));

      // @ts-ignore
      const htmlToImage = await import("html-to-image");

      const dataUrl = await htmlToImage.toJpeg(document.body, {
        quality: 0.7,
        pixelRatio: 0.75,
        backgroundColor: "#ffffff",
        skipFonts: true,
        filter: (node: HTMLElement) => {
          if (node.id === "feedback-widget-modal") return false;
          if (node.classList?.contains?.("feedback-widget-button")) return false;
          return true;
        },
      });

      if (modalEl) modalEl.style.display = wasDisplay || "";

      setScreenshot(dataUrl);
      setScreenshotFile(null);
    } catch (err: any) {
      console.error("Screenshot error:", err);
      setScreenshotError(
        "Capture auto impossible. Tu peux importer une image manuellement ci-dessous."
      );

      const modalEl = document.getElementById("feedback-widget-modal");
      if (modalEl) modalEl.style.display = "";
    } finally {
      setAutoScreenshotPending(false);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setError(null);
    setSubmitted(false);
    setScreenshotError(null);
    setTimeout(captureScreenshot, 400);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setMessage("");
      setPriority("medium");
      setScreenshot(null);
      setScreenshotFile(null);
      setError(null);
      setSubmitted(false);
      setScreenshotError(null);
    }, 200);
  };

  // ============================================================
  //  Upload manuel
  // ============================================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("L'image fait plus de 5 MB. Compresse-la avant.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setScreenshot(ev.target?.result as string);
      setScreenshotFile(file);
      setScreenshotError(null);
    };
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotFile(null);
    setScreenshotError(null);
  };

  const getBrowserInfo = () => {
    return {
      user_agent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform || "unknown",
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString(),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Décris le bug en quelques mots");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Session expirée, reconnecte-toi");
        setSubmitting(false);
        return;
      }

      let screenshotUrl: string | null = null;
      if (screenshot) {
        try {
          const res = await fetch(screenshot);
          const blob = await res.blob();
          const ext = screenshotFile?.name.split(".").pop() || "jpg";
          const fileName = `bug-${Date.now()}-${session.user.id}.${ext}`;

          const { data: upload, error: uploadError } = await supabase.storage
            .from("feedback-screenshots")
            .upload(fileName, blob, {
              contentType: blob.type || "image/jpeg",
              upsert: false,
            });

          if (uploadError) {
            console.warn("Screenshot upload failed:", uploadError.message);
          } else if (upload) {
            const { data: urlData } = supabase.storage
              .from("feedback-screenshots")
              .getPublicUrl(upload.path);
            screenshotUrl = urlData.publicUrl;
          }
        } catch (uploadErr) {
          console.warn("Screenshot upload error:", uploadErr);
        }
      }

      const apiRes = await fetch("/api/super-admin/bugs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          priority,
          page_origin: window.location.href,
          screenshot_url: screenshotUrl,
          browser_info: getBrowserInfo(),
        }),
      });

      const data = await apiRes.json();
      if (!apiRes.ok) {
        setError(data.error || "Erreur lors de l'envoi");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setSubmitting(false);

      setTimeout(handleClose, 2500);
    } catch (err: any) {
      setError(err.message || "Erreur réseau");
      setSubmitting(false);
    }
  };

  if (!userRole || userRole === "super_admin") return null;

  return (
    <>
      {/* Bouton flottant */}
      <button
        type="button"
        onClick={handleOpen}
        className="feedback-widget-button fixed bottom-6 right-6 z-50 group flex items-center gap-2 px-4 py-3 bg-white text-neutral-700 rounded-full shadow-lg hover:shadow-xl border border-neutral-200 hover:border-orange-300 transition-all hover:scale-105"
        title="Signaler un bug"
      >
        <Bug size={16} className="text-orange-500" />
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
          Signaler un bug
        </span>
      </button>

      {/* Modal — ⭐ FIX positionnement : aligné en haut + scroll si trop grand */}
      {isOpen && (
        <div
          id="feedback-widget-modal"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fadeIn overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          {/* Container scrollable avec padding vertical */}
          <div className="min-h-full flex items-start justify-center p-4 py-8">
            <div
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-slideUp my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* SUCCESS STATE */}
              {submitted ? (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-black tracking-tight mb-2">
                    Bug signalé avec succès
                  </h3>
                  <p className="text-sm text-neutral-600 mb-4">
                    Merci, on s'en occupe au plus vite ! 🚀
                  </p>
                  <div className="inline-flex items-center gap-2 text-xs text-neutral-400">
                    <Sparkles size={11} />
                    L'équipe a été notifiée
                  </div>
                </div>
              ) : (
                <>
                  {/* HEADER STICKY */}
                  <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div>
                      <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                        <Bug size={16} className="text-orange-500" />
                        Signaler un bug
                      </h2>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">
                        Aide-nous à améliorer la plateforme
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* FORM */}
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Description */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5 block">
                        Description *
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Que s'est-il passé ? Quel comportement attendu ? Étapes pour reproduire..."
                        rows={4}
                        autoFocus
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:border-orange-500 focus:outline-none transition resize-y"
                        required
                      />
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5 block">
                        Priorité
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => {
                          const cfg = PRIORITY_CONFIG[p];
                          const Icon = cfg.icon;
                          const isActive = priority === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPriority(p)}
                              className={`p-2.5 rounded-lg text-left transition border ${
                                isActive
                                  ? cfg.color
                                  : "bg-neutral-50 border-neutral-200 hover:bg-neutral-100"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Icon size={12} className={isActive ? "" : "text-neutral-400"} />
                                <span className={`text-[11px] font-black uppercase tracking-wider ${isActive ? "" : "text-neutral-700"}`}>
                                  {cfg.label}
                                </span>
                              </div>
                              <div className={`text-[10px] ${isActive ? "opacity-75" : "text-neutral-500"}`}>
                                {cfg.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Screenshot */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                          Capture d'écran
                        </label>
                        {screenshot && (
                          <button
                            type="button"
                            onClick={removeScreenshot}
                            className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 size={10} />
                            Retirer
                          </button>
                        )}
                      </div>

                      {autoScreenshotPending ? (
                        <div className="border border-neutral-200 rounded-lg p-8 text-center bg-neutral-50">
                          <Loader2 size={20} className="animate-spin text-neutral-400 mx-auto mb-2" />
                          <p className="text-xs text-neutral-500">Capture en cours...</p>
                        </div>
                      ) : screenshot ? (
                        <div className="relative rounded-lg overflow-hidden border border-neutral-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={screenshot} alt="Aperçu" className="w-full h-32 object-cover" />
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[9px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 size={9} />
                            {screenshotFile ? "Importée" : "Auto"}
                          </div>
                          <button
                            type="button"
                            onClick={captureScreenshot}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded hover:bg-black/80 transition"
                            title="Re-capturer"
                          >
                            <RefreshCw size={11} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={captureScreenshot}
                              className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-600 hover:border-orange-300 hover:bg-orange-50 transition"
                            >
                              <Camera size={12} />
                              <span className="font-bold">Capturer l'écran</span>
                            </button>
                            <label className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-600 hover:border-orange-300 hover:bg-orange-50 transition cursor-pointer">
                              <Upload size={12} />
                              <span className="font-bold">Importer un fichier</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {/* Erreur capture auto */}
                          {screenshotError && (
                            <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700 flex items-start gap-2">
                              <AlertCircle size={11} className="shrink-0 mt-0.5" />
                              <span>{screenshotError}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                        <AlertCircle size={12} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* META hint */}
                    <div className="text-[10px] text-neutral-400 px-3 py-2 bg-neutral-50 rounded-lg">
                      <span className="font-bold">URL + infos navigateur ajoutées automatiquement</span>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={submitting || !message.trim()}
                      className="w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-300 text-white font-bold text-sm rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          Envoyer le rapport
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-fadeIn {
              animation: fadeIn 0.2s ease-out;
            }
            .animate-slideUp {
              animation: slideUp 0.3s ease-out;
            }
          `}</style>
        </div>
      )}
    </>
  );
}
