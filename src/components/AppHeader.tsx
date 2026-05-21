"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  APP HEADER LUXURY
//  Composant unifié pour TOUTES les pages du site
//  - Logo BrandLock + drapeau suisse en astérix
//  - Titre + sous-titre (optionnel)
//  - Slot center (notifications, badges...)
//  - Slot right pour actions custom (cloche, messages...)
//  - Bouton déconnexion ICÔNE SEULE, isolée à droite avec espace
// ============================================================

const BRAND = {
  bordeaux: "#B11E2F",
  ink: "#181614",
  cream: "#F5F1EA",
  warmGray: "#807972",
};

type AppHeaderProps = {
  // Titre principal de la page
  title?: string;
  // Sous-titre (ex: "Super Administration")
  eyebrow?: string;
  // Lien de retour optionnel (back arrow à gauche)
  backHref?: string;
  // Slot pour mettre des composants au centre/droite (notifications, messages...)
  rightSlot?: React.ReactNode;
  // Customiser la couleur de l'eyebrow (ex: bordeaux pour super-admin)
  eyebrowColor?: string;
  // Sticky par défaut
  sticky?: boolean;
};

export default function AppHeader({
  title,
  eyebrow,
  backHref,
  rightSlot,
  eyebrowColor = BRAND.bordeaux,
  sticky = true,
}: AppHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    if (!confirm("Voulez-vous vraiment vous déconnecter ?")) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header
      className={`bg-white border-b border-neutral-200 px-6 py-3.5 ${
        sticky ? "sticky top-0 z-20" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* GAUCHE — Logo + Titre */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Back arrow optionnel */}
          {backHref && (
            <Link
              href={backHref}
              className="text-neutral-400 hover:text-neutral-700 transition shrink-0"
              title="Retour"
            >
              <ArrowLeft size={18} />
            </Link>
          )}

          {/* Logo BrandLock + drapeau astérix */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group" title="Accueil">
            <img
              src="/media/logo.png"
              alt="BrandLock"
              className="h-8 w-auto object-contain transition-opacity group-hover:opacity-70"
            />
            <div className="flex items-baseline gap-1">
              <span
                className="font-black tracking-tighter text-base italic hidden sm:inline"
                style={{ color: BRAND.ink, letterSpacing: "-0.04em" }}
              >
                BrandLock
              </span>
              {/* Drapeau Suisse minuscule en astérix */}
              <svg
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
                className="h-2.5 w-2.5 shrink-0 hidden sm:block"
                aria-label="Suisse"
              >
                <rect width="32" height="32" fill={BRAND.bordeaux} rx="3" />
                <rect x="13" y="7" width="6" height="18" fill="white" />
                <rect x="7" y="13" width="18" height="6" fill="white" />
              </svg>
            </div>
          </Link>

          {/* Séparateur vertical entre logo et titre */}
          {(title || eyebrow) && (
            <div className="h-7 w-px bg-neutral-200 mx-1 shrink-0 hidden sm:block" />
          )}

          {/* Titre + eyebrow */}
          {(title || eyebrow) && (
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-0.5"
                  style={{ color: eyebrowColor }}
                >
                  {eyebrow}
                </div>
              )}
              {title && (
                <h1 className="text-base font-bold text-neutral-900 truncate leading-tight">
                  {title}
                </h1>
              )}
            </div>
          )}
        </div>

        {/* DROITE — Actions custom + DÉCONNEXION ISOLÉE */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Slot pour les actions personnalisées (notifications, messages...) */}
          {rightSlot}

          {/* ⭐ BOUTON DÉCONNEXION — Isolé avec marge gauche pour clarté */}
          <div className="border-l border-neutral-200 pl-3 ml-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition group"
              title="Se déconnecter"
              aria-label="Déconnexion"
            >
              <LogOut size={15} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
