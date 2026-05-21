"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Upload, FileJson, Loader2, Plus, Trash2,
  AlertCircle, CheckCircle2, Copy, Crown, Send, Eye, EyeOff, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  PAGE CRÉATION TENANT
//  Formulaire complet : infos tenant + JSON + utilisateurs
// ============================================================

const TIERS = [
  { value: "enterprise_b2g", label: "Enterprise B2G (Public)" },
  { value: "pro_b2b", label: "Pro B2B (Privé)" },
  { value: "starter", label: "Starter (Découverte)" },
];

type UserDraft = {
  id: string;
  email: string;
  password: string;
  role: "tenant_admin" | "graphist";
  display_name: string;
};

export default function CreateTenantPage() {
  const router = useRouter();

  // === Tenant infos ===
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tier, setTier] = useState("enterprise_b2g");
  const [notes, setNotes] = useState("");

  // === Config JSON ===
  const [configMode, setConfigMode] = useState<"upload" | "paste">("paste");
  const [configJsonText, setConfigJsonText] = useState("");
  const [configJsonValid, setConfigJsonValid] = useState<boolean | null>(null);
  const [configJsonError, setConfigJsonError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === Users ===
  const [users, setUsers] = useState<UserDraft[]>([
    {
      id: "default_admin",
      email: "",
      password: "",
      role: "tenant_admin",
      display_name: "",
    },
  ]);

  // === Submit state ===
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<any>(null);

  // ============================================================
  //  Validation JSON
  // ============================================================
  const validateJson = (text: string) => {
    if (!text.trim()) {
      setConfigJsonValid(null);
      setConfigJsonError(null);
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        setConfigJsonValid(false);
        setConfigJsonError("Le JSON doit être un objet (pas un tableau ou une valeur simple)");
        return null;
      }
      setConfigJsonValid(true);
      setConfigJsonError(null);
      return parsed;
    } catch (err: any) {
      setConfigJsonValid(false);
      setConfigJsonError("JSON invalide : " + err.message);
      return null;
    }
  };

  // ============================================================
  //  Upload fichier .json
  // ============================================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      setConfigJsonError("Le fichier doit être un .json");
      return;
    }
    try {
      const text = await file.text();
      setConfigJsonText(text);
      validateJson(text);
    } catch (err: any) {
      setConfigJsonError("Erreur de lecture du fichier : " + err.message);
    }
  };

  // ============================================================
  //  Users management
  // ============================================================
  const addUser = (role: "tenant_admin" | "graphist") => {
    setUsers((prev) => [
      ...prev,
      {
        id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        email: "",
        password: "",
        role,
        display_name: "",
      },
    ]);
  };

  const removeUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const updateUser = (id: string, field: keyof UserDraft, value: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)));
  };

  // ============================================================
  //  Submit
  // ============================================================
  const handleSubmit = async () => {
    setSubmitError(null);

    // Validations locales
    if (!tenantId.trim()) return setSubmitError("Identifiant tenant obligatoire");
    if (!/^[a-z0-9_-]+$/.test(tenantId)) {
      return setSubmitError("Identifiant doit être en minuscules, chiffres, _ ou - (ex: canton_vaud)");
    }
    if (!tenantName.trim()) return setSubmitError("Nom du tenant obligatoire");

    const configJson = validateJson(configJsonText);
    if (!configJson) return setSubmitError("Configuration JSON invalide");

    const hasAdmin = users.some((u) => u.role === "tenant_admin" && u.email.trim() && u.password.trim());
    if (!hasAdmin) return setSubmitError("Au moins 1 admin avec email + mot de passe");

    for (const u of users) {
      if (!u.email.trim() || !u.password.trim()) {
        return setSubmitError(`L'utilisateur ${u.email || "(sans email)"} doit avoir email + mot de passe`);
      }
      if (u.password.length < 6) {
        return setSubmitError(`Mot de passe trop court pour ${u.email} (min 6 caractères)`);
      }
    }

    // Envoi
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId.trim(),
          tenant_name: tenantName.trim(),
          tier,
          notes: notes.trim() || null,
          config_json: configJson,
          users: users.map((u) => ({
            email: u.email.trim(),
            password: u.password,
            role: u.role,
            display_name: u.display_name.trim() || null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur création");
      }

      setSubmitSuccess(data);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  //  Si succès : afficher le récap avec credentials
  // ============================================================
  if (submitSuccess) {
    return <SuccessScreen data={submitSuccess} usersSent={users} router={router} />;
  }

  // ============================================================
  //  Formulaire
  // ============================================================
  return (
    <div className="p-10 max-w-4xl mx-auto">
      {/* HEADER */}
      <div className="mb-8">
        <Link
          href="/super-admin/clients"
          className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-4 w-fit"
        >
          <ArrowLeft size={12} />
          Retour à la liste
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <Crown size={14} className="text-orange-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
            Super Administration
          </span>
        </div>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">
          Nouveau client
        </h1>
        <p className="text-sm text-neutral-500">
          Créer un tenant et ses utilisateurs en une seule étape
        </p>
      </div>

      {/* SECTION 1 : INFOS TENANT */}
      <Section
        number="1"
        title="Informations du client"
        description="Identifiant technique, nom et formule"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Identifiant technique *" hint="minuscules, chiffres, _ ou - (ex: canton_vaud)">
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              placeholder="canton_vaud"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono focus:border-orange-500 focus:outline-none"
              maxLength={50}
            />
          </Field>

          <Field label="Nom affiché *">
            <input
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="État de Vaud"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
              maxLength={100}
            />
          </Field>

          <Field label="Formule *">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
            >
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes internes (optionnel)">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contact, info commerciale..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
              maxLength={500}
            />
          </Field>
        </div>
      </Section>

      {/* SECTION 2 : CONFIG JSON */}
      <Section
        number="2"
        title="Configuration JSON"
        description="Charte graphique, polices, templates, taxonomy..."
      >
        {/* Tabs upload / paste */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setConfigMode("paste")}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              configMode === "paste"
                ? "bg-orange-500 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            <FileJson size={13} />
            Coller le JSON
          </button>
          <button
            type="button"
            onClick={() => setConfigMode("upload")}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              configMode === "upload"
                ? "bg-orange-500 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            <Upload size={13} />
            Uploader un fichier .json
          </button>
        </div>

        {configMode === "upload" && (
          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-4 border-2 border-dashed border-neutral-300 rounded-lg text-sm text-neutral-600 hover:border-orange-300 hover:bg-orange-50/30 transition flex items-center justify-center gap-2"
            >
              <Upload size={14} />
              {configJsonText ? "Remplacer le fichier" : "Choisir un fichier .json"}
            </button>
          </div>
        )}

        <textarea
          value={configJsonText}
          onChange={(e) => {
            setConfigJsonText(e.target.value);
            validateJson(e.target.value);
          }}
          placeholder='{"tenant":{"id":"canton_vaud",...},"brandIdentity":{...},...}'
          rows={12}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:border-orange-500 focus:outline-none resize-y"
        />

        {/* Status */}
        {configJsonText && (
          <div className="mt-2">
            {configJsonValid === true && (
              <div className="text-[11px] text-green-700 bg-green-50 px-3 py-2 rounded flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                JSON valide ({configJsonText.length} caractères)
              </div>
            )}
            {configJsonValid === false && (
              <div className="text-[11px] text-red-700 bg-red-50 px-3 py-2 rounded flex items-center gap-1.5">
                <AlertCircle size={12} />
                {configJsonError}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* SECTION 3 : UTILISATEURS */}
      <Section
        number="3"
        title="Utilisateurs"
        description="Au moins 1 admin obligatoire. Tu peux ajouter plusieurs admins ou membres studio."
      >
        <div className="space-y-3">
          {users.map((u, idx) => (
            <UserRow
              key={u.id}
              user={u}
              index={idx}
              canDelete={users.length > 1 && u.id !== "default_admin"}
              onUpdate={(field, value) => updateUser(u.id, field, value)}
              onDelete={() => removeUser(u.id)}
            />
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => addUser("tenant_admin")}
            className="flex-1 px-3 py-2 border border-dashed border-neutral-300 rounded-lg text-xs font-bold text-neutral-600 hover:border-orange-300 hover:bg-orange-50/30 transition flex items-center justify-center gap-1.5"
          >
            <Plus size={13} />
            Ajouter un admin
          </button>
          <button
            type="button"
            onClick={() => addUser("graphist")}
            className="flex-1 px-3 py-2 border border-dashed border-neutral-300 rounded-lg text-xs font-bold text-neutral-600 hover:border-orange-300 hover:bg-orange-50/30 transition flex items-center justify-center gap-1.5"
          >
            <Plus size={13} />
            Ajouter un membre studio
          </button>
        </div>
      </Section>

      {/* ERREUR */}
      {submitError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{submitError}</div>
        </div>
      )}

      {/* SUBMIT */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
        <Link
          href="/super-admin/clients"
          className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
        >
          Annuler
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm"
        >
          {submitting ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Création en cours...
            </>
          ) : (
            <>
              <Send size={13} />
              Créer le client
            </>
          )}
        </button>
      </div>
    </div>
  );
}


// ============================================================
//  SECTION (wrapper de chaque bloc du formulaire)
// ============================================================
function Section({
  number, title, description, children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 bg-white rounded-2xl border border-neutral-200 p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 text-sm font-black">
          {number}
        </div>
        <div>
          <h2 className="text-base font-bold text-neutral-900">{title}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}


// ============================================================
//  FIELD (label + input)
// ============================================================
function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}


// ============================================================
//  USER ROW
// ============================================================
function UserRow({
  user, index, canDelete, onUpdate, onDelete,
}: {
  user: UserDraft;
  index: number;
  canDelete: boolean;
  onUpdate: (field: keyof UserDraft, value: string) => void;
  onDelete: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const roleColors = user.role === "tenant_admin"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-purple-50 text-purple-700 border-purple-200";

  return (
    <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${roleColors}`}>
            {user.role === "tenant_admin" ? "Admin client" : "Studio"}
          </span>
          <span className="text-[10px] text-neutral-400">Utilisateur #{index + 1}</span>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-red-400 hover:bg-red-50 rounded transition"
            title="Supprimer"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
            Email *
          </label>
          <input
            type="email"
            value={user.email}
            onChange={(e) => onUpdate("email", e.target.value)}
            placeholder="prenom.nom@org.ch"
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
            Mot de passe initial *
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={user.password}
              onChange={(e) => onUpdate("password", e.target.value)}
              placeholder="Min 6 caractères"
              className="w-full px-3 py-2 pr-9 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
            Nom affiché (optionnel)
          </label>
          <input
            type="text"
            value={user.display_name}
            onChange={(e) => onUpdate("display_name", e.target.value)}
            placeholder="Jean Dupont"
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}


// ============================================================
//  SUCCESS SCREEN — affiche les credentials
// ============================================================
function SuccessScreen({
  data, usersSent, router,
}: {
  data: any;
  usersSent: UserDraft[];
  router: any;
}) {
  return (
    <div className="p-10 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border-2 border-green-300 p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">
              Client créé !
            </h2>
            <p className="text-sm text-neutral-500">
              Tenant <span className="font-mono font-bold">{data.tenant.tenant_id}</span> — {data.tenant.tenant_name}
            </p>
          </div>
        </div>

        {data.warnings && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-xs font-bold text-amber-700 mb-1">⚠ Avertissements :</div>
            <div className="text-[11px] text-amber-700 space-y-0.5">
              {data.warnings.map((w: string, i: number) => (
                <div key={i}>· {w}</div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-3">
            Identifiants de connexion ({data.users_created.length})
          </h3>
          <div className="space-y-2">
            {data.users_created.map((u: any) => {
              const sent = usersSent.find((s) => s.email.toLowerCase().trim() === u.email);
              return (
                <CredentialCard
                  key={u.user_id}
                  email={u.email}
                  password={sent?.password || ""}
                  role={u.role}
                />
              );
            })}
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-5">
          <div className="text-[11px] text-orange-800">
            ⚠ <strong>Copie ces identifiants maintenant.</strong> Les mots de passe ne seront plus affichés.
            Transmets-les au client via un canal sécurisé.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/super-admin/clients")}
            className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
          >
            Retour à la liste
          </button>
          <button
            type="button"
            onClick={() => router.push(`/super-admin/clients/${data.tenant.tenant_id}`)}
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition shadow-sm"
          >
            Voir le client
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
//  CREDENTIAL CARD (avec bouton copier)
// ============================================================
function CredentialCard({ email, password, role }: { email: string; password: string; role: string }) {
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    const text = `Email: ${email}\nMot de passe: ${password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
            role === "tenant_admin"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-purple-50 text-purple-700 border-purple-200"
          }`}>
            {role === "tenant_admin" ? "Admin" : "Studio"}
          </span>
        </div>
        <div className="text-sm font-mono text-neutral-900 truncate">{email}</div>
        <div className="text-xs font-mono text-neutral-500 truncate">🔑 {password}</div>
      </div>
      <button
        type="button"
        onClick={copyAll}
        className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 shrink-0 ${
          copied
            ? "bg-green-500 text-white"
            : "bg-white border border-neutral-300 hover:bg-orange-50 hover:border-orange-300 text-neutral-700"
        }`}
      >
        {copied ? (
          <>
            <CheckCircle2 size={11} />
            Copié !
          </>
        ) : (
          <>
            <Copy size={11} />
            Copier
          </>
        )}
      </button>
    </div>
  );
}
