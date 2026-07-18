import "server-only";
import type { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { listContentMatches } from "@/lib/content-matches/repository";
import { prisma } from "@/lib/prisma";
import {
  getMigrationProject,
  parseMigrationAssets,
  parseMigrationSourcePages,
  parseMigrationWizardWorkspace,
} from "@/lib/migration/projects";
import type { PagePlanItemInput } from "@/lib/page-plan/types";
import { preparePageDraft } from "./prepare";
import type {
  PreparedDraftResult,
  PreparedDraftStatus,
  PreparedDraftSummary,
} from "./types";

type PreparedDraftRecord = {
  id: string;
  pagePlanItemId: string;
  layoutRevisionId: string;
  version: number;
  sourcePageId: string | null;
  sourceContentRevision: number | null;
  contentChecksum: string;
  notes: Prisma.JsonValue;
  residueReport: Prisma.JsonValue;
  status: string;
  adapterId: string;
  adapterVersion: string;
  createdAt: Date;
};

export async function listPreparedDrafts(
  userId: string,
  projectId: string,
): Promise<PreparedDraftSummary[]> {
  await getMigrationProject(userId, projectId);
  const records = await prisma.preparedDraft.findMany({
    where: { pagePlanItem: { migrationProjectId: projectId } },
    orderBy: [{ pagePlanItem: { position: "asc" } }, { version: "desc" }],
  });
  const latest = new Map<string, PreparedDraftRecord>();
  for (const record of records) {
    if (!latest.has(record.pagePlanItemId)) latest.set(record.pagePlanItemId, record);
  }
  return [...latest.values()].map(serialize);
}

export async function prepareProjectDrafts(
  userId: string,
  projectId: string,
): Promise<PreparedDraftSummary[]> {
  const project = await getMigrationProject(userId, projectId);
  const [planRecords, matches] = await Promise.all([
    prisma.pagePlanItem.findMany({
      where: { migrationProjectId: projectId },
      orderBy: { position: "asc" },
      include: {
        layoutRevision: true,
        preparedDrafts: { orderBy: { version: "desc" }, take: 1 },
      },
    }),
    listContentMatches(userId, projectId),
  ]);
  if (planRecords.length === 0) throw new Error("Add pages to the Page Plan first.");
  if (matches.some((match) => match.status === "check")) {
    throw new Error("Confirm every page marked Check match before preparing drafts.");
  }
  if (matches.length !== planRecords.length) {
    throw new Error("Match content to every planned page before preparing drafts.");
  }

  const sourcePages = parseMigrationSourcePages(project.sourcePages);
  const sourceById = new Map(sourcePages.map((page) => [page.id, page]));
  const assets = parseMigrationAssets(project.assets);
  const workspace = parseMigrationWizardWorkspace(project.wizardWorkspace);
  const pagePlan = planRecords as PagePlanItemInput[];
  const results: Array<{
    result: PreparedDraftResult;
    latest?: PreparedDraftRecord;
  }> = [];

  for (const page of planRecords) {
    const match = matches.find((item) => item.pagePlanItemId === page.id);
    if (!match) throw new Error(`Match content for ${page.pageName} before preparing drafts.`);
    const result = preparePageDraft({
      page: page as PagePlanItemInput,
      match,
      sourcePage: match.sourcePageId ? sourceById.get(match.sourcePageId) : undefined,
      layoutRevision: page.layoutRevision,
      pagePlan,
      matches,
      sourcePages,
      assets,
      workspace,
    });
    results.push({ result, latest: page.preparedDrafts[0] });
  }

  await prisma.$transaction(async (tx) => {
    for (const { result, latest } of results) {
      if (latest?.contentChecksum !== result.contentChecksum) {
        await tx.preparedDraft.create({
          data: {
            pagePlanItemId: result.pagePlanItemId,
            layoutRevisionId: result.layoutRevisionId,
            version: (latest?.version ?? 0) + 1,
            sourcePageId: result.sourcePageId,
            sourceContentRevision: result.sourceContentRevision,
            contentChecksum: result.contentChecksum,
            artifact: toJson(result.artifact),
            notes: toJson(result.notes),
            residueReport: toJson(result.residueReport),
            status: result.status,
            adapterId: result.adapterId,
            adapterVersion: result.adapterVersion,
          },
        });
      }
      await tx.pagePlanItem.update({
        where: { id: result.pagePlanItemId },
        data: {
          status: result.status === "ready" ? "ready" : "needs_attention",
        },
      });
    }
    await tx.migrationProject.update({
      where: { id: projectId },
      data: {
        stage: "prepare",
        status: "active",
        lastError:
          results.some(({ result }) => result.status === "needs_attention")
            ? "One or more prepared drafts need attention."
            : null,
      },
    });
  });

  await audit(userId, "migration.drafts.prepare", project.clientId, {
    migrationProjectId: projectId,
    pages: results.length,
    ready: results.filter(({ result }) => result.status === "ready").length,
    needsAttention: results.filter(({ result }) => result.status === "needs_attention").length,
  });
  return listPreparedDrafts(userId, projectId);
}

function serialize(record: PreparedDraftRecord): PreparedDraftSummary {
  return {
    id: record.id,
    pagePlanItemId: record.pagePlanItemId,
    layoutRevisionId: record.layoutRevisionId,
    version: record.version,
    sourcePageId: record.sourcePageId ?? undefined,
    sourceContentRevision: record.sourceContentRevision ?? undefined,
    contentChecksum: record.contentChecksum,
    notes: parseStrings(record.notes),
    residueReport: parseStrings(record.residueReport),
    status: record.status as PreparedDraftStatus,
    adapterId: record.adapterId,
    adapterVersion: record.adapterVersion,
    createdAt: record.createdAt.toISOString(),
  };
}

function parseStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
