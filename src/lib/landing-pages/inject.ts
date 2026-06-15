import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { repairElementorTextContrast } from "@/lib/elementor/contrast";
import type { BrandColors } from "@/lib/types";

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

type ElementorNode = Record<string, unknown>;

interface SlotDefinition {
  widget_id: string;
  field: string;
  index?: number;
}

interface SlotMap {
  template?: string;
  description?: string;
  notes?: string[];
  slots: Record<string, SlotDefinition | SlotDefinition[]>;
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
  data: ElementorNode;
  populatedSlots: string[];
  missingSlots: string[];
}

export interface LandingPageInjectOptions {
  brandColors?: BrandColors;
  practiceName?: string;
  normalizeCtaText?: boolean;
}

function isTemplateName(value: string): value is LandingPageTemplateName {
  return LANDING_PAGE_TEMPLATES.includes(value as LandingPageTemplateName);
}

export function assertLandingPageTemplateName(
  value: string,
): asserts value is LandingPageTemplateName {
  if (!isTemplateName(value)) {
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
  return LANDING_PAGE_TEMPLATES.map((name) => getLandingPageTemplateSummary(name));
}

export function injectLandingPage(
  templateName: LandingPageTemplateName,
  content: LandingPageContent,
  options: LandingPageInjectOptions = {},
): LandingPageInjectionResult {
  const data = structuredCloneJson(loadTemplate(templateName));
  const slotMap = loadSlotMap(templateName);
  const normalizedContent = normalizeLandingPageContent(content);
  const populatedSlots: string[] = [];
  const missingSlots: string[] = [];

  for (const [slotName, rawDefs] of Object.entries(slotMap.slots)) {
    if (!(slotName in normalizedContent)) {
      missingSlots.push(slotName);
      continue;
    }
    const value = normalizedContent[slotName];
    const defs = Array.isArray(rawDefs) ? rawDefs : [rawDefs];
    for (const def of defs) {
      applySlot(data, def, value, options);
    }
    populatedSlots.push(slotName);
  }

  if (options.normalizeCtaText ?? true) {
    normalizeCtaButtons(data);
  }
  replaceDefaultPracticeNames(data, options.practiceName);
  if (options.brandColors) {
    repairElementorTextContrast(data, options.brandColors);
  }

  return { data, populatedSlots, missingSlots };
}

function loadTemplate(templateName: LandingPageTemplateName): ElementorNode {
  const file = path.join(
    process.cwd(),
    "data",
    "landing-page-templates",
    `${templateName}.json`,
  );
  return JSON.parse(readFileSync(file, "utf-8")) as ElementorNode;
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

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeLandingPageContent(content: LandingPageContent): LandingPageContent {
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
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function findWidget(node: unknown, widgetId: string): ElementorNode | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findWidget(item, widgetId);
      if (found) return found;
    }
    return null;
  }

  if (!isObject(node)) return null;

  if (node.id === widgetId && node.elType === "widget") {
    return node;
  }

  for (const value of Object.values(node)) {
    const found = findWidget(value, widgetId);
    if (found) return found;
  }
  return null;
}

function applySlot(
  data: ElementorNode,
  slotDef: SlotDefinition,
  value: unknown,
  options: LandingPageInjectOptions,
): void {
  const widget = findWidget(data, slotDef.widget_id);
  if (!widget) return;

  const settings = ensureObject(widget, "settings");
  const text = valueToText(value);

  switch (slotDef.field) {
    case "title":
      settings.title = text;
      break;
    case "editor":
      settings.editor = text.trim().startsWith("<") ? text : `<p>${escapeHtml(text)}</p>`;
      break;
    case "icon_list_item":
      setIconListItem(settings, slotDef.index ?? 0, text);
      break;
    case "icon_list_all":
      settings.icon_list = toIconList(value, settings.icon_list);
      break;
    case "button_phone":
      settings.text = text;
      ensureObject(settings, "link").url = `tel:${digitsOnly(text)}`;
      break;
    case "button_url":
      ensureObject(settings, "link").url = text;
      break;
    case "button_text":
      settings.text = text;
      break;
    case "description_text":
      settings.description_text = text;
      break;
    case "maps_address":
      settings.address = toMapSearchAddress(text, options.practiceName);
      break;
    case "form_html":
      settings.html = replaceFormHtml(valueToText(settings.html), text);
      break;
    case "review_html":
      replaceReviewHtml(settings, text);
      break;
    case "raw_html":
      settings.html = text;
      break;
    case "jkit_dual_phone":
      settings.sg_one_text = `Call: ${text}`;
      ensureObject(settings, "sg_one_link").url = `tel:${digitsOnly(text)}`;
      break;
    case "jkit_dual_form_url":
      ensureObject(settings, "sg_two_link").url = text;
      break;
    case "faq_items":
      settings.ekit_accordion_items = toFaqItems(value, settings.ekit_accordion_items);
      break;
    default:
      throw new Error(`Unsupported landing page slot field: ${slotDef.field}`);
  }
}

function setIconListItem(settings: ElementorNode, index: number, text: string): void {
  const list = Array.isArray(settings.icon_list) ? settings.icon_list : [];
  while (list.length <= index) {
    list.push({ _id: makeElementorId(), text: "" });
  }
  const item = isObject(list[index]) ? list[index] : {};
  item.text = text;
  if (!item._id) item._id = makeElementorId();
  list[index] = item;
  settings.icon_list = list;
}

function toIconList(value: unknown, existing: unknown): ElementorNode[] {
  const items = toTextList(value);
  const existingItems = Array.isArray(existing) ? existing : [];
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((text, index) => {
      const existingItem = isObject(existingItems[index]) ? existingItems[index] : {};
      return { ...existingItem, _id: existingItem._id ?? makeElementorId(), text };
    });
}

function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => structuredListItemToText(item));
  }

  if (isObject(value)) {
    const nested =
      value.items ??
      value.hours ??
      value.work_hours ??
      value.workHours ??
      value.business_hours ??
      value.businessHours;
    if (Array.isArray(nested)) {
      return nested.map((item) => structuredListItemToText(item));
    }

    return Object.entries(value).map(([key, item]) => {
      const label = humanizeKey(key);
      if (isObject(item)) {
        return structuredListItemToText({ ...item, day: item.day ?? label });
      }
      return `${label}: ${valueToText(item)}`;
    });
  }

  return valueToText(value).split(/\r?\n/);
}

function structuredListItemToText(item: unknown): string {
  if (!isObject(item)) return valueToText(item);

  const text = item.text ?? item.label ?? item.value;
  if (text != null) return valueToText(text);

  const day = valueToText(item.day ?? item.days ?? item.name).trim();
  const closed = Boolean(item.closed ?? item.isClosed);
  if (closed) return day ? `${day}: Closed` : "Closed";

  const hours = item.hours ?? item.time ?? item.times;
  if (hours != null) {
    return day ? `${day}: ${valueToText(hours)}` : valueToText(hours);
  }

  const open = item.open ?? item.start ?? item.from;
  const close = item.close ?? item.end ?? item.to;
  if (open != null || close != null) {
    const range = [open, close].map(valueToText).filter(Boolean).join(" - ");
    return day ? `${day}: ${range}` : range;
  }

  return valueToText(item);
}

function toFaqItems(value: unknown, existing: unknown): ElementorNode[] {
  const items = Array.isArray(value) ? value : [];
  const existingItems = Array.isArray(existing) ? existing : [];
  return items.map((item, index) => {
    const source = isObject(item) ? item : {};
    const title = valueToText(source.question ?? source.title ?? source.acc_title);
    const answer = valueToText(source.answer ?? source.content ?? source.acc_content);
    const existingItem = isObject(existingItems[index]) ? existingItems[index] : {};
    return {
      ...existingItem,
      acc_title: title,
      acc_content: answer.trim().startsWith("<") ? answer : `<p>${escapeHtml(answer)}</p>`,
      _id: existingItem._id ?? makeElementorId(),
    };
  });
}

function replaceFormHtml(html: string, formUrl: string): string {
  const token = extractLastPathToken(formUrl);
  return html
    .replace(/src=(["'])https?:\/\/[^"']*leadconnectorhq\.com\/widget\/form\/[^"']+\1/i, `src="${formUrl}"`)
    .replace(/(data-form-id=(["']))[^"']+(\2)/gi, `$1${token}$3`)
    .replace(/(id=(["'])inline-[^"']*-)[^"']+(\2)/gi, `$1${token}$3`);
}

function replaceReviewHtml(settings: ElementorNode, reviewUrl: string): void {
  const target = typeof settings.html === "string" ? "html" : "shortcode";
  const current = valueToText(settings[target]);
  const reputationPattern = /src=(["'])https?:\/\/[^"']*reputationhub[^"']+\1/i;
  const firstIframePattern = /src=(["'])https?:\/\/[^"']+\1/i;
  settings[target] = current
    .replace(reputationPattern, `src="${reviewUrl}"`)
    .replace(firstIframePattern, (match) =>
      match.includes(reviewUrl) ? match : `src="${reviewUrl}"`,
    );
}

function toMapSearchAddress(address: string, practiceName?: string): string {
  const cleanAddress = address.trim();
  const cleanPractice = practiceName?.trim();
  if (isLikelyUrl(cleanAddress)) return cleanAddress;
  if (!cleanAddress || !cleanPractice) return cleanAddress;
  if (cleanAddress.toLowerCase().startsWith(cleanPractice.toLowerCase())) {
    return cleanAddress;
  }
  return `${cleanPractice} ${cleanAddress}`;
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
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
      node[key] = replaceDefaultPracticeNameText(value, cleanPractice);
    } else if (isObject(value) || Array.isArray(value)) {
      replaceDefaultPracticeNames(value, cleanPractice);
    }
  }
}

function replaceDefaultPracticeNameText(value: string, practiceName: string): string {
  return DEFAULT_PRACTICE_NAMES.reduce(
    (text, defaultName) =>
      text.replace(new RegExp(escapeRegExp(defaultName), "gi"), practiceName),
    value,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCtaButtons(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(normalizeCtaButtons);
    return;
  }
  if (!isObject(node)) return;

  const settings = isObject(node.settings) ? node.settings : null;
  if (settings && isCtaButtonNode(node)) {
    for (const field of ["text", "button_text", "sg_one_text", "sg_two_text"]) {
      const value = settings[field];
      if (typeof value === "string" && shouldNormalizeCta(value)) {
        settings[field] = "Free Consultation";
      }
    }
  }

  for (const child of Object.values(node)) {
    normalizeCtaButtons(child);
  }
}

function isCtaButtonNode(node: ElementorNode): boolean {
  return (
    node.elType === "widget" &&
    typeof node.widgetType === "string" &&
    node.widgetType.toLowerCase().includes("button")
  );
}

function shouldNormalizeCta(value: string): boolean {
  const text = value.toLowerCase();
  if (/\b(call|phone|tel|submit|website)\b/.test(text)) return false;
  return /\b(appointment|book|consult|consultation|schedule|visit|veneer|whitening|crown|makeover|learn more|today)\b/.test(
    text,
  );
}

function extractLastPathToken(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? "";
  } catch {
    const parts = url.split(/[/?#]/).filter(Boolean);
    return parts.at(-1) ?? "";
  }
}

function ensureObject(parent: ElementorNode, key: string): ElementorNode {
  if (!isObject(parent[key])) {
    parent[key] = {};
  }
  return parent[key] as ElementorNode;
}

function isObject(value: unknown): value is ElementorNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function makeElementorId(): string {
  return Math.random().toString(16).slice(2, 9).padEnd(7, "0");
}
