"use client";

import { toast as sonnerToast } from "sonner";

type ConfirmOptions = {
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * Affiche un toast de confirmation et retourne une Promise<boolean>.
 * Remplace les window.confirm() natifs.
 *
 * @example
 * if (!(await confirmDialog("Supprimer ce projet ?", { destructive: true }))) return;
 */
export function confirmDialog(
  message: string,
  options: ConfirmOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    sonnerToast(message, {
      description: options.description,
      duration: Infinity,
      action: {
        label: options.confirmLabel || "Confirmer",
        onClick: () => finish(true),
      },
      cancel: {
        label: options.cancelLabel || "Annuler",
        onClick: () => finish(false),
      },
      onDismiss: () => finish(false),
      onAutoClose: () => finish(false),
      className: options.destructive ? "destructive-toast" : undefined,
    });
  });
}