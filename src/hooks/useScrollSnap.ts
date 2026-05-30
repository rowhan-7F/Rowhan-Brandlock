"use client";

import { useEffect } from "react";

// ============================================================
//  useScrollSnap — Snap JS robuste iOS Safari (Phase 9.4.x)
//  - scroll DIRECT du conteneur (scrollTo) : fiable sur iOS
//  - ecoute conteneur (scroll + touchend) + 'scrollend' + window-capture
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
      const cont = containerRef.current;
      if (!cont) return;

      const cards = Object.values(cardsRef.current || {}).filter(
        Boolean
      ) as HTMLDivElement[];
      if (cards.length === 0) return;

      const anchor = cont.getBoundingClientRect().top;
      let closest: HTMLDivElement | null = null;
      let minDist = Infinity;

      for (const card of cards) {
        const dist = Math.abs(card.getBoundingClientRect().top - anchor);
        if (dist < minDist) {
          minDist = dist;
          closest = card;
        }
      }

      if (closest && minDist > 6 && minDist < window.innerHeight * 1.5) {
        snapping = true;
        // iOS-fiable : scroll le conteneur directement (offset relatif)
        const delta = closest.getBoundingClientRect().top - anchor;
        cont.scrollTo({ top: cont.scrollTop + delta, behavior: "smooth" });
        setTimeout(() => {
          snapping = false;
        }, 500);
      }
    };

    const onScroll = () => {
      if (snapping) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(snapToNearest, 120);
    };
    const onScrollEnd = () => {
      if (!snapping) snapToNearest();
    };

    // Conteneur : evenements directs (les plus fiables quand dispo)
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("touchend", onScroll, { passive: true });
    // scrollend : declencheur propre (Safari 18+, Chrome 114+)
    (container as unknown as { addEventListener: (t: string, l: EventListener) => void })
      .addEventListener("scrollend", onScrollEnd as EventListener);
    // Fallback iOS : capte le scroll de n'importe quel descendant via window
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });

    return () => {
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("touchend", onScroll);
      (container as unknown as { removeEventListener: (t: string, l: EventListener) => void })
        .removeEventListener("scrollend", onScrollEnd as EventListener);
      window.removeEventListener("scroll", onScroll, {
        capture: true,
      } as EventListenerOptions);
      clearTimeout(settleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}