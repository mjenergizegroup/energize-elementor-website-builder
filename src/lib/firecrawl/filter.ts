import type { FilteredPages, FirecrawlPage, PageEntry } from "./types";

const DROP_PATH_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\/(blog|blogs|news|post|posts|article)(\/|$)/i, reason: "editorial page" },
  { pattern: /\/(category|categories|tag|tags|author)(\/|$)/i, reason: "archive page" },
  { pattern: /\/(sitemap|robots|feed|rss|amp)(\/|$|\.)/i, reason: "technical page" },
  { pattern: /\/(privacy|terms|tos|legal|accessibility|disclaimer|cookie)(\/|$)/i, reason: "policy page" },
  { pattern: /\/(search|404)(\/|$)/i, reason: "utility page" },
  { pattern: /\/page\/\d+(\/|$)/i, reason: "pagination page" },
  { pattern: /\/wp-/i, reason: "WordPress system URL" },
  { pattern: /\/(wp-admin|wp-content|wp-json)(\/|$)/i, reason: "WordPress system URL" },
  { pattern: /\.(pdf|jpe?g|png|xml)$/i, reason: "file URL" },
];

export function filterPages(pages: FirecrawlPage[]): FilteredPages {
  const seen = new Set<string>();
  const keep: PageEntry[] = [];
  const skip: PageEntry[] = [];

  for (const page of pages) {
    const normalizedUrl = normalizePageUrl(page.url);
    if (!normalizedUrl || seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);

    const entry = toEntry({ ...page, url: normalizedUrl });
    const reason = skipReason(normalizedUrl);
    if (reason) {
      skip.push({ ...entry, recommended: false, skipReason: reason });
    } else {
      keep.push({ ...entry, recommended: true });
    }
  }

  keep.sort(sortByPriority);
  skip.sort(sortByPriority);
  return { keep, skip };
}

export function selectFilteredPages(
  filtered: FilteredPages,
  selectedUrls: string[],
): PageEntry[] {
  const selected = new Set(selectedUrls.map(normalizePageUrl).filter(Boolean));
  return [...filtered.keep, ...filtered.skip].filter((page) =>
    selected.has(normalizePageUrl(page.url)),
  );
}

export function normalizePageUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function toEntry(page: FirecrawlPage): PageEntry {
  const title =
    typeof page.metadata.title === "string" && page.metadata.title.trim()
      ? page.metadata.title.trim()
      : titleFromUrl(page.url);
  return {
    ...page,
    title,
    recommended: true,
  };
}

function skipReason(value: string): string | null {
  const url = new URL(value);
  if (url.search) return "query URL";
  const path = url.pathname.toLowerCase();
  for (const { pattern, reason } of DROP_PATH_PATTERNS) {
    if (pattern.test(path)) return reason;
  }
  return null;
}

function sortByPriority(a: PageEntry, b: PageEntry): number {
  const ap = priority(a.url);
  const bp = priority(b.url);
  if (ap !== bp) return ap - bp;
  const al = new URL(a.url).pathname.length;
  const bl = new URL(b.url).pathname.length;
  if (al !== bl) return al - bl;
  return a.url.localeCompare(b.url);
}

function priority(value: string): number {
  const path = new URL(value).pathname.toLowerCase().replace(/\/+$/, "") || "/";
  if (path === "/") return 0;
  if (/\/(about|about-us|our-team|meet|doctor|staff)(\/|$)/.test(path)) return 10;
  if (/\/(service|services|procedure|treatment)(s)?(\/|$|-)/.test(path)) return 20;
  if (/\/(first-visit|new-patient|what-to-expect)(\/|$)/.test(path)) return 30;
  if (/\/(amenities|office|office-tour|comfort)(\/|$)/.test(path)) return 40;
  if (/\/(insurance|financing|payment)(\/|$)/.test(path)) return 50;
  if (/\/(contact|location|directions|hours)(\/|$)/.test(path)) return 60;
  return 100;
}

function titleFromUrl(value: string): string {
  const url = new URL(value);
  const slug = url.pathname.split("/").filter(Boolean).pop();
  if (!slug) return "Homepage";
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
