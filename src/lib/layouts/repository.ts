import "server-only";
import type { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { TemplateAnalysis } from "@/lib/template-import/types";
import { SANITIZER_VERSION, sanitizeLayoutTemplate } from "./sanitize";
import { buildLayoutPreview } from "./preview";
import type {
  LayoutCategory,
  LayoutLibraryItem,
  LayoutPreviewDocument,
  LayoutThumbnail,
} from "./types";
import { layoutDisplayName } from "./naming";

export const LAYOUT_ANALYZER_VERSION = "1";

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseThumbnail(value: Prisma.JsonValue): LayoutThumbnail {
  const fallback: LayoutThumbnail = {
    sectionCount: 0,
    headingSlots: 0,
    bodySlots: 0,
    imageSlots: 0,
    buttonSlots: 0,
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const input = value as Record<string, unknown>;
  const number = (key: keyof LayoutThumbnail) =>
    typeof input[key] === "number" ? input[key] : 0;
  return {
    sectionCount: number("sectionCount"),
    headingSlots: number("headingSlots"),
    bodySlots: number("bodySlots"),
    imageSlots: number("imageSlots"),
    buttonSlots: number("buttonSlots"),
  };
}

function serializeLayout(layout: {
  id: string;
  friendlyName: string;
  category: string;
  status: string;
  activeRevisionId: string | null;
  thumbnail: Prisma.JsonValue;
  structuralSummary: string;
  createdAt: Date;
  updatedAt: Date;
  activeRevision: { version: number } | null;
}): LayoutLibraryItem {
  return {
    id: layout.id,
    friendlyName: layoutDisplayName({
      friendlyName: layout.friendlyName,
      category: layout.category as LayoutCategory,
    }),
    category: layout.category as LayoutCategory,
    status: layout.status as LayoutLibraryItem["status"],
    activeRevisionId: layout.activeRevisionId,
    thumbnail: parseThumbnail(layout.thumbnail),
    structuralSummary: layout.structuralSummary,
    revisionVersion: layout.activeRevision?.version ?? null,
    createdAt: layout.createdAt.toISOString(),
    updatedAt: layout.updatedAt.toISOString(),
  };
}

const libraryInclude = {
  activeRevision: { select: { version: true } },
} satisfies Prisma.LayoutTemplateInclude;

export async function listLayoutTemplates(userId: string): Promise<LayoutLibraryItem[]> {
  const layouts = await prisma.layoutTemplate.findMany({
    where: { createdBy: userId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: libraryInclude,
  });
  return layouts.map(serializeLayout);
}

export async function listReadyLayouts(userId: string): Promise<LayoutLibraryItem[]> {
  const layouts = await prisma.layoutTemplate.findMany({
    where: { createdBy: userId, status: "ready" },
    orderBy: [{ category: "asc" }, { friendlyName: "asc" }],
    include: libraryInclude,
  });
  return layouts.map(serializeLayout);
}

export async function getLayoutTemplate(userId: string, layoutId: string) {
  const layout = await prisma.layoutTemplate.findFirst({
    where: { id: layoutId, createdBy: userId },
    include: { activeRevision: true },
  });
  if (!layout) throw new Error("Layout not found.");
  return layout;
}

export async function getLayoutPreview(
  userId: string,
  layoutId: string,
): Promise<LayoutPreviewDocument> {
  const layout = await prisma.layoutTemplate.findFirst({
    where: { id: layoutId, createdBy: userId },
    select: {
      thumbnail: true,
      activeRevision: {
        select: { sanitizedArtifact: true, semanticSlots: true },
      },
    },
  });
  if (!layout) throw new Error("Layout not found.");
  return buildLayoutPreview({
    artifact: layout.activeRevision?.sanitizedArtifact,
    semanticSlots: layout.activeRevision?.semanticSlots,
    fallback: parseThumbnail(layout.thumbnail),
  });
}

export async function createLayoutTemplate(input: {
  userId: string;
  friendlyName: string;
  category: LayoutCategory;
  fileName: string;
  checksum: string;
  document: unknown;
  analysis: TemplateAnalysis;
}): Promise<LayoutLibraryItem> {
  const sanitized = sanitizeLayoutTemplate({
    analysis: input.analysis,
    document: input.document,
    fileName: input.fileName,
  });

  const layout = await prisma.$transaction(async (tx) => {
    const created = await tx.layoutTemplate.create({
      data: {
        friendlyName: input.friendlyName,
        category: input.category,
        status: sanitized.status,
        thumbnail: toInputJson(sanitized.thumbnail),
        structuralSummary: sanitized.structuralSummary,
        createdBy: input.userId,
      },
    });
    const revision = await tx.layoutRevision.create({
      data: {
        layoutTemplateId: created.id,
        version: 1,
        sourceChecksum: input.checksum,
        originalFilename: input.fileName,
        analyzerVersion: LAYOUT_ANALYZER_VERSION,
        sanitizerVersion: SANITIZER_VERSION,
        status: sanitized.status,
        sanitizedArtifact: toInputJson(sanitized.artifact),
        semanticSlots: toInputJson(sanitized.semanticSlots),
        technicalFindings: toInputJson(input.analysis),
        sanitationReport: toInputJson(sanitized.report),
        identityFingerprints: toInputJson(sanitized.identityFingerprints),
      },
    });
    return tx.layoutTemplate.update({
      where: { id: created.id },
      data: { activeRevisionId: revision.id },
      include: libraryInclude,
    });
  });

  await audit(input.userId, "layout.create", null, {
    layoutTemplateId: layout.id,
    layoutRevisionId: layout.activeRevisionId ?? undefined,
    category: layout.category,
    status: layout.status,
    checksum: input.checksum,
  });
  return serializeLayout(layout);
}
