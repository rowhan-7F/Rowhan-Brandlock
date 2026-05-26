"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirmDialog";
import ProjectCardCore, { ProjectType } from "./ProjectCardCore";

// ============================================================
//  STUDIO PROJECT CARD - Wrapper studio
//
//  Compose ProjectCardCore avec :
//  - Click -> /studio/[id] (carousel editor) ou /studio/video/[id]
//  - Bouton delete (graphist peut supprimer ses projets)
// ============================================================

type Props = {
  project: any;
  type: ProjectType;
  config?: any;
  onDelete?: () => void;
};

export default function StudioProjectCard({ project, type, config, onDelete }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleClick = () => {
    if (deleting) return;
    if (type === "video") {
      router.push(`/studio/video/${project.id}`);
    } else {
      router.push(`/studio/${project.id}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDialog(`Supprimer "${project.title}" ?`, {
      description: "Cette action est definitive.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expiree");

      const endpoint = type === "video"
        ? `/api/studio/video/projects/${project.id}`
        : `/api/studio/projects/${project.id}`;

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur suppression");
      }

      toast.success("Projet supprime");
      onDelete?.();
    } catch (err: any) {
      toast.error("Suppression impossible", { description: err.message });
      setDeleting(false);
    }
  };

  const deleteButton = (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="w-7 h-7 rounded-lg bg-black/50 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
      title="Supprimer"
    >
      <Trash2 size={12} />
    </button>
  );

  return (
    <div onClick={handleClick} className={`cursor-pointer ${deleting ? "opacity-50 pointer-events-none" : ""}`}>
      <ProjectCardCore
        project={project}
        type={type}
        config={config}
        rightSlot={deleteButton}
      />
    </div>
  );
}