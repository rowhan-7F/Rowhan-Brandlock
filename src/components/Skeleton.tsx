"use client";

import React from "react";

// ============================================================
//  SKELETON COMPONENTS LUXURY
//  Remplace les spinners par des squelettes animés
//  (Linear, Notion, Stripe style)
// ============================================================

type SkeletonProps = {
  className?: string;
  variant?: "default" | "shimmer";
  style?: React.CSSProperties;
};

// Base : rectangle animé
export function Skeleton({ className = "", variant = "shimmer", style }: SkeletonProps) {
  const baseClass = "bg-neutral-200 rounded";
  const variantClass =
    variant === "shimmer"
      ? "animate-shimmer bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%]"
      : "animate-pulse";

  return <div className={`${baseClass} ${variantClass} ${className}`} style={style} />;
}

// ============================================================
//  Préréglages métier
// ============================================================

// Carte projet (pour /studio, /admin/tenant)
export function SkeletonProjectCard() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// Ligne de tableau
export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-neutral-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-2">
          <Skeleton className="h-3 w-full" />
        </td>
      ))}
    </tr>
  );
}

// Image (carré)
export function SkeletonImage({ aspectRatio = "square" }: { aspectRatio?: "square" | "video" | "portrait" }) {
  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "video"
        ? "aspect-video"
        : "aspect-[3/4]";
  return <Skeleton className={`w-full ${aspectClass} rounded-xl`} />;
}

// Card KPI (analytics)
export function SkeletonKpiCard() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="w-6 h-6 rounded-lg" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-2.5 w-24" />
    </div>
  );
}

// Liste verticale d'items
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Avatar circulaire
export function SkeletonAvatar({ size = 32 }: { size?: number }) {
  return <Skeleton className="rounded-full" style={{ width: size, height: size }} />;
}

// Texte multi-lignes
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          // Dernière ligne plus courte pour réalisme
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

// Page complète (analytics, dashboard)
export function SkeletonDashboard() {
  return (
    <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4">
        <Skeleton className="h-2.5 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>

      {/* 3 cards horizontales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4">
            <Skeleton className="h-2.5 w-24 mb-4" />
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
