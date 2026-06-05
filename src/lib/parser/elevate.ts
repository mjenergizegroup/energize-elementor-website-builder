import { loadThemeMeta } from "@/lib/injection/loader";
import type {
  ParsedContent,
  PageContent,
  SlotValue,
} from "@/lib/injection/types";
import {
  extractFlags,
  extractLabeledSlots,
  normalize,
  splitPages,
  splitSections,
  toParagraphHtml,
  toPlainText,
  type MarkdownSection,
} from "./markdown";

// Maps a normalized page H1 to an Elevate page key. Service pages are detected
// separately (there can be several).
function pageKeyForHeading(h1: string): string | null {
  const n = normalize(h1);
  if (n === "homepage") return "homepage";
  if (n === "about page" || n === "about") return "about";
  if (n.startsWith("service page")) return "services";
  if (n === "first visit page" || n === "first visit") return "first-visit";
  if (n === "amenities page" || n === "amenities") return "amenities";
  if (n.startsWith("insurance and financing")) return "insurance";
  if (n === "contact page" || n === "contact") return "contact";
  return null;
}

// Per-page, per-section label -> slot key mappings. Section names are matched by
// normalized prefix (so "Our Office" matches "our office").
type LabelMap = Record<string, string>;
type SectionSpec = {
  section: string; // normalized section name (prefix-matched)
  labels?: LabelMap; // normalized content label -> slot key
  special?: (lines: string[], slots: Record<string, SlotValue>) => void;
};

const PAGE_SPECS: Record<string, SectionSpec[]> = {
  homepage: [
    { section: "hero", labels: { headline: "hero_headline", body: "hero_body", "cta button": "hero_cta" } },
    { section: "promotions bar", special: parsePromotions },
    { section: "about", labels: { headline: "about_headline", body: "about_body", "cta button": "about_cta" } },
    {
      section: "services",
      labels: { "section heading": "services_heading" },
      special: parseServiceCards,
    },
    {
      section: "meet your dentist",
      labels: {
        eyebrow: "dentist_eyebrow",
        "doctor name line": "dentist_name_line",
        bio: "dentist_bio",
        "featured in label": "dentist_featured_label",
        "cta button": "dentist_cta",
        "closing quote": "dentist_quote",
      },
    },
    { section: "comfort menu", labels: { "section heading": "comfort_heading" } },
    {
      section: "office amenities",
      labels: { "section heading": "amenities_heading", body: "amenities_body", "cta button": "amenities_cta" },
    },
    {
      section: "personalized care cta",
      labels: { headline: "care_headline", body: "care_body", "cta button": "care_cta" },
    },
    { section: "insurance carousel", labels: { "section heading": "insurance_heading" } },
  ],
  about: [
    { section: "page banner", labels: { h1: "h1" } },
    {
      section: "practice and doctor",
      labels: {
        "practice intro heading": "intro_heading",
        "practice intro body": "intro_body",
        "doctor heading": "doctor_heading",
        "doctor bio": "doctor_bio",
      },
    },
    { section: "our office", labels: { "section heading": "offices_heading", body: "offices_body" } },
  ],
  services: [
    { section: "page banner", labels: { h1: "h1" } },
    {
      section: "service intro",
      labels: { headline: "intro_headline", body: "intro_body", "cta button": "intro_cta" },
    },
    { section: "sub services", special: parseSubServices },
    {
      section: "featured sub service",
      labels: { headline: "featured_headline", body: "featured_desc", "cta button": "featured_cta" },
    },
    {
      section: "personalized care cta",
      labels: { headline: "care_headline", body: "care_body", "cta button": "care_cta" },
    },
  ],
  "first-visit": [
    { section: "page banner", labels: { h1: "h1" } },
    { section: "intro", labels: { headline: "intro_headline", body: "intro_body", "cta button": "intro_cta" } },
    {
      section: "visit walkthrough",
      labels: { headline: "walkthrough_headline", body: "walkthrough_body", "cta button": "walkthrough_cta" },
    },
    { section: "comfort menu", labels: { "section heading": "comfort_heading", "closing line": "comfort_closing" } },
    {
      section: "insurance and financing",
      labels: { "section heading": "insurance_heading", body: "insurance_body", "cta button": "insurance_cta" },
    },
    {
      section: "membership plan cta",
      labels: { headline: "membership_headline", body: "membership_body", "cta button": "membership_cta" },
    },
  ],
  amenities: [
    { section: "page banner", labels: { h1: "h1" } },
    {
      section: "intro",
      labels: { overline: "intro_overline", "main heading": "intro_heading", body: "intro_body", "cta button": "intro_cta" },
    },
    { section: "comfort menu", labels: { "section heading": "comfort_heading", "closing line": "comfort_closing" } },
    {
      section: "membership plan cta",
      labels: { headline: "membership_headline", body: "membership_body", "cta button": "membership_cta" },
    },
  ],
  insurance: [
    { section: "page banner", labels: { h1: "h1" } },
    { section: "insurance acceptance", labels: { "section heading": "acceptance_heading", body: "acceptance_body" } },
    { section: "financing", labels: { "section heading": "financing_heading", body: "financing_body", "cta button": "financing_cta" } },
    {
      section: "membership plan cta",
      labels: { headline: "membership_headline", body: "membership_body", "cta button": "membership_cta" },
    },
  ],
  contact: [
    { section: "page banner", labels: { h1: "h1" } },
    {
      section: "locations and form",
      labels: { "section heading": "section_heading", "intro line": "intro_line" },
      special: parseLocations,
    },
  ],
};

// Standard CTA labels that the content writer leaves implicit.
const SLOT_DEFAULTS: Record<string, string> = {
  subservices_cta: "Request Appointment",
};

let editorSlotCache: Set<string> | null = null;
function editorSlots(): Set<string> {
  if (editorSlotCache) return editorSlotCache;
  const meta = loadThemeMeta("elevate");
  const set = new Set<string>();
  for (const page of meta.pages) {
    for (const slot of page.slots) {
      const fields = slot.fields ?? (slot.field ? [slot.field] : []);
      if (fields.includes("editor")) set.add(slot.key);
    }
  }
  editorSlotCache = set;
  return set;
}

function setValue(
  slots: Record<string, SlotValue>,
  key: string,
  rawValue: string,
): void {
  const value = rawValue.trim();
  if (!value) return;
  slots[key] = editorSlots().has(key) ? toParagraphHtml(value) : toPlainText(value);
}

// ---- special-block handlers ----

function parsePromotions(lines: string[], slots: Record<string, SlotValue>): void {
  // Panels are introduced by "> **Panel N ...**", each followed by **Heading:**
  // and optionally **Body:**.
  const text = lines.join("\n");
  const panelBlocks = text.split(/^>\s*\*\*Panel\s*(\d)/im);
  // split keeps [pre, "1", block1, "2", block2, ...]
  for (let i = 1; i < panelBlocks.length; i += 2) {
    const panelNum = panelBlocks[i];
    const block = panelBlocks[i + 1] ?? "";
    const labeled = extractLabeledSlots(block.split(/\r?\n/));
    if (labeled["heading"]) setValue(slots, `promo${panelNum}_heading`, labeled["heading"]);
    if (labeled["body"]) setValue(slots, `promo${panelNum}_body`, labeled["body"]);
  }
}

function parseServiceCards(lines: string[], slots: Record<string, SlotValue>): void {
  // "**Card N**" followed by "Title: ..." and "Description: ...".
  const text = lines.join("\n");
  const cardBlocks = text.split(/^\*\*Card\s*(\d)\*\*\s*$/im);
  for (let i = 1; i < cardBlocks.length; i += 2) {
    const num = cardBlocks[i];
    const block = cardBlocks[i + 1] ?? "";
    const title = block.match(/^\s*Title:\s*(.+)$/im)?.[1]?.trim();
    const desc = block.match(/^\s*Description:\s*([\s\S]+?)(?:\n\s*\n|$)/im)?.[1]?.trim();
    if (title || desc) {
      slots[`services_card${num}`] = {
        ...(title ? { title_text: toPlainText(title) } : {}),
        ...(desc ? { description_text: toPlainText(desc) } : {}),
      };
    }
  }
}

function parseSubServices(lines: string[], slots: Record<string, SlotValue>): void {
  // "**Sub-Service N: Title**" followed by a description paragraph.
  const text = lines.join("\n");
  const blocks = text.split(/^\*\*Sub-?Service\s*(\d):\s*(.+?)\*\*\s*$/im);
  // [pre, num1, title1, body1, num2, title2, body2, ...]
  for (let i = 1; i < blocks.length; i += 3) {
    const num = blocks[i];
    const title = blocks[i + 1]?.trim();
    const body = blocks[i + 2] ?? "";
    if (title) {
      slots[`subservice${num}_title`] = toPlainText(title);
    }
    const desc = body
      .split(/\r?\n/)
      .filter((l) => !/^>/.test(l) && !/^\*\(.*\)\*/.test(l.trim()) && !/^#/.test(l))
      .join("\n")
      .trim();
    if (desc) {
      // Sub-service descriptions are heading(div) widgets -> plain text.
      slots[`subservice${num}_desc`] = toPlainText(desc);
    }
  }
}

function parseLocations(lines: string[], slots: Record<string, SlotValue>): void {
  // "**Location: Name**" followed by "Address: ..." and "Phone: ...".
  const text = lines.join("\n");
  const blocks = text.split(/^\*\*Location:\s*(.+?)\*\*\s*$/im);
  // [pre, name1, block1, name2, block2, ...]
  let idx = 1;
  for (let i = 1; i < blocks.length; i += 2) {
    const name = blocks[i]?.trim();
    const block = blocks[i + 1] ?? "";
    const address = block.match(/^\s*Address:\s*(.+)$/im)?.[1]?.trim();
    const phone = block.match(/^\s*Phone:\s*(.+)$/im)?.[1]?.trim();
    if (name) slots[`loc${idx}_heading`] = toPlainText(name);
    if (address) slots[`loc${idx}_address`] = toPlainText(address);
    if (phone) slots[`loc${idx}_phone`] = toPlainText(phone);
    idx += 1;
  }
}

// ---- section + page assembly ----

function findSection(
  sections: MarkdownSection[],
  specSection: string,
): MarkdownSection | undefined {
  return sections.find((s) => {
    const n = normalize(s.heading);
    return n === specSection || n.startsWith(specSection);
  });
}

function buildPage(
  pageKey: string,
  sections: MarkdownSection[],
  h1Title: string,
): PageContent {
  const specs = PAGE_SPECS[pageKey] ?? [];
  const slots: Record<string, SlotValue> = {};
  const buildNotes: string[] = [];

  for (const spec of specs) {
    const section = findSection(sections, spec.section);
    if (!section) continue;
    buildNotes.push(...extractFlags(section.lines));

    if (spec.labels) {
      const labeled = extractLabeledSlots(section.lines);
      for (const [contentLabel, slotKey] of Object.entries(spec.labels)) {
        const raw = labeled[contentLabel];
        if (raw) setValue(slots, slotKey, raw);
      }
    }
    if (spec.special) spec.special(section.lines, slots);
  }

  // Apply standard implicit CTA defaults (labels the writer leaves out).
  if (pageKey === "services" && slots["subservices_cta"] === undefined) {
    slots["subservices_cta"] = SLOT_DEFAULTS["subservices_cta"];
  }

  // wpTitle: prefer the page's own H1 slot, else the page H1 heading.
  const wpTitle =
    (typeof slots["h1"] === "string" && (slots["h1"] as string)) ||
    h1Title ||
    pageKey;

  return {
    page: pageKey,
    wpTitle,
    slug:
      pageKey === "homepage"
        ? "home"
        : slugify(typeof slots["h1"] === "string" ? (slots["h1"] as string) : pageKey),
    slots,
    buildNotes: dedupe(buildNotes),
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

export function parseElevate(markdown: string): ParsedContent {
  const docPages = splitPages(markdown);

  // Front matter from the title block.
  const titlePage = docPages.find((p) => /website content/i.test(p.heading));
  const practiceName = titlePage
    ? titlePage.heading.replace(/\s*[\u2014-]\s*website content.*/i, "").trim()
    : "";
  const frontMatter = titlePage
    ? extractLabeledSlots(titlePage.lines)
    : {};
  const doctorName = frontMatter["doctor"];
  // City is the segment before the "[state] [zip]" tail in the location line.
  const locationParts = frontMatter["location"]?.split(",").map((s) => s.trim());
  const city =
    locationParts && locationParts.length >= 2
      ? locationParts[locationParts.length - 2]
      : undefined;

  const pages: PageContent[] = [];
  let serviceSeq = 0;
  for (const docPage of docPages) {
    const key = pageKeyForHeading(docPage.heading);
    if (!key) continue;
    const sections = splitSections(docPage.lines);
    const built = buildPage(key, sections, docPage.heading);
    if (key === "services") {
      serviceSeq += 1;
      // Disambiguate multiple service pages by their H1 slug.
      built.slug = built.slug || `service-${serviceSeq}`;
    }
    pages.push(built);
  }

  // Personalized Care CTA is reused verbatim from the homepage on service pages.
  const homepage = pages.find((p) => p.page === "homepage");
  if (homepage) {
    // The homepage H1 heading is just "HOMEPAGE"; use the practice name as title.
    homepage.wpTitle = practiceName || "Home";
    homepage.slug = "home";
    for (const page of pages) {
      if (page.page !== "services") continue;
      for (const key of ["care_headline", "care_body", "care_cta"]) {
        if (page.slots[key] === undefined && homepage.slots[key] !== undefined) {
          page.slots[key] = homepage.slots[key];
        }
      }
    }
  }

  return {
    practiceName: practiceName || "Practice",
    city,
    doctorName,
    pages,
  };
}
