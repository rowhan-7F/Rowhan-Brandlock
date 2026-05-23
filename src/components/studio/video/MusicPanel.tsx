"use client";

import { Music, Upload, AlertCircle } from "lucide-react";

// ============================================================
//  Phase 12.D - MusicPanel (placeholder V1)
//  Upload music bg + volume slider
//  V1 = juste UI placeholder, integration audio mix demain
// ============================================================

const BRAND_BORDEAUX = "#B11E2F";

type Props = {
  project: any;
  onProjectUpdated: () => void;
};

export default function MusicPanel({ project, onProjectUpdated }: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">EN COURS DE DEVELOPPEMENT</div>
            <p className="text-xs text-amber-900 mt-1">
              L'upload de musique de fond sera disponible dans la prochaine session. 
              Pour l'instant, vous pouvez ajouter de la musique via les Brand Assets (intro/outro).
            </p>
          </div>
        </div>
      </div>

      <div className="border-2 border-dashed border-neutral-200 rounded-xl p-8 text-center">
        <Music size={28} className="mx-auto text-neutral-300 mb-2" />
        <p className="text-xs text-neutral-500">
          Bientot disponible : upload MP3/WAV et reglage volume.
        </p>
      </div>
    </div>
  );
}