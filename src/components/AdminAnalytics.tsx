"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { RotateCw, DollarSign, Layers, Megaphone, Users, Brain, Sparkles, FileText } from "lucide-react";

type UsageEvent = {
  id: string;
  client_email: string;
  brand_name: string;
  event_type: string;
  provider: string;
  model: string;
  units: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  success: boolean;
  created_at: string;
};

const PERIODS = [
  { id: '7d', label: '7 jours', days: 7 },
  { id: '30d', label: '30 jours', days: 30 },
  { id: '90d', label: '90 jours', days: 90 },
  { id: 'all', label: 'Tout', days: 99999 }
];

const USD_TO_CHF = 0.88;
const PIE_COLORS = ['#f97316', '#0ea5e9', '#10b981', '#a855f7', '#ec4899', '#eab308'];

const TYPE_LABELS: Record<string, string> = {
  carousel_generation: 'Carrousels',
  publicity_generation: 'Pubs',
  idea_generation: 'Idées',
  image_regen_ai: 'Image IA',
  image_regen_stock: 'Image stock',
  inspire_call: 'Inspire'
};

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('30d');
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [clientMemory, setClientMemory] = useState<string>('');
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [shortSummary, setShortSummary] = useState<string>('');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [period]);

  useEffect(() => {
    if (selectedClient === 'all') {
      setClientMemory('');
      setShortSummary('');
      return;
    }
    fetchClientMemory();
  }, [selectedClient]);

  const fetchEvents = async () => {
    setLoading(true);
    const periodObj = PERIODS.find(p => p.id === period)!;
    const sinceDate = new Date(Date.now() - periodObj.days * 86400000).toISOString();

    let query = supabase
      .from('usage_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (period !== 'all') query = query.gte('created_at', sinceDate);

    const { data, error } = await query;
    if (error) console.error("[analytics] fetch error:", error);
    if (data) setEvents(data as UsageEvent[]);
    setLoading(false);
  };

  const fetchClientMemory = async () => {
    setLoadingMemory(true);
    setShortSummary('');
    const { data } = await supabase
      .from('brand_kits')
      .select('learned_knowledge')
      .ilike('client_email', selectedClient)
      .maybeSingle();
    setClientMemory(data?.learned_knowledge || '');
    setLoadingMemory(false);
  };

  const generateShortSummary = async () => {
    if (!clientMemory) return;
    setGeneratingSummary(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summarizeMemory: true, memoryText: clientMemory })
      });
      const data = await res.json();
      setShortSummary(data.summary || '');
    } catch {
      alert('Erreur génération résumé');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // === Liste de tous les clients (basée sur events bruts) ===
  const allClientsMap = new Map<string, string>();
  events.forEach(e => {
    if (!allClientsMap.has(e.client_email)) {
      allClientsMap.set(e.client_email, e.brand_name || e.client_email);
    }
  });
  const clientsForDropdown = Array.from(allClientsMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  // === Filtrage par client ===
  const filteredEvents = selectedClient === 'all' ? events : events.filter(e => e.client_email === selectedClient);

  // === Aggregations sur les évènements filtrés ===
  const totalCostUsd = filteredEvents.reduce((s, e) => s + (Number(e.cost_usd) || 0), 0);
  const totalCostChf = totalCostUsd * USD_TO_CHF;
  const carouselCount = filteredEvents.filter(e => e.event_type === 'carousel_generation').length;
  const publicityCount = filteredEvents.filter(e => e.event_type === 'publicity_generation').length;
  const aiImageCount = filteredEvents.filter(e => e.event_type === 'image_regen_ai').length;
  const activeClients = new Set(filteredEvents.map(e => e.client_email)).size;

  const costByDay: Record<string, number> = {};
  filteredEvents.forEach(e => {
    const date = new Date(e.created_at).toISOString().split('T')[0];
    costByDay[date] = (costByDay[date] || 0) + (Number(e.cost_usd) || 0);
  });
  const costByDayArray = Object.entries(costByDay)
    .map(([date, cost]) => ({ date: date.slice(5), cost: Number(cost.toFixed(6)) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const typeCounts: Record<string, number> = {};
  filteredEvents.forEach(e => {
    typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1;
  });
  const distributionArray = Object.entries(typeCounts)
    .map(([name, value]) => ({ name: TYPE_LABELS[name] || name, value }))
    .sort((a, b) => b.value - a.value);

  const clientStats: Record<string, any> = {};
  filteredEvents.forEach(e => {
    const key = e.client_email;
    if (!clientStats[key]) {
      clientStats[key] = {
        email: key,
        brand: e.brand_name || e.client_email,
        carousels: 0, publicities: 0, aiImages: 0,
        inputTokens: 0, outputTokens: 0, totalCost: 0
      };
    }
    const c = clientStats[key];
    if (e.event_type === 'carousel_generation') c.carousels++;
    if (e.event_type === 'publicity_generation') c.publicities++;
    if (e.event_type === 'image_regen_ai') c.aiImages++;
    c.inputTokens += Number(e.input_tokens) || 0;
    c.outputTokens += Number(e.output_tokens) || 0;
    c.totalCost += Number(e.cost_usd) || 0;
  });
  const clientList = Object.values(clientStats).sort((a: any, b: any) => b.totalCost - a.totalCost);
  const topClients = clientList.slice(0, 10).map((c: any) => ({
    brand: c.brand.length > 18 ? c.brand.slice(0, 16) + '…' : c.brand,
    cost: Number(c.totalCost.toFixed(6))
  }));

  const exportCsv = () => {
    const headers = ['Date', 'Client', 'Marque', 'Type', 'Provider', 'Modèle', 'Input tokens', 'Output tokens', 'Coût USD'];
    const rows = filteredEvents.map(e => [
      new Date(e.created_at).toLocaleString('fr-CH'),
      e.client_email,
      e.brand_name || '',
      e.event_type,
      e.provider,
      e.model || '',
      e.input_tokens || 0,
      e.output_tokens || 0,
      (Number(e.cost_usd) || 0).toFixed(6)
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const clientLabel = selectedClient === 'all' ? 'all-clients' : (allClientsMap.get(selectedClient) || 'client').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.href = url;
    a.download = `brandlock-usage-${clientLabel}-${period}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedClientLabel = selectedClient === 'all' ? '' : (allClientsMap.get(selectedClient) || selectedClient);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Analytics & Coûts</h2>
          {selectedClient !== 'all' && (
            <p className="text-sm text-orange-500 font-bold mt-1">Filtre actif : {selectedClientLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="px-4 py-2 rounded-2xl bg-white border border-neutral-100 text-xs font-bold outline-none cursor-pointer hover:border-orange-300 transition-all shadow-sm"
          >
            <option value="all">Tous les clients</option>
            {clientsForDropdown.map(([email, brand]) => (
              <option key={email} value={email}>{brand}</option>
            ))}
          </select>
          <div className="flex bg-white rounded-2xl p-1 border border-neutral-100 shadow-sm">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${period === p.id ? 'bg-orange-500 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={fetchEvents} className="p-2 rounded-xl bg-white border border-neutral-100 hover:bg-neutral-50" title="Rafraîchir">
            <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportCsv} disabled={filteredEvents.length === 0} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-orange-600">
            Export CSV
          </button>
        </div>
      </div>

      {selectedClient !== 'all' && (
        <div className="bg-white rounded-3xl border border-neutral-100 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-orange-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Mémoire IA accumulée pour ce client</h3>
            </div>
            <button
              onClick={generateShortSummary}
              disabled={!clientMemory || generatingSummary}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 disabled:opacity-40 flex items-center gap-2"
            >
              <Sparkles size={12} className={generatingSummary ? 'animate-spin' : ''} />
              {generatingSummary ? 'Génération...' : 'Résumé court'}
            </button>
          </div>

          {loadingMemory ? (
            <p className="text-sm text-neutral-400 italic">Chargement de la mémoire...</p>
          ) : !clientMemory ? (
            <p className="text-sm text-neutral-400 italic">Aucune mémoire accumulée pour ce client. La mémoire se construit progressivement à chaque génération de carrousel.</p>
          ) : (
            <div className="space-y-4">
              {shortSummary && (
                <div className="p-5 bg-gradient-to-br from-orange-50 to-orange-50/50 rounded-2xl border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={12} className="text-orange-600" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-600">Résumé éclair</span>
                  </div>
                  <p className="text-base font-semibold text-neutral-900 leading-relaxed">{shortSummary}</p>
                </div>
              )}
              <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={11} className="text-neutral-500" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">Mémoire complète ({clientMemory.length} caractères)</span>
                </div>
                <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap">{clientMemory}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {filteredEvents.length === 0 && !loading ? (
        <div className="bg-white rounded-3xl border border-neutral-100 p-16 text-center space-y-4">
          <p className="text-neutral-400 text-sm font-medium">
            {selectedClient === 'all' ? 'Aucune donnée pour cette période.' : `Aucune donnée pour ${selectedClientLabel} sur cette période.`}
          </p>
          <p className="text-neutral-300 text-xs">Les évènements s&apos;accumulent dès que les clients génèrent du contenu.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-3xl border border-neutral-100 p-16 text-center">
          <p className="text-orange-500 font-black italic">Chargement...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={14} className="text-orange-500" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Coût total</span>
              </div>
              <p className="text-3xl font-black tracking-tighter">${totalCostUsd.toFixed(4)}</p>
              <p className="text-[10px] font-bold text-neutral-400 mt-1">≈ {totalCostChf.toFixed(4)} CHF</p>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Layers size={14} className="text-orange-500" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Carrousels</span>
              </div>
              <p className="text-3xl font-black tracking-tighter">{carouselCount}</p>
              <p className="text-[10px] font-bold text-neutral-400 mt-1">générés</p>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone size={14} className="text-orange-500" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Pubs</span>
              </div>
              <p className="text-3xl font-black tracking-tighter">{publicityCount}</p>
              <p className="text-[10px] font-bold text-neutral-400 mt-1">générées</p>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-orange-500" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{selectedClient === 'all' ? 'Clients actifs' : 'Images IA'}</span>
              </div>
              <p className="text-3xl font-black tracking-tighter">{selectedClient === 'all' ? activeClients : aiImageCount}</p>
              <p className="text-[10px] font-bold text-neutral-400 mt-1">{selectedClient === 'all' ? `${aiImageCount} images IA` : 'générées'}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-6">Coût quotidien (USD)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={costByDayArray}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <Tooltip formatter={(v: any) => `$${parseFloat(v).toFixed(4)}`} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '11px' }} />
                <Line type="monotone" dataKey="cost" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl border border-neutral-100 p-8 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-6">Répartition par type</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={distributionArray} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={2} label={(entry: any) => `${entry.name} (${entry.value})`}>
                    {distributionArray.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-100 p-8 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-6">{selectedClient === 'all' ? 'Top 10 clients par coût' : 'Coût (client sélectionné)'}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topClients} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis type="category" dataKey="brand" tick={{ fontSize: 10 }} width={130} stroke="#9ca3af" />
                  <Tooltip formatter={(v: any) => `$${parseFloat(v).toFixed(4)}`} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '11px' }} />
                  <Bar dataKey="cost" fill="#f97316" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-6">Détail par client {selectedClient === 'all' ? '(clique sur une ligne pour filtrer)' : ''}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest opacity-40">Client</th>
                    <th className="text-right py-3 px-2 text-[10px] font-black uppercase tracking-widest opacity-40">Carrousels</th>
                    <th className="text-right py-3 px-2 text-[10px] font-black uppercase tracking-widest opacity-40">Pubs</th>
                    <th className="text-right py-3 px-2 text-[10px] font-black uppercase tracking-widest opacity-40">Img IA</th>
                    <th className="text-right py-3 px-2 text-[10px] font-black uppercase tracking-widest opacity-40">Tokens</th>
                    <th className="text-right py-3 px-2 text-[10px] font-black uppercase tracking-widest opacity-40">USD</th>
                    <th className="text-right py-3 px-2 text-[10px] font-black uppercase tracking-widest opacity-40">≈ CHF</th>
                  </tr>
                </thead>
                <tbody>
                  {clientList.map((c: any) => (
                    <tr key={c.email} className="border-b border-neutral-50 hover:bg-orange-50 transition-all cursor-pointer" onClick={() => setSelectedClient(c.email)}>
                      <td className="py-3 px-3">
                        <div className="font-bold">{c.brand}</div>
                        <div className="text-[10px] text-neutral-400">{c.email}</div>
                      </td>
                      <td className="text-right font-bold px-2">{c.carousels}</td>
                      <td className="text-right font-bold px-2">{c.publicities}</td>
                      <td className="text-right font-bold px-2">{c.aiImages}</td>
                      <td className="text-right text-xs text-neutral-500 px-2">{(c.inputTokens + c.outputTokens).toLocaleString()}</td>
                      <td className="text-right font-black px-2">${c.totalCost.toFixed(4)}</td>
                      <td className="text-right text-xs text-neutral-500 px-2">{(c.totalCost * USD_TO_CHF).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-6">Derniers évènements ({Math.min(filteredEvents.length, 20)})</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredEvents.slice(0, 20).map((e) => (
                <div key={e.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-xl text-xs">
                  <span className="text-neutral-400 font-mono text-[10px] w-28 shrink-0">{new Date(e.created_at).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-orange-100 text-orange-600 rounded-md w-24 shrink-0 text-center">{TYPE_LABELS[e.event_type] || e.event_type}</span>
                  <span className="flex-1 truncate font-medium">{e.brand_name || e.client_email}</span>
                  <span className="text-[10px] text-neutral-400 w-20 truncate">{e.provider}</span>
                  <span className="font-black font-mono w-20 text-right">${(Number(e.cost_usd) || 0).toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}