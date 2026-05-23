"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";

// ============================================================
//  EditableProjectTitle - Phase 12 peaufinage #6+7
//
//  Composant reutilisable pour editer le titre d'un projet
//  via une API PATCH configurable (slide ou video).
//
//  Usage :
//    <EditableProjectTitle
//      title={project.title}
//      endpoint={`/api/studio/projects/${id}/save`}
//      onUpdated={(newTitle) => ...}
//    />
//
//  Pour la page video :
//    endpoint = `/api/studio/video/projects/${id}`
//
//  Comportement :
//    - Click sur le titre = editer
//    - Enter / blur = sauver
//    - Esc = annuler
//    - Auto-resize selon contenu
//    - Auth Bearer token
// ============================================================

type Props = {
  title: string;
  endpoint: string;
  onUpdated: (newTitle: string) => void;
  className?: string;
};

export default function EditableProjectTitle({ title, endpoint, onUpdated, className = "" }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset draft if title prop changes from outside
  useEffect(() => {
    if (!isEditing) setDraft(title);
  }, [title, isEditing]);

  // Auto-focus + selection when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = draft.trim();

    // No change : just exit edit mode
    if (!trimmed || trimmed === title) {
      setIsEditing(false);
      setDraft(title);
      return;
    }

    if (trimmed.length > 200) {
      toast.error("Titre trop long", { description: "Max 200 caracteres." });
      setDraft(title);
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expiree, reconnecte-toi");
        setSaving(false);
        return;
      }

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur sauvegarde titre");
      }

      onUpdated(trimmed);
      setIsEditing(false);
      toast.success("Titre mis a jour");
    } catch (err: any) {
      toast.error("Sauvegarde impossible", { description: err.message });
      setDraft(title);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className={"text-sm font-bold text-neutral-900 bg-white border border-neutral-300 rounded px-2 py-0.5 outline-none focus:border-[#B11E2F] min-w-0 flex-1 " + className}
          maxLength={200}
        />
        {saving && <Loader2 size={12} className="text-neutral-400 animate-spin shrink-0" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={"text-sm font-bold text-neutral-900 hover:bg-neutral-100 rounded px-2 py-0.5 transition truncate min-w-0 flex-1 text-left cursor-text " + className}
      title="Cliquez pour renommer"
    >
      {title || "Sans titre"}
    </button>
  );
}