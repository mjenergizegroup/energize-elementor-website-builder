import type { FirecrawlPage } from "./types";

export function buildCombinedMarkdown(pages: FirecrawlPage[]): string {
  return pages
    .map((page) => `# SOURCE_URL: ${page.url}\n\n${page.markdown.trim()}`)
    .join("\n\n---\n\n")
    .trimEnd()
    .concat("\n");
}

export function rawContentFilename(sourceUrl: string): string {
  const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
  const safe = hostname.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  return `${safe}-content-raw.md`;
}
