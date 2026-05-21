"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Users, Building2, FileText, Bug, Inbox, ArrowRight,
  Crown, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

// ============================================================
//  SUPER-ADMIN DASHBOARD
//  Vue d'ensemble : nombre de tenants, users, projets, bugs, prospects
// ============================================================

type Stats = {
  totalTenants: number;
  totalAdmins: number;
  totalGraphists: number;
  totalProjects: number;
  pendingProjects: number;
  unreadBugs: number;
  unreadProspects: number;
};

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Tenants
        const { count: tenants } = await supabase
          .from("tenant_configs")
          .select("tenant_id", { count: "exact", head: true });

        // Profiles par rôle
        const { count: admins } = await supabase
          .from("user_profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "tenant_admin");

        const { count: graphists } = await supabase
          .from("user_profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "graphist");

        // Projets
        const { count: projects } = await supabase
          .from("studio_projects")
          .select("id", { count: "exact", head: true });

        const { count: pending } = await supabase
          .from("studio_projects")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_approval");

        // Bugs non lus
        const { count: bugs } = await supabase
          .from("feedback_reports")
          .select("id", { count: "exact", head: true })
          .eq("read", false);

        // Prospects non lus
        const { count: prospects } = await supabase
          .from("prospect_messages")
          .select("id", { count: "exact", head: true })
          .eq("read", false);

        if (!cancelled) {
          setStats({
            totalTenants: tenants || 0,
            totalAdmins: admins || 0,
            totalGraphists: graphists || 0,
            totalProjects: projects || 0,
            pendingProjects: pending || 0,
            unreadBugs: bugs || 0,
            unreadProspects: prospects || 0,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error("[SuperAdminDashboard] Erreur fetch:", err);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-10 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Crown size={14} className="text-orange-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
            Super Administration
          </span>
        </div>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">
          Dashboard
        </h1>
        <p className="text-sm text-neutral-500">
          Vue d&apos;ensemble de la plateforme BrandLock
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : stats ? (
        <>
          {/* KPI CARDS — Ligne 1 : Clients */}
          <section className="mb-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">
              Plateforme
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="Clients (tenants)"
                value={stats.totalTenants}
                icon={<Building2 size={18} />}
                color="orange"
                href="/super-admin/clients"
              />
              <StatCard
                label="Admins clients"
                value={stats.totalAdmins}
                icon={<Users size={18} />}
                color="blue"
              />
              <StatCard
                label="Graphistes"
                value={stats.totalGraphists}
                icon={<Users size={18} />}
                color="purple"
              />
            </div>
          </section>

          {/* KPI CARDS — Ligne 2 : Activité */}
          <section className="mb-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">
              Activité
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                label="Projets totaux"
                value={stats.totalProjects}
                icon={<FileText size={18} />}
                color="green"
              />
              <StatCard
                label="En attente de validation"
                value={stats.pendingProjects}
                icon={<TrendingUp size={18} />}
                color="amber"
                highlight={stats.pendingProjects > 0}
              />
            </div>
          </section>

          {/* KPI CARDS — Ligne 3 : Inbox */}
          <section className="mb-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">
              À traiter
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                label="Prospects non lus"
                value={stats.unreadProspects}
                icon={<Inbox size={18} />}
                color="blue"
                href="/super-admin/prospects"
                highlight={stats.unreadProspects > 0}
              />
              <StatCard
                label="Bugs non lus"
                value={stats.unreadBugs}
                icon={<Bug size={18} />}
                color="red"
                href="/super-admin/bugs"
                highlight={stats.unreadBugs > 0}
              />
            </div>
          </section>

          {/* QUICK ACTIONS */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">
              Actions rapides
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuickAction
                title="Créer un nouveau client"
                description="Ajouter un tenant avec configuration JSON + utilisateurs"
                href="/super-admin/clients"
                icon={<Building2 size={18} />}
              />
              <QuickAction
                title="Voir les analytics"
                description="Consommation IA, coûts, activité par client"
                href="/super-admin/analytics"
                icon={<BarChart3 />}
              />
            </div>
          </section>
        </>
      ) : (
        <div className="text-center py-12 text-sm text-neutral-400">
          Erreur de chargement des données
        </div>
      )}
    </div>
  );
}


// ============================================================
//  STAT CARD
// ============================================================
function StatCard({
  label, value, icon, color, href, highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "orange" | "blue" | "green" | "purple" | "amber" | "red";
  href?: string;
  highlight?: boolean;
}) {
  const colorMap: Record<string, string> = {
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100",
  };

  const content = (
    <div className={`bg-white rounded-xl border p-5 transition flex items-center gap-4 ${
      highlight ? "border-orange-300 ring-2 ring-orange-100" : "border-neutral-200"
    } ${href ? "hover:border-neutral-300 hover:shadow-sm cursor-pointer" : ""}`}>
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
          {label}
        </div>
        <div className="text-2xl font-black text-neutral-900">{value}</div>
      </div>
      {href && <ArrowRight size={16} className="text-neutral-300" />}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}


// ============================================================
//  QUICK ACTION
// ============================================================
function QuickAction({
  title, description, href, icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-neutral-200 p-5 hover:border-orange-300 hover:shadow-sm transition group flex items-start gap-3"
    >
      <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-neutral-900 mb-1 flex items-center gap-1.5">
          {title}
          <ArrowRight size={12} className="text-neutral-300 group-hover:text-orange-500 transition" />
        </div>
        <div className="text-xs text-neutral-500">{description}</div>
      </div>
    </Link>
  );
}


// Petit helper pour BarChart3 (au cas où l'import n'est pas dispo)
function BarChart3() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}
