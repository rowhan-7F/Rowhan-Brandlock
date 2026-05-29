"use client";

import { useEffect } from "react";

// ============================================================
//  useScrollSnap — Snap JS garanti (Phase 9.3.20b)
//  Ecoute le scroll au niveau window (capture) pour capter
//  le scroll quel que soit l'element qui scrolle reellement
//  (iOS Safari : le <main> ne recoit pas toujours l'event).
// ============================================================
export function useScrollSnap(
  containerRef: { current: HTMLDivElement | null },
  cardsRef: { current: Record<string, HTMLDivElement | null> },
  deps: unknown[] = []
) {
  useEffect(() => {
    let settleTimer: ReturnType<typeof setTimeout>;
    let snapping = false;

    const snapToNearest = () => {
      const container = containerRef.current;
      if (!container) return;

      const cards = Object.values(cardsRef.current || {}).filter(
        Boolean
      ) as HTMLDivElement[];
      if (cards.length === 0) return;

      const anchor = container.getBoundingClientRect().top;
      let closest: HTMLDivElement | null = null;
      let minDist = Infinity;

      for (const card of cards) {
        const dist = Math.abs(card.getBoundingClientRect().top - anchor);
        if (dist < minDist) {
          minDist = dist;
          closest = card;
        }
      }

      // Snap seulement si une card est proche (evite de snapper
      // quand on scrolle un modal ou une autre zone)
      if (closest && minDist > 6 && minDist < window.innerHeight * 1.5) {
        snapping = true;
        closest.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => {
          snapping = false;
        }, 450);
      }
    };

    const onScroll = () => {
      if (snapping) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(snapToNearest, 120);
    };

    // capture: true => capte le scroll de n'importe quel descendant
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", onScroll, {
        capture: true,
      } as EventListenerOptions);
      clearTimeout(settleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}