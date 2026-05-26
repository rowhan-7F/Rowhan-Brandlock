"use client";

import { useEffect, useState } from "react";

/**
 * useMediaQuery — Hook pour responsive runtime detection
 *
 * Usage :
 *   const isMobile = useMediaQuery("(max-width: 767px)");
 *   const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
 *   const isDesktop = useMediaQuery("(min-width: 1024px)");
 *
 * Note : SSR-safe (returns false on server, hydrates on client).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);

    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Helpers preconfigures (breakpoints Tailwind par defaut)
 */
export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsTablet() {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}