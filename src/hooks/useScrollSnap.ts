"use client";

import { useEffect } from "react";

// ============================================================
//  useScrollSnap — Snap JS garanti (Phase 9.3.20)
//  iOS Safari ignore "scroll-snap-stop: always", donc on force
//  le recentrage de la card la plus proche apres chaque scroll.
// ============================================================
export function useScrollSnap(
  containerRef: { current: HTMLDivElement | null },
  cardsRef: { current: Record<string, HTMLDivElement | null> },
  deps: unknown[] = []
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let settleTimer: ReturnType<typeof setTimeout>;
    let snapping = false;

    const snapToNearest = () => {
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

      if (closest && minDist > 6) {
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

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      clearTimeout(settleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}