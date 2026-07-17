import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import type { FirecrawlPage } from "@/lib/firecrawl/types";
import type { TemplateCompileBundle } from "@/lib/template-import/types";
import { cleanAndClassifyPages } from "./cleanup";
import { buildMediaInventory } from "./media/inventory";
import {
  MIGRATION_PROJECT_SCHEMA_VERSION,
  type MigrationAsset,
  type MigrationBlogDraft,
  type MigrationSourcePage,
  type MigrationResolution,
} from "./types";
import type { MigrationDeploymentRecord } from "./deploy/types";
import type { TemplateContentMapping } from "./content/types";

export interface CreateMigrationProjectInput {
  name: string;
  sourceUrl?: string;
  clientId?: string;
  crawlJobId?: string;
}

interface MigrationProjectRecord {
  id: string;
  crawlJobId: string | null;
  clientId: string | null;
  name: string;
  sourceUrl: string | null;
  status: string;
  stage: string;
  schemaVersion: number;
  sourcePages: Prisma.JsonValue;
  cleanedPages: Prisma.JsonValue;
  blogPosts: Prisma.JsonValue;
  blogDrafts: Prisma.JsonValue;
  assets: Prisma.JsonValue;
  selectedTemplates: Prisma.JsonValue;
  mappings: Prisma.JsonValue;
  resolutions: Prisma.JsonValue;
  deployment: Prisma.JsonValue;
  lastError: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type MigrationProjectSummary = Pick<
  MigrationProjectRecord,
  | "id"
  | "crawlJobId"
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
      crawlJobId: input.crawlJobId,
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
      crawlJobId: true,
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

export async function getMigrationProjectByCrawlJob(
  userId: string,
  crawlJobId: string,
) {
  return migrationProjects.findFirst({
    where: { crawlJobId, createdBy: userId },
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

export async function inventoryMigrationMedia(userId: string, projectId: string) {
  const existing = await getMigrationProject(userId, projectId);
  const pages = parseJsonArray<MigrationSourcePage>(existing.sourcePages);
  const assets = buildMediaInventory(pages);
  const project = await migrationProjects.update({
    where: { id: existing.id },
    data: { stage: "media", assets: toInputJson(assets), lastError: null },
  });
  await audit(userId, "migration.media.inventory", existing.clientId, {
    migrationProjectId: existing.id,
    assets: assets.length,
    needsReview: assets.filter((asset) => asset.status === "review").length,
  });
  return { project, assets };
}

export async function saveMigrationAssets(
  userId: string,
  projectId: string,
  assets: MigrationAsset[],
  action = "migration.media.review",
) {
  const existing = await getMigrationProject(userId, projectId);
  const project = await migrationProjects.update({
    where: { id: existing.id },
    data: { stage: "media", assets: toInputJson(assets) },
  });
  await audit(userId, action, existing.clientId, {
    migrationProjectId: existing.id,
    assets: assets.length,
    uploaded: assets.filter((asset) => asset.status === "uploaded").length,
  });
  return project;
}

export function parseMigrationAssets(value: Prisma.JsonValue): MigrationAsset[] {
  return parseJsonArray<MigrationAsset>(value);
}

export function parseMigrationBlogDrafts(
  value: Prisma.JsonValue,
): MigrationBlogDraft[] {
  return parseJsonArray<MigrationBlogDraft>(value);
}

export function parseMigrationSourcePages(
  value: Prisma.JsonValue,
): MigrationSourcePage[] {
  return parseJsonArray<MigrationSourcePage>(value);
}

export async function saveMigrationBlogDrafts(
  userId: string,
  projectId: string,
  drafts: MigrationBlogDraft[],
  action = "migration.blogs.prepare",
) {
  const existing = await getMigrationProject(userId, projectId);
  const project = await migrationProjects.update({
    where: { id: existing.id },
    data: { stage: "blogs", blogDrafts: toInputJson(drafts), lastError: null },
  });
  await audit(userId, action, existing.clientId, {
    migrationProjectId: existing.id,
    posts: drafts.length,
    migrated: drafts.filter((draft) => draft.status === "migrated").length,
    failed: drafts.filter((draft) => draft.status === "failed").length,
  });
  return project;
}

export async function saveMigrationDeploymentPlan(
  userId: string,
  projectId: string,
  bundle: TemplateCompileBundle,
  resolutions: MigrationResolution[],
  contentMappings: TemplateContentMapping[],
  deployment: MigrationDeploymentRecord,
  clientId?: string,
) {
  const existing = await getMigrationProject(userId, projectId);
  const project = await migrationProjects.update({
    where: { id: existing.id },
    data: {
      ...(clientId ? { clientId } : {}),
      status: deployment.status === "ready" ? "ready" : "active",
      stage: "deploy",
      selectedTemplates: toInputJson(bundle),
      mappings: toInputJson(contentMappings),
      resolutions: toInputJson(resolutions),
      deployment: toInputJson(deployment),
      lastError:
        deployment.blockers.length > 0
          ? deployment.blockers.join(" ").slice(0, 10_000)
          : null,
    },
  });
  await audit(userId, "migration.deploy.prepare", clientId ?? existing.clientId, {
    migrationProjectId: existing.id,
    pages: deployment.items.length,
    ready: deployment.status === "ready",
    blockers: deployment.blockers.length,
  });
  return project;
}

export async function saveMigrationDeploymentRecord(
  userId: string,
  projectId: string,
  deployment: MigrationDeploymentRecord,
  action: string,
) {
  const existing = await getMigrationProject(userId, projectId);
  const projectStatus =
    deployment.status === "complete"
      ? "complete"
      : deployment.status === "failed"
        ? "failed"
        : deployment.status === "ready"
          ? "ready"
          : "deploying";
  const project = await migrationProjects.update({
    where: { id: existing.id },
    data: {
      status: projectStatus,
      stage: deployment.status === "complete" ? "complete" : "deploy",
      deployment: toInputJson(deployment),
      lastError:
        deployment.status === "failed" || deployment.status === "partial"
          ? deployment.items
              .flatMap((item) => (item.error ? [item.error] : []))
              .join(" ")
              .slice(0, 10_000) || null
          : null,
    },
  });
  await audit(userId, action, existing.clientId, {
    migrationProjectId: existing.id,
    buildId: deployment.buildId,
    status: deployment.status,
    drafts: deployment.items.filter((item) => item.status === "draft").length,
    failed: deployment.items.filter((item) => item.status === "failed").length,
  });
  return project;
}

export function parseMigrationCompileBundle(
  value: Prisma.JsonValue,
): TemplateCompileBundle | undefined {
  return isJsonObject(value) ? (value as unknown as TemplateCompileBundle) : undefined;
}

export function parseMigrationResolutions(
  value: Prisma.JsonValue,
): MigrationResolution[] {
  return parseJsonArray<MigrationResolution>(value);
}

export function parseMigrationContentMappings(
  value: Prisma.JsonValue,
): TemplateContentMapping[] {
  return parseJsonArray<TemplateContentMapping>(value);
}

export function parseMigrationDeployment(
  value: Prisma.JsonValue,
): MigrationDeploymentRecord | undefined {
  return isJsonObject(value)
    ? (value as unknown as MigrationDeploymentRecord)
    : undefined;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseJsonArray<T>(value: Prisma.JsonValue): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
