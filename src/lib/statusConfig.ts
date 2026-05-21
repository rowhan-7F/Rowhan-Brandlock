// ============================================================
//  STATUTS PROJETS — LUXURY EDITION
//  Helper centralisé pour les labels + couleurs des statuts
//  Utilisé partout pour cohérence garantie
// ============================================================

export type ProjectStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "published"
  | "archived";

export type StatusLabel = {
  label: string;
  description: string;
  color: string;        // Tailwind class (badge complet)
  textColor: string;    // Tailwind class (texte seul)
  bgColor: string;      // Tailwind class (background seul)
  borderColor: string;  // Tailwind class
  icon?: string;        // Emoji ou string
};

// ============================================================
//  PALETTE COHÉRENTE AVEC LE BRANDING LUXURY
// ============================================================
export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, StatusLabel> = {
  draft: {
    label: "En cours",
    description: "Le studio travaille sur ce projet",
    color: "bg-amber-50 text-amber-800 border-amber-200",
    textColor: "text-amber-800",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: "✏️",
  },
  pending_approval: {
    label: "En validation",
    description: "En attente d'approbation par l'admin",
    color: "bg-blue-50 text-blue-800 border-blue-200",
    textColor: "text-blue-800",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: "⏳",
  },
  approved: {
    label: "Validé",
    description: "Projet approuvé et prêt à publier",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    textColor: "text-emerald-800",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    icon: "✓",
  },
  rejected: {
    label: "À retravailler",
    description: "Le studio doit reprendre ce projet",
    color: "bg-orange-50 text-orange-800 border-orange-200",
    textColor: "text-orange-800",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: "🔄",
  },
  published: {
    label: "Publié",
    description: "Diffusé sur les réseaux",
    color: "bg-purple-50 text-purple-800 border-purple-200",
    textColor: "text-purple-800",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    icon: "🚀",
  },
  archived: {
    label: "Archivé",
    description: "Projet clôturé",
    color: "bg-neutral-50 text-neutral-600 border-neutral-200",
    textColor: "text-neutral-600",
    bgColor: "bg-neutral-50",
    borderColor: "border-neutral-200",
    icon: "📦",
  },
};

// Helpers de raccourci
export function getStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_CONFIG[status]?.label || status;
}

export function getStatusColor(status: ProjectStatus): string {
  return PROJECT_STATUS_CONFIG[status]?.color || "bg-neutral-50 text-neutral-600 border-neutral-200";
}

export function getStatusConfig(status: ProjectStatus): StatusLabel {
  return PROJECT_STATUS_CONFIG[status] || PROJECT_STATUS_CONFIG.draft;
}

// ============================================================
//  STATUTS PROSPECTS
// ============================================================
export type ProspectStatus = "new" | "contacted" | "qualified" | "client" | "lost";

export const PROSPECT_STATUS_CONFIG: Record<ProspectStatus, StatusLabel> = {
  new: {
    label: "Nouveau",
    description: "Vient juste de remplir le formulaire",
    color: "bg-blue-50 text-blue-800 border-blue-200",
    textColor: "text-blue-800",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  contacted: {
    label: "Contacté",
    description: "Premier contact établi",
    color: "bg-amber-50 text-amber-800 border-amber-200",
    textColor: "text-amber-800",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  qualified: {
    label: "Qualifié",
    description: "Prêt à devenir client",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    textColor: "text-emerald-800",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  client: {
    label: "Client",
    description: "Converti en client actif",
    color: "bg-purple-50 text-purple-800 border-purple-200",
    textColor: "text-purple-800",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  lost: {
    label: "Perdu",
    description: "N'a pas donné suite",
    color: "bg-neutral-50 text-neutral-600 border-neutral-200",
    textColor: "text-neutral-600",
    bgColor: "bg-neutral-50",
    borderColor: "border-neutral-200",
  },
};

// ============================================================
//  RÔLES UTILISATEURS
// ============================================================
export type UserRole = "super_admin" | "tenant_admin" | "studio" | "viewer";

export const ROLE_CONFIG: Record<UserRole, { label: string; description: string }> = {
  super_admin: {
    label: "Super Administrateur",
    description: "Accès complet à la plateforme",
  },
  tenant_admin: {
    label: "Administrateur",
    description: "Gère le tenant et valide les projets",
  },
  studio: {
    label: "Studio",
    description: "Crée les contenus pour le tenant",
  },
  viewer: {
    label: "Observateur",
    description: "Lecture seule",
  },
};

export function getRoleLabel(role: UserRole): string {
  return ROLE_CONFIG[role]?.label || role;
}
