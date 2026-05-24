"use client";

import Link from "next/link";
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, Download, Send, LogOut, Loader2 } from "lucide-react";
import StudioMenu from "@/components/studio/StudioMenu";
import AdminTenantMenu from "@/components/admin/AdminTenantMenu";
import NotificationsBell from "@/components/NotificationsBell";
import ProjectMessagesIcon from "@/components/ProjectMessagesIcon";
import EditableProjectTitle from "@/components/studio/EditableProjectTitle";

// ============================================================
//  STUDIO HEADER - Composant universel
//
//  Utilise sur :
//    - /studio (dashboard)
//    - /studio/library
//    - /studio/[projectId] (slide editor)
//    - /studio/video/[id] (video editor)
//    - /admin/tenant/* (futur)
//
//  Design : Identique partout (hauteur, alignement, couleurs)
//  Boutons : Configurables via props (afficher/masquer selon contexte)
//
//  Couleurs :
//    - Brand bordeaux : #B11E2F (logo, accents, soumettre par defaut)
//    - Export vert    : #16a34a (cohérent avec "Approuvé")
//    - Submit ambre   : #f59e0b (re-soumettre si pending)
// ============================================================

export const BRAND_COLOR = "#B11E2F";
export const EXPORT_COLOR = "#16a34a";

export type ProjectStatus = "draft" | "uploaded" | "transcribed" | "rendering" | "completed" | "pending_approval" | "approved" | "rejected";

type ExportAction = {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
  loading?: boolean;
};

type SubmitAction = {
  onClick: () => void;
  status: ProjectStatus;
  submitting?: boolean;
  disabled?: boolean;
};

type EditableTitleConfig = {
  endpoint: string;
  onUpdated: (newTitle: string) => void;
};

type Props = {
  // Navigation
  backHref?: string;

  // Eyebrow (toujours visible)
  eyebrowMain?: string;        // ex: "STUDIO"
  eyebrowSubtitle?: string;    // ex: "Genève Attractive" ou "Video Interview · 1080x1920"

  // Titre
  title: string;
  editableTitle?: EditableTitleConfig;  // si defini → titre editable

  // Badge statut (sous le titre)
  statusBadge?: ProjectStatus;
  statusSubtitle?: string;     // ex: "Video rendue" / "Brouillon"

  // Boutons (à droite)
  showStudioMenu?: boolean;
  studioMenuActive?: "projects" | "library";
  showAdminMenu?: boolean;
  adminMenuActive?: "dashboard" | "team" | "brand-assets" | "library";
  tenantId?: string | null;

  showMessages?: boolean;
  projectId?: string;

  showNotifications?: boolean;

  exportAction?: ExportAction;
  submitAction?: SubmitAction;

  showLogout?: boolean;
  onLogout?: () => void;
};

export default function StudioHeader({
  backHref = "/studio",
  eyebrowMain = "STUDIO",
  eyebrowSubtitle,
  title,
  editableTitle,
  statusBadge,
  statusSubtitle,
  showStudioMenu = false,
  studioMenuActive = "projects",
  showAdminMenu = false,
  adminMenuActive = "dashboard",
  tenantId = null,
  showMessages = false,
  projectId,
  showNotifications = false,
  exportAction,
  submitAction,
  showLogout = false,
  onLogout,
}: Props) {
  // Determine submit button config based on status
  const getSubmitConfig = (status: ProjectStatus) => {
    const isApproved = status === "approved";
    const isPending = status === "pending_approval";
    const isRejected = status === "rejected";
    if (isApproved) return { label: "Approuvé", bgColor: "#16a34a", disabled: true, title: "Approuvé", icon: "check" as const };
    if (isPending) return { label: "Re-soumettre", bgColor: "#f59e0b", disabled: false, title: "Mettre à jour", icon: "send" as const };
    if (isRejected) return { label: "Re-soumettre", bgColor: BRAND_COLOR, disabled: false, title: "Nouvelle version", icon: "send" as const };
    return { label: "Soumettre", bgColor: BRAND_COLOR, disabled: false, title: "Soumettre pour validation", icon: "send" as const };
  };

  return (
    <header className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* GAUCHE : Back + Logo + Eyebrow + Title + Badge */}
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
        {/* Back arrow */}
        <Link href={backHref} className="text-neutral-400 hover:text-neutral-700 transition shrink-0" title="Retour">
          <ArrowLeft size={18} />
        </Link>

        {/* Logo PNG */}
        <Link href="/" className="flex items-center shrink-0 group" title="Accueil">
          <img src="/media/logo.png" alt="BrandLock" className="h-7 w-auto group-hover:opacity-80 transition" />
        </Link>

        {/* Séparateur */}
        <div className="h-7 w-px bg-neutral-200 shrink-0 hidden sm:block" />

        {/* Eyebrow */}
        <div className="hidden md:block shrink-0">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#B11E2F]">{eyebrowMain}</div>
          {eyebrowSubtitle && (
            <div className="text-[10px] text-neutral-400 -mt-0.5">{eyebrowSubtitle}</div>
          )}
        </div>

        {/* Séparateur */}
        <div className="h-7 w-px bg-neutral-200 shrink-0 hidden md:block" />

        {/* Titre + Badge statut */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {editableTitle ? (
              <EditableProjectTitle
                title={title}
                endpoint={editableTitle.endpoint}
                onUpdated={editableTitle.onUpdated}
              />
            ) : (
              <h1 className="text-sm font-bold text-neutral-900 truncate min-w-0 flex-1">{title}</h1>
            )}
            {statusBadge === "pending_approval" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-black uppercase tracking-widest text-amber-700 shrink-0">
                <Clock size={9} />
                En attente de validation
              </span>
            )}
            {statusBadge === "approved" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded text-[9px] font-black uppercase tracking-widest text-green-700 shrink-0">
                <CheckCircle2 size={9} />
                Approuvé
              </span>
            )}
            {statusBadge === "rejected" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded text-[9px] font-black uppercase tracking-widest text-red-700 shrink-0">
                <AlertCircle size={9} />
                À retravailler
              </span>
            )}
          </div>
          {statusSubtitle && (
            <div className="text-[10px] text-neutral-400 mt-0.5">{statusSubtitle}</div>
          )}
        </div>
      </div>

      {/* DROITE : Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {showStudioMenu && <StudioMenu active={studioMenuActive} tenantId={tenantId} />}
        {showAdminMenu && <AdminTenantMenu active={adminMenuActive} tenantId={tenantId} />}

        {showMessages && projectId && (
          <ProjectMessagesIcon projectId={projectId} brandColor={BRAND_COLOR} />
        )}

        {showNotifications && <NotificationsBell brandColor={BRAND_COLOR} />}

        {exportAction && (
          <button
            onClick={exportAction.onClick}
            disabled={exportAction.disabled}
            title={exportAction.title || "Exporter"}
            className="text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: EXPORT_COLOR }}
          >
            {exportAction.loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {exportAction.loading ? "..." : (exportAction.label || "Exporter")}
          </button>
        )}

        {submitAction && (() => {
          const cfg = getSubmitConfig(submitAction.status);
          return (
            <button
              onClick={submitAction.onClick}
              disabled={submitAction.submitting || submitAction.disabled || cfg.disabled}
              title={cfg.title}
              className="text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: cfg.bgColor }}
            >
              {submitAction.submitting ? <Loader2 size={12} className="animate-spin" /> : cfg.icon === "check" ? <CheckCircle2 size={12} /> : <Send size={12} />}
              {submitAction.submitting ? "..." : cfg.label}
            </button>
          );
        })()}

        {showLogout && onLogout && (
          <div className="border-l border-neutral-200 pl-3 ml-1">
            <button
              type="button"
              onClick={onLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition group"
              title="Se déconnecter"
              aria-label="Déconnexion"
            >
              <LogOut size={15} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}