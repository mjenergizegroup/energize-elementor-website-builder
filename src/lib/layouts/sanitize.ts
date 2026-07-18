import { createHash, randomBytes } from "node:crypto";
import type { TemplateAnalysis } from "@/lib/template-import/types";
import type {
  LayoutIdentityFingerprint,
  LayoutSanitationReport,
  LayoutSemanticSlot,
  LayoutSlotKind,
  SanitizedLayoutResult,
} from "./types";

type JsonRecord = Record<string, unknown>;

const SANITIZER_VERSION = "1";
const CONTENT_KEYS = new Set([
  "description",
  "editor",
  "sub_title",
  "subtitle",
  "text",
  "title",
]);
const SOURCE_MEDIA_PATTERN = /(?:background.*(?:image|gallery)|image|gallery|video|poster)/i;
const SOURCE_LINK_PATTERN = /(?:^|_)(?:link|url|href)(?:$|_)/i;
const CUSTOM_CODE_PATTERN = /(?:custom_css|html|javascript|script|code|tracking|pixel)/i;
const GLOBAL_PATTERN = /^__(?:globals|dynamic)__$/;
const SAFE_STYLE_PATTERN = /^(?:_element_|_flex_|align|animation|background_(?:background|position|repeat|size)|border|content_width|display|flex|gap|grid|header_size|height|icon_|justify|margin|max_|min_|object_|order|overflow|padding|position|text_align|text_padding|transform|transition|typography_(?:font_size|font_style|font_weight|letter_spacing|line_height|text_transform)|width|z_index)/;
const SUPPORTED_WIDGETS = new Set([
  "button",
  "heading",
  "icon",
  "icon-box",
  "icon-list",
  "image",
  "text-editor",
]);

interface MutableState {
  slots: LayoutSemanticSlot[];
  report: LayoutSanitationReport;
  sourceMarkers: Array<{ kind: LayoutIdentityFingerprint["kind"]; value: string }>;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function generateId(): string {
  return randomBytes(4).toString("hex");
}

function digest(value: string): string {
  return createHash("sha256").update(value.toLowerCase()).digest("hex");
}

function markerFor(slot: LayoutSemanticSlot): string {
  return `{{ENERGIZE_SLOT:${slot.id}}}`;
}

function addSlot(
  state: MutableState,
  nodeId: string,
  kind: LayoutSlotKind,
  settingKey: string,
  repeatable = false,
): LayoutSemanticSlot {
  const slot: LayoutSemanticSlot = {
    id: `${kind}-${state.slots.length + 1}`,
    kind,
    nodeId,
    settingKey,
    order: state.slots.length,
    repeatable,
  };
  state.slots.push(slot);
  return slot;
}

function recordSourceMarker(
  state: MutableState,
  kind: LayoutIdentityFingerprint["kind"],
  value: unknown,
) {
  if (typeof value !== "string") return;
  const normalized = value.trim();
  if (normalized.length < 4 || normalized.startsWith("{{ENERGIZE_")) return;
  state.sourceMarkers.push({ kind, value: normalized });
}

function collectSourceIdentity(
  state: MutableState,
  value: unknown,
  key = "",
  depth = 0,
) {
  if (depth > 100) return;
  if (Array.isArray(value)) {
    for (const child of value) collectSourceIdentity(state, child, key, depth + 1);
    return;
  }
  if (!isRecord(value)) return;

  if (typeof value.id === "number" || typeof value.id === "string") {
    recordSourceMarker(state, "id", String(value.id));
  }

  for (const [childKey, child] of Object.entries(value)) {
    if (typeof child === "string") {
      if (SOURCE_LINK_PATTERN.test(childKey) || /^https?:\/\//i.test(child)) {
        recordSourceMarker(state, "url", child);
        try {
          recordSourceMarker(state, "domain", new URL(child).hostname);
        } catch {
          // Non-absolute links are still captured as URL markers above.
        }
      }
      if (/email/i.test(childKey) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(child)) {
        recordSourceMarker(state, "email", child);
      }
      if (/phone|tel/i.test(childKey) || /^\+?[\d\s().-]{10,}$/.test(child)) {
        recordSourceMarker(state, "phone", child);
      }
      if (CONTENT_KEYS.has(childKey) || childKey === "alt" || childKey === "caption") {
        recordSourceMarker(state, "content", child);
      }
    } else {
      collectSourceIdentity(state, child, childKey, depth + 1);
    }
  }
}

function sanitizeScalar(value: unknown): unknown {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((child) => sanitizeScalar(child))
      .filter((child) => child !== undefined);
  }
  if (!isRecord(value)) return undefined;

  const result: JsonRecord = {};
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:id|url|href|alt|caption|source)$/.test(key)) continue;
    const sanitized = sanitizeScalar(child);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

function sanitizeSettings(
  settings: JsonRecord,
  nodeId: string,
  widgetType: string | undefined,
  state: MutableState,
): JsonRecord {
  const result: JsonRecord = {};

  for (const [key, value] of Object.entries(settings)) {
    if (GLOBAL_PATTERN.test(key)) {
      const count = isRecord(value) ? Object.keys(value).length : 1;
      if (key === "__globals__") state.report.globalsRemoved += count;
      else state.report.dynamicBindingsRemoved += count;
      state.report.settingsRemoved += 1;
      continue;
    }
    if (CUSTOM_CODE_PATTERN.test(key)) {
      state.report.customCodeRemoved += 1;
      state.report.settingsRemoved += 1;
      continue;
    }
    if (SOURCE_MEDIA_PATTERN.test(key)) {
      const hasSource = JSON.stringify(value) !== "{}" && JSON.stringify(value) !== "[]";
      if (hasSource) {
        const slot = addSlot(state, nodeId, "image", key, /gallery/.test(key));
        result[key] = { id: "", url: markerFor(slot), alt: "" };
        state.report.sourceMediaRemoved += 1;
      }
      state.report.settingsRemoved += 1;
      continue;
    }
    if (SOURCE_LINK_PATTERN.test(key)) {
      const slot = addSlot(state, nodeId, "link", key);
      result[key] = { url: markerFor(slot), is_external: "", nofollow: "" };
      state.report.sourceLinksRemoved += 1;
      state.report.settingsRemoved += 1;
      continue;
    }
    if (CONTENT_KEYS.has(key)) {
      let kind: LayoutSlotKind = key === "editor" || key === "description" ? "body" : "heading";
      if (widgetType === "button" && key === "text") kind = "button-label";
      if (widgetType === "icon-list") kind = "list";
      const slot = addSlot(state, nodeId, kind, key, kind === "list");
      result[key] = markerFor(slot);
      state.report.contentValuesRemoved += 1;
      continue;
    }
    if (/color/i.test(key)) {
      const role = /background/i.test(key) ? "background" : "text";
      result[key] = `{{ENERGIZE_BRAND:${role}}}`;
      state.report.settingsRemoved += 1;
      continue;
    }
    if (key === "icon_list" || key === "tabs" || key === "slides") {
      const slot = addSlot(state, nodeId, "list", key, true);
      result[key] = [markerFor(slot)];
      state.report.contentValuesRemoved += 1;
      continue;
    }
    if (!SAFE_STYLE_PATTERN.test(key)) {
      state.report.settingsRemoved += 1;
      continue;
    }
    const sanitized = sanitizeScalar(value);
    if (sanitized !== undefined) result[key] = sanitized;
  }

  if (widgetType === "image" && !state.slots.some((slot) => slot.nodeId === nodeId && slot.kind === "image")) {
    const slot = addSlot(state, nodeId, "image", "image");
    result.image = { id: "", url: markerFor(slot), alt: "" };
  }

  return result;
}

function sanitizeNode(node: unknown, state: MutableState): JsonRecord | undefined {
  if (!isRecord(node)) return undefined;
  state.report.sourceNodes += 1;

  const elType = typeof node.elType === "string" ? node.elType : "";
  const widgetType = typeof node.widgetType === "string" ? node.widgetType : undefined;
  if (elType === "widget" && (!widgetType || !SUPPORTED_WIDGETS.has(widgetType))) {
    state.report.unsupportedWidgetsRemoved.push(widgetType || "unknown");
    return undefined;
  }

  const nextId = generateId();
  const children = Array.isArray(node.elements)
    ? node.elements
        .map((child) => sanitizeNode(child, state))
        .filter((child): child is JsonRecord => Boolean(child))
    : [];
  const sanitized: JsonRecord = {
    id: nextId,
    elType: elType || "container",
    settings: sanitizeSettings(
      isRecord(node.settings) ? node.settings : {},
      nextId,
      widgetType,
      state,
    ),
    elements: children,
    isInner: Boolean(node.isInner),
  };
  if (widgetType) sanitized.widgetType = widgetType;

  state.report.sanitizedNodes += 1;
  state.report.regeneratedIds += 1;
  return sanitized;
}

function uniqueFingerprints(
  markers: MutableState["sourceMarkers"],
): LayoutIdentityFingerprint[] {
  const seen = new Set<string>();
  const result: LayoutIdentityFingerprint[] = [];
  for (const marker of markers) {
    const value = marker.value.trim().toLowerCase();
    const key = `${marker.kind}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ kind: marker.kind, digest: digest(value), length: value.length });
  }
  return result;
}

function residueScan(
  artifact: JsonRecord,
  sourceMarkers: MutableState["sourceMarkers"],
): string[] {
  const serialized = JSON.stringify(artifact).toLowerCase();
  const matches = new Set<string>();

  for (const marker of sourceMarkers) {
    const value = marker.value.trim().toLowerCase();
    if (value.length >= 4 && serialized.includes(value)) matches.add(marker.kind);
  }
  if (/https?:\/\//i.test(serialized)) matches.add("url");
  if (/[^\s"']+@[^\s"']+\.[^\s"']+/.test(serialized)) matches.add("email");
  if (/__(?:globals|dynamic)__/.test(serialized)) matches.add("global-binding");
  if (/(?:custom_css|javascript|tracking|pixel)/.test(serialized)) matches.add("custom-code");

  return [...matches].sort();
}

function structuralSummary(slots: LayoutSemanticSlot[]): string {
  const parts: string[] = [];
  if (slots.some((slot) => slot.kind === "heading")) parts.push("hero and headings");
  if (slots.some((slot) => slot.kind === "image")) parts.push("image regions");
  if (slots.some((slot) => slot.kind === "body" || slot.kind === "list")) {
    parts.push("content sections");
  }
  if (slots.some((slot) => slot.kind === "button-label" || slot.kind === "link")) {
    parts.push("call to action");
  }
  return parts.length > 0 ? parts.join(", ") : "Structure requires template setup";
}

export function sanitizeLayoutTemplate(input: {
  analysis: TemplateAnalysis;
  document: unknown;
  fileName: string;
}): SanitizedLayoutResult {
  const report: LayoutSanitationReport = {
    sourceNodes: 0,
    sanitizedNodes: 0,
    regeneratedIds: 0,
    settingsRemoved: 0,
    contentValuesRemoved: 0,
    sourceLinksRemoved: 0,
    sourceMediaRemoved: 0,
    globalsRemoved: 0,
    dynamicBindingsRemoved: 0,
    customCodeRemoved: 0,
    unsupportedWidgetsRemoved: [],
    blockingReasons: [],
    residueMatches: [],
  };
  const state: MutableState = { slots: [], report, sourceMarkers: [] };
  const filenameStem = input.fileName.replace(/\.json$/i, "").trim();
  recordSourceMarker(state, "filename", filenameStem);
  collectSourceIdentity(state, input.document);

  const document = isRecord(input.document) ? input.document : {};
  if (input.analysis.format.family !== "elementor-export" || !Array.isArray(document.content)) {
    report.blockingReasons.push("This file is not a supported Elementor page export.");
  }
  if (input.analysis.dependencies.sensitiveFieldNames.length > 0) {
    report.blockingReasons.push("Credential-like fields must be removed before this layout can be used.");
  }
  if (input.analysis.warnings.some((warning) => warning.severity === "blocker")) {
    report.blockingReasons.push("The source file did not pass safe template analysis.");
  }
  if (document.type && document.type !== "page") {
    report.blockingReasons.push("Only normal page layouts can be added to the website library.");
  }

  const content = Array.isArray(document.content)
    ? document.content
        .map((node) => sanitizeNode(node, state))
        .filter((node): node is JsonRecord => Boolean(node))
    : [];
  const artifact: JsonRecord = {
    schemaVersion: "1",
    sanitizer: { id: "energize-layout", version: SANITIZER_VERSION },
    type: "page",
    content,
  };

  report.unsupportedWidgetsRemoved = [...new Set(report.unsupportedWidgetsRemoved)].sort();
  if (content.length === 0) report.blockingReasons.push("No supported page structure remained after sanitation.");
  if (state.slots.length === 0) report.blockingReasons.push("No reusable content regions were detected.");
  report.residueMatches = residueScan(artifact, state.sourceMarkers);
  if (report.residueMatches.length > 0) {
    report.blockingReasons.push("Source-site residue remains in the sanitized layout.");
  }

  const count = (kind: LayoutSlotKind) => state.slots.filter((slot) => slot.kind === kind).length;
  return {
    status: report.blockingReasons.length === 0 ? "ready" : "needs_setup",
    artifact,
    semanticSlots: state.slots,
    identityFingerprints: uniqueFingerprints(state.sourceMarkers),
    report,
    thumbnail: {
      sectionCount: content.length,
      headingSlots: count("heading"),
      bodySlots: count("body") + count("list"),
      imageSlots: count("image"),
      buttonSlots: count("button-label"),
    },
    structuralSummary: structuralSummary(state.slots),
  };
}

export { SANITIZER_VERSION };
