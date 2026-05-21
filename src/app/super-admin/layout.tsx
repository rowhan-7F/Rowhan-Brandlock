"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, BarChart3, Mail, Bug,
  Crown, LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  LAYOUT SUPER-ADMIN LUXURY V2
//  - Logo BrandLock + drapeau suisse
//  - Sidebar avec badges de notifications LIVE
//  - Bouton déconnexion isolé en bas
//  - Palette LUXURY (Bordeaux + crème + ink)
// ============================================================

const BRAND = {
  bordeaux: "#B11E2F",
  bordeauxDark: "#7A1320",
  ink: "#181614",
  cream: "#F5F1EA",
  warmGray: "#807972",
  gold: "#D4AF7A",
};

type Counts = {
  newProspects: number;
  newBugs: number;
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({ newProspects: 0, newBugs: 0 });
  const [loading, setLoading] = useState(true);

  // Vérifie l'accès super_admin + récupère les compteurs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("scope, role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile || profile.scope !== "platform" || profile.role !== "super_admin") {
        router.push("/");
        return;
      }

      // Charger les compteurs initiaux
      await loadCounts();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Recharge les counters quand on change de page
  useEffect(() => {
    loadCounts();
  }, [pathname]);

  // Auto-refresh toutes les 60s
  useEffect(() => {
    const interval = setInterval(loadCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadCounts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Récupère les compteurs de manière efficace
      const [prospectsRes, bugsRes] = await Promise.all([
        supabase
          .from("prospect_messages")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabase
          .from("feedback_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
      ]);

      setCounts({
        newProspects: prospectsRes.count || 0,
        newBugs: bugsRes.count || 0,
      });
    } catch (err) {
      console.error("[layout] loadCounts error:", err);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Voulez-vous vraiment vous déconnecter ?")) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BRAND.cream }}>
        <div className="text-sm font-bold uppercase tracking-widest" style={{ color: BRAND.warmGray }}>
          Vérification d'accès...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: BRAND.cream }}>
      {/* ============================================================ */}
      {/*  SIDEBAR                                                     */}
      {/* ============================================================ */}
      <aside
        className="w-64 flex flex-col shrink-0 border-r"
        style={{
          backgroundColor: "white",
          borderColor: `${BRAND.ink}10`,
        }}
      >
        {/* Header sidebar — Logo BrandLock + drapeau astérix */}
        <div className="p-6 border-b" style={{ borderColor: `${BRAND.ink}10` }}>
          <Link href="/super-admin" className="flex items-center gap-2.5 group">
            <img
              src="/media/logo.png"
              alt="BrandLock"
              className="h-9 w-auto object-contain transition-opacity group-hover:opacity-70"
            />
            <div className="flex items-baseline gap-1">
              <span
                className="font-black tracking-tighter text-lg italic"
                style={{ color: BRAND.ink, letterSpacing: "-0.04em" }}
              >
                BrandLock
              </span>
              <svg
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
                className="h-2.5 w-2.5 shrink-0"
                aria-label="Suisse"
              >
                <rect width="32" height="32" fill={BRAND.bordeaux} rx="3" />
                <rect x="13" y="7" width="6" height="18" fill="white" />
                <rect x="7" y="13" width="18" height="6" fill="white" />
              </svg>
            </div>
          </Link>
          <div
            className="text-[9px] font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-1.5"
            style={{ color: BRAND.bordeaux }}
          >
            <Crown size={9} />
            Super Administration
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavItem
            href="/super-admin"
            icon={<LayoutDashboard size={15} />}
            label="Vue d'ensemble"
            active={pathname === "/super-admin"}
          />
          <NavItem
            href="/super-admin/clients"
            icon={<Users size={15} />}
            label="Clients"
            active={pathname.startsWith("/super-admin/clients")}
          />
          <NavItem
            href="/super-admin/analytics"
            icon={<BarChart3 size={15} />}
            label="Analytics"
            active={pathname.startsWith("/super-admin/analytics")}
          />
          <NavItem
            href="/super-admin/prospects"
            icon={<Mail size={15} />}
            label="Prospects"
            active={pathname.startsWith("/super-admin/prospects")}
            badge={counts.newProspects}
          />
          <NavItem
            href="/super-admin/bugs"
            icon={<Bug size={15} />}
            label="Bugs & feedback"
            active={pathname.startsWith("/super-admin/bugs")}
            badge={counts.newBugs}
          />
        </nav>

        {/* Footer sidebar — Déconnexion */}
        <div className="p-3 border-t" style={{ borderColor: `${BRAND.ink}10` }}>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-red-600 hover:bg-red-50 transition group"
          >
            <LogOut size={14} className="group-hover:rotate-12 transition-transform" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/*  CONTENT                                                     */}
      {/* ============================================================ */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

// ============================================================
//  NAV ITEM avec badge notif
// ============================================================
function NavItem({
  href, icon, label, active, badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition group ${
        active
          ? "text-white shadow-sm"
          : "text-neutral-600 hover:bg-neutral-100"
      }`}
      style={active ? {
        backgroundColor: BRAND.ink,
      } : {}}
    >
      <div className="flex items-center gap-2.5">
        <span className={active ? "text-white" : "text-neutral-400 group-hover:text-neutral-700 transition-colors"}>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span
          className="min-w-5 h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center"
          style={{
            backgroundColor: BRAND.bordeaux,
            color: "white",
            boxShadow: `0 2px 8px -2px ${BRAND.bordeaux}80`,
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
