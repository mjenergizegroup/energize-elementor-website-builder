import type { TemplateCompileBundle, TemplatePageRole } from "@/lib/template-import/types";
import type {
  NormalizedContentSlot,
  TemplateContentMapping,
} from "./types";
import type { FirecrawlPage } from "@/lib/firecrawl/types";

export interface StructuredMigrationPage {
  page: string;
  wpTitle?: string;
  slug?: string;
  builderPageType?: string;
  selected: boolean;
  pageData?: Record<string, Record<string, unknown>>;
}

export function mapStructuredPagesToTemplates(
  bundle: TemplateCompileBundle,
  pages: StructuredMigrationPage[],
): { mappings: TemplateContentMapping[]; errors: string[] } {
  const available = pages.filter((page) => page.selected && page.pageData);
  const used = new Set<string>();
  const mappings: TemplateContentMapping[] = [];
  const errors: string[] = [];

  for (const template of bundle.pages.filter((page) => page.mapping.selected)) {
    const match = bestPageMatch(template.mapping.role, template.mapping.slug, available, used);
    if (!match) {
      errors.push(`No approved content page matches ${template.mapping.title}.`);
      continue;
    }
    used.add(match.page);
    mappings.push({
      analysisId: template.analysisId,
      content: normalizeStructuredPage(match, template.mapping.title, template.mapping.slug),
    });
  }
  return { mappings, errors };
}

export function contentMappingsToSourcePages(
  mappings: TemplateContentMapping[],
  sourceBaseUrl: string,
): FirecrawlPage[] {
  let base: URL;
  try {
    base = new URL(sourceBaseUrl);
  } catch {
    base = new URL("https://source.invalid/");
  }
  return mappings.map((mapping) => ({
    url: new URL(`/${mapping.content.slug}`, base).toString(),
    markdown: mapping.content.slots.map(slotToMarkdown).join("\n\n"),
    metadata: {
      title: mapping.content.title,
      migrationAnalysisId: mapping.analysisId,
    },
  }));
}

export function resolveContentImageUrls(
  mappings: TemplateContentMapping[],
  sourceBaseUrl: string,
): TemplateContentMapping[] {
  let base: URL;
  try {
    base = new URL(sourceBaseUrl);
  } catch {
    base = new URL("https://source.invalid/");
  }
  return mappings.map((mapping) => ({
    ...mapping,
    content: {
      ...mapping.content,
      slots: mapping.content.slots.map((slot) =>
        slot.kind === "image"
          ? { ...slot, sourceUrl: new URL(slot.sourceUrl, base).toString() }
          : slot,
      ),
    },
  }));
}

function bestPageMatch(
  role: TemplatePageRole,
  slug: string,
  pages: StructuredMigrationPage[],
  used: Set<string>,
): StructuredMigrationPage | undefined {
  const unused = pages.filter((page) => !used.has(page.page));
  const exact = unused.find(
    (page) => page.slug === slug || page.page === slug,
  );
  if (exact) return exact;
  const roleMatch = unused.find((page) => roleMatches(role, page));
  if (roleMatch) return roleMatch;
  if (role === "custom" && unused.length === 1) return unused[0];
  return undefined;
}

function roleMatches(
  role: TemplatePageRole,
  page: StructuredMigrationPage,
): boolean {
  if (role === "homepage") return page.builderPageType === "homepage";
  if (role === "service-page") return page.builderPageType === "service-page";
  if (role === "blog-archive" || role === "blog-single") return false;
  return page.builderPageType === role || page.page === role;
}

function normalizeStructuredPage(
  page: StructuredMigrationPage,
  fallbackTitle: string,
  fallbackSlug: string,
) {
  const slots: NormalizedContentSlot[] = [];
  const data = page.pageData ?? {};
  for (const [sectionName, fields] of Object.entries(data)) {
    if (/^(meta|seo|schema)$/i.test(sectionName)) continue;
    for (const [field, value] of Object.entries(fields)) {
      appendField(slots, page.page, field, value, fields);
    }
  }
  if (!slots.some((slot) => slot.kind === "heading")) {
    slots.unshift({
      id: `${page.page}-heading`,
      kind: "heading",
      text: page.wpTitle ?? fallbackTitle,
      level: 1,
    });
  }
  return {
    schemaVersion: "1" as const,
    sourcePageId: page.page,
    title: page.wpTitle ?? fallbackTitle,
    slug: page.slug ?? fallbackSlug,
    slots,
  };
}

function appendField(
  slots: NormalizedContentSlot[],
  pageId: string,
  field: string,
  value: unknown,
  siblingFields: Record<string, unknown>,
) {
  if (value == null || value === "") return;
  if (/(?:^|_)(?:alt|caption)(?:$|_)/i.test(field)) return;
  const id = `${pageId}-${slots.length}`;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return;
    if (looksLikeUrl(text) && /(?:image|photo|portrait|logo)/i.test(field)) {
      slots.push({
        id,
        kind: "image",
        sourceUrl: text,
        altText: relatedAlt(field, siblingFields),
      });
    } else if (looksLikeUrl(text) && /(?:url|link|href)/i.test(field)) {
      slots.push({ id, kind: "link", label: humanize(field), href: text });
    } else if (/(?:headline|heading|title|^h[1-6]$)/i.test(field)) {
      slots.push({
        id,
        kind: "heading",
        text,
        level: headingLevel(field),
      });
    } else {
      slots.push({ id, kind: "rich-text", html: `<p>${escapeHtml(text)}</p>` });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) appendField(slots, pageId, field, item, siblingFields);
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      appendField(slots, pageId, `${field}_${key}`, item, value as Record<string, unknown>);
    }
  }
}

function relatedAlt(field: string, siblings: Record<string, unknown>): string {
  const base = field.replace(/(?:_?(?:url|image|photo|portrait))+$/i, "");
  const match = Object.entries(siblings).find(
    ([key, value]) =>
      typeof value === "string" &&
      /alt/i.test(key) &&
      (!base || key.toLowerCase().includes(base.toLowerCase())),
  );
  return typeof match?.[1] === "string" ? match[1].trim() : "";
}

function headingLevel(field: string): 1 | 2 | 3 | 4 | 5 | 6 {
  const explicit = field.match(/(?:^|_)h([1-6])(?:$|_)/i)?.[1];
  if (explicit) return Number(explicit) as 1 | 2 | 3 | 4 | 5 | 6;
  return /hero|headline|page_title/i.test(field) ? 1 : 2;
}

function looksLikeUrl(value: string): boolean {
  return /^(?:https?:\/\/|\/|#|mailto:|tel:)/i.test(value);
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slotToMarkdown(slot: NormalizedContentSlot): string {
  if (slot.kind === "heading") return `${"#".repeat(slot.level)} ${slot.text}`;
  if (slot.kind === "rich-text") return stripHtml(slot.html);
  if (slot.kind === "image") {
    return `![${slot.altText.replace(/[\[\]]/g, "")}](${slot.sourceUrl})`;
  }
  return `[${slot.label.replace(/[\[\]]/g, "")}](${slot.href})`;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .trim();
}
