import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

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
): LandingPageInjectionResult {
  const data = structuredCloneJson(loadTemplate(templateName));
  const slotMap = loadSlotMap(templateName);
  const populatedSlots: string[] = [];
  const missingSlots: string[] = [];

  for (const [slotName, rawDefs] of Object.entries(slotMap.slots)) {
    if (!(slotName in content)) {
      missingSlots.push(slotName);
      continue;
    }
    const value = content[slotName];
    const defs = Array.isArray(rawDefs) ? rawDefs : [rawDefs];
    for (const def of defs) {
      applySlot(data, def, value);
    }
    populatedSlots.push(slotName);
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

function applySlot(data: ElementorNode, slotDef: SlotDefinition, value: unknown): void {
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
      settings.address = text;
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
  const items = Array.isArray(value) ? value : valueToText(value).split(/\r?\n/);
  const existingItems = Array.isArray(existing) ? existing : [];
  return items
    .map((item) => valueToText(item).trim())
    .filter(Boolean)
    .map((text, index) => {
      const existingItem = isObject(existingItems[index]) ? existingItems[index] : {};
      return { ...existingItem, _id: existingItem._id ?? makeElementorId(), text };
    });
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
  settings[target] = current.replace(
    /src=(["'])https?:\/\/[^"']*reputationhub[^"']+\1/i,
    `src="${reviewUrl}"`,
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
