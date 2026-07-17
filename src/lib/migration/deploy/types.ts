import type { TemplateCompileTargetKind } from "@/lib/template-import/types";

export type MigrationDeploymentStatus =
  | "prepared"
  | "ready"
  | "running"
  | "partial"
  | "complete"
  | "failed";

export type MigrationDeploymentItemStatus =
  | "pending"
  | "ready"
  | "deploying"
  | "draft"
  | "failed";

export interface MigrationDeploymentItem {
  analysisId: string;
  title: string;
  slug: string;
  targetKind: TemplateCompileTargetKind;
  status: MigrationDeploymentItemStatus;
  attemptCount: number;
  wpPageId?: number;
  editUrl?: string;
  viewUrl?: string;
  error?: string;
}

export interface MigrationDeploymentEvent {
  at: string;
  analysisId?: string;
  status: "start" | "ok" | "fail";
  label: string;
  message?: string;
  editUrl?: string;
}

export interface MigrationDeploymentRecord {
  schemaVersion: 1;
  status: MigrationDeploymentStatus;
  dryRun: boolean;
  attemptCount: number;
  buildId?: string;
  preparedAt: string;
  startedAt?: string;
  completedAt?: string;
  items: MigrationDeploymentItem[];
  events: MigrationDeploymentEvent[];
  blockers: string[];
  warnings: string[];
}

export interface MigrationDeploymentPreflight {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  pages: Array<{
    analysisId: string;
    title: string;
    slug: string;
    elementorData: unknown[];
    elementorVersion?: string;
    pageTemplate: "elementor_header_footer";
  }>;
}

export interface MigrationPageGateway {
  upsertDraft(input: {
    title: string;
    slug: string;
    elementorData: unknown[];
    elementorVersion?: string;
    pageTemplate: "elementor_header_footer";
  }): Promise<{
    id: number;
    status: string;
    editUrl: string;
    viewUrl: string;
    reused: boolean;
  }>;
}
