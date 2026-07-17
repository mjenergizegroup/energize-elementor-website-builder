import type { TemplateCompileBundle } from "@/lib/template-import/types";
import type { MigrationResolution } from "../types";
import { preflightMigrationDeployment } from "./preflight";
import type {
  MigrationDeploymentRecord,
  MigrationPageGateway,
} from "./types";

export function prepareMigrationDeployment(
  bundle: TemplateCompileBundle,
  resolutions: MigrationResolution[],
  now = new Date(),
): MigrationDeploymentRecord {
  const preflight = preflightMigrationDeployment(bundle, resolutions);
  return {
    schemaVersion: 1,
    status: preflight.ready ? "ready" : "prepared",
    dryRun: true,
    attemptCount: 0,
    preparedAt: now.toISOString(),
    items: bundle.pages
      .filter((page) => page.mapping.selected)
      .map((page) => ({
        analysisId: page.analysisId,
        title: page.mapping.title,
        slug: page.mapping.slug,
        targetKind: page.targetKind,
        status: preflight.ready ? "ready" : "pending",
        attemptCount: 0,
      })),
    events: [],
    blockers: preflight.blockers,
    warnings: preflight.warnings,
  };
}

export async function runMigrationDeployment(
  bundle: TemplateCompileBundle,
  resolutions: MigrationResolution[],
  previous: MigrationDeploymentRecord,
  gateway: MigrationPageGateway,
  options: {
    dryRun?: boolean;
    retryFailedOnly?: boolean;
    buildId?: string;
    now?: () => Date;
  } = {},
): Promise<MigrationDeploymentRecord> {
  const preflight = preflightMigrationDeployment(bundle, resolutions);
  const dryRun = options.dryRun ?? true;
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const priorItems = new Map(
    previous.items.map((item) => [item.analysisId, item]),
  );
  const events = [...previous.events];
  const event = (
    status: "start" | "ok" | "fail",
    label: string,
    analysisId?: string,
    message?: string,
    editUrl?: string,
  ) => {
    events.push({
      at: now().toISOString(),
      analysisId,
      status,
      label,
      message,
      editUrl,
    });
  };

  event("start", "Running migration preflight");
  if (!preflight.ready) {
    event("fail", "Migration preflight failed", undefined, preflight.blockers.join(" "));
    return {
      ...previous,
      status: "failed",
      dryRun,
      buildId: options.buildId ?? previous.buildId,
      attemptCount: previous.attemptCount + 1,
      startedAt,
      completedAt: now().toISOString(),
      blockers: preflight.blockers,
      warnings: preflight.warnings,
      events,
    };
  }
  event("ok", "Migration preflight passed");

  const items = [] as MigrationDeploymentRecord["items"];
  for (const page of preflight.pages) {
    const prior = priorItems.get(page.analysisId) ?? {
      analysisId: page.analysisId,
      title: page.title,
      slug: page.slug,
      targetKind: "wp-page" as const,
      status: "ready" as const,
      attemptCount: 0,
    };
    if (
      prior.status === "draft" ||
      (options.retryFailedOnly && prior.status !== "failed")
    ) {
      items.push(prior);
      continue;
    }
    if (dryRun) {
      event("ok", `Validated ${page.title}`, page.analysisId);
      items.push({ ...prior, status: "ready", error: undefined });
      continue;
    }

    event("start", `Creating draft for ${page.title}`, page.analysisId);
    try {
      const result = await gateway.upsertDraft({
        title: page.title,
        slug: page.slug,
        elementorData: page.elementorData,
        elementorVersion: page.elementorVersion,
        pageTemplate: page.pageTemplate,
      });
      if (result.status !== "draft") {
        throw new Error("WordPress did not retain the page as a draft.");
      }
      items.push({
        ...prior,
        title: page.title,
        slug: page.slug,
        status: "draft",
        attemptCount: prior.attemptCount + 1,
        wpPageId: result.id,
        editUrl: result.editUrl,
        viewUrl: result.viewUrl,
        error: undefined,
      });
      event(
        "ok",
        `${result.reused ? "Recovered" : "Created"} draft for ${page.title}`,
        page.analysisId,
        undefined,
        result.editUrl,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Page deployment failed.";
      items.push({
        ...prior,
        status: "failed",
        attemptCount: prior.attemptCount + 1,
        error: message,
      });
      event("fail", `Could not create ${page.title}`, page.analysisId, message);
    }
  }

  const failed = items.filter((item) => item.status === "failed").length;
  const complete = items.length > 0 && items.every((item) => item.status === "draft");
  return {
    ...previous,
    status: dryRun
      ? "ready"
      : complete
        ? "complete"
        : failed === items.length
          ? "failed"
          : "partial",
    dryRun,
    buildId: options.buildId ?? previous.buildId,
    attemptCount: previous.attemptCount + 1,
    startedAt,
    completedAt: now().toISOString(),
    items,
    events,
    blockers: [],
    warnings: preflight.warnings,
  };
}
