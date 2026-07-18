import type { BrandKit } from "@/lib/types";

export type PreparedBuildStatus =
  | "ready"
  | "running"
  | "partial"
  | "complete"
  | "failed";

export type PreparedBuildItemStatus = "ready" | "draft" | "failed";

export interface PreparedBuildDestination {
  clientId?: string;
  name: string;
  slug: string;
  wpSiteUrl: string;
  wpUsername: string;
  brandKit: BrandKit;
}

export interface PreparedBuildSourcePage {
  preparedDraftId: string;
  pagePlanItemId: string;
  pageName: string;
  slug: string;
  contentChecksum: string;
  layoutRevisionId: string;
  sourceSignature: string;
  status: string;
  residueReport: string[];
  artifact: unknown[];
}

export interface PreparedBuildItem {
  preparedDraftId: string;
  pagePlanItemId: string;
  title: string;
  slug: string;
  contentChecksum: string;
  layoutRevisionId: string;
  sourceSignature: string;
  artifactChecksum: string;
  status: PreparedBuildItemStatus;
  attemptCount: number;
  wpPageId?: number;
  editUrl?: string;
  viewUrl?: string;
  error?: string;
}

export interface PreparedBuildEvent {
  at: string;
  status: "start" | "ok" | "fail";
  label: string;
  message?: string;
}

export interface PreparedBuildPlan {
  schemaVersion: 1;
  kind: "prepared-page-plan";
  id: string;
  projectId: string;
  status: PreparedBuildStatus;
  inputChecksum: string;
  workspaceChecksum: string;
  destination: {
    clientId?: string;
    name: string;
    slug: string;
    wpSiteUrl: string;
    wpUsername: string;
    checksum: string;
  };
  preparedAt: string;
  startedAt?: string;
  completedAt?: string;
  buildId?: string;
  attemptCount: number;
  items: PreparedBuildItem[];
  events: PreparedBuildEvent[];
  blockers: string[];
  warnings: string[];
}

export interface PreparedBuildGateway {
  prepareDestination(): Promise<void>;
  applyBrand(): Promise<void>;
  upsertDraft(input: {
    title: string;
    slug: string;
    elementorData: unknown[];
    elementorVersion: "4.1.1";
    pageTemplate: "elementor_header_footer";
  }): Promise<{
    id: number;
    status: string;
    editUrl: string;
    viewUrl: string;
    reused: boolean;
  }>;
}

export interface PreparedBuildPlanSummary {
  id: string;
  status: PreparedBuildStatus;
  preparedAt: string;
  attemptCount: number;
  items: Array<{
    preparedDraftId: string;
    pagePlanItemId: string;
    title: string;
    slug: string;
    status: PreparedBuildItemStatus;
    attemptCount: number;
    wpPageId?: number;
    editUrl?: string;
    viewUrl?: string;
    error?: string;
  }>;
  events: PreparedBuildEvent[];
  blockers: string[];
  warnings: string[];
}
