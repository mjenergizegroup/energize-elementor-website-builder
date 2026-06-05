/**
 * Elevate theme website-builder - main builder logic.
 *
 * Public entry point: buildElevatePage()
 *
 * Walks the parsed schema data and applies the appropriate widget injector
 * for each field in each section. Auto-injects site-level values into known
 * widget slots (phone buttons on inner-page heroes, practice name on Contact,
 * address/phone icon-boxes on Contact).
 */

import type {
  BuildOptions,
  BuildResult,
  ElementorJSON,
  ElevatePageType,
  FieldTarget,
  RepeatingMap,
  SectionData,
  SectionMap,
  SiteData,
} from "./types";
import { BuildError } from "./types";
import { pageMaps } from "./node-maps";
import {
  findNode,
  injectButton,
  injectElementskitHeading,
  injectHeading,
  injectIconBoxBoth,
  injectIconBoxDesc,
  injectIconBoxTitle,
  injectIconList,
  injectImage,
  injectImageBox,
  injectTextEditor,
} from "./injectors";

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function buildElevatePage(opts: BuildOptions): BuildResult {
  const { pageType, site, pageData, template, slug } = opts;

  if (pageType === "service-page" && !slug) {
    throw new BuildError(
      "service-page requires a slug (e.g. 'cosmetic-dentistry')"
    );
  }

  const map = pageMaps[pageType];
  if (!map) {
    throw new BuildError(`Unknown pageType: ${pageType}`);
  }

  // Deep clone the template so we don't mutate the caller's input.
  const json: ElementorJSON = JSON.parse(JSON.stringify(template));

  const warnings: string[] = [];
  const buildNotes: string[] = [];

  // For service pages, derive service_name from slug and inject into pageData
  // wherever {service_name} appears (the parser doesn't know about this).
  const effectivePageData =
    pageType === "service-page" && slug
      ? substituteServiceName(pageData, slugToServiceName(slug))
      : pageData;

  // Walk each section in the map.
  for (const [sectionName, sectionMap] of Object.entries(map)) {
    const sectionData = effectivePageData[sectionName];
    if (!sectionData) {
      // Section omitted from content - note for build report
      buildNotes.push(
        `[DAVID: hide ${sectionName} section - not in content]`
      );
      continue;
    }
    applySection(json, sectionMap, sectionData, site, warnings, buildNotes, sectionName);
  }

  // Apply site-level auto-injections (phone button, practice name on Contact, etc.)
  applySiteAutoInjections(json, pageType, site);
  normalizeDarkSectionText(json);

  return { json, warnings, buildNotes };
}

// -----------------------------------------------------------------------------
// Section walker
// -----------------------------------------------------------------------------

function applySection(
  json: ElementorJSON,
  sectionMap: SectionMap,
  sectionData: SectionData,
  site: SiteData,
  warnings: string[],
  buildNotes: string[],
  sectionName: string
): void {
  for (const [fieldName, fieldMap] of Object.entries(sectionMap)) {
    const value = sectionData[fieldName];
    if (value === undefined || value === null) {
      // Field omitted - skip silently. The cleanup Project marks intentional
      // gaps with [MISSING:] which arrives here as a string, not undefined.
      continue;
    }

    if (Array.isArray(fieldMap)) {
      // Repeating field - fieldMap is RepeatingMap (array of per-item field dicts)
      applyRepeating(json, fieldMap, value, site, warnings, buildNotes, sectionName, fieldName);
    } else {
      applyField(json, fieldMap, value, site, warnings, sectionName, fieldName);
    }
  }
}

function applyField(
  json: ElementorJSON,
  target: FieldTarget,
  value: unknown,
  site: SiteData,
  warnings: string[],
  sectionName: string,
  fieldName: string
): void {
  const node = findNode(json.content, target.id);
  if (!node) {
    warnings.push(
      `Widget #${target.id} not found in template (${sectionName}.${fieldName}, ${target.kind})`
    );
    return;
  }

  switch (target.kind) {
    case "heading":
    case "elementskit-heading": {
      if (typeof value !== "string") {
        warnings.push(
          `${sectionName}.${fieldName}: expected string for ${target.kind}, got ${typeof value}`
        );
        return;
      }
      if (target.kind === "heading") injectHeading(node, value);
      else injectElementskitHeading(node, value);
      return;
    }

    case "text-editor": {
      if (typeof value !== "string") {
        warnings.push(
          `${sectionName}.${fieldName}: expected string for text-editor, got ${typeof value}`
        );
        return;
      }
      injectTextEditor(node, value);
      return;
    }

    case "button": {
      if (typeof value !== "string") {
        warnings.push(
          `${sectionName}.${fieldName}: expected string for button, got ${typeof value}`
        );
        return;
      }
      injectButton(node, value, target.urlSource, site);
      return;
    }

    case "icon-box-title": {
      if (typeof value !== "string") return;
      injectIconBoxTitle(node, value);
      return;
    }

    case "icon-box-desc": {
      if (typeof value !== "string") return;
      injectIconBoxDesc(node, value);
      return;
    }

    case "icon-box-both": {
      if (!isDict(value)) {
        warnings.push(
          `${sectionName}.${fieldName}: expected object for icon-box-both`
        );
        return;
      }
      const t = value[target.titleKey] ?? "";
      const d = value[target.descKey] ?? "";
      injectIconBoxBoth(node, String(t), String(d));
      return;
    }

    case "icon-list": {
      if (!Array.isArray(value)) {
        warnings.push(
          `${sectionName}.${fieldName}: expected list for icon-list, got ${typeof value}`
        );
        return;
      }
      injectIconList(node, value.map(String));
      return;
    }

    case "image": {
      const url = isDict(value) ? String(value.url || "") : "";
      const alt = isDict(value) ? String(value.alt || "") : "";
      if (!url) return;
      injectImage(node, url, alt);
      return;
    }

    case "image-box": {
      if (!isDict(value)) {
        warnings.push(
          `${sectionName}.${fieldName}: expected object for image-box`
        );
        return;
      }
      const title = String(value[target.titleKey] || "");
      const desc = String(value[target.descKey] || "");
      const imageUrl =
        typeof value.image_url === "string" ? value.image_url : undefined;
      const imageAlt =
        typeof value.image_alt === "string" ? value.image_alt : undefined;
      injectImageBox(node, title, desc, imageUrl, imageAlt);
      return;
    }
  }
}

function applyRepeating(
  json: ElementorJSON,
  itemMaps: RepeatingMap,
  value: unknown,
  site: SiteData,
  warnings: string[],
  buildNotes: string[],
  sectionName: string,
  fieldName: string
): void {
  if (!Array.isArray(value)) {
    warnings.push(
      `${sectionName}.${fieldName}: expected list for repeating field, got ${typeof value}`
    );
    return;
  }

  const items = value as Array<Record<string, unknown>>;
  const slots = itemMaps.length;

  // Inject up to the lesser of (slots available, items provided)
  const fillCount = Math.min(items.length, slots);

  for (let i = 0; i < fillCount; i++) {
    const itemData = items[i];
    const itemMap = itemMaps[i];
    if (!isDict(itemData)) {
      warnings.push(
        `${sectionName}.${fieldName}[${i}]: expected object, got ${typeof itemData}`
      );
      continue;
    }
    // Treat each sub-field of the item like a field of a section.
    for (const [subField, subTarget] of Object.entries(itemMap)) {
      // image / image-box fields expect dict-shaped values
      if (
        (subTarget.kind === "image" || subTarget.kind === "image-box") &&
        subField === "image"
      ) {
        // Item-level image: read url and alt from item directly
        const url = String(itemData.image_url || "");
        const alt = String(itemData.image_alt || "");
        if (url) {
          const node = findNode(json.content, subTarget.id);
          if (!node) {
            warnings.push(
              `Widget #${subTarget.id} not found in template`
            );
            continue;
          }
          injectImage(node, url, alt);
        }
        continue;
      }

      const subValue = itemData[subField];
      if (subValue === undefined) continue;

      applyField(json, subTarget, subValue, site, warnings, sectionName, `${fieldName}[${i}].${subField}`);
    }
  }

  // If content has fewer items than template slots, flag the leftovers for David
  if (items.length < slots) {
    buildNotes.push(
      `[DAVID: hide ${sectionName}.${fieldName} slots ${items.length + 1}-${slots} - only ${items.length} provided]`
    );
  }
  // If content has more items than template slots, warn
  if (items.length > slots) {
    warnings.push(
      `${sectionName}.${fieldName}: ${items.length} items provided but template has only ${slots} slots`
    );
  }
}

// -----------------------------------------------------------------------------
// Site-level auto-injections
// -----------------------------------------------------------------------------

/**
 * Inject site values into well-known widget slots that don't map to schema
 * fields directly: the phone button on inner-page heroes, the practice-name
 * display on Contact, and the address/phone icon-boxes on Contact.
 */
function applySiteAutoInjections(
  json: ElementorJSON,
  pageType: ElevatePageType,
  site: SiteData
): void {
  // Inner-page hero phone buttons. Each page's hero has a 2nd button whose
  // label is the phone number and link is tel:phone.
  const phoneButtonIds: Partial<Record<ElevatePageType, string>> = {
    about: "44132cac",
    "service-page": "155cb69c",
    contact: "4b9e626e",
  };
  const phoneBtnId = phoneButtonIds[pageType];
  if (phoneBtnId && site.phone) {
    const node = findNode(json.content, phoneBtnId);
    if (node) {
      injectButton(node, site.phone, "phone_tel", site);
    }
  }

  // Contact page: practice-name display heading + address + phone icon-boxes
  if (pageType === "contact") {
    if (site.practice_name) {
      const node = findNode(json.content, "6fc73827");
      if (node) injectHeading(node, site.practice_name);
    }

    // Address icon-box
    const addrParts = [
      site.address_line1,
      site.address_city && site.address_state
        ? `${site.address_city}, ${site.address_state} ${site.address_zip || ""}`.trim()
        : "",
    ].filter(Boolean);
    if (addrParts.length) {
      const node = findNode(json.content, "20ce5125");
      if (node) injectIconBoxDesc(node, addrParts.join(", "));
    }

    // Phone icon-box
    if (site.phone) {
      const node = findNode(json.content, "7643f4a");
      if (node) injectIconBoxDesc(node, site.phone);
    }
  }
}

// -----------------------------------------------------------------------------
// Color normalization
// -----------------------------------------------------------------------------

const DARK_GLOBAL_COLOR_IDS = new Set(["primary", "text", "black"]);
const LIGHT_GLOBAL_COLOR_IDS = new Set(["secondary", "background", "white"]);
const WHITE_GLOBAL = "globals/colors?id=white";
const BLACK_GLOBAL = "globals/colors?id=black";

function normalizeDarkSectionText(json: ElementorJSON): void {
  for (const node of json.content) {
    normalizeNodeColors(node, false);
  }
}

function normalizeNodeColors(node: unknown, inheritedDark: boolean): void {
  if (!isDict(node)) return;

  const settings = isDict(node.settings) ? node.settings : {};
  const sectionTone = getSectionTone(settings);
  const inDarkSection =
    sectionTone === "dark" ? true : sectionTone === "light" ? false : inheritedDark;

  if (inDarkSection) {
    applyInverseTextColor(node);
  }

  if (Array.isArray(node.elements)) {
    for (const child of node.elements) {
      normalizeNodeColors(child, inDarkSection);
    }
  }
}

function getSectionTone(settings: Record<string, unknown>): "dark" | "light" | null {
  const globals = isDict(settings.__globals__) ? settings.__globals__ : {};
  const colorRefs = [
    globals.background_color,
    globals.background_overlay_color,
    globals.background_overlay_color_b,
  ];

  const globalIds = colorRefs.map(globalColorId).filter((id): id is string => Boolean(id));
  if (globalIds.some((id) => DARK_GLOBAL_COLOR_IDS.has(id))) return "dark";
  if (globalIds.some((id) => LIGHT_GLOBAL_COLOR_IDS.has(id))) return "light";

  let sawLightLiteral = false;
  for (const ref of colorRefs) {
    if (typeof ref !== "string") continue;
    if (isDarkHexColor(ref)) return "dark";
    if (isLightHexColor(ref)) sawLightLiteral = true;
  }

  const literalColors = [
    settings.background_color,
    settings.background_overlay_color,
    settings.background_overlay_color_b,
  ];
  for (const color of literalColors) {
    if (typeof color !== "string") continue;
    if (isDarkHexColor(color)) return "dark";
    if (isLightHexColor(color)) sawLightLiteral = true;
  }

  return sawLightLiteral ? "light" : null;
}

function applyInverseTextColor(node: Record<string, unknown>): void {
  const settings = isDict(node.settings) ? node.settings : {};
  if (!isDict(settings)) return;

  const widgetType = typeof node.widgetType === "string" ? node.widgetType : "";

  if (widgetType === "heading") {
    setGlobal(settings, "title_color", "white");
    settings.title_color = "#FFFFFF";
    return;
  }

  if (widgetType === "text-editor") {
    setGlobal(settings, "text_color", "white");
    settings.text_color = "#FFFFFF";
    return;
  }

  if (widgetType === "button") {
    const globals = isDict(settings.__globals__) ? settings.__globals__ : {};
    const bgId = globalColorId(globals.background_color);
    if (!bgId || DARK_GLOBAL_COLOR_IDS.has(bgId)) {
      setGlobal(settings, "button_text_color", "white");
    } else if (LIGHT_GLOBAL_COLOR_IDS.has(bgId)) {
      setGlobal(settings, "button_text_color", "black");
    }
    return;
  }

  if (widgetType === "icon-box") {
    setGlobal(settings, "title_color", "white");
    setGlobal(settings, "description_color", "white");
  }
}

function setGlobal(
  settings: Record<string, unknown>,
  key: string,
  colorId: "white" | "black"
): void {
  const globals = isDict(settings.__globals__)
    ? settings.__globals__
    : (settings.__globals__ = {});
  globals[key] = colorId === "white" ? WHITE_GLOBAL : BLACK_GLOBAL;
}

function globalColorId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/globals\/colors\?id=([^/&]+)/);
  return match?.[1] || null;
}

function isDarkHexColor(value: string): boolean {
  const rgb = parseHexColor(value);
  if (!rgb) return false;
  return relativeLuminance(rgb) < 0.45;
}

function isLightHexColor(value: string): boolean {
  const rgb = parseHexColor(value);
  if (!rgb) return false;
  return relativeLuminance(rgb) >= 0.45;
}

function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const match = value.trim().match(/^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/);
  if (!match) return null;
  const hex = match[1];
  const parsed = Number.parseInt(hex, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function isDict(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Convert a service-page slug to a human-readable name.
 * Example: 'cosmetic-dentistry' to 'Cosmetic Dentistry'
 *          'all-on-4' to 'All On 4'
 */
export function slugToServiceName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Walk pageData and substitute {service_name} in every string value.
 * The parser doesn't know about service_name (it's slug-derived), so this
 * happens at build time for service pages only.
 */
function substituteServiceName(pageData: PageData, serviceName: string): PageData {
  const sub = (val: unknown): unknown => {
    if (typeof val === "string") {
      return val.replace(/\{service_name\}/g, serviceName);
    }
    if (Array.isArray(val)) return val.map(sub);
    if (isDict(val)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) out[k] = sub(v);
      return out;
    }
    return val;
  };
  return sub(pageData) as PageData;
}

// Re-export for convenience
import type { PageData } from "./types";
export type { PageData };
