import { createHash } from "node:crypto";
import type { FirecrawlPage } from "@/lib/firecrawl/types";
import type {
  MigrationCleanupResult,
  MigrationSourcePage,
  SourcePageClassification,
} from "./types";

const SKIP_PATH_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\/(category|categories|tag|tags|author)(\/|$)/i,
    reason: "taxonomy archive",
  },
  {
    pattern: /\/(sitemap|robots|feed|rss|amp)(\/|$|\.)/i,
    reason: "technical page",
  },
  {
    pattern:
      /\/(privacy(?:-policy)?|terms(?:-of-(?:use|service))?|tos|legal|accessibility|disclaimer|cookie(?:-policy)?)(\/|$)/i,
    reason: "policy page",
  },
  { pattern: /\/(search|404)(\/|$)/i, reason: "utility page" },
  { pattern: /\/page\/\d+(\/|$)/i, reason: "pagination page" },
  { pattern: /\/wp-(admin|content|json)(\/|$)/i, reason: "WordPress system URL" },
  { pattern: /\.(pdf|jpe?g|png|gif|webp|svg|xml)$/i, reason: "file URL" },
];

const BLOG_INDEX_PATH = /^\/(blog|blogs|news|articles?|resources?)\/?$/i;
const BLOG_POST_PATH =
  /\/(blog|blogs|news|articles?|posts?|resources?)\/.+|\/\d{4}\/\d{1,2}\/.+/i;

const NOISE_LINE_PATTERNS = [
  /^skip to (main )?content$/i,
  /^(open|close) (main )?menu$/i,
  /^(menu|navigation|search)$/i,
  /^(accept|reject|manage) (all )?cookies?$/i,
  /^cookie (settings|preferences|policy)$/i,
  /^all rights reserved\.?$/i,
  /^©\s*\d{4}.*$/i,
  /^(facebook|instagram|linkedin|youtube|x|twitter)$/i,
];

const DUPLICATE_SECTION_HEADINGS =
  /^(#{1,6})\s+(contact form|request an appointment|book an appointment|get in touch)$/i;

interface CleanMarkdownResult {
  markdown: string;
  removedNoiseLines: number;
  removedDuplicateSections: number;
}

export function cleanAndClassifyPages(
  pages: FirecrawlPage[],
): MigrationCleanupResult {
  const seenUrls = new Set<string>();
  const seenChecksums = new Set<string>();
  const sourcePages: MigrationSourcePage[] = [];
  let duplicates = 0;
  let removedNoiseLines = 0;
  let removedDuplicateSections = 0;

  for (const page of pages) {
    const normalizedUrl = normalizeSourceUrl(page.url);
    const rawMarkdown = normalizeNewlines(page.markdown).trim();
    const checksum = sha256(rawMarkdown);

    if (
      !normalizedUrl ||
      seenUrls.has(normalizedUrl) ||
      (rawMarkdown && seenChecksums.has(checksum))
    ) {
      duplicates += 1;
      continue;
    }

    seenUrls.add(normalizedUrl);
    if (rawMarkdown) seenChecksums.add(checksum);

    const cleaned = cleanMarkdown(rawMarkdown);
    removedNoiseLines += cleaned.removedNoiseLines;
    removedDuplicateSections += cleaned.removedDuplicateSections;
    const classification = classifyPage(
      normalizedUrl,
      page.metadata,
      cleaned.markdown,
    );

    sourcePages.push({
      id: sha256(`${normalizedUrl}\n${checksum}`).slice(0, 20),
      sourceUrl: page.url,
      normalizedUrl,
      title: sourceTitle(page, normalizedUrl),
      sourceChecksum: checksum,
      rawMarkdown,
      cleanedMarkdown: cleaned.markdown,
      approvedMarkdown: cleaned.markdown,
      contentRevision: 1,
      classification: classification.kind,
      classificationReason: classification.reason,
      included: classification.kind !== "skipped",
      reviewed: false,
      metadata: page.metadata,
    });
  }

  const corePages = sourcePages.filter(
    (page) => page.classification === "core-page",
  );
  const blogPosts = sourcePages.filter(
    (page) => page.classification === "blog-post",
  );
  const blogIndexes = sourcePages.filter(
    (page) => page.classification === "blog-index",
  );
  const skipped = sourcePages.filter(
    (page) => page.classification === "skipped",
  );

  return {
    sourcePages,
    corePages,
    blogPosts,
    blogIndexes,
    skipped,
    report: {
      input: pages.length,
      unique: sourcePages.length,
      duplicates,
      corePages: corePages.length,
      blogPosts: blogPosts.length,
      blogIndexes: blogIndexes.length,
      skipped: skipped.length,
      removedNoiseLines,
      removedDuplicateSections,
    },
  };
}

export function cleanMarkdown(markdown: string): CleanMarkdownResult {
  const lines = normalizeNewlines(markdown).split("\n");
  const cleanedLines: string[] = [];
  let removedNoiseLines = 0;

  for (const line of lines) {
    const normalized = line
      .replace(/^[-*+]\s+/, "")
      .replace(/^\[([^\]]+)\]\([^\)]+\)$/, "$1")
      .trim();
    if (
      normalized.length <= 120 &&
      NOISE_LINE_PATTERNS.some((pattern) => pattern.test(normalized))
    ) {
      removedNoiseLines += 1;
      continue;
    }
    if (
      cleanedLines.length > 0 &&
      line.trim() &&
      cleanedLines[cleanedLines.length - 1].trim() === line.trim()
    ) {
      removedNoiseLines += 1;
      continue;
    }
    cleanedLines.push(line.replace(/[ \t]+$/g, ""));
  }

  const deduped = removeDuplicateFormSections(cleanedLines);
  return {
    markdown: deduped.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    removedNoiseLines,
    removedDuplicateSections: deduped.removed,
  };
}

export function normalizeSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

function classifyPage(
  normalizedUrl: string,
  metadata: Record<string, unknown>,
  markdown: string,
): { kind: SourcePageClassification; reason: string } {
  if (!normalizedUrl) return { kind: "skipped", reason: "invalid URL" };
  if (!markdown.trim()) return { kind: "skipped", reason: "empty content" };

  const url = new URL(normalizedUrl);
  if (url.search) return { kind: "skipped", reason: "query URL" };
  for (const candidate of SKIP_PATH_PATTERNS) {
    if (candidate.pattern.test(url.pathname)) {
      return { kind: "skipped", reason: candidate.reason };
    }
  }

  if (hasArticleMetadata(metadata)) {
    return { kind: "blog-post", reason: "article metadata" };
  }
  if (BLOG_INDEX_PATH.test(url.pathname)) {
    return { kind: "blog-index", reason: "editorial listing path" };
  }
  if (BLOG_POST_PATH.test(url.pathname)) {
    return { kind: "blog-post", reason: "editorial content path" };
  }
  if (/^date:\s*\d{4}-\d{2}-\d{2}$/im.test(markdown.slice(0, 1200))) {
    return { kind: "blog-post", reason: "published date in source content" };
  }
  return { kind: "core-page", reason: "site content page" };
}

function hasArticleMetadata(metadata: Record<string, unknown>): boolean {
  const entries = flattenMetadata(metadata);
  return entries.some(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    const normalizedValue = String(value).toLowerCase();
    return (
      ((normalizedKey.includes("type") || normalizedKey.includes("schema")) &&
        /article|blogposting|newsarticle/.test(normalizedValue)) ||
      /published(time|date)|datepublished/.test(normalizedKey)
    );
  });
}

function flattenMetadata(
  value: Record<string, unknown>,
  prefix = "",
): Array<[string, string | number | boolean]> {
  const entries: Array<[string, string | number | boolean]> = [];
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      entries.push([path, item]);
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      entries.push(...flattenMetadata(item as Record<string, unknown>, path));
    }
  }
  return entries;
}

function sourceTitle(page: FirecrawlPage, normalizedUrl: string): string {
  if (typeof page.metadata.title === "string" && page.metadata.title.trim()) {
    return page.metadata.title.trim();
  }
  const heading = page.markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  const slug = new URL(normalizedUrl).pathname.split("/").filter(Boolean).pop();
  if (!slug) return "Homepage";
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function removeDuplicateFormSections(lines: string[]): {
  lines: string[];
  removed: number;
} {
  const output: string[] = [];
  const seen = new Set<string>();
  let removed = 0;
  let index = 0;

  while (index < lines.length) {
    const heading = lines[index];
    if (!DUPLICATE_SECTION_HEADINGS.test(heading.trim())) {
      output.push(heading);
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < lines.length && !/^#{1,6}\s+/.test(lines[end])) end += 1;
    const section = lines.slice(index, end);
    const fingerprint = sha256(
      section.map((line) => line.trim().toLowerCase()).join("\n"),
    );
    if (seen.has(fingerprint)) {
      removed += 1;
    } else {
      seen.add(fingerprint);
      output.push(...section);
    }
    index = end;
  }

  return { lines: output, removed };
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
