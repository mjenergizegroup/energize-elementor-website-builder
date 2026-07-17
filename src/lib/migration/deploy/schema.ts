import { z } from "zod";

const pageRole = z.enum([
  "homepage",
  "about",
  "contact",
  "first-visit",
  "membership",
  "amenities",
  "technology",
  "blog-archive",
  "blog-single",
  "service-page",
  "custom",
]);

const warningSchema = z.object({
  code: z.string().max(200),
  severity: z.enum(["blocker", "warning", "info"]),
  title: z.string().max(500),
  message: z.string().max(5_000),
  remediation: z.string().max(5_000),
});

const compiledPageSchema = z.object({
  analysisId: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["ready", "review", "blocked"]),
  deployable: z.boolean(),
  targetKind: z.enum(["wp-page", "elementor-theme-template"]),
  mapping: z.object({
    role: pageRole,
    title: z.string().trim().min(1).max(200),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
    selected: z.boolean(),
  }),
  compiler: z.object({ id: z.string().max(200), version: z.string().max(100) }),
  transformations: z.object({
    elementIdsRegenerated: z.number().int().nonnegative(),
    duplicateIdsResolved: z.number().int().nonnegative(),
    mediaIdsCleared: z.number().int().nonnegative(),
    globalReferencesPreserved: z.number().int().nonnegative(),
    dynamicBindingsPreserved: z.number().int().nonnegative(),
    unsupportedWidgetsPreserved: z.number().int().nonnegative(),
  }),
  pending: z.object({
    externalHosts: z.array(z.string().max(500)).max(500),
    customGlobalIds: z.array(z.string().max(500)).max(500),
    plugins: z.array(z.string().max(500)).max(500),
    unsupportedWidgets: z.array(z.string().max(500)).max(500),
    shortcodes: z.array(z.string().max(5_000)).max(500),
  }),
  warnings: z.array(warningSchema).max(1_000),
  wordpress: z.object({
    status: z.literal("draft"),
    pageTemplate: z.literal("elementor_header_footer"),
  }),
  artifact: z.record(z.string(), z.unknown()).optional(),
});

export const migrationCompileBundleSchema = z.object({
  schemaVersion: z.literal("1"),
  compiledAt: z.string().datetime(),
  sourceManifestCreatedAt: z.string().datetime(),
  totals: z.object({
    selected: z.number().int().min(0).max(20),
    compiled: z.number().int().min(0).max(20),
    ready: z.number().int().min(0).max(20),
    review: z.number().int().min(0).max(20),
    blocked: z.number().int().min(0).max(20),
  }),
  pages: z.array(compiledPageSchema).min(1).max(20),
});

const resolutionSchema = z.object({
  id: z.string().min(1).max(500),
  kind: z.enum([
    "media",
    "global-style",
    "plugin",
    "widget",
    "shortcode",
    "dynamic-binding",
    "external-url",
    "theme-builder-target",
  ]),
  source: z.string().min(1).max(5_000),
  status: z.enum(["unresolved", "resolved", "accepted", "blocked"]),
  resolution: z.record(z.string(), z.unknown()).optional(),
  note: z.string().max(5_000).optional(),
});

export const migrationResolutionsSchema = z.array(resolutionSchema).max(10_000);

const workspaceAssetSchema = z.object({
  filename: z.string().min(1).max(255),
  dataBase64: z.string().min(1).max(4_000_000),
});

export const migrationWizardWorkspaceSchema = z.object({
  schemaVersion: z.literal(1),
  step: z.number().int().min(0).max(5),
  siteKind: z.enum(["existing", "new"]),
  deployMode: z.enum(["pages", "branding-only"]),
  name: z.string().max(200),
  slug: z.string().max(200),
  address: z.string().max(2_000),
  phone: z.string().max(200),
  email: z.string().max(500),
  hours: z.string().max(2_000),
  bookingLink: z.string().max(5_000),
  social: z.string().max(5_000),
  siteUrl: z.string().max(5_000),
  username: z.string().max(500),
  colors: z.object({
    primary: z.string().max(100),
    secondary: z.string().max(100),
    accent: z.string().max(100),
    text: z.string().max(100),
    background: z.string().max(100),
  }),
  fonts: z.object({
    heading: z.string().max(200),
    body: z.string().max(200),
  }),
  logo: workspaceAssetSchema.optional(),
  favicon: workspaceAssetSchema.optional(),
}).strict();

const assetSchema = z.object({
  filename: z.string().min(1).max(255),
  dataBase64: z.string().min(1).max(4_000_000),
});

const destinationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(200),
  wpSiteUrl: z.string().url(),
  wpUsername: z.string().trim().min(1).max(200),
  wpAppPassword: z.string().min(1).max(1_000),
  brandKit: z.object({
    colors: z.object({
      primary: z.string().max(100),
      secondary: z.string().max(100),
      accent: z.string().max(100),
      text: z.string().max(100),
      background: z.string().max(100),
    }),
    fonts: z.object({
      heading: z.string().max(200),
      body: z.string().max(200),
    }),
    logo: assetSchema.optional(),
    favicon: assetSchema.optional(),
  }),
});

const normalizedSlotSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1).max(500),
    kind: z.literal("heading"),
    text: z.string().max(20_000),
    level: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
  }),
  z.object({
    id: z.string().min(1).max(500),
    kind: z.literal("rich-text"),
    html: z.string().max(200_000),
  }),
  z.object({
    id: z.string().min(1).max(500),
    kind: z.literal("image"),
    sourceUrl: z.string().regex(/^(?:https?:\/\/|\/)/).max(5_000),
    altText: z.string().max(500),
  }),
  z.object({
    id: z.string().min(1).max(500),
    kind: z.literal("link"),
    label: z.string().max(2_000),
    href: z
      .string()
      .regex(/^(?:https?:\/\/|\/|#|mailto:|tel:)/i)
      .max(5_000),
  }),
]);

const contentMappingSchema = z.object({
  analysisId: z.string().min(1).max(500),
  sourceRevision: z.number().int().positive().optional(),
  sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  content: z.object({
    schemaVersion: z.literal("1"),
    sourcePageId: z.string().min(1).max(500),
    title: z.string().min(1).max(500),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
    slots: z.array(normalizedSlotSchema).min(1).max(2_000),
  }),
});

export const migrationContentMappingsSchema = z
  .array(contentMappingSchema)
  .min(1)
  .max(20);

export const migrationDeployActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("prepare"),
    bundle: migrationCompileBundleSchema,
    resolutions: migrationResolutionsSchema,
    contentMappings: migrationContentMappingsSchema,
    destination: destinationSchema.optional(),
  }),
  z.object({ action: z.literal("preflight") }),
  z.object({
    action: z.literal("deploy"),
    dryRun: z.boolean().default(true),
    retryFailedOnly: z.boolean().default(false),
  }),
]);
