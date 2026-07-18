import type {
  TemplateCompileBundle,
  TemplateMappingManifest,
} from "@/lib/template-import/types";

export const MIGRATION_PROJECT_SCHEMA_VERSION = 4 as const;

export type MigrationProjectStatus =
  | "draft"
  | "active"
  | "ready"
  | "deploying"
  | "complete"
  | "failed";

export type MigrationProjectStage =
  | "source"
  | "cleanup"
  | "plan"
  | "media"
  | "templates"
  | "resolution"
  | "blogs"
  | "deploy"
  | "complete";

export type SourcePageClassification =
  | "core-page"
  | "blog-post"
  | "blog-index"
  | "skipped";

export interface MigrationSourcePage {
  id: string;
  sourceUrl: string;
  normalizedUrl: string;
  title: string;
  sourceChecksum: string;
  rawMarkdown: string;
  cleanedMarkdown: string;
  approvedMarkdown: string;
  contentRevision: number;
  approvedChecksum?: string;
  approvedAt?: string;
  classification: SourcePageClassification;
  classificationReason: string;
  included: boolean;
  reviewed: boolean;
  metadata: Record<string, unknown>;
}

export interface MigrationAsset {
  id: string;
  sourceUrl: string;
  originalUrl: string;
  sourcePageIds: string[];
  status:
    | "pending"
    | "review"
    | "ready"
    | "uploading"
    | "uploaded"
    | "skipped"
    | "failed";
  included: boolean;
  discoveredAltText: string;
  altText: string;
  title: string;
  filename: string;
  mimeType?: string;
  checksum?: string;
  attemptCount: number;
  destinationMediaId?: number;
  destinationUrl?: string;
  error?: string;
}

export interface MigrationBlogDraft {
  id: string;
  sourcePageId: string;
  title: string;
  slug: string;
  date?: string;
  excerpt?: string;
  gutenbergContent: string;
  sourceImageUrls: string[];
  imageAssetIds: string[];
  unresolvedImageUrls: string[];
  featuredImageUrl?: string;
  featuredAssetId?: string;
  featuredMediaId?: number;
  status: "pending" | "ready" | "migrated" | "failed";
  attemptCount: number;
  destinationPostId?: number;
  destinationUrl?: string;
  editUrl?: string;
  error?: string;
}

export interface MigrationResolution {
  id: string;
  kind:
    | "media"
    | "global-style"
    | "plugin"
    | "widget"
    | "shortcode"
    | "dynamic-binding"
    | "external-url"
    | "theme-builder-target";
  source: string;
  status: "unresolved" | "resolved" | "accepted" | "blocked";
  resolution?: Record<string, unknown>;
  note?: string;
}

export interface MigrationProjectState {
  schemaVersion: typeof MIGRATION_PROJECT_SCHEMA_VERSION;
  sourcePages: MigrationSourcePage[];
  cleanedPages: MigrationSourcePage[];
  blogPosts: MigrationSourcePage[];
  blogDrafts: MigrationBlogDraft[];
  assets: MigrationAsset[];
  templateManifest?: TemplateMappingManifest;
  compileBundle?: TemplateCompileBundle;
  resolutions: MigrationResolution[];
}

export interface MigrationWizardWorkspace {
  schemaVersion: 1;
  step: number;
  siteKind: "existing" | "new";
  deployMode: "pages" | "branding-only";
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  bookingLink: string;
  social: string;
  siteUrl: string;
  username: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
  fonts: { heading: string; body: string };
  logo?: { filename: string; dataBase64: string };
  favicon?: { filename: string; dataBase64: string };
}

export interface MigrationCleanupReport {
  input: number;
  unique: number;
  duplicates: number;
  corePages: number;
  blogPosts: number;
  blogIndexes: number;
  skipped: number;
  removedNoiseLines: number;
  removedDuplicateSections: number;
}

export interface MigrationCleanupResult {
  sourcePages: MigrationSourcePage[];
  corePages: MigrationSourcePage[];
  blogPosts: MigrationSourcePage[];
  blogIndexes: MigrationSourcePage[];
  skipped: MigrationSourcePage[];
  report: MigrationCleanupReport;
}
