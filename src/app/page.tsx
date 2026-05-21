"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Lock, Server, KeyRound, ScrollText, Scale,
  Sparkles, Layers, Captions, Network, Zap, Megaphone,
  Users, Briefcase, Eye, FileCheck2, ArrowRight, X, Loader2,
  Plus, MapPin, MailCheck, ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  BRANDLOCK — LANDING INSTITUTIONNELLE LUXURY V2
//  Palette : Bordeaux + Bleu nuit + Or champagne + Crème
//  Style : Magazine print de luxe × Banque suisse premium
// ============================================================

const COLORS = {
  bordeaux: "#B11E2F",
  bordeauxDark: "#7A1320",
  nightBlue: "#1A2332",
  nightBlueLight: "#2A3445",
  gold: "#D4AF7A",
  goldDark: "#B8945F",
  cream: "#F5F1EA",
  creamDark: "#EBE5D8",
  ink: "#181614",
  charcoal: "#3D3935",
  warmGray: "#807972",
};

export default function LandingPage() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const [prospectOpen, setProspectOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Auto-redirect si déjà loggé
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("scope, role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!profile) return;
      if (profile.scope === "platform" && profile.role === "super_admin") {
        router.push("/super-admin");
      } else if (profile.role === "tenant_admin") {
        router.push("/admin/tenant");
      } else if (profile.role === "graphist") {
        router.push("/studio");
      }
    })();
  }, [router]);

  return (
    <div style={{ backgroundColor: COLORS.cream, color: COLORS.ink }} className="min-h-screen">
      {/* ═══════════════════════════════════════════════════════ */}
      {/*  NAV STICKY                                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <nav
        className="sticky top-0 z-30 backdrop-blur-md border-b"
        style={{
          backgroundColor: `${COLORS.cream}E0`,
          borderColor: `${COLORS.ink}10`,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo + Drapeau en astérix */}
          <div className="flex items-center gap-3">
            <img
              src="/media/logo.png"
              alt="BrandLock"
              className="h-10 w-auto object-contain"
            />
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-black tracking-tighter text-lg italic"
                style={{ color: COLORS.ink, letterSpacing: "-0.04em" }}
              >
                BrandLock
              </span>
              {/* Drapeau Suisse — astérix tout petit aligné typo */}
              <svg
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3 shrink-0"
                aria-label="Suisse"
                style={{ alignSelf: "center" }}
              >
                <rect width="32" height="32" fill={COLORS.bordeaux} rx="3" />
                <rect x="13" y="7" width="6" height="18" fill="white" />
                <rect x="7" y="13" width="18" height="6" fill="white" />
              </svg>
            </div>
          </div>

          {/* Bouton Connexion */}
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-full transition-all hover:shadow-md flex items-center gap-2"
            style={{
              backgroundColor: COLORS.ink,
              color: COLORS.cream,
            }}
          >
            <Lock size={11} />
            Connexion
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  HERO — Image de fond + overlay luxe                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Image de fond */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('/media/bg-header.jpg')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Overlay sombre élégant pour lisibilité */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${COLORS.nightBlue}E8 0%, ${COLORS.nightBlue}D0 60%, ${COLORS.bordeaux}90 100%)`,
          }}
        />
        {/* Texture/grain subtil */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 py-24 lg:py-36 text-center">
          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.25em] mb-10"
            style={{
              backgroundColor: "rgba(212, 175, 122, 0.15)",
              border: `1px solid ${COLORS.gold}40`,
              color: COLORS.gold,
            }}
          >
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: COLORS.gold }}></span>
            Édition Institutionnelle Suisse
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: COLORS.gold }}></span>
          </div>

          {/* Titre énorme magazine */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.95] mb-8 text-white"
            style={{ fontFeatureSettings: "'ss01'" }}
          >
            Le verrou de{" "}
            <span style={{ color: COLORS.gold, fontStyle: "italic", fontWeight: 500 }}>
              conformité
            </span>
            <br />
            pour vos contenus<br />numériques.
          </h1>

          <p
            className="text-base lg:text-lg leading-[1.7] max-w-2xl mx-auto mb-12"
            style={{ color: "#EFE9DD" }}
          >
            Automatisez le « dernier kilomètre » de votre communication :
            habillage, sous-titrage et déclinaison multi-formats. BrandLock
            sécurise la production de vos vidéos et images en forçant le respect
            strict de vos <em style={{ color: COLORS.gold, fontStyle: "italic" }}>Safe Zones</em> et de votre charte graphique.
          </p>

          {/* CTA principal */}
          <button
            type="button"
            onClick={() => setProspectOpen(true)}
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5"
            style={{
              backgroundColor: COLORS.cream,
              color: COLORS.ink,
              boxShadow: "0 20px 50px -20px rgba(0,0,0,0.5)",
            }}
          >
            Demander une présentation technique
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="mt-6 text-[10px] uppercase tracking-[0.25em]" style={{ color: "#EFE9DD90" }}>
            Sans engagement · Réponse sous 48h ouvrées
          </div>
        </div>

        {/* Ornement bas de hero */}
        <div className="relative">
          <svg
            viewBox="0 0 1440 60"
            className="block w-full"
            preserveAspectRatio="none"
            style={{ height: 60 }}
          >
            <path
              d="M0,30 L1440,30"
              stroke={COLORS.gold}
              strokeWidth="0.5"
              fill="none"
            />
            <circle cx="720" cy="30" r="3" fill={COLORS.gold} />
          </svg>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  TRUST CENTER — 3 colonnes magazine                      */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="px-6 py-24" style={{ backgroundColor: COLORS.cream }}>
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow="Trust Center"
            title="Garanties juridiques & infrastructure IT"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <TrustCard
              icon={<Server size={20} />}
              title="Hébergement souverain 100% genevois"
              description="Infrastructures cloud gérées exclusivement par Infomaniak à Genève. Aucune donnée ne transite par des serveurs tiers ou nord-américains."
            />
            <TrustCard
              icon={<Scale size={20} />}
              title="Conformité stricte nLPD"
              description="Architecture technique et traitement des flux alignés de manière intransigeante sur les exigences de la nouvelle Loi sur la Protection des Données suisse."
            />
            <TrustCard
              icon={<KeyRound size={20} />}
              title="Intégration IT transparente (SSO)"
              description="Connexion fluide à vos environnements institutionnels existants (Single Sign-On / SAML, Active Directory) pour une gestion centralisée des accès."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  6 GARANTIES — Fond bleu nuit pour break                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section
        className="px-6 py-24"
        style={{
          backgroundColor: COLORS.nightBlue,
          color: COLORS.cream,
        }}
      >
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow="Architecture de confiance"
            title="Six garanties technologiques"
            subtitle="Pour répondre aux impératifs de sécurité et d'efficacité du secteur public."
            invert
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px mt-16" style={{ backgroundColor: `${COLORS.gold}25` }}>
            <GuaranteeCard num="01" icon={<Lock size={18} />} title="Le « Hard Lock » architectural" description="Votre charte graphique n'est plus une simple suggestion, c'est une règle mathématique (JSON). L'outil verrouille les polices, les couleurs institutionnelles et les marges de sécurité (Safe Zones). Vos équipes intègrent leurs médias, le logiciel garantit un rendu parfait pour chaque réseau." />
            <GuaranteeCard num="02" icon={<Layers size={18} />} title="Adaptation multi-formats sans faille" description="Uploadez une vidéo horizontale, BrandLock la décline instantanément pour vos Stories, Reels ou Carrousels. Les zones mortes des réseaux sociaux (boutons « J'aime », descriptions) sont calculées automatiquement pour que votre message et vos intervenants ne soient jamais masqués." />
            <GuaranteeCard num="03" icon={<Captions size={18} />} title="Sous-titrage charté & automatisé" description="Fini la transcription manuelle. L'intelligence artificielle (technologie Whisper) extrait la voix de vos vidéos et incruste les sous-titres directement dans la typographie et les couleurs exactes de votre institution. Une accessibilité parfaite en un clic." />
            <GuaranteeCard num="04" icon={<ShieldCheck size={18} />} title="Souveraineté & étanchéité absolue" description="Hébergées chez Infomaniak, vos vidéos brutes, vos discours et vos données métier restent strictement confidentiels. L'IA agit comme un moteur de traitement local et n'utilise jamais vos médias pour entraîner des modèles publics." />
            <GuaranteeCard num="05" icon={<Network size={18} />} title="Décentralisation sécurisée" description="Déléguez la création de contenu à vos différents départements, partenaires ou agences externes sans aucune crainte. Ils gagnent en autonomie de production, tandis que la Direction de la Communication conserve le contrôle absolu du moteur de rendu." />
            <GuaranteeCard num="06" icon={<Zap size={18} />} title="Le « dernier kilomètre » accéléré" description="De l'upload de la vidéo brute à l'export du fichier .zip normé, le logiciel élimine les tâches chronophages (ajout de logos, création de bumpers d'intro/outro, recadrage). Vos collaborateurs gagnent des heures chaque semaine et les boucles de validation sont drastiquement réduites." />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  CAS D'USAGE — Crème                                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="px-6 py-24" style={{ backgroundColor: COLORS.cream }}>
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow="Cas d'usage sectoriels"
            title="Comment BrandLock sécurise vos départements"
            subtitle="Une plateforme unique, des gabarits cloisonnés selon vos profils métiers."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <UseCaseCard
              icon={<Megaphone size={22} />}
              title="Direction de la Communication"
              description="Pilotez l'identité cantonale ou institutionnelle depuis une tour de contrôle centrale. Mettez à jour un élément de la charte, la modification s'applique instantanément à tous les futurs exports de vos collaborateurs."
            />
            <UseCaseCard
              icon={<Sparkles size={22} />}
              title="Community Management & Création"
              description="Produisez des vignettes d'actualité, des infographies économiques ou des interviews vidéo à la volée. Concentrez-vous sur le message, le logiciel s'occupe de l'habillage aux normes."
            />
            <UseCaseCard
              icon={<Users size={22} />}
              title="Ressources Humaines"
              description="Déclinez vos campagnes de recrutement et vidéos « Marque Employeur » avec une garantie d'uniformité absolue, renforçant la crédibilité de l'institution auprès des candidats."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  AUDIT IA — Section éditoriale Or                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section
        className="px-6 py-24 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${COLORS.ink} 0%, ${COLORS.nightBlue} 100%)`,
          color: COLORS.cream,
        }}
      >
        {/* Ornements décoratifs */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16"
          style={{ backgroundColor: `${COLORS.gold}80` }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-16"
          style={{ backgroundColor: `${COLORS.gold}80` }}
        />

        <div className="max-w-3xl mx-auto text-center relative">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 text-[10px] font-bold uppercase tracking-[0.25em]"
            style={{ color: COLORS.gold }}
          >
            <span className="w-6 h-px" style={{ backgroundColor: COLORS.gold }}></span>
            Audit qualité IA & traçabilité
            <span className="w-6 h-px" style={{ backgroundColor: COLORS.gold }}></span>
          </div>

          <h2
            className="text-4xl lg:text-5xl font-black tracking-[-0.03em] leading-[1.05] mb-6"
          >
            Le <em style={{ color: COLORS.gold, fontWeight: 500, fontStyle: "italic" }}>check-up</em> avant publication.
          </h2>

          <p className="text-base leading-[1.75] mb-10" style={{ color: "#EFE9DD" }}>
            Juste avant l'exportation, notre <strong style={{ color: COLORS.gold }}>« Police IA »</strong> scanne votre rendu final.
            Elle vérifie le ratio de contraste pour garantir l'accessibilité aux
            malvoyants (Normes WCAG), alerte sur les dépassements de Safe Zones
            et valide la structure. Le tableau de bord conserve l'historique des
            exports pour une traçabilité totale.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Pill icon={<Eye size={11} />} label="WCAG Accessibility" />
            <Pill icon={<FileCheck2 size={11} />} label="Safe Zones validées" />
            <Pill icon={<ScrollText size={11} />} label="Historique complet" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  PROCESSUS 3 ÉTAPES                                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="px-6 py-24" style={{ backgroundColor: COLORS.cream }}>
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow="Processus de déploiement"
            title="Une intégration sans friction"
            subtitle="Un déploiement sur-mesure en trois étapes."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <StepCard num="01" title="L'encodage de la charte" description="Nous traduisons vos directives graphiques PDF en un fichier de configuration strict (Configuration as Code) qui devient le moteur de vos gabarits." />
            <StepCard num="02" title="L'intégration des assets" description="Nous connectons vos logos, animations de bumpers d'intro/outro et typographies officielles directement dans l'environnement sécurisé." />
            <StepCard num="03" title="Le déploiement opérationnel" description="Vos équipes se connectent via leurs identifiants professionnels et commencent immédiatement à décliner leurs médias avec une conformité garantie." />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  FAQ                                                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section
        className="px-6 py-24"
        style={{ backgroundColor: COLORS.creamDark }}
      >
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            eyebrow="Foire aux questions"
            title="Gouvernance & sécurité"
          />

          <div className="space-y-3 mt-12">
            <FaqItem
              isOpen={openFaq === 0}
              onToggle={() => setOpenFaq(openFaq === 0 ? null : 0)}
              question="L'IA modifie-t-elle le fond de notre message ?"
              answer="Non. L'IA de BrandLock est utilisée de manière utilitaire (transcription audio pour les sous-titres, recadrage vidéo, vérification de conformité). Le fond de votre message reste 100% sous le contrôle de vos équipes."
            />
            <FaqItem
              isOpen={openFaq === 1}
              onToggle={() => setOpenFaq(openFaq === 1 ? null : 1)}
              question="Que se passe-t-il si les formats des réseaux sociaux (Instagram, LinkedIn) changent ?"
              answer="Notre équipe technique met à jour les grilles de Safe Zones de manière centralisée. Vos gabarits s'adaptent automatiquement aux nouvelles dimensions sans aucune intervention de votre part."
            />
            <FaqItem
              isOpen={openFaq === 2}
              onToggle={() => setOpenFaq(openFaq === 2 ? null : 2)}
              question="Le logiciel remplace-t-il nos agences de création ou logiciels de montage ?"
              answer="Pas du tout. BrandLock sécurise le « dernier kilomètre ». Vos équipes ou agences continuent d'utiliser leurs outils habituels pour le montage créatif, puis utilisent BrandLock pour l'habillage final, le sous-titrage et la déclinaison multicanale aux normes de l'institution."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  CLOSING CTA — Bordeaux dominant                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section
        className="px-6 py-28 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${COLORS.bordeauxDark} 0%, ${COLORS.bordeaux} 100%)`,
          color: COLORS.cream,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-4xl lg:text-5xl font-black tracking-[-0.03em] leading-[1.05] mb-5">
            La technologie au service des<br />
            <em style={{ color: COLORS.gold, fontWeight: 500, fontStyle: "italic" }}>institutions suisses.</em>
          </h2>
          <p className="text-base mb-10" style={{ color: "#EFE9DD" }}>
            Sécurité, rigueur et fiabilité. Conçu en Suisse, hébergé à Genève.
          </p>
          <button
            type="button"
            onClick={() => setProspectOpen(true)}
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5"
            style={{
              backgroundColor: COLORS.cream,
              color: COLORS.ink,
              boxShadow: "0 20px 50px -20px rgba(0,0,0,0.4)",
            }}
          >
            Organiser une présentation technique
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  FOOTER                                                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <footer
        className="px-6 py-10"
        style={{ backgroundColor: COLORS.ink, color: COLORS.cream }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/media/logo.png"
              alt="BrandLock"
              className="h-8 w-auto object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <div className="flex items-baseline gap-1.5">
              <span className="font-black tracking-tighter text-base italic">BrandLock</span>
              <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5">
                <rect width="32" height="32" fill={COLORS.bordeaux} rx="3" />
                <rect x="13" y="7" width="6" height="18" fill="white" />
                <rect x="7" y="13" width="18" height="6" fill="white" />
              </svg>
            </div>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "#807972" }}>
              Édition Institutionnelle
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest" style={{ color: COLORS.gold }}>
            <MapPin size={11} />
            Genève · Suisse
          </div>

          <div className="text-[10px] uppercase tracking-widest" style={{ color: "#807972" }}>
            © 2026 BrandLock · Tous droits réservés
          </div>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  MODALS                                                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {prospectOpen && <ProspectModal onClose={() => setProspectOpen(false)} />}
    </div>
  );
}

// ============================================================
//  COMPOSANTS DESIGN
// ============================================================

function SectionHeader({
  eyebrow, title, subtitle, invert,
}: { eyebrow: string; title: string; subtitle?: string; invert?: boolean }) {
  const accentColor = invert ? COLORS.gold : COLORS.bordeaux;
  return (
    <div className="text-center max-w-3xl mx-auto">
      <div
        className="inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] mb-5"
        style={{ color: accentColor }}
      >
        <span className="w-8 h-px" style={{ backgroundColor: accentColor }}></span>
        {eyebrow}
        <span className="w-8 h-px" style={{ backgroundColor: accentColor }}></span>
      </div>
      <h2
        className="text-3xl lg:text-5xl font-black tracking-[-0.03em] leading-[1.05] mb-4"
        style={{ color: invert ? COLORS.cream : COLORS.ink }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="text-base lg:text-lg leading-[1.7]"
          style={{ color: invert ? "#EFE9DD" : COLORS.warmGray }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function TrustCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div
      className="p-7 rounded-2xl border transition-all duration-300 hover:-translate-y-1"
      style={{
        backgroundColor: "white",
        borderColor: `${COLORS.ink}10`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
        style={{
          backgroundColor: COLORS.cream,
          color: COLORS.bordeaux,
        }}
      >
        {icon}
      </div>
      <h3 className="text-base font-black tracking-tight mb-2 leading-snug" style={{ color: COLORS.ink }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: COLORS.warmGray }}>
        {description}
      </p>
    </div>
  );
}

function GuaranteeCard({ num, icon, title, description }: { num: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <div
      className="p-8 transition-all duration-300 hover:bg-opacity-100 group"
      style={{
        backgroundColor: COLORS.nightBlue,
      }}
    >
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
          style={{
            backgroundColor: `${COLORS.gold}15`,
            color: COLORS.gold,
            border: `1px solid ${COLORS.gold}30`,
          }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] mb-1" style={{ color: COLORS.gold }}>
            Garantie {num}
          </div>
          <h3 className="text-lg font-black tracking-tight leading-snug" style={{ color: COLORS.cream }}>
            {title}
          </h3>
        </div>
      </div>
      <p className="text-sm leading-[1.7] pl-14" style={{ color: "#C5BDB0" }}>
        {description}
      </p>
    </div>
  );
}

function UseCaseCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div
      className="p-7 rounded-2xl transition-all duration-300 hover:-translate-y-1 group"
      style={{
        backgroundColor: "white",
        border: `1px solid ${COLORS.ink}10`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform"
        style={{
          background: `linear-gradient(135deg, ${COLORS.bordeaux} 0%, ${COLORS.bordeauxDark} 100%)`,
          color: "white",
          boxShadow: `0 8px 20px -8px ${COLORS.bordeaux}80`,
        }}
      >
        {icon}
      </div>
      <h3 className="text-base font-black tracking-tight mb-2.5 leading-snug" style={{ color: COLORS.ink }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: COLORS.warmGray }}>
        {description}
      </p>
    </div>
  );
}

function StepCard({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div
      className="relative p-7 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        backgroundColor: "white",
        border: `1px solid ${COLORS.ink}10`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <div
        className="absolute top-3 right-4 text-7xl font-black tracking-tighter leading-none pointer-events-none"
        style={{
          color: COLORS.gold,
          opacity: 0.15,
        }}
      >
        {num}
      </div>
      <div className="relative">
        <div
          className="inline-block text-[10px] font-bold uppercase tracking-[0.25em] mb-3"
          style={{ color: COLORS.bordeaux }}
        >
          Étape {num}
        </div>
        <h3 className="text-base font-black tracking-tight mb-2.5 leading-snug" style={{ color: COLORS.ink }}>
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: COLORS.warmGray }}>
          {description}
        </p>
      </div>
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]"
      style={{
        backgroundColor: `${COLORS.gold}15`,
        border: `1px solid ${COLORS.gold}40`,
        color: COLORS.gold,
      }}
    >
      {icon}
      {label}
    </div>
  );
}

function FaqItem({
  isOpen, onToggle, question, answer,
}: { isOpen: boolean; onToggle: () => void; question: string; answer: string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: "white",
        border: `1px solid ${isOpen ? COLORS.bordeaux + "40" : COLORS.ink + "10"}`,
        boxShadow: isOpen ? `0 8px 25px -8px ${COLORS.bordeaux}20` : "none",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 py-5 flex items-center justify-between gap-3 text-left transition"
      >
        <span className="text-base font-bold tracking-tight" style={{ color: COLORS.ink }}>
          {question}
        </span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
          style={{
            backgroundColor: isOpen ? COLORS.bordeaux : COLORS.cream,
            color: isOpen ? "white" : COLORS.bordeaux,
            transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <Plus size={16} />
        </div>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 -mt-1">
          <p className="text-sm leading-[1.7]" style={{ color: COLORS.warmGray }}>
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  MODAL LOGIN
// ============================================================

function LoginModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Connexion impossible");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("scope, role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!profile) {
        setError("Compte non configuré. Contactez l'administrateur.");
        setLoading(false);
        return;
      }

      if (profile.scope === "platform" && profile.role === "super_admin") {
        router.push("/super-admin");
      } else if (profile.role === "tenant_admin") {
        router.push("/admin/tenant");
      } else if (profile.role === "graphist") {
        router.push("/studio");
      } else {
        setError("Rôle non reconnu");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      style={{ backgroundColor: `${COLORS.ink}E0` }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-scaleIn"
        style={{
          backgroundColor: COLORS.cream,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: `${COLORS.ink}10` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: COLORS.bordeaux, color: "white" }}
            >
              <Lock size={16} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight" style={{ color: COLORS.ink }}>
                Connexion
              </h2>
              <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: COLORS.warmGray }}>
                Édition Institutionnelle Suisse
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition hover:opacity-70"
            style={{ color: COLORS.warmGray }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: COLORS.warmGray }}>
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@institution.ch"
              required
              autoFocus
              autoComplete="email"
              className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition"
              style={{
                backgroundColor: "white",
                border: `1px solid ${COLORS.ink}15`,
              }}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: COLORS.warmGray }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition"
              style={{
                backgroundColor: "white",
                border: `1px solid ${COLORS.ink}15`,
              }}
            />
          </div>

          {error && (
            <div
              className="px-3 py-2.5 rounded-lg text-xs"
              style={{
                backgroundColor: `${COLORS.bordeaux}10`,
                border: `1px solid ${COLORS.bordeaux}30`,
                color: COLORS.bordeauxDark,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full px-4 py-3.5 font-bold text-xs uppercase tracking-[0.2em] rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:-translate-y-0.5"
            style={{
              backgroundColor: COLORS.ink,
              color: COLORS.cream,
              boxShadow: `0 10px 25px -10px ${COLORS.ink}80`,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Connexion...
              </>
            ) : (
              <>
                <Lock size={12} />
                Se connecter
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================
//  MODAL PROSPECT
// ============================================================

function ProspectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Nom, email et message sont obligatoires");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/super-admin/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim() || null,
          email: email.trim(),
          phone: phone.trim() || null,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'envoi");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setSubmitting(false);
      setTimeout(onClose, 3500);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 backdrop-blur-md overflow-y-auto animate-fadeIn"
      style={{ backgroundColor: `${COLORS.ink}E0` }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="min-h-full flex items-start justify-center p-4 py-8">
        <div
          className="w-full max-w-lg rounded-2xl overflow-hidden animate-scaleIn my-auto"
          style={{
            backgroundColor: COLORS.cream,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {submitted ? (
            <div className="p-12 text-center">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
                style={{ backgroundColor: COLORS.bordeaux, color: COLORS.cream }}
              >
                <MailCheck size={28} />
              </div>
              <h3 className="text-xl font-black tracking-tight mb-3" style={{ color: COLORS.ink }}>
                Demande envoyée
              </h3>
              <p className="text-sm mb-2" style={{ color: COLORS.charcoal }}>
                Merci pour votre confiance.
              </p>
              <p className="text-xs" style={{ color: COLORS.warmGray }}>
                Notre équipe revient vers vous sous <strong>48h ouvrées</strong>.
              </p>
            </div>
          ) : (
            <>
              <div
                className="px-6 py-5 border-b flex items-center justify-between sticky top-0 z-10"
                style={{
                  backgroundColor: COLORS.cream,
                  borderColor: `${COLORS.ink}10`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: COLORS.bordeaux, color: "white" }}
                  >
                    <Briefcase size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-black tracking-tight" style={{ color: COLORS.ink }}>
                      Présentation technique
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: COLORS.warmGray }}>
                      Réponse sous 48h ouvrées
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition hover:opacity-70"
                  style={{ color: COLORS.warmGray }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Nom complet *">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                      placeholder="Marie Dupont"
                      className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition"
                      style={{ backgroundColor: "white", border: `1px solid ${COLORS.ink}15` }}
                    />
                  </Field>

                  <Field label="Institution">
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Canton de Genève"
                      className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition"
                      style={{ backgroundColor: "white", border: `1px solid ${COLORS.ink}15` }}
                    />
                  </Field>
                </div>

                <Field label="Email professionnel *">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="vous@institution.ch"
                    className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition"
                    style={{ backgroundColor: "white", border: `1px solid ${COLORS.ink}15` }}
                  />
                </Field>

                <Field label="Téléphone">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+41 22 ..."
                    className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition"
                    style={{ backgroundColor: "white", border: `1px solid ${COLORS.ink}15` }}
                  />
                </Field>

                <Field label="Votre besoin *">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={4}
                    placeholder="Quel est votre cas d'usage ? Combien de collaborateurs ? Quelles plateformes visées ?"
                    className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none transition resize-none"
                    style={{ backgroundColor: "white", border: `1px solid ${COLORS.ink}15` }}
                  />
                </Field>

                {error && (
                  <div
                    className="px-3 py-2.5 rounded-lg text-xs"
                    style={{
                      backgroundColor: `${COLORS.bordeaux}10`,
                      border: `1px solid ${COLORS.bordeaux}30`,
                      color: COLORS.bordeauxDark,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div
                  className="text-[10px] flex items-start gap-2 px-3 py-2.5 rounded-lg"
                  style={{
                    backgroundColor: `${COLORS.gold}10`,
                    border: `1px solid ${COLORS.gold}30`,
                    color: COLORS.charcoal,
                  }}
                >
                  <ShieldCheck size={12} className="shrink-0 mt-0.5" style={{ color: COLORS.goldDark }} />
                  <span>
                    Vos données sont traitées en conformité avec la <strong>nLPD suisse</strong>.
                    Hébergement Infomaniak (Genève) · Zéro transfert hors Suisse.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-4 py-3.5 font-bold text-xs uppercase tracking-[0.2em] rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:-translate-y-0.5"
                  style={{
                    backgroundColor: COLORS.bordeaux,
                    color: "white",
                    boxShadow: `0 10px 25px -10px ${COLORS.bordeaux}80`,
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <ArrowRight size={14} />
                      Envoyer ma demande
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
        style={{ color: COLORS.warmGray }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
