"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

// ============================================================
//  Phase 12 - StudioDrawer
//  Panel slide-in depuis la droite (480px)
//  Avec overlay semi-transparent.
//  Animation : translate-x-full -> translate-x-0
// ============================================================

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
};

export default function StudioDrawer({ isOpen, onClose, title, eyebrow, children }: Props) {
  // Close on ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={"fixed inset-0 bg-black/30 z-40 transition-opacity " + (isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}
      />

      {/* Drawer */}
      <aside
        className={"fixed right-0 top-0 bottom-0 z-50 bg-white shadow-2xl flex flex-col transition-transform duration-250 ease-out " + (isOpen ? "translate-x-0" : "translate-x-full")}
        style={{ width: "min(480px, 100vw)" }}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <div>
            {eyebrow && (
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                {eyebrow}
              </div>
            )}
            <h2 className="text-base font-bold text-neutral-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
            title="Fermer (Echap)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </aside>
    </>
  );
}