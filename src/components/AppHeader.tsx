"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  APP HEADER LUXURY (V2 - 1 ligne unifie)
//  - Logo PNG seul (sans texte BrandLock)
//  - Eyebrow + Titre sur MEME ligne (separes par bullet)
//  - Slot right pour menu contextuel (admin / studio / super-admin)
//  - Bouton deconnexion isole a droite
// ============================================================

const BRAND = {
  bordeaux: "#B11E2F",
  ink: "#181614",
  cream: "#F5F1EA",
  warmGray: "#807972",
};

type AppHeaderProps = {
  title?: string;
  eyebrow?: string;
  backHref?: string;
  rightSlot?: React.ReactNode;
  eyebrowColor?: string;
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
    if (!confirm("Voulez-vous vraiment vous deconnecter ?")) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  const headerClass = "bg-white border-b border-neutral-200 px-6 py-3.5 " +
    (sticky ? "sticky top-0 z-20" : "");

  return (
    <header className={headerClass}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* GAUCHE - Logo PNG seul + Eyebrow + Titre sur 1 ligne */}
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

          {/* Logo PNG seul (sans texte BrandLock ni drapeau) */}
          <Link href="/" className="flex items-center shrink-0 group" title="Accueil">
            <img
              src="/media/logo.png"
              alt="BrandLock"
              className="h-8 w-auto object-contain transition-opacity group-hover:opacity-70"
            />
          </Link>

          {/* Separateur vertical */}
          {(title || eyebrow) && (
            <div className="h-7 w-px bg-neutral-200 mx-1 shrink-0 hidden sm:block" />
          )}

          {/* Eyebrow + Titre sur MEME ligne */}
          {(title || eyebrow) && (
            <div className="flex items-baseline gap-2 min-w-0 flex-1">
              {eyebrow && (
                <span
                  className="text-[10px] font-black uppercase tracking-widest shrink-0"
                  style={{ color: eyebrowColor }}
                >
                  {eyebrow}
                </span>
              )}
              {title && (
                <h1 className="text-base font-bold text-neutral-900 truncate leading-tight">
                  {title}
                </h1>
              )}
            </div>
          )}
        </div>

        {/* DROITE - Slot menu contextuel + DECONNEXION */}
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}

          {/* Bouton deconnexion - Isole avec marge gauche */}
          <div className="border-l border-neutral-200 pl-3 ml-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition group"
              title="Se deconnecter"
              aria-label="Deconnexion"
            >
              <LogOut size={15} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}