import type { PageData } from "@/lib/builders/elevate/types";
import type { SlotValue } from "@/lib/injection/types";
import {
  CLASS_IDS,
  MINIMUM_ELEMENTOR_VERSION,
} from "./foundation";
import {
  button,
  flexbox,
  heading,
  image,
  legacyEmbed,
  paragraph,
} from "./elements";
import type { AtomicElement } from "./types";

export type AtomicVisualPreset = "elevate" | "summit" | "lux" | "landing-page";

export interface AtomicPageBuildInput {
  page: string;
  title: string;
  practiceName: string;
  preset: AtomicVisualPreset;
  site?: Record<string, string>;
  pageData?: PageData;
  slots?: Record<string, SlotValue>;
  landingContent?: Record<string, unknown>;
}

export interface AtomicPageBuildResult {
  elementorData: AtomicElement[];
  elementorVersion: string;
  warnings: string[];
  legacyExceptions: string[];
}

interface ContentSection {
  name: string;
  fields: Array<[string, unknown]>;
}

export function buildAtomicPage(input: AtomicPageBuildInput): AtomicPageBuildResult {
  const sections = collectSections(input);
  const warnings: string[] = [];
  const legacyExceptions: string[] = [];
  const site = input.site ?? {};
  const firstSection = sections[0];
  const heroHeadline =
    findFirstField(firstSection, /(^|_)(headline|heading|title|h1)($|_)/i) ??
    input.title;
  const heroBody =
    findFirstField(firstSection, /(subheadline|description|body|intro|copy|text)/i) ??
    `${input.practiceName} provides thoughtful, patient-focused dental care.`;
  const ctaHref = firstText(site, [
    "appointment_url",
    "form_url",
    "contact_url",
  ]) || "#contact";

  const hero = flexbox(
    [CLASS_IDS.section, presetSectionClass(input.preset)],
    [
      flexbox(
        [CLASS_IDS.container, CLASS_IDS.stack, CLASS_IDS.stackL],
        [
          paragraph(input.practiceName, [
            CLASS_IDS.eyebrow,
            ...inverseClasses(input.preset),
          ]),
          heading(heroHeadline, "h1", [
            CLASS_IDS.h1,
            ...inverseClasses(input.preset),
          ]),
          paragraph(heroBody, [
            CLASS_IDS.body,
            CLASS_IDS.lead,
            ...inverseClasses(input.preset),
          ]),
          flexbox(
            [CLASS_IDS.cluster],
            [
              button("Schedule a Consultation", ctaHref, [
                CLASS_IDS.button,
                input.preset === "lux" ? CLASS_IDS.buttonAccent : CLASS_IDS.buttonPrimary,
              ]),
            ],
          ),
        ],
      ),
    ],
    "section",
  );

  const contentSections = /hero|masthead|intro/i.test(firstSection?.name ?? "")
    ? sections.slice(1)
    : sections;
  const bodySections = contentSections.map((section, index) =>
    buildSection(section, index, legacyExceptions, warnings),
  );

  const cta = flexbox(
    [CLASS_IDS.section, CLASS_IDS.sectionPrimary],
    [
      flexbox(
        [CLASS_IDS.container, CLASS_IDS.containerNarrow, CLASS_IDS.stack, CLASS_IDS.textCenter],
        [
          heading("Ready to plan your visit?", "h2", [CLASS_IDS.h2, CLASS_IDS.textInverse]),
          paragraph(`Connect with the ${input.practiceName} team today.`, [
            CLASS_IDS.body,
            CLASS_IDS.bodyL,
            CLASS_IDS.textInverse,
          ]),
          flexbox(
            [CLASS_IDS.cluster, CLASS_IDS.clusterCenter],
            [button("Schedule a Consultation", ctaHref, [CLASS_IDS.button, CLASS_IDS.buttonAccent])],
          ),
        ],
      ),
    ],
    "section",
  );

  return {
    elementorData: [flexbox([CLASS_IDS.site], [hero, ...bodySections, cta])],
    elementorVersion: MINIMUM_ELEMENTOR_VERSION,
    warnings,
    legacyExceptions,
  };
}

function collectSections(input: AtomicPageBuildInput): ContentSection[] {
  if (input.pageData) {
    return Object.entries(input.pageData).map(([name, fields]) => ({
      name,
      fields: Object.entries(fields),
    }));
  }

  if (input.landingContent) {
    return groupFlatFields(input.landingContent);
  }

  return groupFlatFields(input.slots ?? {});
}

function groupFlatFields(fields: Record<string, unknown>): ContentSection[] {
  const grouped = new Map<string, Array<[string, unknown]>>();
  for (const [key, value] of Object.entries(fields)) {
    const canonical = key.toLowerCase();
    const prefix = canonical.includes("_") ? canonical.split("_")[0] : "content";
    const list = grouped.get(prefix) ?? [];
    list.push([key, value]);
    grouped.set(prefix, list);
  }
  return [...grouped.entries()].map(([name, sectionFields]) => ({
    name,
    fields: sectionFields,
  }));
}

function buildSection(
  section: ContentSection,
  index: number,
  legacyExceptions: string[],
  warnings: string[],
): AtomicElement {
  const content: AtomicElement[] = [];
  const headingText =
    findFirstField(section, /(^|_)(headline|heading|title)($|_)/i) ??
    humanize(section.name);

  content.push(paragraph(humanize(section.name), [CLASS_IDS.eyebrow]));
  content.push(heading(headingText, "h2", [CLASS_IDS.h2]));

  for (const [field, value] of section.fields) {
    if (/headline|heading|(^|_)title($|_)/i.test(field)) continue;
    if (isImageUrlField(field, value)) {
      const alt = findRelatedAlt(section, field);
      content.push(image(toText(value), alt, [CLASS_IDS.media, CLASS_IDS.mediaPortrait]));
      continue;
    }
    if (/(^|_)(image|photo)_?alt($|_)/i.test(field)) continue;
    const rendered = renderField(field, value, legacyExceptions, warnings);
    content.push(...rendered);
  }

  return flexbox(
    [CLASS_IDS.section, ...(index % 2 === 1 ? [CLASS_IDS.sectionSurface] : [])],
    [
      flexbox(
        [CLASS_IDS.container, CLASS_IDS.stack],
        content,
      ),
    ],
    "section",
  );
}

function renderField(
  field: string,
  value: unknown,
  legacyExceptions: string[],
  warnings: string[],
): AtomicElement[] {
  if (value == null || value === "") return [];

  if (isLegacyEmbedField(field, value)) {
    legacyExceptions.push(field);
    return [buildLegacyEmbed(field, value)];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const cards = value.map((item, index) =>
      flexbox(
        [CLASS_IDS.card, CLASS_IDS.cardFeature],
        renderCardItem(item, index),
        "article",
      ),
    );
    return [flexbox([gridClass(value.length)], cards)];
  }

  if (isObject(value)) {
    const cards = Object.entries(value).map(([key, item]) =>
      flexbox(
        [CLASS_IDS.card],
        [
          heading(humanize(key), "h3", [CLASS_IDS.h3]),
          paragraph(toText(item), [CLASS_IDS.body]),
        ],
        "article",
      ),
    );
    return [flexbox([gridClass(cards.length)], cards)];
  }

  const text = toText(value).trim();
  if (!text) return [];
  if (looksLikeUrl(text) && /(url|link|cta)/i.test(field)) {
    return [button("Learn More", text, [CLASS_IDS.button, CLASS_IDS.buttonOutline])];
  }
  if (text.length > 2500) {
    warnings.push(`${field} contains more than 2,500 characters and should be reviewed in Elementor.`);
  }
  return text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((part) => paragraph(stripMarkdown(part), [CLASS_IDS.body]));
}

function renderCardItem(item: unknown, index: number): AtomicElement[] {
  if (isObject(item)) {
    const entries = Object.entries(item);
    const titleEntry = entries.find(([key]) => /title|name|question|heading/i.test(key));
    const bodyEntries = entries.filter(([key]) => titleEntry?.[0] !== key);
    return [
      heading(toText(titleEntry?.[1] ?? `Item ${index + 1}`), "h3", [CLASS_IDS.h3]),
      ...bodyEntries.map(([key, value]) =>
        paragraph(`${humanize(key)}: ${toText(value)}`, [CLASS_IDS.body]),
      ),
    ];
  }
  return [heading(toText(item), "h3", [CLASS_IDS.h3])];
}

function buildLegacyEmbed(field: string, value: unknown): AtomicElement {
  const text = toText(value);
  if (/shortcode/i.test(field) || /^\[[^\]]+\]$/.test(text.trim())) {
    return legacyEmbed("shortcode", { shortcode: text });
  }
  if (/map|address/i.test(field) && !/<iframe/i.test(text)) {
    return legacyEmbed("google_maps", { address: text, zoom: { size: 14, unit: "px" } });
  }
  return legacyEmbed("html", { html: text });
}

function isLegacyEmbedField(field: string, value: unknown): boolean {
  const text = toText(value);
  return (
    /(form_html|review_html|raw_html|shortcode|map|embed|iframe)/i.test(field) ||
    /<iframe|leadconnectorhq|reputationhub/i.test(text) ||
    /^\[[a-z][^\]]*\]$/i.test(text.trim())
  );
}

function gridClass(count: number): string {
  if (count >= 4) return CLASS_IDS.grid4;
  if (count === 3) return CLASS_IDS.grid3;
  return CLASS_IDS.grid2;
}

function presetSectionClass(preset: AtomicVisualPreset): string {
  if (preset === "lux") return CLASS_IDS.sectionDark;
  if (preset === "summit") return CLASS_IDS.sectionSurface;
  return CLASS_IDS.sectionPrimary;
}

function inverseClasses(preset: AtomicVisualPreset): string[] {
  return preset === "summit" ? [] : [CLASS_IDS.textInverse];
}

function findFirstField(
  section: ContentSection | undefined,
  pattern: RegExp,
): string | undefined {
  if (!section) return undefined;
  for (const [key, value] of section.fields) {
    if (!pattern.test(key)) continue;
    const text = toText(value).trim();
    if (text) return stripMarkdown(text);
  }
  return undefined;
}

function firstText(source: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]?.trim();
    if (value) return value;
  }
  return "";
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toText).join("\n");
  if (isObject(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${humanize(key)}: ${toText(item)}`)
      .join("\n");
  }
  return String(value);
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^(tel:|mailto:|#)/i.test(value);
}

function isImageUrlField(field: string, value: unknown): boolean {
  return /(image|photo|portrait|headshot).*(url|src)|^(image|photo)$/i.test(field) &&
    /^https?:\/\//i.test(toText(value));
}

function findRelatedAlt(section: ContentSection, imageField: string): string {
  const base = imageField.replace(/(url|src)$/i, "").replace(/[_-]+$/, "");
  const exact = section.fields.find(([field]) =>
    new RegExp(`^${escapeRegExp(base)}[_-]?alt$`, "i").test(field),
  );
  if (exact) return toText(exact[1]);
  const fallback = section.fields.find(([field]) => /(^|_)(image|photo)_?alt($|_)/i.test(field));
  return fallback ? toText(fallback[1]) : "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
