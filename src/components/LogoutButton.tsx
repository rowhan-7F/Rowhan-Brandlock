"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  LOGOUT BUTTON — Réutilisable
//  À placer dans le header de chaque espace (admin + studio)
// ============================================================

type Props = {
  /** Affiche en mode compact (juste icône) ou étendu (icône + texte) */
  variant?: "compact" | "full";
  /** Couleur du brand pour le hover */
  brandColor?: string;
};

export default function LogoutButton({
  variant = "full",
  brandColor = "#F26522",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (!confirm("Te déconnecter ?")) return;
    setLoading(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
      // Force redirection même en cas d'erreur
      router.push("/");
    }
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="w-9 h-9 rounded-lg hover:bg-neutral-100 transition flex items-center justify-center text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
        title="Se déconnecter"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition flex items-center gap-1.5 disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
      Déconnexion
    </button>
  );
}
