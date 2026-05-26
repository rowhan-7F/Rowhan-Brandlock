"use client";

import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import ProjectCardCore, { ProjectType } from "./ProjectCardCore";

// ============================================================
//  ADMIN PROJECT CARD - Wrapper admin tenant
//
//  Compose ProjectCardCore avec :
//  - Click -> /admin/tenant/projects/[id] (page de validation)
//  - Badge "A valider" si pending_approval (top-right)
//  - PAS de delete (admin valide, ne supprime pas)
// ============================================================

type Props = {
  project: any;
  type: ProjectType;
  config?: any;
};

export default function AdminProjectCard({ project, type, config }: Props) {
  const router = useRouter();

  const handleClick = () => {
    if (type === "video") {
      router.push(`/admin/tenant/projects/video/${project.id}`);
    } else {
      router.push(`/admin/tenant/projects/${project.id}`);
    }
  };

  // Badge "Urgent" si en attente de validation
  const isPending = project.status === "pending_approval";
  const urgentBadge = isPending ? (
    <div className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider rounded flex items-center gap-1 shadow-md">
      <AlertCircle size={9} />
      A valider
    </div>
  ) : null;
  return (
    <div onClick={handleClick} className="cursor-pointer">
      <ProjectCardCore
        project={project}
        type={type}
        config={config}
        rightSlot={urgentBadge}
      />
    </div>
  );
}
