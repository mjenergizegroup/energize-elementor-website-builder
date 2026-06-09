import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
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
      applySlot(data, def, value, options);
    }
    populatedSlots.push(slotName);
  }

  if (options.normalizeCtaText ?? true) {
    normalizeCtaButtons(data);
  }
  if (options.brandColors) {
    repairTextContrast(data, options.brandColors);
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

function toMapSearchAddress(address: string, practiceName?: string): string {
  const cleanAddress = address.trim();
  const cleanPractice = practiceName?.trim();
  if (!cleanAddress || !cleanPractice) return cleanAddress;
  if (cleanAddress.toLowerCase().startsWith(cleanPractice.toLowerCase())) {
    return cleanAddress;
  }
  return `${cleanPractice} ${cleanAddress}`;
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

const FOREGROUND_FIELDS = [
  "title_color",
  "text_color",
  "description_color",
  "icon_color",
  "primary_color",
  "secondary_color",
  "button_text_color",
] as const;

const BACKGROUND_FIELDS = [
  "background_color",
  "background_overlay_color",
  "background_color_b",
] as const;

interface ResolvedColor {
  hex?: string;
  token?: string;
  unresolvedGlobal?: boolean;
}

function repairTextContrast(node: unknown, colors: BrandColors): void {
  repairNodeTextContrast(node, colors, null);
}

function repairNodeTextContrast(
  node: unknown,
  colors: BrandColors,
  inheritedBackground: ResolvedColor | null,
): void {
  if (Array.isArray(node)) {
    node.forEach((child) => repairNodeTextContrast(child, colors, inheritedBackground));
    return;
  }
  if (!isObject(node)) return;

  const settings = isObject(node.settings) ? node.settings : null;
  const nodeBackground = settings
    ? resolveBackground(settings, colors) ?? inheritedBackground
    : inheritedBackground;

  if (settings) {
    const textBackground =
      isCtaButtonNode(node) && resolveColor(settings, "background_color", colors)
        ? resolveColor(settings, "background_color", colors)
        : nodeBackground;

    for (const field of FOREGROUND_FIELDS) {
      repairForeground(settings, field, textBackground, colors);
    }
  }

  const children = Array.isArray(node.elements)
    ? node.elements
    : Array.isArray(node.content)
      ? node.content
      : [];
  children.forEach((child) => repairNodeTextContrast(child, colors, nodeBackground));
}

function resolveBackground(
  settings: ElementorNode,
  colors: BrandColors,
): ResolvedColor | null {
  for (const field of BACKGROUND_FIELDS) {
    const color = resolveColor(settings, field, colors);
    if (color?.hex || color?.unresolvedGlobal) return color;
  }
  return null;
}

function repairForeground(
  settings: ElementorNode,
  field: string,
  background: ResolvedColor | null,
  colors: BrandColors,
): void {
  if (!background?.hex) return;

  const foreground = resolveColor(settings, field, colors);
  const hasExplicitField =
    settings[field] !== undefined ||
    (isObject(settings.__globals__) && settings.__globals__[field] !== undefined);

  if (!hasExplicitField) return;

  const needsRepair =
    !foreground?.hex ||
    foreground.unresolvedGlobal ||
    contrastRatio(foreground.hex, background.hex) < 4.5;

  if (!needsRepair) return;

  setDirectColor(settings, field, readableForeground(background.hex, colors));
}

function resolveColor(
  settings: ElementorNode,
  field: string,
  colors: BrandColors,
): ResolvedColor | null {
  const globalValue = isObject(settings.__globals__)
    ? settings.__globals__[field]
    : undefined;
  const fromGlobal = resolveColorValue(globalValue, colors);
  if (fromGlobal) return fromGlobal;

  return resolveColorValue(settings[field], colors);
}

function resolveColorValue(value: unknown, colors: BrandColors): ResolvedColor | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const globalMatch = value.match(/globals\/colors\?id=([^"&]+)/);
  if (globalMatch) {
    const token = globalMatch[1];
    const hex = colorTokenToHex(token, colors);
    return hex ? { hex, token } : { token, unresolvedGlobal: true };
  }

  const hex = normalizeHexColor(value);
  if (hex) return { hex };

  const rgba = value.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i,
  );
  if (rgba) {
    return {
      hex: rgbToHex(
        Number.parseInt(rgba[1], 10),
        Number.parseInt(rgba[2], 10),
        Number.parseInt(rgba[3], 10),
      ),
    };
  }

  return null;
}

function colorTokenToHex(token: string, colors: BrandColors): string | null {
  if (token in colors) return colors[token as keyof BrandColors];
  if (token === "white") return "#FFFFFF";
  if (token === "black") return "#111111";
  return null;
}

function normalizeHexColor(value: string): string | null {
  const match = value.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) return null;
  const raw = match[1];
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : raw.slice(0, 6);
  return `#${expanded.toUpperCase()}`;
}

function setDirectColor(settings: ElementorNode, field: string, color: string): void {
  settings[field] = color;
  if (isObject(settings.__globals__)) {
    delete settings.__globals__[field];
  }
}

function readableForeground(background: string, colors: BrandColors): string {
  const candidates = [colors.text, colors.background, "#FFFFFF", "#111111"];
  return candidates.reduce((best, color) =>
    contrastRatio(color, background) > contrastRatio(best, background) ? color : best,
  );
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return { r: 0, g: 0, b: 0 };
  const value = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
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
