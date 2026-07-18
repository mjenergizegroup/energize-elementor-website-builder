import { createHash } from "node:crypto";
import { validateArtifact } from "@/lib/migration/deploy/preflight";
import type {
  PreparedBuildDestination,
  PreparedBuildGateway,
  PreparedBuildPlan,
  PreparedBuildPlanSummary,
  PreparedBuildSourcePage,
} from "./types";

export function createPreparedBuildPlan(input: {
  id: string;
  projectId: string;
  pages: PreparedBuildSourcePage[];
  workspaceChecksum: string;
  destination: PreparedBuildDestination;
  now?: Date;
}): PreparedBuildPlan {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const slugs = new Set<string>();
  const pages = [...input.pages];

  if (pages.length === 0) blockers.push("Add at least one page before creating drafts.");
  if (!input.destination.brandKit.logo) blockers.push("Add a site logo before creating drafts.");
  if (!input.destination.brandKit.favicon) blockers.push("Add a site favicon before creating drafts.");
  for (const page of pages) {
    if (slugs.has(page.slug)) blockers.push(`The URL /${page.slug}/ is used more than once.`);
    slugs.add(page.slug);
    if (page.status !== "ready") blockers.push(`${page.pageName} needs attention before drafts can be created.`);
    if (page.residueReport.length > 0) blockers.push(`${page.pageName} still contains source-layout residue.`);
    if (page.artifact.length === 0) blockers.push(`${page.pageName} has no prepared layout content.`);
    blockers.push(
      ...validateArtifact({ content: page.artifact }).map(
        (message) => `${page.pageName}: ${friendlyArtifactError(message)}`,
      ),
    );
  }

  const destinationChecksum = checksum({
    clientId: input.destination.clientId,
    name: input.destination.name,
    slug: input.destination.slug,
    wpSiteUrl: normalizeUrl(input.destination.wpSiteUrl),
    wpUsername: input.destination.wpUsername,
    brandKit: input.destination.brandKit,
  });
  const items = pages.map((page) => ({
    preparedDraftId: page.preparedDraftId,
    pagePlanItemId: page.pagePlanItemId,
    title: page.pageName,
    slug: page.slug,
    contentChecksum: page.contentChecksum,
    layoutRevisionId: page.layoutRevisionId,
    sourceSignature: page.sourceSignature,
    artifactChecksum: checksum(page.artifact),
    status: "ready" as const,
    attemptCount: 0,
  }));
  const inputChecksum = checksum({
    workspaceChecksum: input.workspaceChecksum,
    destinationChecksum,
    items: items.map((item) => ({
      preparedDraftId: item.preparedDraftId,
      pagePlanItemId: item.pagePlanItemId,
      title: item.title,
      slug: item.slug,
      contentChecksum: item.contentChecksum,
      layoutRevisionId: item.layoutRevisionId,
      sourceSignature: item.sourceSignature,
      artifactChecksum: item.artifactChecksum,
    })),
  });
  const preparedAt = (input.now ?? new Date()).toISOString();
  const ready = blockers.length === 0;

  return {
    schemaVersion: 1,
    kind: "prepared-page-plan",
    id: input.id,
    projectId: input.projectId,
    status: ready ? "ready" : "failed",
    inputChecksum,
    workspaceChecksum: input.workspaceChecksum,
    destination: {
      clientId: input.destination.clientId,
      name: input.destination.name,
      slug: input.destination.slug,
      wpSiteUrl: normalizeUrl(input.destination.wpSiteUrl),
      wpUsername: input.destination.wpUsername,
      checksum: destinationChecksum,
    },
    preparedAt,
    attemptCount: 0,
    items,
    events: ready
      ? [
          event(preparedAt, "ok", "Preparing destination", "Destination settings are complete."),
          event(preparedAt, "ok", "Applying brand", "Brand inputs passed the no-write check."),
          event(preparedAt, "ok", `Creating ${items.length} page drafts`, "Every prepared page passed the no-write check."),
          event(preparedAt, "ok", "Final checks", "No source-layout residue or unsafe draft data was found."),
        ]
      : [event(preparedAt, "fail", "Final checks", blockers.join(" "))],
    blockers: unique(blockers),
    warnings: unique(warnings),
  };
}

export async function runPreparedBuildPlan(
  plan: PreparedBuildPlan,
  pages: PreparedBuildSourcePage[],
  gateway: PreparedBuildGateway,
  options: {
    retryFailedOnly?: boolean;
    buildId?: string;
    now?: () => Date;
  } = {},
): Promise<PreparedBuildPlan> {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const events = [] as PreparedBuildPlan["events"];
  const addEvent = (
    status: "start" | "ok" | "fail",
    label: string,
    message?: string,
  ) => events.push(event(now().toISOString(), status, label, message));

  if (plan.status === "complete") return plan;
  if (plan.blockers.length > 0) {
    addEvent("fail", "Final checks", plan.blockers.join(" "));
    return finish(plan, "failed", events, startedAt, now, options.buildId);
  }

  try {
    addEvent("start", "Preparing destination");
    await gateway.prepareDestination();
    addEvent("ok", "Preparing destination");
  } catch (error) {
    addEvent("fail", "Preparing destination", message(error, "Could not prepare the WordPress destination."));
    return finish(plan, "failed", events, startedAt, now, options.buildId);
  }

  try {
    addEvent("start", "Applying brand");
    await gateway.applyBrand();
    addEvent("ok", "Applying brand");
  } catch (error) {
    addEvent("fail", "Applying brand", message(error, "Could not apply the brand kit."));
    return finish(plan, "failed", events, startedAt, now, options.buildId);
  }

  const sources = new Map(pages.map((page) => [page.preparedDraftId, page]));
  const hadFailedItems = plan.items.some((item) => item.status === "failed");
  const items = [] as PreparedBuildPlan["items"];
  addEvent("start", `Creating ${plan.items.length} page drafts`);
  for (const item of plan.items) {
    if (
      item.status === "draft" ||
      (options.retryFailedOnly && hadFailedItems && item.status !== "failed")
    ) {
      items.push(item);
      continue;
    }
    const source = sources.get(item.preparedDraftId);
    if (!source) {
      items.push({ ...item, status: "failed", error: "The prepared draft is no longer available." });
      continue;
    }
    try {
      const result = await gateway.upsertDraft({
        title: item.title,
        slug: item.slug,
        elementorData: source.artifact,
        elementorVersion: "4.1.1",
        pageTemplate: "elementor_header_footer",
      });
      if (result.status !== "draft") throw new Error("WordPress did not keep the page as a draft.");
      items.push({
        ...item,
        status: "draft",
        attemptCount: item.attemptCount + 1,
        wpPageId: result.id,
        editUrl: result.editUrl,
        viewUrl: result.viewUrl,
        error: undefined,
      });
    } catch (error) {
      items.push({
        ...item,
        status: "failed",
        attemptCount: item.attemptCount + 1,
        error: message(error, "WordPress could not create this draft."),
      });
    }
  }
  const failed = items.filter((item) => item.status === "failed");
  if (failed.length > 0) {
    addEvent("fail", `Creating ${plan.items.length} page drafts`, `${failed.length} draft${failed.length === 1 ? " needs" : "s need"} another try.`);
  } else {
    addEvent("ok", `Creating ${plan.items.length} page drafts`);
  }
  addEvent(failed.length > 0 ? "fail" : "ok", "Final checks", failed.length > 0 ? "Completed drafts were saved. Retry only the drafts that failed." : "All pages are saved as WordPress drafts.");

  const complete = items.length > 0 && items.every((item) => item.status === "draft");
  return {
    ...finish(
      plan,
      complete ? "complete" : failed.length === items.length ? "failed" : "partial",
      events,
      startedAt,
      now,
      options.buildId,
    ),
    items,
  };
}

export function summarizePreparedBuild(plan: PreparedBuildPlan): PreparedBuildPlanSummary {
  return {
    id: plan.id,
    status: plan.status,
    preparedAt: plan.preparedAt,
    attemptCount: plan.attemptCount,
    items: plan.items.map((item) => ({
      preparedDraftId: item.preparedDraftId,
      pagePlanItemId: item.pagePlanItemId,
      title: item.title,
      slug: item.slug,
      status: item.status,
      attemptCount: item.attemptCount,
      wpPageId: item.wpPageId,
      editUrl: item.editUrl,
      viewUrl: item.viewUrl,
      error: item.error,
    })),
    events: plan.events,
    blockers: plan.blockers,
    warnings: plan.warnings,
  };
}

export function checksum(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function finish(
  plan: PreparedBuildPlan,
  status: PreparedBuildPlan["status"],
  events: PreparedBuildPlan["events"],
  startedAt: string,
  now: () => Date,
  buildId?: string,
): PreparedBuildPlan {
  return {
    ...plan,
    status,
    buildId: buildId ?? plan.buildId,
    attemptCount: plan.attemptCount + 1,
    startedAt,
    completedAt: now().toISOString(),
    events,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function event(
  at: string,
  status: "start" | "ok" | "fail",
  label: string,
  message?: string,
) {
  return { at, status, label, message };
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function friendlyArtifactError(value: string): string {
  if (value.includes("credential-like")) return "unsafe private data was found in the prepared draft.";
  if (value.includes("duplicate Elementor ID")) return "the prepared layout contains a duplicate internal ID.";
  if (value.includes("8-character")) return "the prepared layout contains an invalid internal ID.";
  return value;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
