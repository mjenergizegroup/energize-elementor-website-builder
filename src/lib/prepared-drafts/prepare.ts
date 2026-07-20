import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { PersistedContentMatch } from "@/lib/content-matches/types";
import { scanPreparedLayoutResidue } from "@/lib/layouts/residue";
import type {
  LayoutIdentityFingerprint,
  LayoutSemanticSlot,
} from "@/lib/layouts/types";
import { convertTemplateToAtomic } from "@/lib/migration/content/registry";
import { cleanMarkdown } from "@/lib/migration/cleanup";
import { injectNormalizedContent } from "@/lib/migration/content/inject";
import {
  injectSanitizedElementorV3Content,
  isSanitizedElementorV3Artifact,
} from "@/lib/migration/content/inject-elementor-v3";
import { normalizePageContent } from "@/lib/migration/content/normalize";
import type {
  NormalizedContentSlot,
  NormalizedPageContent,
} from "@/lib/migration/content/types";
import type { AtomicElement } from "@/lib/elementor/atomic/types";
import type {
  MigrationAsset,
  MigrationSourcePage,
  MigrationWizardWorkspace,
} from "@/lib/migration/types";
import { pagePath, type PagePlanItemInput } from "@/lib/page-plan/types";
import type { PreparedDraftResult } from "./types";

export const DRAFT_PREPARER_VERSION = "3";

export interface PrepareDraftInput {
  page: PagePlanItemInput;
  match: PersistedContentMatch;
  sourcePage?: MigrationSourcePage;
  layoutRevision: {
    id: string;
    status: string;
    sanitizerVersion?: string;
    sanitizedArtifact: Prisma.JsonValue | Record<string, unknown>;
    semanticSlots: Prisma.JsonValue | LayoutSemanticSlot[];
    identityFingerprints: Prisma.JsonValue | LayoutIdentityFingerprint[];
  };
  pagePlan: PagePlanItemInput[];
  matches: PersistedContentMatch[];
  sourcePages: MigrationSourcePage[];
  assets: MigrationAsset[];
  workspace?: MigrationWizardWorkspace;
}

export function preparePageDraft(input: PrepareDraftInput): PreparedDraftResult {
  if (input.layoutRevision.status !== "ready") {
    throw new Error(`Choose another Ready layout for ${input.page.pageName}.`);
  }
  if (input.match.status === "check") {
    throw new Error(`Confirm the content match for ${input.page.pageName}.`);
  }
  if (input.match.status === "matched" && !input.sourcePage) {
    throw new Error(`The matched source content for ${input.page.pageName} is missing.`);
  }
  if (
    input.sourcePage &&
    input.match.normalizedContentRevision !== undefined &&
    input.match.normalizedContentRevision !== input.sourcePage.contentRevision
  ) {
    throw new Error(`The source content for ${input.page.pageName} changed. Match it again.`);
  }

  const notes: string[] = [];
  const normalized = input.sourcePage
    ? normalizeForDestination({ ...input, sourcePage: input.sourcePage }, notes)
    : emptyDestinationContent(input.page);
  const fingerprints = parseFingerprints(input.layoutRevision.identityFingerprints);
  const semanticSlots = parseSemanticSlots(input.layoutRevision.semanticSlots);
  const sanitizedArtifact = input.layoutRevision.sanitizedArtifact;
  const preserveElementorV3 = isSanitizedElementorV3Artifact(sanitizedArtifact);
  const sanitizerVersion = input.layoutRevision.sanitizerVersion ??
    artifactSanitizerVersion(sanitizedArtifact);
  if (
    preserveElementorV3 &&
    !supportsDesignPreservingSanitizer(sanitizerVersion)
  ) {
    throw new Error(
      `The selected layout for ${input.page.pageName} was prepared by an older layout engine and cannot preserve its design. Add the original JSON to Template Library again, then choose the new Ready layout.`,
    );
  }
  const converted = preserveElementorV3
    ? undefined
    : convertTemplateToAtomic(sanitizedArtifact);
  const sourceLayout = preserveElementorV3
    ? sanitizedContent(sanitizedArtifact)
    : converted?.elementorData ?? [];
  const residueBeforeFit = scanPreparedLayoutResidue(sourceLayout, fingerprints, {
    checkPlaceholders: false,
  });
  const injected = preserveElementorV3
    ? injectSanitizedElementorV3Content(sourceLayout, normalized, {
        semanticSlots,
        colors: input.workspace?.colors,
      })
    : injectNormalizedContent(sourceLayout as AtomicElement[], normalized, {
        semanticSlots,
        slotTargets: converted?.slotTargets,
      });
  const residueAfterFit = scanPreparedLayoutResidue(injected.elementorData, []);
  const residueReport = [...new Set([...residueBeforeFit, ...residueAfterFit])].sort();
  for (const item of converted?.reviewItems ?? []) notes.push(plainReviewNote(item.message));
  if (preserveElementorV3) {
    notes.push("The sanitized layout design was preserved in its original Elementor structure.");
  }
  if (!input.sourcePage) notes.push("Empty draft content was requested for this page.");
  if (injected.appended > 0) {
    notes.push("Extra source content was kept with its matching content section.");
  }
  if (injected.removedPlaceholders > 0) {
    notes.push("Unused layout placeholders were removed.");
  }

  const contentChecksum = checksum({
    preparerVersion: DRAFT_PREPARER_VERSION,
    page: {
      id: input.page.id,
      pageName: input.page.pageName,
      slug: input.page.slug,
      titleTag: input.page.titleTag,
      layoutRevisionId: input.page.layoutRevisionId,
    },
    sourceChecksum: input.sourcePage?.sourceChecksum,
    sourceRevision: input.sourcePage?.contentRevision,
    sanitizerVersion,
    match: {
      sourcePageId: input.match.sourcePageId,
      status: input.match.status,
      confirmedByUser: input.match.confirmedByUser,
    },
    normalized,
    assets: input.assets.map((asset) => ({
      id: asset.id,
      status: asset.status,
      destinationMediaId: asset.destinationMediaId,
      destinationUrl: asset.destinationUrl,
    })),
    workspace: input.workspace
      ? {
          name: input.workspace.name,
          phone: input.workspace.phone,
          email: input.workspace.email,
          bookingLink: input.workspace.bookingLink,
        }
      : undefined,
  });

  return {
    pagePlanItemId: input.page.id,
    layoutRevisionId: input.layoutRevision.id,
    sourcePageId: input.sourcePage?.id,
    sourceContentRevision: input.sourcePage?.contentRevision,
    contentChecksum,
    artifact: injected.elementorData,
    notes: [...new Set(notes)],
    residueReport,
    status:
      (converted?.deployable ?? true) && residueReport.length === 0
        ? "ready"
        : "needs_attention",
    adapterId: converted?.adapter.id ?? "elementor-v3-preserved",
    adapterVersion: converted?.adapter.version ?? "1",
    replacedSlots: injected.replaced,
    appendedSlots: injected.appended,
    removedPlaceholders: injected.removedPlaceholders,
  };
}

function supportsDesignPreservingSanitizer(version: string | undefined): boolean {
  if (!version) return false;
  const major = Number.parseInt(version, 10);
  return Number.isFinite(major) && major >= 2;
}

function artifactSanitizerVersion(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const sanitizer = (value as Record<string, unknown>).sanitizer;
  if (!sanitizer || typeof sanitizer !== "object" || Array.isArray(sanitizer)) {
    return undefined;
  }
  const version = (sanitizer as Record<string, unknown>).version;
  return typeof version === "string" ? version : undefined;
}

function sanitizedContent(value: unknown): unknown[] {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Array.isArray((value as Record<string, unknown>).content)
    ? (value as Record<string, unknown>).content as unknown[]
    : [];
}

function normalizeForDestination(
  input: PrepareDraftInput & { sourcePage: MigrationSourcePage },
  notes: string[],
): NormalizedPageContent {
  const approvedMarkdown =
    input.sourcePage.approvedMarkdown || input.sourcePage.cleanedMarkdown;
  const finalCleanup = cleanMarkdown(approvedMarkdown);
  if (finalCleanup.markdown !== approvedMarkdown.trim()) {
    notes.push("Repeated website controls and footer text were removed before fitting content.");
  }
  const rewrittenPage = {
    ...input.sourcePage,
    approvedMarkdown: rewriteMarkdownLinks(
      finalCleanup.markdown,
      (href, label) => rewriteLink(input, href, label, notes),
    ),
  };
  const normalized = normalizePageContent(rewrittenPage);
  const slots = mapMedia(normalized.slots, input, notes);
  const firstHeadingIndex = slots.findIndex((slot) => slot.kind === "heading");
  const titleHeading: NormalizedContentSlot = {
    id: `${input.page.id}-destination-title`,
    kind: "heading",
    text: input.page.pageName,
    level: 1,
  };
  if (firstHeadingIndex >= 0) slots[firstHeadingIndex] = titleHeading;
  else slots.unshift(titleHeading);
  return {
    ...normalized,
    title: input.page.pageName,
    slug: input.page.slug || "home",
    slots: removeDuplicateDestinationHeadings(slots, input.page.pageName),
  };
}

function emptyDestinationContent(page: PagePlanItemInput): NormalizedPageContent {
  return {
    schemaVersion: "1",
    sourcePageId: `empty:${page.id}`,
    title: page.pageName,
    slug: page.slug || "home",
    slots: [
      {
        id: `${page.id}-destination-title`,
        kind: "heading",
        text: page.pageName,
        level: 1,
      },
    ],
  };
}

function rewriteMarkdownLinks(
  markdown: string,
  rewrite: (href: string, label: string) => string | undefined,
): string {
  return markdown.replace(
    /(^|[^!])\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gm,
    (full, prefix: string, label: string, href: string) => {
      const destination = rewrite(href, label);
      return destination ? `${prefix}[${label}](${destination})` : `${prefix}${label}`;
    },
  );
}

function rewriteLink(
  input: PrepareDraftInput,
  href: string,
  label: string,
  notes: string[],
): string | undefined {
  const workspace = input.workspace;
  if (/^(?:book|request|schedule|appointment)/i.test(label.trim()) && workspace?.bookingLink) {
    return safeVisibleUrl(workspace.bookingLink);
  }
  if (/^mailto:/i.test(href)) return workspace?.email ? `mailto:${workspace.email}` : undefined;
  if (/^tel:/i.test(href)) {
    return workspace?.phone ? `tel:${workspace.phone.replace(/[^+\d]/g, "")}` : undefined;
  }
  let target: URL;
  try {
    target = new URL(href, input.sourcePage?.normalizedUrl);
  } catch {
    notes.push(`A link labeled ${label} was removed because its destination was invalid.`);
    return undefined;
  }
  if (!input.sourcePage) return safeVisibleUrl(target.toString());
  const sourceHost = new URL(input.sourcePage.normalizedUrl).hostname;
  if (target.hostname === sourceHost) {
    const targetPath = cleanPath(target.pathname);
    const targetSource = input.sourcePages.find(
      (page) => cleanPath(new URL(page.normalizedUrl).pathname) === targetPath,
    );
    const targetMatch = targetSource
      ? input.matches.find((match) => match.sourcePageId === targetSource.id)
      : undefined;
    const targetPlan = targetMatch
      ? input.pagePlan.find((page) => page.id === targetMatch.pagePlanItemId)
      : input.pagePlan.find((page) => cleanPath(pagePath(page.slug)) === targetPath);
    if (targetPlan) return pagePath(targetPlan.slug);
    notes.push(`The link labeled ${label} was removed because that page is not in the Page Plan.`);
    return undefined;
  }
  return safeVisibleUrl(target.toString());
}

function mapMedia(
  slots: NormalizedContentSlot[],
  input: PrepareDraftInput,
  notes: string[],
): NormalizedContentSlot[] {
  const result: NormalizedContentSlot[] = [];
  for (const slot of slots) {
    if (slot.kind !== "image") {
      result.push(slot);
      continue;
    }
    let sourceUrl: string;
    try {
      sourceUrl = new URL(slot.sourceUrl, input.sourcePage?.normalizedUrl).toString();
    } catch {
      notes.push("An invalid source image was omitted.");
      continue;
    }
    const asset = input.assets.find(
      (candidate) =>
        sameUrl(candidate.sourceUrl, sourceUrl) ||
        sameUrl(candidate.originalUrl, sourceUrl),
    );
    if (!asset?.destinationUrl || asset.status !== "uploaded") {
      notes.push("A source image needs to be added in WordPress.");
      continue;
    }
    result.push({
      ...slot,
      sourceUrl: asset.destinationUrl,
      altText: asset.altText || slot.altText,
    });
  }
  return result;
}

function removeDuplicateDestinationHeadings(
  slots: NormalizedContentSlot[],
  pageName: string,
): NormalizedContentSlot[] {
  let titleSeen = false;
  const normalizedTitle = textKey(pageName);
  return slots.filter((slot) => {
    if (slot.kind !== "heading" || textKey(slot.text) !== normalizedTitle) return true;
    if (!titleSeen) {
      titleSeen = true;
      return true;
    }
    return false;
  });
}

function safeVisibleUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password) return undefined;
    if (url.port && !["80", "443"].includes(url.port)) return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function sameUrl(left: string, right: string): boolean {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    leftUrl.hash = "";
    rightUrl.hash = "";
    return leftUrl.toString() === rightUrl.toString();
  } catch {
    return false;
  }
}

function cleanPath(value: string): string {
  const normalized = value.replace(/\/+$/, "");
  return normalized || "/";
}

function textKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseFingerprints(value: unknown): LayoutIdentityFingerprint[] {
  return Array.isArray(value) ? (value as LayoutIdentityFingerprint[]) : [];
}

function parseSemanticSlots(value: unknown): LayoutSemanticSlot[] {
  return Array.isArray(value) ? (value as LayoutSemanticSlot[]) : [];
}

function plainReviewNote(message: string): string {
  if (/dynamic/i.test(message)) return "A dynamic layout region needs setup in WordPress.";
  if (/widget|embed|shortcode/i.test(message)) return "An unsupported optional layout region was omitted.";
  return "A layout region needs attention before this draft can be created.";
}

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
