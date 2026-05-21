// ============================================================
//  Composant affichant l'état d'upload : barre + ETA précis
// ============================================================

"use client";

import { Loader2, X, Upload } from "lucide-react";
import { formatDuration, formatFileSize } from "@/lib/video/thumbnail";

type UploadingState = {
  phase: "uploading";
  fileName: string;
  progress: number;
  etaSeconds: number;
  totalSize: number;
};

type ProcessingState = {
  phase: "processing";
  message: string;
};

type ValidatingState = {
  phase: "validating";
  fileName: string;
};

type Props = {
  state: UploadingState | ProcessingState | ValidatingState;
  onCancel?: () => void;
};

export default function VideoUploadProgress({ state, onCancel }: Props) {
  if (state.phase === "validating") {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 bg-white border-2 border-neutral-300 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Loader2 size={20} className="text-blue-600 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-neutral-900 truncate">
              Vérification du fichier...
            </div>
            <div className="text-xs text-neutral-500 truncate mt-0.5">
              {state.fileName}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "processing") {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 bg-white border-2 border-blue-300 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Loader2 size={20} className="text-blue-600 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-neutral-900">
              {state.message}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              On finalise, ça ne prend que quelques secondes.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { fileName, progress, etaSeconds, totalSize } = state;
  const uploadedBytes = Math.round((progress / 100) * totalSize);

  const etaLabel =
    etaSeconds < 0
      ? "Estimation..."
      : etaSeconds < 1
      ? "Quelques secondes"
      : `~${formatDuration(etaSeconds)} restantes`;

  return (
    <div className="w-full max-w-2xl mx-auto p-8 bg-white border-2 border-[#B11E2F]/30 rounded-2xl">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-[#B11E2F]/10 flex items-center justify-center shrink-0">
          <Upload size={20} className="text-[#B11E2F]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-neutral-900 truncate">
            {fileName}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {formatFileSize(uploadedBytes)} / {formatFileSize(totalSize)}
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
            title="Annuler"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden mb-2">
        <div
          className="absolute inset-y-0 left-0 bg-[#B11E2F] rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-neutral-500">{etaLabel}</span>
        <span className="font-bold text-[#B11E2F]">{progress}%</span>
      </div>
    </div>
  );
}