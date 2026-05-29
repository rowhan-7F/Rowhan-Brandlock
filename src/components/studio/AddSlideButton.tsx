"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { getAvailableVariants, getSubVariants } from "@/lib/studioHelpers";

// ============================================================
//  AddSlideButton - Phase 9.4.3
//  Bouton + menu deroulant pour ajouter une slide (par variant)
//  Extrait de studio/[projectId]/page.tsx
// ============================================================
export default function AddSlideButton({ config, onAdd, brandColor }: any) {
  const [open, setOpen] = useState(false);
  const variants = getAvailableVariants(config);

  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition shadow-sm"
        style={{ backgroundColor: brandColor }}
        title="Ajouter une slide"
      >
        <Plus size={16} strokeWidth={3} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute top-full right-0 mt-2 w-64 z-40 bg-white rounded-xl border border-neutral-200 shadow-lg overflow-hidden max-h-96 overflow-y-auto">
            <div className="px-3 py-2 border-b border-neutral-100 text-[10px] font-black uppercase tracking-widest text-neutral-400 bg-neutral-50">
              Type de slide
            </div>
            {variants.map((v: any) => {
              const subs = getSubVariants(config, v.key);
              const defaultSub = subs[0]?.key || "default";
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => { onAdd(v.key, defaultSub); close(); }}
                  className="w-full px-3 py-2.5 text-left hover:bg-neutral-50 transition border-b border-neutral-50 last:border-b-0"
                >
                  <div className="text-xs font-bold text-neutral-900">
                    {v.label || v.key}
                  </div>
                  {v.description && (
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      {v.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}