import "server-only";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getMigrationProject } from "@/lib/migration/projects";
import type { PagePlanItem, PagePlanItemInput } from "./types";

function serialize(item: {
  id: string;
  migrationProjectId: string;
  position: number;
  pageName: string;
  slug: string;
  titleTag: string;
  pageType: string;
  layoutRevisionId: string;
  emptyDraftAllowed: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): PagePlanItem {
  return {
    ...item,
    pageType: item.pageType as PagePlanItem["pageType"],
    status: item.status as PagePlanItem["status"],
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listPagePlan(userId: string, projectId: string): Promise<PagePlanItem[]> {
  await getMigrationProject(userId, projectId);
  const items = await prisma.pagePlanItem.findMany({
    where: { migrationProjectId: projectId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return items.map(serialize);
}

export async function savePagePlan(
  userId: string,
  projectId: string,
  inputItems: PagePlanItemInput[],
): Promise<PagePlanItem[]> {
  const project = await getMigrationProject(userId, projectId);
  const revisionIds = [...new Set(inputItems.map((item) => item.layoutRevisionId))];
  const revisions = await prisma.layoutRevision.findMany({
    where: {
      id: { in: revisionIds },
      status: "ready",
      layoutTemplate: { createdBy: userId, status: "ready" },
    },
    select: { id: true },
  });
  if (revisions.length !== revisionIds.length) {
    throw new Error("One or more selected layouts are not Ready.");
  }
  const requestedIds = inputItems.map((item) => item.id);
  const foreignItem = requestedIds.length > 0
    ? await prisma.pagePlanItem.findFirst({
        where: {
          id: { in: requestedIds },
          migrationProjectId: { not: projectId },
        },
        select: { id: true },
      })
    : null;
  if (foreignItem) throw new Error("A Page Plan item does not belong to this project.");

  const existingItems = await prisma.pagePlanItem.findMany({
    where: { migrationProjectId: projectId },
    select: { id: true, pageName: true, slug: true, pageType: true, status: true },
  });
  const existingById = new Map(existingItems.map((item) => [item.id, item]));

  const normalized = inputItems.map((item, position) => ({
    ...item,
    position,
    pageName: item.pageName.trim(),
    slug: item.slug.trim(),
    titleTag: item.titleTag.trim(),
    status: matchingFieldsChanged(existingById.get(item.id), item)
      ? ("planned" as const)
      : existingById.get(item.id)?.status ?? ("planned" as const),
  }));
  const keepIds = normalized.map((item) => item.id);
  await prisma.$transaction(async (tx) => {
    await tx.pagePlanItem.deleteMany({
      where: {
        migrationProjectId: projectId,
        ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
      },
    });
    for (const item of normalized) {
      if (item.status === "planned") {
        await tx.contentMatch.deleteMany({ where: { pagePlanItemId: item.id } });
      }
      await tx.pagePlanItem.upsert({
        where: { id: item.id },
        create: { ...item, migrationProjectId: projectId },
        update: {
          position: item.position,
          pageName: item.pageName,
          slug: item.slug,
          titleTag: item.titleTag,
          pageType: item.pageType,
          layoutRevisionId: item.layoutRevisionId,
          emptyDraftAllowed: item.emptyDraftAllowed,
          status: item.status,
        },
      });
    }
    await tx.migrationProject.update({
      where: { id: projectId },
      data: {
        status: project.status === "complete" ? "complete" : "active",
        stage: project.status === "complete" ? project.stage : "plan",
        lastError: null,
      },
    });
  });

  await audit(userId, "migration.page-plan.save", project.clientId, {
    migrationProjectId: projectId,
    pages: normalized.length,
    layouts: revisionIds.length,
  });
  return listPagePlan(userId, projectId);
}

function matchingFieldsChanged(
  existing: { pageName: string; slug: string; pageType: string } | undefined,
  input: PagePlanItemInput,
): boolean {
  return (
    !existing ||
    existing.pageName.trim() !== input.pageName.trim() ||
    existing.slug.trim() !== input.slug.trim() ||
    existing.pageType !== input.pageType
  );
}
