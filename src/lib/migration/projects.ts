import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import type { FirecrawlPage } from "@/lib/firecrawl/types";
import { cleanAndClassifyPages } from "./cleanup";
import { MIGRATION_PROJECT_SCHEMA_VERSION } from "./types";

export interface CreateMigrationProjectInput {
  name: string;
  sourceUrl?: string;
  clientId?: string;
}

interface MigrationProjectRecord {
  id: string;
  clientId: string | null;
  name: string;
  sourceUrl: string | null;
  status: string;
  stage: string;
  schemaVersion: number;
  sourcePages: Prisma.JsonValue;
  cleanedPages: Prisma.JsonValue;
  blogPosts: Prisma.JsonValue;
  assets: Prisma.JsonValue;
  selectedTemplates: Prisma.JsonValue;
  mappings: Prisma.JsonValue;
  resolutions: Prisma.JsonValue;
  lastError: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type MigrationProjectSummary = Pick<
  MigrationProjectRecord,
  | "id"
  | "clientId"
  | "name"
  | "sourceUrl"
  | "status"
  | "stage"
  | "schemaVersion"
  | "lastError"
  | "createdAt"
  | "updatedAt"
>;

interface MigrationProjectDelegate {
  create(args: unknown): Promise<MigrationProjectRecord>;
  findMany(args: unknown): Promise<MigrationProjectSummary[]>;
  findFirst(args: unknown): Promise<MigrationProjectRecord | null>;
  update(args: unknown): Promise<MigrationProjectRecord>;
}

// The checked-in schema owns this delegate. This structural bridge lets local
// type-checking continue before an environment regenerates its Prisma client.
const migrationProjects = (
  prisma as unknown as { migrationProject: MigrationProjectDelegate }
).migrationProject;

export async function createMigrationProject(
  userId: string,
  input: CreateMigrationProjectInput,
) {
  if (input.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      select: { id: true, createdBy: true },
    });
    if (!client || client.createdBy !== userId) {
      throw new Error("The selected client does not exist.");
    }
  }

  const project = await migrationProjects.create({
    data: {
      name: input.name,
      sourceUrl: input.sourceUrl,
      clientId: input.clientId,
      schemaVersion: MIGRATION_PROJECT_SCHEMA_VERSION,
      createdBy: userId,
    },
  });
  await audit(userId, "migration.project.create", input.clientId, {
    migrationProjectId: project.id,
    sourceUrl: project.sourceUrl ?? undefined,
  });
  return project;
}

export async function listMigrationProjects(userId: string) {
  return migrationProjects.findMany({
    where: { createdBy: userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      clientId: true,
      name: true,
      sourceUrl: true,
      status: true,
      stage: true,
      schemaVersion: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getMigrationProject(userId: string, projectId: string) {
  const project = await migrationProjects.findFirst({
    where: { id: projectId, createdBy: userId },
  });
  if (!project) throw new Error("Migration project not found.");
  return project;
}

export async function ingestMigrationSource(
  userId: string,
  projectId: string,
  pages: FirecrawlPage[],
) {
  const existing = await getMigrationProject(userId, projectId);
  const result = cleanAndClassifyPages(pages);
  const project = await migrationProjects.update({
    where: { id: existing.id },
    data: {
      status: "active",
      stage: "cleanup",
      sourcePages: toInputJson(result.sourcePages),
      cleanedPages: toInputJson([...result.corePages, ...result.blogIndexes]),
      blogPosts: toInputJson(result.blogPosts),
      lastError: null,
    },
  });
  await audit(userId, "migration.source.ingest", existing.clientId, {
    migrationProjectId: existing.id,
    report: toInputJson(result.report),
  });
  return { project, report: result.report };
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
