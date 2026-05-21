/**
 * ============================================================
 *  BrandLock IA — Types fondateurs v2 "Smart Studio B2G"
 * ============================================================
 *
 *  Différences vs v1 :
 *   - Un ExportTemplate contient plusieurs SlideVariant (intro, content,
 *     stat, quote, conclusion) — chaque variant a son propre layout
 *   - Ajout des composants : statValue, statCaption, bodyBlock, quoteBlock,
 *     quoteAuthor, ctaBlock, linkBlock, logoBlock
 *   - Plus de cascade d'inputs : chaque slide est autonome
 *
 *  Convention : tout ce qui provient du JSON est `readonly`.
 *  Le ProjectState mutable contient des `CarouselSlide[]` indépendantes.
 */

// ============================================================
//  1. RÉFÉRENCES SÉMANTIQUES (typage des "clés JSON")
// ============================================================

export type ColorRef =
  | 'brandPrimary'
  | 'brandSecondary'
  | 'textLight'
  | 'textDark'
  | 'badgeBackground';

export type FontRef = 'titleFont' | 'bodyFont';

export type AssetRef =
  | 'logoWhite'
  | 'logoColor'
  | 'annotationCircle'
  | 'annotationArrow'
  | 'quoteMark'
  | 'videoBumperIn'
  | 'videoBumperOut';

export type Placement =
  | 'top-left'    | 'top-center'    | 'top-right'
  | 'center-left' | 'center'        | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'below-stat'  | 'below-quote';

export type SlideVariantKey = 'intro' | 'content' | 'stat' | 'quote' | 'conclusion';

export type InputKey =
  | 'badgeLabel'
  | 'backgroundMedia'
  | 'titleText'
  | 'bodyText'
  | 'statValue'
  | 'statCaption'
  | 'quoteText'
  | 'quoteAuthor'
  | 'ctaText'
  | 'linkText';


// ============================================================
//  2. TENANT & COMPLIANCE
// ============================================================

export interface TenantMeta {
  readonly id: string;
  readonly name: string;
  readonly tier: 'enterprise_b2g' | 'enterprise' | 'pro' | 'starter';
  readonly version: string;
  readonly compliance: ComplianceRules;
}

export interface ComplianceRules {
  readonly dataResidency: 'CH' | 'EU' | 'US';
  readonly requireApprovalWorkflow: boolean;
  readonly enforceWCAGContrast: boolean;
  readonly wcagLevel?: 'AA' | 'AAA';
}


// ============================================================
//  3. BRAND IDENTITY
// ============================================================

export interface ColorPalette {
  readonly brandPrimary: string;
  readonly brandSecondary: string;
  readonly textLight: string;
  readonly textDark: string;
  readonly badgeBackground: string;
  readonly overlayGradient: readonly [string, string, ...string[]];
}

export interface FontDefinition {
  readonly family: string;
  readonly weight: string;
  readonly source: string;
  readonly fallback?: readonly string[];
}

export interface TypographySystem {
  readonly titleFont: FontDefinition;
  readonly bodyFont: FontDefinition;
}

export interface AssetLibrary {
  readonly logoWhite: string;
  readonly logoColor: string;
  readonly annotationCircle: string;
  readonly annotationArrow: string;
  readonly quoteMark: string;
  readonly videoBumperIn: string;
  readonly videoBumperOut: string;
}

export interface BrandIdentity {
  readonly colors: ColorPalette;
  readonly typography: TypographySystem;
  readonly assets: AssetLibrary;
}


// ============================================================
//  4. CONTENT TAXONOMY
// ============================================================

export interface ContentTaxonomy {
  readonly badges: readonly string[];
}


// ============================================================
//  5. LAYOUT RULES (par variant)
// ============================================================

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export interface SafeZonesPx {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface SlideLayoutRules {
  readonly safeZonesPx: SafeZonesPx;
  readonly strictOverlapBlock: boolean;
  readonly backgroundFilter?: 'overlayGradient' | 'blur' | 'desaturate' | null;
  /** Couleur de fond fixe (utilisé pour la slide conclusion par exemple). */
  readonly fixedBackgroundColor?: ColorRef;
}


// ============================================================
//  6. COMPOSANTS DE SLIDE
// ============================================================

interface ComponentBase {
  readonly enabled?: boolean;
  readonly placement: Placement;
}

export interface BadgeComponent extends ComponentBase {
  readonly textColor: ColorRef;
  readonly bgColor: ColorRef;
  readonly accentBorderLeft?: ColorRef;
}

export interface BackgroundMediaComponent {
  readonly enabled: boolean;
  readonly required: boolean;
}

export interface TitleBlockComponent extends ComponentBase {
  readonly maxWidth: string;
  readonly font: FontRef;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly textColor?: ColorRef;
  readonly autoHighlight?: {
    readonly triggerCharacter: string;
    readonly svgAsset: AssetRef;
  };
}

export interface BodyBlockComponent extends ComponentBase {
  readonly maxWidth: string;
  readonly font: FontRef;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly textColor: ColorRef;
  readonly alignment?: 'left' | 'center' | 'right';
}

export interface StatValueComponent extends ComponentBase {
  readonly font: FontRef;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly textColor: ColorRef;
  readonly letterSpacing?: string;
}

export interface StatCaptionComponent extends ComponentBase {
  readonly maxWidth: string;
  readonly font: FontRef;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly textColor: ColorRef;
  readonly alignment?: 'left' | 'center' | 'right';
}

export interface QuoteMarkComponent extends ComponentBase {
  readonly enabled: boolean;
  readonly asset: AssetRef;
  readonly widthPx: number;
  readonly color?: ColorRef;
}

export interface QuoteBlockComponent extends ComponentBase {
  readonly maxWidth: string;
  readonly font: FontRef;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly textColor: ColorRef;
  readonly alignment?: 'left' | 'center' | 'right';
}

export interface QuoteAuthorComponent extends ComponentBase {
  readonly font: FontRef;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly textColor: ColorRef;
  readonly alignment?: 'left' | 'center' | 'right';
  readonly prefix?: string;
}

export interface LogoBlockComponent extends ComponentBase {
  readonly enabled: boolean;
  readonly asset: AssetRef;
  readonly widthPx: number;
}

export interface CTABlockComponent extends ComponentBase {
  readonly maxWidth: string;
  readonly font: FontRef;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly textColor: ColorRef;
  readonly alignment?: 'left' | 'center' | 'right';
}

export interface LinkBlockComponent extends ComponentBase {
  readonly font: FontRef;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly textColor: ColorRef;
  readonly alignment?: 'left' | 'center' | 'right';
}

/** Tous les composants reconnus dans une slide variant. */
export interface SlideComponents {
  readonly badge?: BadgeComponent;
  readonly backgroundMedia?: BackgroundMediaComponent;
  readonly titleBlock?: TitleBlockComponent;
  readonly bodyBlock?: BodyBlockComponent;
  readonly statValue?: StatValueComponent;
  readonly statCaption?: StatCaptionComponent;
  readonly quoteMark?: QuoteMarkComponent;
  readonly quoteBlock?: QuoteBlockComponent;
  readonly quoteAuthor?: QuoteAuthorComponent;
  readonly logoBlock?: LogoBlockComponent;
  readonly ctaBlock?: CTABlockComponent;
  readonly linkBlock?: LinkBlockComponent;
}


// ============================================================
//  7. SLIDE VARIANT (intro / content / stat / quote / conclusion)
// ============================================================

export interface SlideVariant {
  readonly label: string;
  readonly description: string;
  readonly layoutRules: SlideLayoutRules;
  readonly components: SlideComponents;
  /** Liste des inputs que le formulaire doit afficher pour cette variant. */
  readonly inputs: readonly InputKey[];
}

export type SlideVariantMap = Readonly<Record<SlideVariantKey, SlideVariant>>;


// ============================================================
//  8. CAROUSEL RULES
// ============================================================

export interface CarouselRules {
  readonly minSlides: number;
  readonly maxSlides: number;
  readonly firstSlideMustBe?: SlideVariantKey;
  readonly lastSlideMustBe?: SlideVariantKey;
  readonly suggestedSlideCount?: number;
}


// ============================================================
//  9. EXPORT TEMPLATE (un format de sortie complet)
// ============================================================

export type TemplateType = 'image' | 'video';
export type ImageFormat = 'jpeg' | 'png' | 'webp';
export type VideoFormat = 'mp4' | 'mov' | 'webm';

export interface ExportTemplate {
  readonly id: string;
  readonly label: string;
  readonly type: TemplateType;
  readonly format: ImageFormat | VideoFormat;
  readonly dimensions: Dimensions;
  readonly carouselRules: CarouselRules;
  readonly slideVariants: SlideVariantMap;
}

export type ExportTemplateMap = Readonly<Record<string, ExportTemplate>>;


// ============================================================
//  10. BRAND CONFIG (racine)
// ============================================================

export interface BrandConfig {
  readonly tenant: TenantMeta;
  readonly brandIdentity: BrandIdentity;
  readonly contentTaxonomy: ContentTaxonomy;
  readonly exportTemplates: ExportTemplateMap;
}

export const SUPPORTED_CONFIG_VERSIONS = ['1.0.0'] as const;
export type SupportedConfigVersion = typeof SUPPORTED_CONFIG_VERSIONS[number];


// ============================================================
//  11. RBAC
// ============================================================

export type TenantRole = 'graphist' | 'tenant_admin' | 'viewer';
export type PlatformRole = 'super_admin';

export type AuthenticatedUser =
  | {
      readonly scope: 'tenant';
      readonly tenantId: string;
      readonly userId: string;
      readonly email: string;
      readonly role: TenantRole;
    }
  | {
      readonly scope: 'platform';
      readonly userId: string;
      readonly email: string;
      readonly role: PlatformRole;
    };

export type Permission =
  | 'project.create'
  | 'project.edit'
  | 'project.submit'
  | 'project.approve'
  | 'project.export'
  | 'project.delete'
  | 'tenant.config.read'
  | 'tenant.config.write'
  | 'platform.metrics.read';


// ============================================================
//  12. PROJECT STATE (mutable)
// ============================================================

export type ProjectStatus = 'draft' | 'pending_approval' | 'approved' | 'archived' | 'rejected';

/** Une slide individuelle dans le carrousel — autonome. */
export interface CarouselSlide {
  readonly id: string;
  readonly variant: SlideVariantKey;
  readonly badgeLabel?: string;
  readonly backgroundMedia?: {
    readonly url: string;
    readonly type: 'image' | 'video';
    readonly source: 'upload' | 'library' | 'stock' | 'ai';
    readonly mediaId?: string;
  };
  readonly titleText?: string;
  readonly bodyText?: string;
  readonly statValue?: string;
  readonly statCaption?: string;
  readonly quoteText?: string;
  readonly quoteAuthor?: string;
  readonly ctaText?: string;
  readonly linkText?: string;
  readonly validationErrors: readonly ValidationError[];
}

export interface ValidationError {
  readonly code: 'OVERLAP' | 'SAFEZONE' | 'WCAG_CONTRAST' | 'MISSING_REQUIRED' | 'INVALID_BADGE' | 'INVALID_VARIANT';
  readonly component?: keyof SlideComponents;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ProjectState {
  readonly id: string;
  readonly tenantId: string;
  readonly templateKey: string;
  readonly title: string;
  readonly status: ProjectStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
  readonly slides: readonly CarouselSlide[];
}


// ============================================================
//  13. METRICS
// ============================================================

export type MetricEventType =
  | 'project.created'
  | 'project.submitted'
  | 'project.approved'
  | 'format.exported'
  | 'media.uploaded'
  | 'ai.generation';

export interface MetricEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly type: MetricEventType;
  readonly timestamp: string;
  readonly cost?: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}


// ============================================================
//  14. HELPERS DE RÉSOLUTION
// ============================================================

export type ColorResolver = (ref: ColorRef) => string;
export type FontResolver = (ref: FontRef) => FontDefinition;
export type AssetResolver = (ref: AssetRef) => string;

export interface BrandResolvers {
  readonly color: ColorResolver;
  readonly font: FontResolver;
  readonly asset: AssetResolver;
}