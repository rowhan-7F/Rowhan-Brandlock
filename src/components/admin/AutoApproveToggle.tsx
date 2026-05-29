"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";

// ============================================================
//  AutoApproveToggle — Phase 9.3.22
//  Toggle "Toujours approuver les images" (config tenant).
//  Autonome : lit /api/admin/settings au montage, PATCH au clic.
// ============================================================
export default function AutoApproveToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }
        const res = await fetch("/api/admin/settings", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setEnabled(data.autoApproveImages === true);
        }
      } catch {
        // silencieux
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next); // optimiste
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ autoApproveImages: next }),
      });
      if (!res.ok) throw new Error("Echec de la sauvegarde");
      toast.success(
        next
          ? "Images approuvees automatiquement"
          : "Validation manuelle retablie"
      );
    } catch (err: any) {
      setEnabled(!next); // rollback
      toast.error("Erreur", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-start gap-3 mb-4">
      <div className="mt-0.5 text-[#B11E2F]">
        <ShieldCheck size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-neutral-900">
          Toujours approuver les images
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">
          Si active, les images uploadees par votre equipe sont approuvees
          automatiquement, sans validation manuelle.
        </p>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || saving}
        className="shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50"
        style={{ backgroundColor: enabled ? "#B11E2F" : "#d4d4d4" }}
        title="Activer / desactiver l'approbation automatique"
      >
        {loading || saving ? (
          <Loader2 size={12} className="animate-spin mx-auto text-white" />
        ) : (
          <span
            className="inline-block h-4 w-4 rounded-full bg-white transition"
            style={{
              transform: enabled ? "translateX(22px)" : "translateX(4px)",
            }}
          />
        )}
      </button>
    </div>
  );
}