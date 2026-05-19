"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import {
  X, Check, ArrowRight, Send,
  ShieldCheck, FileLock2, KeyRound,
  Lock, Image as ImageIcon, Lightbulb, Database, Users, Zap,
  Building2, Network, UserSquare,
  FileSearch, ChevronDown
} from "lucide-react";

// ============================================
// Drapeau suisse minuscule (taille du texte BrandLock)
// ============================================
const SwissFlag = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Suisse"
  >
    <rect width="32" height="32" fill="#DA291C" rx="2" />
    <rect x="13" y="7" width="6" height="18" fill="white" />
    <rect x="7" y="13" width="18" height="6" fill="white" />
  </svg>
);

// ============================================
// Wrapper d'animation au scroll (fade-in + translate)
// ============================================
function FadeInOnScroll({
  children,
  delay = 0,
  className = ""
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect du prefers-reduced-motion : pas d'animation si l'utilisateur l'a désactivée
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ============================================
// PAGE
// ============================================
export default function HomePage() {
  const router = useRouter();

  // === Login form ===
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileLoginOpen, setMobileLoginOpen] = useState(false);

  // === Demo form ===
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: "", company: "", email: "", phone: "", message: "" });
  const [submittingDemo, setSubmittingDemo] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState(false);
  const [demoError, setDemoError] = useState("");

  // === FAQ accordion ===
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const ADMIN_EMAIL = "admin@rowhan.com";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (authError) throw authError;
      const loggedInEmail = data.user?.email?.toLowerCase();
      if (loggedInEmail === ADMIN_EMAIL.toLowerCase()) router.push("/admin");
      else router.push("/generate");
    } catch {
      setError("Accès refusé. Vérifiez vos identifiants.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoError("");
    if (!demoForm.name.trim() || !demoForm.email.trim() || !demoForm.message.trim()) {
      setDemoError("Nom, email et message sont obligatoires.");
      return;
    }
    setSubmittingDemo(true);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoForm)
      });
      const data = await res.json();
      if (!res.ok) {
        setDemoError(data.error || "Erreur lors de l'envoi. Réessayez.");
        return;
      }
      setDemoSuccess(true);
      setDemoForm({ name: "", company: "", email: "", phone: "", message: "" });
    } catch {
      setDemoError("Erreur réseau. Réessayez dans un instant.");
    } finally {
      setSubmittingDemo(false);
    }
  };

  const closeDemoModal = () => {
    setDemoOpen(false);
    setTimeout(() => {
      setDemoSuccess(false);
      setDemoError("");
    }, 300);
  };

  // ============================================
  // CONTENU DES SECTIONS
  // ============================================

  const trustCenter = [
    {
      Icon: ShieldCheck,
      title: "Hébergement Souverain",
      text: "Hébergé exclusivement en Suisse. Aucune donnée ne transite par des serveurs cloud publics nord-américains."
    },
    {
      Icon: FileLock2,
      title: "Conformité nLPD",
      text: "Architecture strictement alignée sur les exigences de la nouvelle Loi sur la Protection des Données suisse."
    },
    {
      Icon: KeyRound,
      title: "Intégration IT Transparente (SSO)",
      text: "Compatible avec vos environnements institutionnels sécurisés (Single Sign-On / SAML, Active Directory)."
    }
  ];

  const piliers = [
    {
      Icon: Lock,
      number: "01",
      title: "Maîtrise Visuelle et Sémantique",
      text: "L'outil intègre vos directives officielles (codes couleurs, typographies, termes prohibés) comme un cadre de travail strict. Vos collaborateurs créent avec agilité, mais le résultat final reste systématiquement fidèle à votre charte graphique."
    },
    {
      Icon: ImageIcon,
      number: "02",
      title: "Valorisation de votre Patrimoine Photographique",
      text: "Afin d'éviter les visuels stéréotypés, l'outil puise uniquement dans vos propres banques d'images validées. Vos photographies existantes servent de référence pour illustrer vos communications, préservant ainsi toute l'authenticité de votre institution."
    },
    {
      Icon: Lightbulb,
      number: "03",
      title: "Assistance à la Réflexion et Idéation",
      text: "Face à la page blanche, l'outil analyse vos thématiques et vous suggère des angles de communication pertinents. Il agit comme un partenaire de réflexion qui apporte de nouvelles idées, tout en formulant ses propositions dans le strict respect du ton et de la mesure de votre administration. Vos équipes ne partent plus jamais de zéro."
    },
    {
      Icon: Database,
      number: "04",
      title: "Souveraineté des Données",
      text: "Vos informations restent strictement confidentielles et ne sont jamais exploitées pour entraîner des algorithmes externes. L'infrastructure garantit la protection de vos droits et répond aux normes suisses en matière de sécurité de l'information."
    },
    {
      Icon: Users,
      number: "05",
      title: "Collaboration Encadrée",
      text: "Mettez une solution de création sécurisée à la disposition de vos différents services ou partenaires locaux. Ils gagnent en autonomie, tandis que la direction de la communication conserve le contrôle exclusif des paramètres identitaires."
    },
    {
      Icon: Zap,
      number: "06",
      title: "Accélération de la Chaîne de Production",
      text: "De la conceptualisation à l'exportation du visuel, le logiciel fluidifie chaque étape. En garantissant une conformité technique et éditoriale dès le premier jet, il élimine les interminables boucles de validation. Vos collaborateurs gagnent un temps de production précieux et se recentrent sur la valeur ajoutée de leurs missions."
    }
  ];

  const casUsage = [
    {
      Icon: Building2,
      title: "Direction de la Communication",
      text: "Mettez à jour la charte graphique en un clic. La règle s'applique instantanément à tous les utilisateurs du réseau, garantissant une cohérence cantonale absolue."
    },
    {
      Icon: Network,
      title: "Entités Partenaires & Réseaux",
      text: "Offrez à vos influenceurs, sous-traitants et partenaires un accès pour générer des contenus promotionnels qui intègrent nativement et obligatoirement vos polices et logos officiels."
    },
    {
      Icon: UserSquare,
      title: "Ressources Humaines",
      text: "Rédigez des offres d'emploi ou des notes internes automatisées, avec la garantie technologique que le ton reste neutre, inclusif et conforme aux directives de l'État."
    }
  ];

  const deploiement = [
    {
      number: "01",
      title: "L'Audit Initial",
      text: "Nous numérisons vos directives graphiques et sémantiques (Brand Guidelines) pour les intégrer au cœur de notre algorithme."
    },
    {
      number: "02",
      title: "Le Verrouillage du DAM",
      text: "Nous connectons vos archives photographiques officielles pour en faire la matière première exclusive de l'IA."
    },
    {
      number: "03",
      title: "Le Déploiement Encadré",
      text: "Vos équipes accèdent à l'interface de création métier via leurs identifiants institutionnels habituels, prêtes à produire en toute sécurité."
    }
  ];

  const faq = [
    {
      q: "Nos documents internes servent-ils à entraîner l'IA ?",
      a: "Non. L'architecture est totalement cloisonnée. Vos données et requêtes ne nourrissent aucun modèle public."
    },
    {
      q: "Que se passe-t-il si notre charte évolue ?",
      a: "La mise à jour est centralisée. Une modification d'une typographie ou d'un terme interdit par l'administrateur s'applique immédiatement à tous les gabarits et pour tous les utilisateurs."
    },
    {
      q: "Qui détient les droits des images générées ?",
      a: "L'utilisation exclusive de vos archives photographiques internes (Bring Your Own Assets) couplée à notre système de génération fermé vous garantit une exploitation sans aucun risque de violation de droits d'auteur."
    }
  ];

  // ============================================
  // RENDU
  // ============================================
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 antialiased overflow-x-hidden">
      {/* =================== HEADER STICKY =================== */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/media/logo.png" alt="BrandLock" className="h-9 w-auto" />
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.3em] uppercase text-slate-900">
                BrandLock
              </span>
              <SwissFlag className="w-3 h-3 shrink-0" />
            </div>
          </div>

          <form onSubmit={handleLogin} className="hidden md:flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              className="px-4 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white transition w-48"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mot de passe"
              className="px-4 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white transition w-44"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? "..." : "Connexion"}
            </button>
          </form>

          <button
            onClick={() => setMobileLoginOpen(true)}
            className="md:hidden px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest"
          >
            Connexion
          </button>
        </div>

        {error && (
          <div className="hidden md:block bg-red-50 border-t border-red-100 px-6 py-2">
            <p className="text-xs text-red-600 font-medium text-center">{error}</p>
          </div>
        )}
      </header>

      {/* =================== MOBILE LOGIN =================== */}
      {mobileLoginOpen && (
        <div
          className="md:hidden fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-end animate-in fade-in duration-300"
          onClick={() => setMobileLoginOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-8 space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black tracking-tight">Connexion</h3>
              <button onClick={() => setMobileLoginOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                className="w-full px-4 py-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Mot de passe"
                className="w-full px-4 py-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition disabled:opacity-50"
              >
                {loading ? "Vérification..." : "Entrer"}
              </button>
              {error && <p className="text-xs text-red-600 font-medium text-center">{error}</p>}
            </form>
          </div>
        </div>
      )}

      {/* =================== HERO =================== */}
      <section className="relative min-h-[88vh] flex items-center justify-center overflow-hidden">
        <img src="/media/bg-header.jpg" alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/70 to-slate-950/90"></div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-12 py-32 text-center">
          <FadeInOnScroll>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-10">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/90">
                Édition Institutionnelle Suisse
              </span>
              <SwissFlag className="w-2.5 h-2.5 ml-1 shrink-0" />
            </div>
          </FadeInOnScroll>

          <FadeInOnScroll delay={100}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05] mb-8">
              Le verrou de conformité <br className="hidden md:block" />
              entre <span className="text-orange-500">l&apos;IA</span> et{" "}
              <span className="text-white/95">votre image</span> de marque.
            </h1>
          </FadeInOnScroll>

          <FadeInOnScroll delay={200}>
            <p className="max-w-3xl mx-auto text-base md:text-lg text-white/85 leading-relaxed mb-12 font-medium">
              Intégrez l&apos;intelligence artificielle dans vos processus internes avec une maîtrise absolue. BrandLock
              sécurise la production de vos contenus en forçant le respect de vos codes visuels et de votre lexique
              institutionnel. <span className="text-white">Une technologie fiable et souveraine</span>, pensée pour les
              exigences du secteur public.
            </p>
          </FadeInOnScroll>

          <FadeInOnScroll delay={300}>
            <button
              onClick={() => setDemoOpen(true)}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/30 hover:bg-orange-600 hover:shadow-orange-500/50 hover:-translate-y-0.5 transition-all active:scale-95"
            >
              Demander une présentation technique
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </FadeInOnScroll>
        </div>
      </section>

      {/* =================== SECTION 1 : TRUST CENTER =================== */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <FadeInOnScroll>
            <div className="text-center mb-16 lg:mb-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-orange-500 mb-4">
                Trust Center
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.1]">
                Garanties Juridiques<br className="hidden md:block" /> et Infrastructure IT
              </h2>
            </div>
          </FadeInOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {trustCenter.map((item, i) => {
              const Icon = item.Icon;
              return (
                <FadeInOnScroll key={i} delay={i * 120}>
                  <div className="h-full p-8 lg:p-10 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-6 group-hover:bg-orange-100 transition">
                      <Icon size={24} className="text-orange-500" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-lg font-black tracking-tight mb-3 leading-tight">{item.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{item.text}</p>
                  </div>
                </FadeInOnScroll>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================== SECTION 2 : 6 PILIERS =================== */}
      <section className="py-24 lg:py-32 bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(249,115,22,0.06),transparent_60%)]"></div>
        <div className="max-w-6xl mx-auto px-6 lg:px-12 relative">
          <FadeInOnScroll>
            <div className="text-center mb-16 lg:mb-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-orange-500 mb-4">
                Architecture de Confiance
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.1] mb-5">
                Six garanties technologiques
              </h2>
              <p className="text-base md:text-lg text-slate-600 font-medium max-w-2xl mx-auto">
                Pour répondre aux impératifs de sécurité du secteur public et parapublic.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {piliers.map((p, i) => {
              const Icon = p.Icon;
              return (
                <FadeInOnScroll key={i} delay={(i % 2) * 100}>
                  <div className="h-full p-8 lg:p-10 rounded-3xl bg-white border border-slate-200 hover:border-orange-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                        <Icon size={20} className="text-orange-500" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black tracking-[0.3em] text-slate-400 mb-2">{p.number}</p>
                        <h3 className="text-lg font-black tracking-tight mb-3 leading-tight">{p.title}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">{p.text}</p>
                      </div>
                    </div>
                  </div>
                </FadeInOnScroll>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================== SECTION 3 : CAS D'USAGE =================== */}
      <section className="py-24 lg:py-32 bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <FadeInOnScroll>
            <div className="text-center mb-16 lg:mb-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-orange-500 mb-4">
                Cas d&apos;Usage Sectoriels
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1] mb-5">
                Comment BrandLock sécurise<br className="hidden md:block" /> vos départements
              </h2>
              <p className="text-base md:text-lg text-white/70 font-medium max-w-2xl mx-auto">
                Une plateforme unique, des espaces de travail cloisonnés selon vos profils métiers.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {casUsage.map((c, i) => {
              const Icon = c.Icon;
              return (
                <FadeInOnScroll key={i} delay={i * 120}>
                  <div className="h-full p-8 lg:p-10 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-orange-500/40 hover:-translate-y-1 transition-all duration-500">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-6">
                      <Icon size={24} className="text-orange-500" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-lg font-black tracking-tight mb-3 leading-tight text-white">{c.title}</h3>
                    <p className="text-sm text-white/70 leading-relaxed font-medium">{c.text}</p>
                  </div>
                </FadeInOnScroll>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================== SECTION 4 : AUDIT & TRAÇABILITÉ =================== */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <FadeInOnScroll>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-10 md:p-16 lg:p-20 text-white shadow-2xl shadow-slate-900/20">
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-orange-500/5 rounded-full blur-3xl"></div>

              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mb-8">
                  <FileSearch size={28} className="text-orange-500" strokeWidth={1.8} />
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-orange-400 mb-4">
                  Registre d&apos;Audit & Traçabilité
                </p>

                <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1] mb-6">
                  Traçabilité Totale :<br /> Le Registre d&apos;Audit Intégré
                </h2>

                <p className="text-base md:text-lg text-white/80 leading-relaxed font-medium max-w-3xl">
                  Chaque génération, approbation et exportation est consignée dans un registre d&apos;audit inaltérable.
                  La direction conserve une visibilité totale sur l&apos;historique de création de chaque partenaire ou
                  département, garantissant la responsabilisation des acteurs et une protection absolue face au risque
                  de crise réputationnelle.
                </p>
              </div>
            </div>
          </FadeInOnScroll>
        </div>
      </section>

      {/* =================== SECTION 5 : DÉPLOIEMENT =================== */}
      <section className="py-24 lg:py-32 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <FadeInOnScroll>
            <div className="text-center mb-16 lg:mb-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-orange-500 mb-4">
                Processus de Déploiement
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.1] mb-5">
                Une intégration sans friction<br className="hidden md:block" /> pour vos équipes
              </h2>
              <p className="text-base md:text-lg text-slate-600 font-medium max-w-2xl mx-auto">
                Un déploiement sur-mesure et encadré en 3 étapes.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-4 relative">
            {/* Ligne de connexion entre les étapes */}
            <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent"></div>

            {deploiement.map((d, i) => (
              <FadeInOnScroll key={i} delay={i * 150}>
                <div className="text-center p-6 relative">
                  <div className="w-20 h-20 rounded-full bg-white border-2 border-orange-500 mx-auto mb-6 flex items-center justify-center font-black text-2xl text-orange-500 shadow-xl shadow-orange-500/10 relative z-10">
                    {d.number}
                  </div>
                  <h3 className="text-lg font-black tracking-tight mb-3 text-slate-900">{d.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">{d.text}</p>
                </div>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* =================== SECTION 6 : FAQ =================== */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-3xl mx-auto px-6 lg:px-12">
          <FadeInOnScroll>
            <div className="text-center mb-16 lg:mb-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-orange-500 mb-4">
                Foire Aux Questions
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.1]">
                Gouvernance<br className="hidden md:block" /> & Sécurité
              </h2>
            </div>
          </FadeInOnScroll>

          <div className="space-y-3">
            {faq.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <FadeInOnScroll key={i} delay={i * 80}>
                  <div
                    className={`bg-slate-50 rounded-2xl border transition-all duration-500 overflow-hidden ${
                      isOpen ? "border-orange-300 shadow-lg shadow-orange-500/5" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full p-6 lg:p-7 text-left flex items-center justify-between gap-4"
                    >
                      <span className="text-base lg:text-lg font-black tracking-tight text-slate-900">{item.q}</span>
                      <ChevronDown
                        size={20}
                        className={`text-slate-400 shrink-0 transition-transform duration-500 ${
                          isOpen ? "rotate-180 text-orange-500" : ""
                        }`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-500 ease-in-out ${
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-6 lg:px-7 pb-6 lg:pb-7 text-sm text-slate-600 leading-relaxed font-medium">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </div>
                </FadeInOnScroll>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================== FOOTER + CTA FINAL =================== */}
      <footer className="bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.12),transparent_50%)]"></div>

        <div className="relative max-w-5xl mx-auto px-6 lg:px-12 py-24 lg:py-32 text-center">
          <FadeInOnScroll>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1] mb-8 max-w-3xl mx-auto">
              La technologie au service<br /> des institutions suisses.
            </h2>
          </FadeInOnScroll>

          <FadeInOnScroll delay={100}>
            <p className="text-base md:text-lg text-white/70 font-medium mb-12 max-w-2xl mx-auto">
              Sécurité, rigueur et fiabilité. Conçu en Suisse, pour la Suisse.
            </p>
          </FadeInOnScroll>

          <FadeInOnScroll delay={200}>
            <button
              onClick={() => setDemoOpen(true)}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/30 hover:bg-orange-600 hover:shadow-orange-500/50 hover:-translate-y-0.5 transition-all active:scale-95"
            >
              Organiser une présentation technique
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </FadeInOnScroll>

          <FadeInOnScroll delay={300}>
            <div className="flex items-center justify-center gap-2 mt-20 pt-10 border-t border-white/10">
              <img src="/media/logo.png" alt="BrandLock" className="h-7 w-auto opacity-80" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/70">BrandLock</span>
                <SwissFlag className="w-2.5 h-2.5 shrink-0" />
              </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50 mt-4">
              © 2026 BrandLock · Édition Institutionnelle · Tous droits réservés
            </p>
          </FadeInOnScroll>
        </div>
      </footer>

      {/* =================== MODAL DEMO REQUEST =================== */}
      {demoOpen && (
        <div
          className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={closeDemoModal}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {demoSuccess ? (
              <div className="text-center py-10 space-y-5">
                <div className="w-20 h-20 rounded-3xl bg-green-100 mx-auto flex items-center justify-center">
                  <Check size={36} className="text-green-600" />
                </div>
                <h3 className="text-2xl font-black tracking-tight">Demande reçue</h3>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Nous revenons vers vous dans les 24 heures ouvrées pour planifier votre présentation technique.
                </p>
                <button
                  onClick={closeDemoModal}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Présentation technique</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Réponse sous 24h ouvrées</p>
                  </div>
                  <button
                    onClick={closeDemoModal}
                    className="p-2 hover:bg-slate-100 rounded-lg transition shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleDemoSubmit} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nom complet *"
                    value={demoForm.name}
                    onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
                  />
                  <input
                    type="text"
                    placeholder="Institution / Organisation"
                    value={demoForm.company}
                    onChange={(e) => setDemoForm({ ...demoForm, company: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
                  />
                  <input
                    type="email"
                    placeholder="Email professionnel *"
                    value={demoForm.email}
                    onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone (facultatif)"
                    value={demoForm.phone}
                    onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:border-slate-400 transition"
                  />
                  <textarea
                    placeholder="Décrivez votre besoin en quelques mots *"
                    value={demoForm.message}
                    onChange={(e) => setDemoForm({ ...demoForm, message: e.target.value })}
                    required
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:border-slate-400 transition resize-none"
                  />

                  {demoError && (
                    <p className="text-xs text-red-600 font-medium bg-red-50 px-4 py-2 rounded-lg">{demoError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingDemo}
                    className="w-full py-3.5 bg-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Send size={14} />
                    {submittingDemo ? "Envoi en cours..." : "Envoyer la demande"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
