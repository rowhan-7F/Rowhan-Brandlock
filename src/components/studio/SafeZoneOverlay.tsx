"use client";

import React from "react";

// ============================================================
//  SafeZoneOverlay - Affiche les marges de securite sur une slide
//
//  Render 4 rectangles assombris autour de la zone "safe" (centrale)
//  pour aider le designer a placer le contenu dans les bonnes zones.
//
//  Source : layoutRules.safeZonesPx du variant actuel
//  (top/left/right/bottom en px du canvas REEL, pas scaled)
// ============================================================

export type SafeZoneOverlayProps = {
  safeZonesPx: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
  canvasWidth: number;   // width REEL du canvas (ex: 1080)
  canvasHeight: number;  // height REEL du canvas (ex: 1350)
  scale: number;         // scale applique pour la preview (ex: 0.27)
};

export default function SafeZoneOverlay({
  safeZonesPx,
  canvasWidth,
  canvasHeight,
  scale,
}: SafeZoneOverlayProps) {
  // Scale les valeurs au container preview
  const top = safeZonesPx.top * scale;
  const left = safeZonesPx.left * scale;
  const right = safeZonesPx.right * scale;
  const bottom = safeZonesPx.bottom * scale;

  const previewWidth = canvasWidth * scale;
  const previewHeight = canvasHeight * scale;

  // Style commun des zones assombris
  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    pointerEvents: "none",
    zIndex: 10,
  };

  return (
    <>
      {/* Zone TOP - bande sombre en haut */}
      <div
        style={{
          ...overlayStyle,
          top: 0,
          left: 0,
          width: previewWidth,
          height: top,
        }}
      />
      {/* Zone BOTTOM - bande sombre en bas */}
      <div
        style={{
          ...overlayStyle,
          bottom: 0,
          left: 0,
          width: previewWidth,
          height: bottom,
        }}
      />
      {/* Zone LEFT - bande sombre a gauche (entre top et bottom) */}
      <div
        style={{
          ...overlayStyle,
          top: top,
          left: 0,
          width: left,
          height: previewHeight - top - bottom,
        }}
      />
      {/* Zone RIGHT - bande sombre a droite */}
      <div
        style={{
          ...overlayStyle,
          top: top,
          right: 0,
          width: right,
          height: previewHeight - top - bottom,
        }}
      />
      {/* Bordure pointillee orange autour de la safe zone (centre) */}
      <div
        style={{
          position: "absolute",
          top: top,
          left: left,
          width: previewWidth - left - right,
          height: previewHeight - top - bottom,
          border: "1.5px dashed rgba(242, 101, 34, 0.8)",
          pointerEvents: "none",
          zIndex: 11,
          boxSizing: "border-box",
        }}
      />
    </>
  );
}