import "server-only";
import type { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  getMigrationProject,
  parseMigrationSourcePages,
} from "@/lib/migration/projects";
import type { PagePlanItemInput } from "@/lib/page-plan/types";
import { findSourceByCandidatePath, matchPagePlanToSource } from "./matcher";
import type {
  ContentMatchCandidate,
  ContentMatchResult,
  ContentMatchStatus,
  PersistedContentMatch,
} from "./types";

type ContentMatchRecord = {
  id: string;
  pagePlanItemId: string;
  sourcePageId: string | null;
  score: number;
  signals: Prisma.JsonValue;
  candidates: Prisma.JsonValue;
  status: string;
  confirmedByUser: boolean;
  normalizedContentRevision: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listContentMatches(
  userId: string,
  projectId: string,
): Promise<PersistedContentMatch[]> {
  await getMigrationProject(userId, projectId);
  const records = await prisma.contentMatch.findMany({
    where: { pagePlanItem: { migrationProjectId: projectId } },
    orderBy: { pagePlanItem: { position: "asc" } },
  });
  return records.map(serialize);
}

export async function rebuildContentMatches(
  userId: string,
  projectId: string,
): Promise<PersistedContentMatch[]> {
  const project = await getMigrationProject(userId, projectId);
  const [planRecords, existing] = await Promise.all([
    prisma.pagePlanItem.findMany({
      where: { migrationProjectId: projectId },
      orderBy: { position: "asc" },
    }),
    prisma.contentMatch.findMany({
      where: { pagePlanItem: { migrationProjectId: projectId } },
    }),
  ]);
  if (planRecords.length === 0) {
    throw new Error("Add pages to the Page Plan before importing content.");
  }
  const pages = parseMigrationSourcePages(project.sourcePages);
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const existingByPlan = new Map(existing.map((match) => [match.pagePlanItemId, match]));
  const history = Object.fromEntries(
    existing.map((match) => [match.pagePlanItemId, match.sourcePageId ?? undefined]),
  );
  const computed = matchPagePlanToSource(
    planRecords as PagePlanItemInput[],
    pages,
    history,
  );

  const results = computed.map((result) => {
    const previous = existingByPlan.get(result.pagePlanItemId);
    if (!previous?.confirmedByUser) return result;
    if (!previous.sourcePageId) {
      return {
        ...result,
        sourcePageId: undefined,
        score: 0,
        signals: ["Create an empty draft was confirmed"],
        status: "empty" as const,
        confirmedByUser: true,
        normalizedContentRevision: undefined,
      };
    }
    const previousCandidate = parseCandidates(previous.candidates).find(
      (candidate) => candidate.sourcePageId === previous.sourcePageId,
    );
    const source =
      pageById.get(previous.sourcePageId) ??
      (previousCandidate
        ? findSourceByCandidatePath(pages, previousCandidate)
        : undefined);
    if (!source) return result;
    const confirmedCandidate = candidateForSource(source, previousCandidate?.score ?? previous.score);
    return {
      ...result,
      sourcePageId: source.id,
      score: previous.score,
      signals: ["Previously confirmed for this page"],
      candidates: result.candidates.some((candidate) => candidate.sourcePageId === source.id)
        ? result.candidates
        : [confirmedCandidate, ...result.candidates].slice(0, 5),
      status: "matched" as const,
      confirmedByUser: true,
      normalizedContentRevision: source.contentRevision,
    };
  });

  await prisma.$transaction(async (tx) => {
    for (const result of results) {
      await tx.contentMatch.upsert({
        where: { pagePlanItemId: result.pagePlanItemId },
        create: toCreate(result),
        update: toUpdate(result),
      });
      await tx.pagePlanItem.update({
        where: { id: result.pagePlanItemId },
        data: { status: result.status },
      });
    }
    await tx.migrationProject.update({
      where: { id: projectId },
      data: { stage: "cleanup", status: "active", lastError: null },
    });
  });

  await audit(userId, "migration.content-match.rebuild", project.clientId, {
    migrationProjectId: projectId,
    pages: results.length,
    matched: results.filter((result) => result.status === "matched").length,
    check: results.filter((result) => result.status === "check").length,
    empty: results.filter((result) => result.status === "empty").length,
  });
  return listContentMatches(userId, projectId);
}

export async function confirmContentMatch(
  userId: string,
  projectId: string,
  input: { pagePlanItemId: string; sourcePageId?: string },
): Promise<PersistedContentMatch[]> {
  const project = await getMigrationProject(userId, projectId);
  const item = await prisma.pagePlanItem.findFirst({
    where: { id: input.pagePlanItemId, migrationProjectId: projectId },
  });
  if (!item) throw new Error("The planned page does not exist.");
  const pages = parseMigrationSourcePages(project.sourcePages);
  const source = input.sourcePageId
    ? pages.find(
        (page) =>
          page.id === input.sourcePageId &&
          page.included &&
          page.classification !== "skipped" &&
          page.classification !== "blog-post",
      )
    : undefined;
  if (input.sourcePageId && !source) {
    throw new Error("The selected source page is not available.");
  }
  if (!source && !item.emptyDraftAllowed) {
    throw new Error("Choose source content for this page.");
  }

  const current = await prisma.contentMatch.findUnique({
    where: { pagePlanItemId: item.id },
  });
  const candidates = parseCandidates(current?.candidates);
  if (source && !candidates.some((candidate) => candidate.sourcePageId === source.id)) {
    candidates.push(candidateForSource(source, 0));
  }
  const status: ContentMatchStatus = source ? "matched" : "empty";
  const result: ContentMatchResult = {
    pagePlanItemId: item.id,
    sourcePageId: source?.id,
    score: source
      ? candidates.find((candidate) => candidate.sourcePageId === source.id)?.score ?? 0
      : 0,
    signals: [source ? "Confirmed by user" : "Create an empty draft was confirmed"],
    candidates,
    status,
    confirmedByUser: true,
    normalizedContentRevision: source?.contentRevision,
  };
  await prisma.$transaction([
    prisma.contentMatch.upsert({
      where: { pagePlanItemId: item.id },
      create: toCreate(result),
      update: toUpdate(result),
    }),
    prisma.pagePlanItem.update({ where: { id: item.id }, data: { status } }),
  ]);
  await audit(userId, "migration.content-match.confirm", project.clientId, {
    migrationProjectId: projectId,
    pagePlanItemId: item.id,
    status,
  });
  return listContentMatches(userId, projectId);
}

function toCreate(result: ContentMatchResult) {
  return {
    pagePlanItemId: result.pagePlanItemId,
    sourcePageId: result.sourcePageId,
    score: result.score,
    signals: toJson(result.signals),
    candidates: toJson(result.candidates),
    status: result.status,
    confirmedByUser: result.confirmedByUser,
    normalizedContentRevision: result.normalizedContentRevision,
  };
}

function toUpdate(result: ContentMatchResult) {
  return {
    sourcePageId: result.sourcePageId ?? null,
    score: result.score,
    signals: toJson(result.signals),
    candidates: toJson(result.candidates),
    status: result.status,
    confirmedByUser: result.confirmedByUser,
    normalizedContentRevision: result.normalizedContentRevision ?? null,
  };
}

function serialize(record: ContentMatchRecord): PersistedContentMatch {
  return {
    id: record.id,
    pagePlanItemId: record.pagePlanItemId,
    sourcePageId: record.sourcePageId ?? undefined,
    score: record.score,
    signals: parseStrings(record.signals),
    candidates: parseCandidates(record.candidates),
    status: record.status as ContentMatchStatus,
    confirmedByUser: record.confirmedByUser,
    normalizedContentRevision: record.normalizedContentRevision ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function parseCandidates(value: Prisma.JsonValue | undefined): ContentMatchCandidate[] {
  return Array.isArray(value) ? (value as unknown as ContentMatchCandidate[]) : [];
}

function parseStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function cleanPath(value: string): string {
  try {
    return new URL(value).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
}

function candidateForSource(
  source: ReturnType<typeof parseMigrationSourcePages>[number],
  score: number,
): ContentMatchCandidate {
  return {
    sourcePageId: source.id,
    title: source.title,
    path: cleanPath(source.normalizedUrl || source.sourceUrl),
    preview: source.cleanedMarkdown
      .replace(/[#*_`>\[\]\(\)]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180),
    score,
    signals: ["Selected by user"],
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
