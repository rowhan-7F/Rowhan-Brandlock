"use client";

// ============================================================
//  SkeletonCard — Placeholder anime pendant le chargement
//  (Phase 9.3.21) — meme forme qu'une StudioProjectCard
// ============================================================
export default function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-neutral-200">
      {/* Zone preview (ratio carre) */}
      <div className="aspect-square bg-neutral-100 animate-pulse" />

      {/* Zone texte */}
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 rounded bg-neutral-100 animate-pulse" />
        <div className="h-2.5 w-1/2 rounded bg-neutral-100 animate-pulse" />
      </div>
    </div>
  );
}