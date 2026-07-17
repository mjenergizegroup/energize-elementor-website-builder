import { createHash } from "node:crypto";
import type { MigrationAsset, MigrationSourcePage } from "../types";

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(([^\s\)]+)(?:\s+["'][^"']*["'])?\)/g;
const HTML_IMAGE = /<img\b[^>]*>/gi;
const SKIP_ASSET =
  /(?:favicon|spacer|tracking|pixel|transparent|placeholder|sprite|loading|spinner|icon[-_.]|[-_.]icon)(?:[-_.]|$)/i;
const SANITY_TRANSFORM_PARAMS = new Set([
  "rect",
  "w",
  "h",
  "width",
  "height",
  "fit",
  "crop",
  "auto",
  "q",
  "quality",
  "dpr",
]);

interface ImageReference {
  url: string;
  altText: string;
}

export function buildMediaInventory(
  pages: MigrationSourcePage[],
): MigrationAsset[] {
  const assets = new Map<string, MigrationAsset>();

  for (const page of pages.filter((item) => item.included)) {
    for (const reference of extractImageReferences(page.cleanedMarkdown)) {
      const sourceUrl = resolveImageUrl(reference.url, page.normalizedUrl);
      if (!sourceUrl) continue;
      const originalUrl = originalAssetUrl(sourceUrl);
      if (shouldSkipAsset(originalUrl, reference.altText)) continue;
      const key = canonicalAssetUrl(originalUrl);
      const current = assets.get(key);
      if (current) {
        if (!current.sourcePageIds.includes(page.id)) current.sourcePageIds.push(page.id);
        if (!current.discoveredAltText && reference.altText) {
          current.discoveredAltText = reference.altText;
          current.altText = reference.altText;
          current.title = reference.altText;
          current.filename = seoFilename(reference.altText, originalUrl);
        }
        continue;
      }
      const altText = cleanAltText(reference.altText);
      assets.set(key, {
        id: createHash("sha256").update(key).digest("hex").slice(0, 20),
        sourceUrl,
        originalUrl,
        sourcePageIds: [page.id],
        status: altText ? "ready" : "review",
        included: true,
        discoveredAltText: altText,
        altText,
        title: altText || titleFromUrl(originalUrl),
        filename: seoFilename(altText || titleFromUrl(originalUrl), originalUrl),
        attemptCount: 0,
      });
    }
  }

  return [...assets.values()].sort((a, b) => a.originalUrl.localeCompare(b.originalUrl));
}

export function originalAssetUrl(value: string): string {
  const url = new URL(value);
  if (/cdn\.sanity\.io$/i.test(url.hostname)) {
    for (const key of [...url.searchParams.keys()]) {
      if (SANITY_TRANSFORM_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
  }
  url.hash = "";
  return url.toString();
}

export function seoFilename(label: string, sourceUrl: string): string {
  const url = new URL(sourceUrl);
  const extension = safeExtension(url.pathname) || "jpg";
  const base = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "site-image";
  const suffix = createHash("sha256").update(canonicalAssetUrl(sourceUrl)).digest("hex").slice(0, 8);
  return `${base}-${suffix}.${extension}`;
}

function extractImageReferences(markdown: string): ImageReference[] {
  const references: ImageReference[] = [];
  for (const match of markdown.matchAll(MARKDOWN_IMAGE)) {
    references.push({ url: match[2], altText: cleanAltText(match[1]) });
  }
  for (const match of markdown.matchAll(HTML_IMAGE)) {
    const tag = match[0];
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1] ?? "";
    references.push({ url: src, altText: cleanAltText(alt) });
  }
  return references;
}

function resolveImageUrl(value: string, pageUrl: string): string {
  try {
    const url = new URL(value.replace(/^<|>$/g, ""), pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function canonicalAssetUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

function shouldSkipAsset(url: string, altText: string): boolean {
  const pathname = new URL(url).pathname;
  return SKIP_ASSET.test(pathname) || /^(icon|logo|spacer|tracking pixel)$/i.test(altText.trim());
}

function cleanAltText(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function titleFromUrl(value: string): string {
  const name = decodeURIComponent(new URL(value).pathname.split("/").pop() ?? "site image")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name || "Site image";
}

function safeExtension(pathname: string): string {
  const extension = pathname.split(".").pop()?.toLowerCase() ?? "";
  return /^(jpe?g|png|webp|gif|avif)$/.test(extension)
    ? extension === "jpeg" ? "jpg" : extension
    : "";
}
