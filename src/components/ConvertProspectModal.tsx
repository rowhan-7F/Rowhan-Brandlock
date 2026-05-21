"use client";

import { useState, useEffect } from "react";
import {
  UserPlus, X, Loader2, CheckCircle2, AlertCircle, Sparkles,
  Copy, RefreshCw, Eye, EyeOff, Building2, Crown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { generateStrongPassword, generateTenantSlug } from "@/lib/passwordGenerator";

// ============================================================
//  MODAL : Convertir prospect en client
//  Pré-remplie avec les infos du prospect
//  Génère un mot de passe solide automatiquement
// ============================================================

const BRAND = {
  bordeaux: "#B11E2F",
  bordeauxDark: "#7A1320",
  ink: "#181614",
  cream: "#F5F1EA",
  warmGray: "#807972",
  gold: "#D4AF7A",
};

type Prospect = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  message: string;
};

type ConversionResult = {
  tenant: { id: string; name: string };
  admin: { email: string; password: string; displayName: string };
};

export default function ConvertProspectModal({
  prospect, onClose, onSuccess,
}: {
  prospect: Prospect;
  onClose: () => void;
  onSuccess?: (result: ConversionResult) => void;
}) {
  // Form state — pré-rempli depuis le prospect
  const [tenantName, setTenantName] = useState(prospect.company || prospect.name);
  const [tenantId, setTenantId] = useState(generateTenantSlug(prospect.company || prospect.name));
  const [tier, setTier] = useState<"enterprise_b2g" | "pro_b2b" | "starter">("enterprise_b2g");
  const [adminEmail, setAdminEmail] = useState(prospect.email);
  const [adminDisplayName, setAdminDisplayName] = useState(prospect.name);
  const [adminPassword, setAdminPassword] = useState(generateStrongPassword());
  const [showPassword, setShowPassword] = useState(true);
  const [brandColor, setBrandColor] = useState("#B11E2F");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Block body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Auto-update tenantId quand tenantName change (seulement si vide initialement)
  useEffect(() => {
    setTenantId(generateTenantSlug(tenantName));
  }, [tenantName]);

  const regeneratePassword = () => {
    setAdminPassword(generateStrongPassword());
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Session expirée");
        setSubmitting(false);
        return;
      }

      const res = await fetch(`/api/super-admin/prospects/${prospect.id}/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tenantId,
          tenantName,
          tier,
          adminEmail: adminEmail.trim(),
          adminPassword,
          adminDisplayName: adminDisplayName.trim(),
          brandColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la conversion");
        setSubmitting(false);
        return;
      }

      setSuccess({
        tenant: data.tenant,
        admin: data.admin,
      });
      setSubmitting(false);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  // ============================================================
  //  ÉCRAN DE SUCCESS — Affiche les credentials à copier
  // ============================================================
  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 backdrop-blur-md overflow-y-auto animate-fadeIn"
        style={{ backgroundColor: `${BRAND.ink}E0` }}
      >
        <div className="min-h-full flex items-start justify-center p-4 py-8">
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden animate-scaleIn my-auto"
            style={{
              backgroundColor: BRAND.cream,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            <div className="p-8 text-center">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
                style={{ backgroundColor: BRAND.bordeaux, color: "white" }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-black tracking-tight mb-2" style={{ color: BRAND.ink }}>
                Client créé avec succès
              </h2>
              <p className="text-sm mb-6" style={{ color: BRAND.warmGray }}>
                <strong>{success.tenant.name}</strong> a été ajouté comme client.
                Transmets ces identifiants en sécurité.
              </p>

              <div
                className="text-left p-5 rounded-xl space-y-3 mb-5"
                style={{ backgroundColor: "white", border: `1px solid ${BRAND.gold}40` }}
              >
                <CredentialRow
                  label="URL de connexion"
                  value={typeof window !== "undefined" ? window.location.origin : ""}
                  onCopy={() => copyToClipboard(window.location.origin, "url")}
                  copied={copied === "url"}
                />
                <CredentialRow
                  label="Email"
                  value={success.admin.email}
                  onCopy={() => copyToClipboard(success.admin.email, "email")}
                  copied={copied === "email"}
                />
                <CredentialRow
                  label="Mot de passe"
                  value={success.admin.password}
                  onCopy={() => copyToClipboard(success.admin.password, "password")}
                  copied={copied === "password"}
                  mono
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(
                    `URL: ${window.location.origin}\nEmail: ${success.admin.email}\nMot de passe: ${success.admin.password}`,
                    "all"
                  )}
                  className="w-full mt-3 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: copied === "all" ? "#10b981" : BRAND.ink,
                    color: "white",
                  }}
                >
                  {copied === "all" ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {copied === "all" ? "Tout copié !" : "Tout copier d'un coup"}
                </button>
              </div>

              <div
                className="text-[10px] leading-relaxed text-left px-3 py-2 rounded-lg mb-4"
                style={{
                  backgroundColor: `${BRAND.gold}10`,
                  border: `1px solid ${BRAND.gold}30`,
                  color: BRAND.ink,
                }}
              >
                ⚠️ <strong>Ces informations ne pourront PAS être récupérées</strong> ensuite.
                Transmets-les au client via un canal sécurisé (1Password, message éphémère).
              </div>

              <button
                type="button"
                onClick={() => {
                  onSuccess?.(success);
                  onClose();
                }}
                className="w-full px-4 py-3 font-bold text-xs uppercase tracking-[0.2em] rounded-lg transition hover:-translate-y-0.5"
                style={{
                  backgroundColor: BRAND.bordeaux,
                  color: "white",
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  //  FORMULAIRE DE CONVERSION
  // ============================================================
  return (
    <div
      className="fixed inset-0 z-50 backdrop-blur-md overflow-y-auto animate-fadeIn"
      style={{ backgroundColor: `${BRAND.ink}E0` }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="min-h-full flex items-start justify-center p-4 py-8">
        <div
          className="w-full max-w-2xl rounded-2xl overflow-hidden animate-scaleIn my-auto"
          style={{
            backgroundColor: BRAND.cream,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-6 py-5 border-b flex items-center justify-between sticky top-0 z-10"
            style={{ backgroundColor: BRAND.cream, borderColor: `${BRAND.ink}10` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: BRAND.bordeaux, color: "white" }}
              >
                <UserPlus size={16} />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight" style={{ color: BRAND.ink }}>
                  Convertir en client
                </h2>
                <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: BRAND.warmGray }}>
                  Création d'un tenant + administrateur
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition hover:opacity-70"
              style={{ color: BRAND.warmGray }}
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Section 1 : Tenant */}
            <Section icon={<Building2 size={13} />} label="Informations société">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nom affiché *">
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    required
                    placeholder="Canton de Genève"
                    className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition"
                    style={{ backgroundColor: "white", border: `1px solid ${BRAND.ink}15` }}
                  />
                </Field>
                <Field
                  label="Identifiant technique *"
                  hint="Lettres minuscules, chiffres et _"
                >
                  <input
                    type="text"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    required
                    placeholder="canton_geneve"
                    pattern="[a-z0-9_]{3,40}"
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono focus:outline-none transition"
                    style={{ backgroundColor: "white", border: `1px solid ${BRAND.ink}15` }}
                  />
                </Field>
              </div>

              <Field label="Type d'abonnement *">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "enterprise_b2g", label: "Enterprise B2G", desc: "Secteur public" },
                    { value: "pro_b2b", label: "Pro B2B", desc: "Entreprises" },
                    { value: "starter", label: "Starter", desc: "TPE / Solo" },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTier(t.value as any)}
                      className="p-3 rounded-lg text-left transition"
                      style={{
                        backgroundColor: tier === t.value ? BRAND.ink : "white",
                        color: tier === t.value ? BRAND.cream : BRAND.ink,
                        border: tier === t.value ? `1px solid ${BRAND.ink}` : `1px solid ${BRAND.ink}15`,
                      }}
                    >
                      <div className="text-[11px] font-black uppercase tracking-wider">{t.label}</div>
                      <div className="text-[9px] opacity-70 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Couleur de marque">
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-10 w-16 rounded-lg cursor-pointer"
                    style={{ border: `1px solid ${BRAND.ink}15` }}
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    className="flex-1 px-4 py-3 rounded-lg text-sm font-mono focus:outline-none transition"
                    style={{ backgroundColor: "white", border: `1px solid ${BRAND.ink}15` }}
                  />
                </div>
              </Field>
            </Section>

            {/* Section 2 : Admin */}
            <Section icon={<Crown size={13} />} label="Administrateur du compte">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nom d'affichage *">
                  <input
                    type="text"
                    value={adminDisplayName}
                    onChange={(e) => setAdminDisplayName(e.target.value)}
                    required
                    placeholder="Marie Dupont"
                    className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition"
                    style={{ backgroundColor: "white", border: `1px solid ${BRAND.ink}15` }}
                  />
                </Field>
                <Field label="Email professionnel *">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    placeholder="marie@institution.ch"
                    className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition"
                    style={{ backgroundColor: "white", border: `1px solid ${BRAND.ink}15` }}
                  />
                </Field>
              </div>

              <Field
                label="Mot de passe initial *"
                hint="Généré automatiquement, solide et lisible"
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full pl-4 pr-10 py-3 rounded-lg text-sm font-mono focus:outline-none transition"
                      style={{ backgroundColor: "white", border: `1px solid ${BRAND.gold}40` }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded"
                      style={{ color: BRAND.warmGray }}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={regeneratePassword}
                    className="px-3 py-2 rounded-lg flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition"
                    style={{
                      backgroundColor: `${BRAND.gold}20`,
                      color: BRAND.bordeauxDark,
                      border: `1px solid ${BRAND.gold}40`,
                    }}
                    title="Regénérer un mot de passe"
                  >
                    <RefreshCw size={12} />
                    Nouveau
                  </button>
                </div>
              </Field>
            </Section>

            {/* Erreurs */}
            {error && (
              <div
                className="px-3 py-2.5 rounded-lg text-xs flex items-start gap-2"
                style={{
                  backgroundColor: `${BRAND.bordeaux}10`,
                  border: `1px solid ${BRAND.bordeaux}30`,
                  color: BRAND.bordeauxDark,
                }}
              >
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Note de sécurité */}
            <div
              className="text-[10px] flex items-start gap-2 px-3 py-2.5 rounded-lg"
              style={{
                backgroundColor: `${BRAND.gold}10`,
                border: `1px solid ${BRAND.gold}30`,
                color: BRAND.ink,
              }}
            >
              <Sparkles size={12} className="shrink-0 mt-0.5" style={{ color: BRAND.gold }} />
              <span>
                À la création, tu recevras les identifiants à transmettre au client.
                Le tenant sera marqué <strong>« en cours d'enregistrement »</strong> jusqu'à
                la première connexion du client.
              </span>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-3.5 font-bold text-xs uppercase tracking-[0.2em] rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:-translate-y-0.5"
              style={{
                backgroundColor: BRAND.bordeaux,
                color: "white",
                boxShadow: `0 10px 25px -10px ${BRAND.bordeaux}80`,
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  Créer le client
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Sous-composants
// ============================================================

function Section({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] pb-2 border-b"
        style={{ color: BRAND.bordeaux, borderColor: `${BRAND.ink}10` }}
      >
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
        style={{ color: BRAND.warmGray }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div className="text-[10px] italic mt-1" style={{ color: BRAND.warmGray }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  label, value, onCopy, copied, mono,
}: { label: string; value: string; onCopy: () => void; copied: boolean; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.warmGray }}>
        {label}
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`flex-1 px-3 py-2 rounded-lg text-xs ${mono ? "font-mono" : ""}`}
          style={{ backgroundColor: BRAND.cream, color: BRAND.ink, border: `1px solid ${BRAND.ink}10` }}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="px-3 py-2 rounded-lg text-xs font-bold transition"
          style={{
            backgroundColor: copied ? "#10b981" : BRAND.ink,
            color: "white",
          }}
        >
          {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}
