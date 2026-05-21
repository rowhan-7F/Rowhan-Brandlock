"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Crown, TrendingUp, DollarSign, Layers, CheckCircle2,
  Users, Image as ImageIcon, Bug, Target, Clock, Zap, Activity,
  Mail, Sparkles, AlertCircle, BarChart3, PieChart as PieChartIcon,
  TrendingDown, Award, Palette, Calendar, Building2,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, Legend,
} from "recharts";
import { supabase } from "@/lib/supabase";

// ============================================================
//  PAGE ANALYTICS — LUXURY EDITION
//  Vue plateforme complète + mode tenant (drill-down)
// ============================================================

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#ec4899", "#eab308", "#06b6d4", "#84cc16"];
const USD_TO_CHF = 0.88;

type Period = "7d" | "30d" | "90d" | "all";

type AnalyticsData = {
  period: string;
  tenant: string;
  filters: { availableTenants: Array<{ id: string; name: string }> };
  kpis: any;
  charts: any;
};

export default function SuperAdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [tenantFilter, setTenantFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Non authentifié");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ period, tenant: tenantFilter });
      const res = await fetch(`/api/super-admin/analytics?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period, tenantFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, charts, filters } = data;
  const isTenantView = tenantFilter !== "all";
  const tenantName = isTenantView
    ? filters.availableTenants.find(t => t.id === tenantFilter)?.name || tenantFilter
    : null;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* HEADER */}
      <div className="bg-white border-b border-neutral-200 px-8 py-6 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown size={12} className="text-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                Super Administration
              </span>
            </div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
              Analytics
              {isTenantView && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-100 text-orange-800 text-xs font-black uppercase tracking-wider border border-orange-300">
                  <Building2 size={11} />
                  {tenantName}
                </span>
              )}
            </h1>
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-2">
            {/* Sélecteur tenant */}
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-bold uppercase tracking-wider bg-white focus:border-orange-500 focus:outline-none transition"
            >
              <option value="all">📊 Vue plateforme</option>
              {filters.availableTenants.map(t => (
                <option key={t.id} value={t.id}>🏢 {t.name}</option>
              ))}
            </select>

            {/* Sélecteur période */}
            <div className="flex bg-neutral-100 rounded-lg p-1">
              {(["7d", "30d", "90d", "all"] as Period[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition ${
                    period === p
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  {p === "7d" ? "7 jours" : p === "30d" ? "30 jours" : p === "90d" ? "90 jours" : "Tout"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-[1600px] mx-auto space-y-6">

        {/* ============================================================ */}
        {/*  SECTION 1 — KPI HÉROS                                       */}
        {/* ============================================================ */}
        <section>
          <SectionTitle icon={<Sparkles size={14} />} label="Vue d'ensemble" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
            <KpiCard
              icon={<DollarSign size={14} />}
              label="Coûts IA"
              value={`$${kpis.totalCost.toFixed(2)}`}
              subValue={`${(kpis.totalCost * USD_TO_CHF).toFixed(2)} CHF`}
              color="orange"
            />
            <KpiCard
              icon={<Zap size={14} />}
              label="Events IA"
              value={kpis.totalEvents.toString()}
              subValue={`${((kpis.totalInputTokens + kpis.totalOutputTokens) / 1000).toFixed(1)}k tokens`}
              color="blue"
            />
            <KpiCard
              icon={<Layers size={14} />}
              label="Projets"
              value={kpis.totalProjects.toString()}
              subValue={`${kpis.approvalRate}% approuvés`}
              color="purple"
            />
            <KpiCard
              icon={<ImageIcon size={14} />}
              label="Bibliothèque"
              value={kpis.totalImages.toString()}
              subValue={`${kpis.totalImagesMB} MB · ${kpis.imagesUsed} utilisées`}
              color="green"
            />
            <KpiCard
              icon={<Target size={14} />}
              label="Succès IA"
              value={`${kpis.successRate}%`}
              subValue={`Temps approbation: ${kpis.avgApprovalTimeHours}h`}
              color="amber"
            />
          </div>
        </section>

        {/* ============================================================ */}
        {/*  SECTION 2 — TIMELINE ACTIVITÉ                               */}
        {/* ============================================================ */}
        {charts.eventsTimeline.length > 0 && (
          <section>
            <SectionTitle icon={<TrendingUp size={14} />} label="Activité dans le temps" />
            <Card>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={charts.eventsTimeline}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis
                    dataKey="date"
                    style={{ fontSize: 10 }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: "short" })}
                  />
                  <YAxis style={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Events"
                    stroke="#f97316"
                    fillOpacity={1}
                    fill="url(#colorCount)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    name="Coût ($)"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorCost)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </section>
        )}

        {/* ============================================================ */}
        {/*  SECTION 3 — COÛTS IA (3 charts)                             */}
        {/* ============================================================ */}
        <section>
          <SectionTitle icon={<DollarSign size={14} />} label="Décomposition des coûts IA" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
            {/* Par event type */}
            <Card title="Par type d'action">
              {charts.costsByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.costsByType} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis type="number" style={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                    <YAxis dataKey="type" type="category" style={{ fontSize: 10 }} width={100} />
                    <Tooltip
                      formatter={(v: any) => `$${parseFloat(v).toFixed(4)}`}
                      labelStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="cost" fill="#f97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </Card>

            {/* Par provider */}
            <Card title="Par provider IA">
              {charts.costsByProvider.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={charts.costsByProvider}
                      dataKey="cost"
                      nameKey="provider"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={(d: any) => d.provider}
                      labelLine={false}
                      style={{ fontSize: 10 }}
                    >
                      {charts.costsByProvider.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `$${parseFloat(v).toFixed(4)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </Card>

            {/* Top models */}
            <Card title="Top 5 modèles">
              {charts.costsByModel.length > 0 ? (
                <div className="space-y-2">
                  {charts.costsByModel.map((m: any, i: number) => (
                    <div key={m.model} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-1.5 h-6 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-neutral-900 truncate">{m.model}</div>
                          <div className="text-[10px] text-neutral-400">{m.count} calls</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="font-black text-orange-600">${m.cost.toFixed(4)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Empty />}
            </Card>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  SECTION 4 — WORKFLOW PROJETS + GRAPHISTES                   */}
        {/* ============================================================ */}
        <section>
          <SectionTitle icon={<Layers size={14} />} label="Workflow & équipe" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            {/* Funnel workflow */}
            <Card title="Funnel projets">
              <div className="space-y-2">
                <FunnelStep label="Brouillons" count={kpis.projectsDraft} total={kpis.totalProjects} color="neutral" />
                <FunnelStep label="En attente d'approbation" count={kpis.projectsPending} total={kpis.totalProjects} color="amber" />
                <FunnelStep label="Approuvés" count={kpis.projectsApproved} total={kpis.totalProjects} color="green" />
                <FunnelStep label="Refusés" count={kpis.projectsRejected} total={kpis.totalProjects} color="red" />
              </div>
              {kpis.avgApprovalTimeHours > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-1.5 text-[11px] text-neutral-600">
                  <Clock size={11} className="text-orange-500" />
                  <span>Temps moyen d'approbation : <strong>{kpis.avgApprovalTimeHours}h</strong></span>
                </div>
              )}
            </Card>

            {/* Performance graphistes */}
            <Card title="Top membres studio">
              {charts.graphistesPerf.length > 0 ? (
                <div className="space-y-2">
                  {charts.graphistesPerf.map((g: any, i: number) => {
                    const approvalRate = g.total > 0 ? Math.round((g.approved / g.total) * 100) : 0;
                    return (
                      <div key={g.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-neutral-50">
                        <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-neutral-900 truncate">{g.display_name}</div>
                          <div className="text-[10px] text-neutral-400 truncate">{g.email}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-neutral-900">{g.total}</div>
                          <div className="text-[10px] text-green-600">{approvalRate}% OK</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <Empty />}
            </Card>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  SECTION 5 — TENANTS (vue plateforme uniquement)              */}
        {/* ============================================================ */}
        {!isTenantView && charts.tenantsActivity.length > 0 && (
          <section>
            <SectionTitle icon={<Building2 size={14} />} label="Activité par client" />
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-2 px-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">Client</th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">Projets</th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">Approuvés</th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">Taux</th>
                      <th className="text-right py-2 px-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">Coût IA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charts.tenantsActivity.map((t: any) => {
                      const rate = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                      return (
                        <tr key={t.tenant} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="py-2 px-2 font-bold text-neutral-900">{t.tenant}</td>
                          <td className="py-2 px-2 text-right">{t.total}</td>
                          <td className="py-2 px-2 text-right text-green-600 font-bold">{t.approved}</td>
                          <td className="py-2 px-2 text-right">
                            <span className={`font-bold ${rate >= 75 ? "text-green-600" : rate >= 50 ? "text-amber-600" : "text-neutral-500"}`}>
                              {rate}%
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-orange-600">${t.cost.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        )}

        {/* ============================================================ */}
        {/*  SECTION 6 — BIBLIOTHÈQUE (Top images + Couleurs)             */}
        {/* ============================================================ */}
        <section>
          <SectionTitle icon={<ImageIcon size={14} />} label="Bibliothèque d'images" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            {/* Top images */}
            <Card title="Top images les plus utilisées">
              {charts.topImages.length > 0 ? (
                <div className="grid grid-cols-5 gap-2">
                  {charts.topImages.slice(0, 10).map((img: any, i: number) => (
                    <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.thumbnail_url}
                        alt={img.filename || ""}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute top-1 right-1 bg-black/70 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                        ×{img.use_count}
                      </div>
                      {i < 3 && (
                        <div className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] font-black px-1 py-0.5 rounded flex items-center gap-0.5">
                          <Award size={8} /> {i + 1}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-neutral-400">
                  Aucune image n'a encore été utilisée dans un projet
                </div>
              )}
            </Card>

            {/* Couleurs dominantes */}
            <Card title="Palette de couleurs populaires">
              {charts.dominantColors.length > 0 ? (
                <div className="grid grid-cols-6 gap-2">
                  {charts.dominantColors.map((c: any) => (
                    <div key={c.hex} className="aspect-square rounded-lg flex flex-col items-center justify-end p-1.5 group cursor-pointer transition-all hover:scale-105"
                      style={{ backgroundColor: c.hex }}
                      title={`${c.hex} · ${c.count} fois`}
                    >
                      <div className="text-[8px] font-black text-white/90 mix-blend-difference uppercase tracking-wider">
                        {c.hex}
                      </div>
                      <div className="text-[9px] font-bold text-white/80 mix-blend-difference">
                        ×{c.count}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-neutral-400">
                  Les couleurs apparaîtront quand les images seront analysées
                </div>
              )}
            </Card>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  SECTION 7 — TRENDS (activité par heure/jour)                */}
        {/* ============================================================ */}
        {charts.activityHourly.some((a: any) => a.count > 0) && (
          <section>
            <SectionTitle icon={<Activity size={14} />} label="Tendances d'utilisation" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
              {/* Activité par heure */}
              <Card title="Activité par heure de la journée">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={charts.activityHourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="hour" style={{ fontSize: 10 }} tickFormatter={(h) => `${h}h`} />
                    <YAxis style={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: any) => [`${v} events`, "Total"]}
                      labelFormatter={(h: any) => `${h}h00`}
                    />
                    <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Activité par jour de semaine */}
              <Card title="Activité par jour de semaine">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={charts.activityWeekly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="day" style={{ fontSize: 10 }} />
                    <YAxis style={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/*  SECTION 8 — SANTÉ + ENGAGEMENT (vue plateforme)              */}
        {/* ============================================================ */}
        {!isTenantView && (
          <section>
            <SectionTitle icon={<Activity size={14} />} label="Santé plateforme" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {/* Bugs */}
              <Card title="Bugs & Support">
                <div className="space-y-2">
                  <Metric label="Nouveaux" value={kpis.bugsNew} color={kpis.bugsNew > 0 ? "red" : "neutral"} />
                  <Metric label="Résolus" value={kpis.bugsResolved} color="green" />
                  <Metric label="Critiques ouverts" value={kpis.bugsCritical} color={kpis.bugsCritical > 0 ? "red" : "neutral"} />
                </div>
              </Card>

              {/* Prospects */}
              <Card title="Funnel commercial">
                <div className="space-y-2">
                  <Metric label="Nouveaux prospects" value={kpis.prospectsNew} color="blue" />
                  <Metric label="Convertis en clients" value={kpis.prospectsClients} color="green" />
                  <Metric label="Taux conversion" value={`${kpis.conversionRate}%`} color="orange" />
                </div>
              </Card>

              {/* Engagement */}
              <Card title="Engagement utilisateurs">
                <div className="space-y-2">
                  <Metric label="Notifications totales" value={kpis.notifsTotal} color="neutral" />
                  <Metric label="Notifications lues" value={kpis.notifsRead} color="green" />
                  <Metric label="Taux de lecture" value={`${kpis.notifsReadRate}%`} color={kpis.notifsReadRate >= 70 ? "green" : "amber"} />
                </div>
              </Card>
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="text-[10px] text-neutral-400 text-center py-4">
          Analytics rafraîchies à chaque chargement · {new Date().toLocaleString("fr-CH")}
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  COMPONENTS
// ============================================================

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-500">
      {icon}
      {label}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4">
      {title && (
        <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function KpiCard({
  icon, label, value, subValue, color,
}: { icon: React.ReactNode; label: string; value: string; subValue?: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    orange: { bg: "bg-orange-50", text: "text-orange-700", iconBg: "bg-orange-100" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", iconBg: "bg-blue-100" },
    green: { bg: "bg-green-50", text: "text-green-700", iconBg: "bg-green-100" },
    purple: { bg: "bg-purple-50", text: "text-purple-700", iconBg: "bg-purple-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100" },
    red: { bg: "bg-red-50", text: "text-red-700", iconBg: "bg-red-100" },
    neutral: { bg: "bg-neutral-50", text: "text-neutral-700", iconBg: "bg-neutral-100" },
  };
  const c = colorMap[color] || colorMap.neutral;
  return (
    <div className={`${c.bg} rounded-xl p-3 border border-transparent hover:border-current/20 transition`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-6 h-6 rounded-lg ${c.iconBg} flex items-center justify-center ${c.text}`}>
          {icon}
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">{label}</span>
      </div>
      <div className={`text-2xl font-black ${c.text} tracking-tight`}>{value}</div>
      {subValue && <div className="text-[10px] text-neutral-500 mt-0.5">{subValue}</div>}
    </div>
  );
}

function FunnelStep({
  label, count, total, color,
}: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const colorMap: Record<string, string> = {
    neutral: "bg-neutral-400",
    amber: "bg-amber-500",
    green: "bg-green-500",
    red: "bg-red-500",
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-neutral-700">{label}</span>
        <span className="text-[11px] font-black">
          {count} <span className="text-neutral-400 font-normal">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={`h-full ${colorMap[color]} transition-all`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: any; color: string }) {
  const colorMap: Record<string, string> = {
    neutral: "text-neutral-700",
    red: "text-red-600",
    green: "text-green-600",
    amber: "text-amber-600",
    orange: "text-orange-600",
    blue: "text-blue-600",
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-neutral-600">{label}</span>
      <span className={`text-base font-black ${colorMap[color] || colorMap.neutral}`}>{value}</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex items-center justify-center h-48 text-xs text-neutral-400">
      Aucune donnée
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white px-3 py-2 rounded-lg border border-neutral-200 shadow-lg text-xs">
      <div className="font-bold text-neutral-900 mb-1">
        {new Date(label).toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" })}
      </div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-neutral-600">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>
            {p.name.includes("Coût") ? `$${parseFloat(p.value).toFixed(4)}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
