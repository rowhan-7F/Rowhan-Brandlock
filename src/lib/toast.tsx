"use client";

import { toast as sonnerToast } from "sonner";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import React from "react";

// ============================================================
//  TOAST HELPER LUXURY
//  Wrapper élégant autour de Sonner avec icônes Lucide cohérentes
//  Utilise la même palette de couleurs que le reste du site
// ============================================================

type ToastOptions = {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export const toast = {
  // ✅ Success — Vert, pour confirmer une action réussie
  success: (message: string, options?: ToastOptions) => {
    return sonnerToast.success(message, {
      ...options,
      icon: <CheckCircle2 size={16} className="text-green-600" />,
      className: "luxury-toast-success",
    });
  },

  // ❌ Error — Rouge, pour les erreurs
  error: (message: string, options?: ToastOptions) => {
    return sonnerToast.error(message, {
      ...options,
      icon: <AlertCircle size={16} className="text-red-600" />,
      duration: options?.duration ?? 5000, // Plus long par défaut
      className: "luxury-toast-error",
    });
  },

  // ⚠️ Warning — Orange, pour les avertissements
  warning: (message: string, options?: ToastOptions) => {
    return sonnerToast.warning(message, {
      ...options,
      icon: <AlertTriangle size={16} className="text-amber-600" />,
      className: "luxury-toast-warning",
    });
  },

  // ℹ️ Info — Bleu, pour les infos
  info: (message: string, options?: ToastOptions) => {
    return sonnerToast.info(message, {
      ...options,
      icon: <Info size={16} className="text-blue-600" />,
      className: "luxury-toast-info",
    });
  },

  // 🔄 Loading — Avec spinner, pour les actions en cours
  loading: (message: string, options?: Omit<ToastOptions, "action">) => {
    return sonnerToast.loading(message, {
      ...options,
      icon: <Loader2 size={16} className="animate-spin text-orange-600" />,
      className: "luxury-toast-loading",
    });
  },

  // ⚡ Promise — Le must absolu : toast qui suit une promise
  // Affiche loading → success/error automatiquement
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  },

  // 🗑️ Dismiss — Fermer un toast spécifique
  dismiss: (id?: string | number) => {
    sonnerToast.dismiss(id);
  },

  // 🎨 Custom — Pour un toast 100% personnalisé
  custom: (content: React.ReactNode, options?: ToastOptions) => {
    return sonnerToast.custom(() => <>{content}</>, options);
  },
};

// ============================================================
//  HELPER : remplacer alert() facilement
//  Usage : alertReplacement("Erreur : " + err.message)
// ============================================================
export function alertReplacement(message: string) {
  // Détecte le type via le contenu
  if (/erreur|error|impossible|échec/i.test(message)) {
    toast.error(message);
  } else if (/attention|warning|prudence/i.test(message)) {
    toast.warning(message);
  } else if (/succès|réussi|ok|bravo|✓/i.test(message)) {
    toast.success(message);
  } else {
    toast.info(message);
  }
}

// ============================================================
//  HELPER : remplacer confirm() avec promise
//  Usage : await confirmAction("Supprimer ce projet ?", "Cette action est irréversible")
// ============================================================
export function confirmAction(
  title: string,
  description?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const id = sonnerToast.custom(
      (t) => (
        <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 p-4 w-[380px]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-neutral-900">{title}</div>
              {description && (
                <div className="text-xs text-neutral-500 mt-0.5">{description}</div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                sonnerToast.dismiss(t);
                resolve(false);
              }}
              className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                sonnerToast.dismiss(t);
                resolve(true);
              }}
              className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition"
            >
              Confirmer
            </button>
          </div>
        </div>
      ),
      {
        duration: Infinity, // Reste jusqu'à choix
        position: "top-center",
      }
    );
  });
}
