"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import NotificationsBell from "@/components/NotificationsBell";

const COLORS = {
  ink: "#181614",
  cream: "#F5F1EA",
  bordeaux: "#B11E2F",
  warmGray: "#807972",
};

type AdminMobileHeaderProps = {
  title: string;
  tenantName: string;
  brandPrimary?: string;
};

export default function AdminMobileHeader({
  title,
  tenantName,
  brandPrimary = "#B11E2F",
}: AdminMobileHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isMobile) return null;

  return (
    <>
      <header
        className="sticky top-0 z-30 px-4 py-3 border-b"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              src="/media/logo.png"
              alt="ROWHAN"
              className="h-7 w-auto shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-[9px] font-black uppercase tracking-widest shrink-0"
                  style={{ color: COLORS.bordeaux }}
                >
                  ADMINISTRATION
                </span>
                <span
                  className="text-[9px] shrink-0"
                  style={{ color: COLORS.warmGray }}
                >
                  •
                </span>
                <span
                  className="text-xs font-black tracking-tight truncate"
                  style={{ color: COLORS.ink }}
                >
                  {title}
                </span>
              </div>
              <p
                className="text-[10px] mt-0.5 truncate"
                style={{ color: COLORS.warmGray }}
              >
                {tenantName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <NotificationsBell brandColor={brandPrimary} />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="p-2 -m-2 rounded-full"
              aria-label="Menu"
            >
              <Menu size={20} style={{ color: COLORS.ink }} />
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <BurgerDrawer
          tenantName={tenantName}
          activePath={pathname}
          onClose={() => setDrawerOpen(false)}
          onNavigate={(path) => {
            setDrawerOpen(false);
            router.push(path);
          }}
        />
      )}
    </>
  );
}

function BurgerDrawer({
  tenantName,
  activePath,
  onClose,
  onNavigate,
}: {
  tenantName: string;
  activePath: string;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] flex flex-col"
        style={{ backgroundColor: COLORS.cream }}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-200">
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: COLORS.ink }}
          >
            {tenantName}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2"
            aria-label="Fermer"
          >
            <X size={20} style={{ color: COLORS.ink }} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          <DrawerItem
            label="Dashboard"
            onClick={() => onNavigate("/admin/tenant")}
            active={activePath === "/admin/tenant"}
          />
          <DrawerItem
            label="Mon équipe"
            onClick={() => onNavigate("/admin/tenant/team")}
            active={activePath.startsWith("/admin/tenant/team")}
          />
          <DrawerItem
            label="Brand Assets"
            onClick={() => onNavigate("/admin/tenant/brand-assets")}
            active={activePath.startsWith("/admin/tenant/brand-assets")}
          />
          <DrawerItem
            label="Bibliothèque"
            onClick={() => onNavigate("/admin/tenant/library")}
            active={activePath.startsWith("/admin/tenant/library")}
          />
        </nav>
        <div className="px-5 py-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: COLORS.ink,
              color: COLORS.cream,
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>
    </>
  );
}

function DrawerItem({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-5 py-3 text-left text-sm font-medium transition-colors"
      style={{
        backgroundColor: active ? "rgba(177, 30, 47, 0.08)" : "transparent",
        color: active ? COLORS.bordeaux : COLORS.ink,
        fontWeight: active ? 700 : 500,
        borderLeft: active ? `3px solid ${COLORS.bordeaux}` : "3px solid transparent",
      }}
    >
      {label}
    </button>
  );
}