import "server-only";
import type { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { getMigrationProject, parseMigrationWizardWorkspace } from "@/lib/migration/projects";
import { prisma } from "@/lib/prisma";
import { checksum } from "./orchestrate";
import type { PreparedBuildPlan, PreparedBuildSourcePage } from "./types";

export async function loadPreparedBuildSource(
  userId: string,
  projectId: string,
): Promise<{ pages: PreparedBuildSourcePage[]; workspaceChecksum: string; clientId?: string }> {
  const project = await getMigrationProject(userId, projectId);
  const records = await prisma.pagePlanItem.findMany({
    where: { migrationProjectId: projectId },
    orderBy: { position: "asc" },
    include: {
      contentMatch: true,
      preparedDrafts: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  const pages = records.map((page): PreparedBuildSourcePage => {
    const draft = page.preparedDrafts[0];
    if (!draft) throw new Error(`${page.pageName} has not been prepared yet.`);
    return {
      preparedDraftId: draft.id,
      pagePlanItemId: page.id,
      pageName: page.pageName,
      slug: page.slug,
      contentChecksum: draft.contentChecksum,
      layoutRevisionId: draft.layoutRevisionId,
      sourceSignature: checksum({
        pageName: page.pageName,
        slug: page.slug,
        titleTag: page.titleTag,
        pageType: page.pageType,
        layoutRevisionId: page.layoutRevisionId,
        pageUpdatedAt: page.updatedAt.toISOString(),
        match: page.contentMatch
          ? {
              sourcePageId: page.contentMatch.sourcePageId,
              status: page.contentMatch.status,
              normalizedContentRevision: page.contentMatch.normalizedContentRevision,
              updatedAt: page.contentMatch.updatedAt.toISOString(),
            }
          : null,
      }),
      status:
        draft.status === "ready" && draft.layoutRevisionId === page.layoutRevisionId
          ? "ready"
          : "needs_attention",
      residueReport: parseStrings(draft.residueReport),
      artifact: Array.isArray(draft.artifact) ? (draft.artifact as unknown[]) : [],
    };
  });
  const workspace = parseMigrationWizardWorkspace(project.wizardWorkspace);
  return {
    pages,
    clientId: project.clientId ?? undefined,
    workspaceChecksum: checksum(
      workspace
        ? {
            siteKind: workspace.siteKind,
            deployMode: workspace.deployMode,
            name: workspace.name,
            slug: workspace.slug,
            address: workspace.address,
            phone: workspace.phone,
            email: workspace.email,
            hours: workspace.hours,
            bookingLink: workspace.bookingLink,
            social: workspace.social,
            siteUrl: workspace.siteUrl,
            username: workspace.username,
            colors: workspace.colors,
            fonts: workspace.fonts,
            logo: workspace.logo,
            favicon: workspace.favicon,
          }
        : null,
    ),
  };
}

export async function savePreparedBuildPlan(
  userId: string,
  projectId: string,
  plan: PreparedBuildPlan,
  action: string,
  clientId?: string,
) {
  const project = await getMigrationProject(userId, projectId);
  const status =
    plan.status === "complete"
      ? "complete"
      : plan.status === "failed"
        ? "failed"
        : plan.status === "ready"
          ? "ready"
          : "deploying";
  await prisma.migrationProject.update({
    where: { id: project.id },
    data: {
      ...(clientId ? { clientId } : {}),
      status,
      stage: plan.status === "complete" ? "complete" : "deploy",
      deployment: toJson(plan),
      lastError:
        plan.status === "failed" || plan.status === "partial"
          ? [...plan.blockers, ...plan.items.flatMap((item) => (item.error ? [item.error] : []))]
              .join(" ")
              .slice(0, 10_000) || null
          : null,
    },
  });
  await audit(userId, action, clientId ?? project.clientId, {
    migrationProjectId: projectId,
    planId: plan.id,
    buildId: plan.buildId,
    status: plan.status,
    drafts: plan.items.filter((item) => item.status === "draft").length,
    failed: plan.items.filter((item) => item.status === "failed").length,
  });
}

export async function loadPreparedBuildPlan(
  userId: string,
  projectId: string,
): Promise<PreparedBuildPlan | undefined> {
  const project = await getMigrationProject(userId, projectId);
  const value = project.deployment;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as unknown as Partial<PreparedBuildPlan>;
  return candidate.kind === "prepared-page-plan" && candidate.schemaVersion === 1
    ? (candidate as PreparedBuildPlan)
    : undefined;
}

function parseStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
