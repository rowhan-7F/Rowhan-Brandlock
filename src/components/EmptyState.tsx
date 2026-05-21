"use client";

import React from "react";
import {
  Inbox, ImageIcon, FileText, Bug, Mail, BarChart3,
  Sparkles, Plus, ArrowRight,
} from "lucide-react";
import Link from "next/link";

// ============================================================
//  EMPTY STATES LUXURY
//  Remplace les "Aucun résultat" génériques par des messages
//  contextuels avec personnalité + action claire
// ============================================================

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  variant?: "default" | "subtle";
};

// ============================================================
//  COMPOSANT DE BASE
// ============================================================

export function EmptyState({
  icon, title, description, action, secondaryAction, variant = "default",
}: EmptyStateProps) {
  const containerClass =
    variant === "subtle"
      ? "py-12 px-6"
      : "py-16 px-8 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50";

  return (
    <div className={`text-center ${containerClass}`}>
      {icon && (
        <div className="inline-flex w-14 h-14 rounded-2xl bg-white border border-neutral-200 items-center justify-center mb-4 text-neutral-400 shadow-sm">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-neutral-900 mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-neutral-500 max-w-md mx-auto mb-5">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-2">
          {action && (
            action.href ? (
              <Link
                href={action.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition"
              >
                <Plus size={13} />
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition"
              >
                <Plus size={13} />
                {action.label}
              </button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-1 px-4 py-2 text-neutral-600 hover:text-neutral-900 text-xs font-bold uppercase tracking-wider transition"
              >
                {secondaryAction.label}
                <ArrowRight size={11} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="inline-flex items-center gap-1 px-4 py-2 text-neutral-600 hover:text-neutral-900 text-xs font-bold uppercase tracking-wider transition"
              >
                {secondaryAction.label}
                <ArrowRight size={11} />
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  PRÉRÉGLAGES MÉTIER (Faciles à utiliser)
// ============================================================

export function EmptyProjects() {
  return (
    <EmptyState
      icon={<FileText size={22} />}
      title="Aucun projet pour l'instant"
      description="Lance ta première création ! Carrousel Instagram, publicité Meta, idées de posts... tout commence ici."
      action={{ label: "Nouveau projet", href: "#" }}
    />
  );
}

export function EmptyLibrary() {
  return (
    <EmptyState
      icon={<ImageIcon size={22} />}
      title="Ta bibliothèque est vide"
      description="Importe les visuels de ta marque pour les utiliser dans tes créations. Photos, logos, illustrations..."
      action={{ label: "Importer des images", href: "#" }}
    />
  );
}

export function EmptyPendingValidation() {
  return (
    <EmptyState
      icon={<Sparkles size={22} />}
      title="Tout est à jour ! 🎉"
      description="Aucune image en attente de validation. Ton studio est efficace, ou il n'y a rien de nouveau."
      variant="subtle"
    />
  );
}

export function EmptyProspects() {
  return (
    <EmptyState
      icon={<Mail size={22} />}
      title="Aucun prospect pour l'instant"
      description="Les messages reçus depuis le formulaire de contact apparaîtront ici. En attendant, va promouvoir le site !"
      variant="subtle"
    />
  );
}

export function EmptyBugs() {
  return (
    <EmptyState
      icon={<Bug size={22} />}
      title="Aucun bug signalé"
      description="C'est bon signe ! Soit la plateforme est parfaite, soit personne ne l'utilise. (On espère la première option.)"
      variant="subtle"
    />
  );
}

export function EmptyAnalytics() {
  return (
    <EmptyState
      icon={<BarChart3 size={22} />}
      title="Pas encore assez de données"
      description="Les stats apparaîtront quand tes utilisateurs commenceront à créer des projets. Reviens dans quelques jours."
      variant="subtle"
    />
  );
}

export function EmptyMessages() {
  return (
    <EmptyState
      icon={<Inbox size={22} />}
      title="Aucun message"
      description="Démarre la conversation avec ton équipe sur ce projet."
      variant="subtle"
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={<Inbox size={22} />}
      title="Tu es à jour ! 🎉"
      description="Aucune nouvelle notification. Tu pourras revenir ici quand quelqu'un t'enverra un message ou commentera un projet."
      variant="subtle"
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<Inbox size={22} />}
      title={`Aucun résultat pour "${query}"`}
      description="Essaie un autre terme de recherche, ou vérifie l'orthographe."
      variant="subtle"
    />
  );
}
