import type {
  TemplateCompileBundle,
  TemplateMappingManifest,
} from "@/lib/template-import/types";

export const MIGRATION_PROJECT_SCHEMA_VERSION = 1 as const;

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
  classification: SourcePageClassification;
  classificationReason: string;
  included: boolean;
  reviewed: boolean;
  metadata: Record<string, unknown>;
}

export interface MigrationAsset {
  id: string;
  sourceUrl: string;
  sourcePageIds: string[];
  status: "pending" | "review" | "ready" | "uploaded" | "failed";
  altText: string;
  filename: string;
  destinationMediaId?: number;
  destinationUrl?: string;
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
  assets: MigrationAsset[];
  templateManifest?: TemplateMappingManifest;
  compileBundle?: TemplateCompileBundle;
  resolutions: MigrationResolution[];
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
