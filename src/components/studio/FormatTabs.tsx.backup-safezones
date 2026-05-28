"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Star } from "lucide-react";

// ============================================================
//  TYPES
// ============================================================

export type FormatTabsProps = {
  allTemplates: Record<string, any>;
  activeFormats: string[];
  activeEditingFormat: string;
  primaryFormat: string;
  overridesCount: Record<string, number>;
  primaryColor?: string;
  onSelectFormat: (formatKey: string) => void;
  onAddFormat: (formatKey: string) => void;
  onRemoveFormat?: (formatKey: string) => void;
};

// ============================================================
//  HELPER : Label friendly
// ============================================================

function getFormatLabel(formatKey: string, template: any): string {
  if (template?.label) return template.label;
  return formatKey
    .replace(/^carrousel_/, "")
    .replace(/^video_/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ============================================================
//  COMPOSANT PRINCIPAL
// ============================================================

export default function FormatTabs({
  allTemplates,
  activeFormats,
  activeEditingFormat,
  primaryFormat,
  overridesCount,
  primaryColor = "#B11E2F",
  onSelectFormat,
  onAddFormat,
  onRemoveFormat,
}: FormatTabsProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Track mount pour SSR safety (Portal needs window)
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Calculer la position du dropdown quand on l ouvre
  useEffect(() => {
    if (!addMenuOpen || !buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 4,           // 4px de gap sous le bouton
      left: rect.left,
    });
  }, [addMenuOpen]);
  
  // Fermer le menu si clic en dehors
  useEffect(() => {
    if (!addMenuOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setAddMenuOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addMenuOpen]);
  
  // Templates disponibles a l ajout
  const availableTemplates = Object.entries(allTemplates || {})
    .filter(([key]) => !activeFormats.includes(key))
    .filter(([key]) => {
      const primaryCategory = primaryFormat.startsWith("carrousel_") ? "carrousel" : "video";
      const keyCategory = key.startsWith("carrousel_") ? "carrousel" : "video";
      return primaryCategory === keyCategory;
    });
  
  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-neutral-200 bg-white overflow-x-auto shrink-0">
      {activeFormats.map((formatKey) => {
        const template = allTemplates[formatKey];
        const label = getFormatLabel(formatKey, template);
        const isActive = formatKey === activeEditingFormat;
        const isPrimary = formatKey === primaryFormat;
        const count = overridesCount[formatKey] || 0;
        const canRemove = !isPrimary && onRemoveFormat;
        
        const buttonClass = [
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border-2",
          isActive
            ? "border-[color:var(--bl-primary)] bg-[color:var(--bl-primary)]/5 text-[color:var(--bl-primary)]"
            : "border-transparent bg-neutral-50 text-neutral-600 hover:bg-neutral-100",
        ].join(" ");
        
        return (
          <div
            key={formatKey}
            className="relative group shrink-0"
            style={{ ["--bl-primary" as any]: primaryColor }}
          >
            <button
              type="button"
              onClick={() => onSelectFormat(formatKey)}
              className={buttonClass}
            >
              {isPrimary && <Star size={10} className="opacity-60" />}
              <span>{label}</span>
              
              {count > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black"
                  style={{
                    backgroundColor: isActive ? primaryColor : "#737373",
                    color: "white",
                  }}
                  title={count + " modification(s) manuelle(s)"}
                >
                  {count}
                </span>
              )}
              
              {canRemove && (
                <X
                  size={12}
                  className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Supprimer ce format du projet ? Les modifications manuelles seront perdues.")) {
                      onRemoveFormat!(formatKey);
                    }
                  }}
                />
              )}
            </button>
          </div>
        );
      })}
      
      {availableTemplates.length > 0 && (
        <>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setAddMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-neutral-500 border-2 border-dashed border-neutral-300 hover:border-neutral-400 hover:text-neutral-700 transition-all shrink-0"
            title="Ajouter un format au projet"
          >
            <Plus size={12} />
            <span>Ajouter format</span>
          </button>
          
          {/* Portal : le dropdown sort de la hierarchie DOM, position fixed */}
          {mounted && addMenuOpen && menuPosition && createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: menuPosition.top + "px",
                left: menuPosition.left + "px",
                zIndex: 9999,
              }}
              className="bg-white rounded-lg shadow-2xl border border-neutral-200 py-1 min-w-[240px] max-h-[400px] overflow-y-auto"
            >
              {availableTemplates.map(([key, template]) => {
                const label = getFormatLabel(key, template);
                const canvas = template?.canvas;
                const dim = canvas ? canvas.widthPx + "x" + canvas.heightPx : "";
                
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onAddFormat(key);
                      setAddMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-neutral-900">{label}</span>
                    {dim && (
                      <span className="text-[10px] text-neutral-400 font-mono ml-3">{dim}</span>
                    )}
                  </button>
                );
              })}
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}