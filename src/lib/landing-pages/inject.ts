import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildAtomicPage } from "@/lib/elementor/atomic/page-builder";

export const LANDING_PAGE_TEMPLATES = [
  "std_v1",
  "std_v2",
  "inv_v1",
  "inv_v2",
  "fa_v1",
  "fa_v2",
  "thank_you",
] as const;

export type LandingPageTemplateName = (typeof LANDING_PAGE_TEMPLATES)[number];
export type LandingPageContent = Record<string, unknown>;

type ElementorDocument = Record<string, unknown>;

interface SlotMap {
  template?: string;
  description?: string;
  notes?: string[];
  slots: Record<string, unknown>;
}

const SLOT_ALIASES: Record<string, string[]> = {
  MAPS_ADDRESS: [
    "GOOGLE_MAPS_ADDRESS",
    "GOOGLE_MAPS_QUERY",
    "GOOGLE_MAPS_URL",
    "GOOGLE_BUSINESS_PROFILE",
    "GOOGLE_BUSINESS_PROFILE_URL",
    "GBP_URL",
    "GBP_LINK",
    "BUSINESS_ADDRESS",
    "ADDRESS",
    "ADDRESS_LINE",
  ],
  WORK_HOURS: [
    "HOURS",
    "BUSINESS_HOURS",
    "WORKING_HOURS",
    "OFFICE_HOURS",
    "PRACTICE_HOURS",
  ],
  PHONE_NUMBER: [
    "PHONE",
    "PHONE_ICON_BOX",
    "CALL_PHONE",
    "CALL_TRACKING_NUMBER",
    "TRACKING_PHONE",
  ],
  PHONE_ICON_BOX: [
    "PHONE_NUMBER",
    "PHONE",
    "CALL_PHONE",
    "CALL_TRACKING_NUMBER",
    "TRACKING_PHONE",
  ],
  GHL_REVIEW_URL: [
    "GOOGLE_BUSINESS_PROFILE_URL",
    "GOOGLE_REVIEW_URL",
    "GOOGLE_REVIEWS_URL",
    "GOOGLE_MAPS_URL",
    "GBP_URL",
    "GBP_LINK",
    "REVIEW_URL",
    "REVIEWS_URL",
  ],
};

const DEFAULT_PRACTICE_NAMES = [
  "Nellie Gail Orthodontics: Braces and Invisalign",
  "Nellie Gail Orthodontics",
  "Pleasant Smiles Dental",
  "Elevate Smile Design & Sleep Wellness",
  "Dental By Design",
  "Dental Inc.",
  "DENTAL INC.",
];

export interface LandingPageTemplateSummary {
  name: LandingPageTemplateName;
  description?: string;
  slotNames: string[];
}

export interface LandingPageInjectionResult {
  data: ElementorDocument;
  populatedSlots: string[];
  missingSlots: string[];
}

export interface LandingPageInjectOptions {
  practiceName?: string;
}

export function assertLandingPageTemplateName(
  value: string,
): asserts value is LandingPageTemplateName {
  if (!LANDING_PAGE_TEMPLATES.includes(value as LandingPageTemplateName)) {
    throw new Error(`Unknown landing page template: ${value}`);
  }
}

export function getLandingPageTemplateSummary(
  templateName: LandingPageTemplateName,
): LandingPageTemplateSummary {
  const slotMap = loadSlotMap(templateName);
  return {
    name: templateName,
    description: slotMap.description,
    slotNames: Object.keys(slotMap.slots),
  };
}

export function listLandingPageTemplateSummaries(): LandingPageTemplateSummary[] {
  return LANDING_PAGE_TEMPLATES.map((name) =>
    getLandingPageTemplateSummary(name),
  );
}

export function injectLandingPage(
  templateName: LandingPageTemplateName,
  content: LandingPageContent,
  options: LandingPageInjectOptions = {},
): LandingPageInjectionResult {
  const slotMap = loadSlotMap(templateName);
  const normalizedContent = normalizeLandingPageContent(content);
  replaceDefaultPracticeNames(normalizedContent, options.practiceName);

  const slotNames = Object.keys(slotMap.slots);
  const populatedSlots = slotNames.filter(
    (slotName) => valueToText(normalizedContent[slotName]).trim() !== "",
  );
  const missingSlots = slotNames.filter(
    (slotName) => !populatedSlots.includes(slotName),
  );
  const title = valueToText(
    normalizedContent.HEADLINE ??
      normalizedContent.HERO_HEADLINE ??
      normalizedContent.HERO_HEADING ??
      normalizedContent.PAGE_TITLE ??
      "Landing Page",
  );
  const built = buildAtomicPage({
    page: templateName,
    title,
    practiceName: options.practiceName ?? "Dental Practice",
    preset: "landing-page",
    landingContent: normalizedContent,
  });

  return {
    data: {
      content: built.elementorData,
      version: built.elementorVersion,
      type: "wp-page",
      title,
      energize_atomic: {
        template: templateName,
        legacy_exceptions: built.legacyExceptions,
      },
    },
    populatedSlots,
    missingSlots,
  };
}

function loadSlotMap(templateName: LandingPageTemplateName): SlotMap {
  const file = path.join(
    process.cwd(),
    "data",
    "landing-page-slots",
    `${templateName}.json`,
  );
  return JSON.parse(readFileSync(file, "utf-8")) as SlotMap;
}

function normalizeLandingPageContent(
  content: LandingPageContent,
): LandingPageContent {
  const normalized: LandingPageContent = { ...content };
  const byCanonicalKey = new Map<string, unknown>();

  for (const [key, value] of Object.entries(content)) {
    const canonicalKey = canonicalSlotKey(key);
    byCanonicalKey.set(canonicalKey, value);
    if (normalized[canonicalKey] == null) {
      normalized[canonicalKey] = value;
    }
  }

  for (const [slotName, aliases] of Object.entries(SLOT_ALIASES)) {
    if (normalized[slotName] != null) continue;
    for (const alias of aliases) {
      const value = byCanonicalKey.get(canonicalSlotKey(alias));
      if (value != null && valueToText(value).trim() !== "") {
        normalized[slotName] = value;
        break;
      }
    }
  }

  return normalized;
}

function canonicalSlotKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function replaceDefaultPracticeNames(node: unknown, practiceName?: string): void {
  const cleanPractice = practiceName?.trim();
  if (!cleanPractice) return;

  if (Array.isArray(node)) {
    node.forEach((child) => replaceDefaultPracticeNames(child, cleanPractice));
    return;
  }
  if (!isObject(node)) return;

  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      node[key] = DEFAULT_PRACTICE_NAMES.reduce(
        (text, defaultName) =>
          text.replace(new RegExp(escapeRegExp(defaultName), "gi"), cleanPractice),
        value,
      );
    } else if (isObject(value) || Array.isArray(value)) {
      replaceDefaultPracticeNames(value, cleanPractice);
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function valueToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
