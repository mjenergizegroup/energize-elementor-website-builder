import { randomBytes } from "node:crypto";
import { button, flexbox, heading, image, paragraph } from "@/lib/elementor/atomic/elements";
import { CLASS_IDS } from "@/lib/elementor/atomic/foundation";
import type { LayoutSemanticSlot } from "@/lib/layouts/types";
import type { MigrationWizardWorkspace } from "@/lib/migration/types";
import type {
  NormalizedContentSlot,
  NormalizedPageContent,
} from "./types";

type JsonRecord = Record<string, unknown>;

type AssignedContent =
  | Extract<NormalizedContentSlot, { kind: "heading" | "image" | "link" }>
  | { kind: "rich-text"; html: string };

export interface ElementorV3InjectionResult {
  elementorData: unknown[];
  replaced: number;
  appended: number;
  removedPlaceholders: number;
}

export function isSanitizedElementorV3Artifact(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.content)) return false;
  return containsClassicElementorContent(value.content);
}

export function containsClassicElementorContent(value: unknown[]): boolean {
  const stack = [...value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!isRecord(node)) continue;
    if (["section", "column", "container"].includes(String(node.elType ?? ""))) {
      return true;
    }
    if (
      node.elType === "widget" &&
      typeof node.widgetType === "string" &&
      !node.widgetType.startsWith("e-")
    ) {
      return true;
    }
    if (Array.isArray(node.elements)) stack.push(...node.elements);
  }
  return false;
}

export function injectSanitizedElementorV3Content(
  source: unknown[],
  content: NormalizedPageContent,
  options: {
    semanticSlots: LayoutSemanticSlot[];
    colors?: MigrationWizardWorkspace["colors"];
  },
): ElementorV3InjectionResult {
  const elementorData = structuredClone(source).filter(isRecord);
  const slotsByNode = groupSlotsByNode(options.semanticSlots);
  const rootsWithTargets = elementorData
    .map((root, index) => ({
      root,
      index,
      slots: collectRootSlots(root, slotsByNode),
    }))
    .filter((entry) => entry.slots.length > 0);
  const contentGroups = groupContentSections(content.slots);
  const allocation = allocateContentGroups(
    contentGroups,
    rootsWithTargets.map((entry) => contentCapacity(entry.slots)),
  );
  const assignments = new Map<string, AssignedContent>();
  const appendedByRoot = new Map<number, NormalizedContentSlot[]>();
  let appended = 0;

  for (let index = 0; index < rootsWithTargets.length; index += 1) {
    const targetGroup = rootsWithTargets[index];
    const sourceGroup = allocation.byTarget[index]?.flat() ?? [];
    const consumed = new Set<string>();

    assignOneToOne(
      targetGroup.slots.filter((slot) => slot.kind === "heading"),
      sourceGroup.filter(isHeading),
      assignments,
      consumed,
    );
    assignRichText(
      targetGroup.slots.filter((slot) => slot.kind === "body" || slot.kind === "list"),
      sourceGroup.filter(isRichText),
      assignments,
      consumed,
    );
    assignOneToOne(
      targetGroup.slots.filter((slot) => slot.kind === "image"),
      sourceGroup.filter(isImage),
      assignments,
      consumed,
    );
    assignLinks(
      targetGroup.slots,
      sourceGroup.filter(isLink),
      assignments,
      consumed,
    );

    const remaining = sourceGroup.filter((slot) => !consumed.has(slot.id));
    if (remaining.length > 0) {
      appendedByRoot.set(targetGroup.index, remaining);
      appended += remaining.length;
    }
  }

  const overflowGroups = allocation.overflow;
  appended += overflowGroups.reduce((sum, group) => sum + group.length, 0);

  let replaced = 0;
  let removedPlaceholders = 0;
  const injectNode = (node: JsonRecord): JsonRecord | undefined => {
    const nodeId = typeof node.id === "string" ? node.id : "";
    const slots = slotsByNode.get(nodeId) ?? [];
    const settings = isRecord(node.settings) ? node.settings : {};
    let assignedOnNode = 0;

    for (const slot of slots) {
      const assignment = assignments.get(slot.id);
      if (assignment) {
        applyAssignment(settings, slot, assignment);
        assignedOnNode += 1;
        replaced += 1;
      } else {
        clearSlot(settings, slot);
        removedPlaceholders += 1;
      }
    }

    node.settings = settings;
    node.elements = Array.isArray(node.elements)
      ? node.elements
          .filter(isRecord)
          .map(injectNode)
          .filter((child): child is JsonRecord => Boolean(child))
      : [];

    if (
      node.elType === "widget" &&
      slots.length > 0 &&
      assignedOnNode === 0 &&
      node.widgetType !== "image"
    ) {
      removedPlaceholders += 1;
      return undefined;
    }
    return node;
  };

  const fittedRoots = elementorData
    .map((root, index) => ({ root: injectNode(root), index }))
    .filter(
      (entry): entry is { root: JsonRecord; index: number } =>
        Boolean(entry.root),
    );
  const fitted: unknown[] = [];
  for (const { root, index } of fittedRoots) {
    const extra = appendedByRoot.get(index);
    if (extra?.length) {
      appendV3ContentStack(root, v3ContentStack(extra));
    }
    fitted.push(root);
  }
  for (const group of overflowGroups) {
    if (group.length > 0) fitted.push(standardAtomicSection(group));
  }

  replaceBrandMarkers(fitted, options.colors);
  regenerateElementIds(fitted);

  return {
    elementorData: fitted,
    replaced,
    appended,
    removedPlaceholders,
  };
}

function v3ContentStack(slots: NormalizedContentSlot[]): JsonRecord {
  return {
    id: randomBytes(4).toString("hex"),
    elType: "container",
    settings: {
      flex_direction: "column",
      content_width: "full",
      width: { unit: "%", size: 100, sizes: [] },
      flex_gap: {
        column: "16",
        row: "16",
        isLinked: true,
        unit: "px",
        size: 16,
      },
    },
    elements: slots.map(slotToV3),
    isInner: true,
  };
}

function appendV3ContentStack(root: JsonRecord, stack: JsonRecord) {
  if (root.elType !== "section") {
    const children = Array.isArray(root.elements) ? root.elements : [];
    root.elements = [...children, stack];
    return;
  }

  const target = lastClassicContentParent(root);
  if (target) {
    const children = Array.isArray(target.elements) ? target.elements : [];
    target.elements = [...children, stack];
    return;
  }

  const children = Array.isArray(root.elements) ? root.elements : [];
  root.elements = [
    ...children,
    {
      id: randomBytes(4).toString("hex"),
      elType: "column",
      settings: { _column_size: 100, _inline_size: null },
      elements: [stack],
      isInner: false,
    },
  ];
}

function lastClassicContentParent(root: JsonRecord): JsonRecord | undefined {
  const stack = Array.isArray(root.elements)
    ? root.elements.filter(isRecord).reverse()
    : [];
  let target: JsonRecord | undefined;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    if (current.elType === "column" || current.elType === "container") {
      target = current;
    }
    if (Array.isArray(current.elements)) {
      stack.push(...current.elements.filter(isRecord).reverse());
    }
  }
  return target;
}

function slotToV3(slot: NormalizedContentSlot): JsonRecord {
  if (slot.kind === "heading") {
    return {
      id: randomBytes(4).toString("hex"),
      elType: "widget",
      widgetType: "heading",
      settings: { title: safeText(slot.text), header_size: `h${slot.level}` },
      elements: [],
      isInner: false,
    };
  }
  if (slot.kind === "rich-text") {
    return {
      id: randomBytes(4).toString("hex"),
      elType: "widget",
      widgetType: "text-editor",
      settings: { editor: safeRichText(slot.html) },
      elements: [],
      isInner: false,
    };
  }
  if (slot.kind === "image") {
    return {
      id: randomBytes(4).toString("hex"),
      elType: "widget",
      widgetType: "image",
      settings: {
        image: {
          id: "",
          url: safeImageUrl(slot.sourceUrl),
          alt: safeText(slot.altText),
        },
        image_size: "full",
      },
      elements: [],
      isInner: false,
    };
  }
  return {
    id: randomBytes(4).toString("hex"),
    elType: "widget",
    widgetType: "button",
    settings: {
      text: safeText(slot.label),
      link: {
        url: safeLink(slot.href),
        is_external: "",
        nofollow: "",
      },
    },
    elements: [],
    isInner: false,
  };
}

function allocateContentGroups(
  groups: NormalizedContentSlot[][],
  capacities: number[],
): {
  byTarget: NormalizedContentSlot[][][];
  overflow: NormalizedContentSlot[][];
} {
  if (capacities.length === 0) return { byTarget: [], overflow: groups };
  const counts = capacities.map(() => 0);
  if (groups.length >= capacities.length) {
    counts.fill(1);
    let remaining = groups.length - capacities.length;
    while (remaining > 0) {
      let bestIndex = 0;
      let bestScore = -1;
      for (let index = 0; index < capacities.length; index += 1) {
        const score = capacities[index] / (counts[index] + 1);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      counts[bestIndex] += 1;
      remaining -= 1;
    }
  } else if (groups.length > 0) {
    counts[0] = 1;
    if (groups.length > 1) counts[counts.length - 1] = 1;
    let remaining = groups.length - Math.min(groups.length, 2);
    const middle = capacities
      .map((capacity, index) => ({ capacity, index }))
      .slice(1, -1)
      .sort((left, right) => right.capacity - left.capacity || left.index - right.index);
    for (const target of middle) {
      if (remaining <= 0) break;
      counts[target.index] = 1;
      remaining -= 1;
    }
  }

  const byTarget = capacities.map(() => [] as NormalizedContentSlot[][]);
  let cursor = 0;
  for (let index = 0; index < counts.length; index += 1) {
    byTarget[index] = groups.slice(cursor, cursor + counts[index]);
    cursor += counts[index];
  }
  return { byTarget, overflow: groups.slice(cursor) };
}

function contentCapacity(slots: LayoutSemanticSlot[]): number {
  const textSlots = slots.filter(
    (slot) => slot.kind === "heading" || slot.kind === "body" || slot.kind === "list",
  ).length;
  const buttonNodes = new Set(
    slots
      .filter((slot) => slot.kind === "button-label" || slot.kind === "link")
      .map((slot) => slot.nodeId),
  ).size;
  return Math.max(1, textSlots + buttonNodes);
}

function collectRootSlots(
  root: JsonRecord,
  slotsByNode: Map<string, LayoutSemanticSlot[]>,
): LayoutSemanticSlot[] {
  const slots: LayoutSemanticSlot[] = [];
  const stack: JsonRecord[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    if (typeof node.id === "string") slots.push(...(slotsByNode.get(node.id) ?? []));
    if (Array.isArray(node.elements)) stack.push(...node.elements.filter(isRecord));
  }
  return slots.sort((left, right) => left.order - right.order);
}

function groupSlotsByNode(
  slots: LayoutSemanticSlot[],
): Map<string, LayoutSemanticSlot[]> {
  const result = new Map<string, LayoutSemanticSlot[]>();
  for (const slot of [...slots].sort((left, right) => left.order - right.order)) {
    const group = result.get(slot.nodeId) ?? [];
    group.push(slot);
    result.set(slot.nodeId, group);
  }
  return result;
}

function groupContentSections(
  slots: NormalizedContentSlot[],
): NormalizedContentSlot[][] {
  const groups: NormalizedContentSlot[][] = [];
  let current: NormalizedContentSlot[] = [];
  let hasMajorHeading = false;
  for (const slot of slots) {
    const startsSection = slot.kind === "heading" && slot.level <= 2;
    if (startsSection && hasMajorHeading && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(slot);
    if (startsSection) hasMajorHeading = true;
  }
  if (current.length > 0) groups.push(current);
  return groups.length > 0 ? groups : [[]];
}

function assignOneToOne<
  T extends Extract<NormalizedContentSlot, { kind: "heading" | "image" }>,
>(
  targets: LayoutSemanticSlot[],
  slots: T[],
  assignments: Map<string, AssignedContent>,
  consumed: Set<string>,
) {
  const count = Math.min(targets.length, slots.length);
  for (let index = 0; index < count; index += 1) {
    assignments.set(targets[index].id, slots[index]);
    consumed.add(slots[index].id);
  }
}

function assignRichText(
  targets: LayoutSemanticSlot[],
  slots: Array<Extract<NormalizedContentSlot, { kind: "rich-text" }>>,
  assignments: Map<string, AssignedContent>,
  consumed: Set<string>,
) {
  const count = Math.min(targets.length, slots.length);
  if (count === 0) return;
  for (let index = 0; index < count; index += 1) {
    const start = Math.floor((index * slots.length) / count);
    const end = Math.floor(((index + 1) * slots.length) / count);
    const chunk = slots.slice(start, end);
    assignments.set(targets[index].id, {
      kind: "rich-text",
      html: chunk.map((slot) => slot.html).join(""),
    });
    for (const slot of chunk) consumed.add(slot.id);
  }
}

function assignLinks(
  targets: LayoutSemanticSlot[],
  slots: Array<Extract<NormalizedContentSlot, { kind: "link" }>>,
  assignments: Map<string, AssignedContent>,
  consumed: Set<string>,
) {
  const buttonNodes = [...new Set(
    targets
      .filter((slot) => slot.kind === "button-label" || slot.kind === "link")
      .map((slot) => slot.nodeId),
  )];
  const count = Math.min(buttonNodes.length, slots.length);
  for (let index = 0; index < count; index += 1) {
    for (const target of targets.filter((slot) => slot.nodeId === buttonNodes[index])) {
      if (target.kind === "button-label" || target.kind === "link") {
        assignments.set(target.id, slots[index]);
      }
    }
    consumed.add(slots[index].id);
  }
}

function applyAssignment(
  settings: JsonRecord,
  target: LayoutSemanticSlot,
  content: AssignedContent,
) {
  if (target.kind === "heading" && content.kind === "heading") {
    settings[target.settingKey] = safeText(content.text);
    if (target.settingKey === "title") settings.header_size = `h${content.level}`;
    return;
  }
  if ((target.kind === "body" || target.kind === "list") && content.kind === "rich-text") {
    settings[target.settingKey] = target.settingKey === "icon_list"
      ? iconListValue(content.html)
      : safeRichText(content.html);
    return;
  }
  if (target.kind === "image" && content.kind === "image") {
    settings[target.settingKey] = {
      id: "",
      url: safeImageUrl(content.sourceUrl),
      alt: safeText(content.altText),
    };
    return;
  }
  if (target.kind === "button-label" && content.kind === "link") {
    settings[target.settingKey] = safeText(content.label);
    return;
  }
  if (target.kind === "link" && content.kind === "link") {
    settings[target.settingKey] = {
      url: safeLink(content.href),
      is_external: "",
      nofollow: "",
    };
  }
}

function clearSlot(settings: JsonRecord, slot: LayoutSemanticSlot) {
  if (slot.kind === "image") {
    settings[slot.settingKey] = { id: "", url: "", alt: "Add image in WordPress" };
  } else if (slot.kind === "link") {
    settings[slot.settingKey] = { url: "", is_external: "", nofollow: "" };
  } else if (slot.kind === "list") {
    settings[slot.settingKey] = [];
  } else {
    settings[slot.settingKey] = "";
  }
}

function standardAtomicSection(slots: NormalizedContentSlot[]) {
  return flexbox(
    [CLASS_IDS.section],
    [
      flexbox(
        [CLASS_IDS.container, CLASS_IDS.stack],
        slots.map(slotToAtomic),
      ),
    ],
    "section",
  );
}

function slotToAtomic(slot: NormalizedContentSlot) {
  if (slot.kind === "heading") {
    return heading(safeText(slot.text), `h${slot.level}`, [headingClass(slot.level)]);
  }
  if (slot.kind === "rich-text") {
    return paragraph(safeRichText(slot.html), [CLASS_IDS.body]);
  }
  if (slot.kind === "image") {
    return image(safeImageUrl(slot.sourceUrl), safeText(slot.altText), [CLASS_IDS.media]);
  }
  return button(safeText(slot.label), safeLink(slot.href), [
    CLASS_IDS.button,
    CLASS_IDS.buttonPrimary,
  ]);
}

function headingClass(level: number): string {
  if (level === 1) return CLASS_IDS.h1;
  if (level === 2) return CLASS_IDS.h2;
  if (level === 3) return CLASS_IDS.h3;
  if (level === 4) return CLASS_IDS.h4;
  if (level === 5) return CLASS_IDS.h5;
  return CLASS_IDS.h6;
}

function replaceBrandMarkers(
  value: unknown,
  colors: MigrationWizardWorkspace["colors"] | undefined,
) {
  const palette = colors ?? {
    primary: "#1F5E6A",
    secondary: "#17324D",
    accent: "#D9A441",
    text: "#24313A",
    background: "#FFFFFF",
  };
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (!isRecord(current)) continue;
    for (const [key, child] of Object.entries(current)) {
      const marker = typeof child === "string"
        ? child.match(/^\{\{ENERGIZE_BRAND:(primary|secondary|accent|text|background)\}\}$/)
        : undefined;
      if (marker) current[key] = palette[marker[1] as keyof typeof palette];
      else stack.push(child);
    }
  }
}

function regenerateElementIds(value: unknown) {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (!isRecord(current)) continue;
    if (typeof current.elType === "string") current.id = randomBytes(4).toString("hex");
    stack.push(...Object.values(current));
  }
}

function iconListValue(html: string): JsonRecord[] {
  const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/gi)];
  return items.map((item) => ({
    _id: randomBytes(4).toString("hex"),
    text: safeText(item[1]),
    selected_icon: { value: "fas fa-check", library: "fa-solid" },
  }));
}

function safeText(value: string): string {
  return escapeText(
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function safeRichText(value: string): string {
  return value
    .replace(/<(?:script|style)[^>]*>[\s\S]*?<\/(?:script|style)>/gi, "")
    .replace(/<a\s+href="([^"]*)"[^>]*>/gi, (_full, href: string) =>
      `<a href="${escapeText(safeLink(href))}">`,
    )
    .replace(/<(?!\/?(?:p|ul|ol|li|strong|em|a|br)\b)[^>]+>/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function safeImageUrl(value: string): string {
  return /^https:\/\//i.test(value) ? value : "";
}

function safeLink(value: string): string {
  return /^(?:https:\/\/|\/|#|mailto:|tel:)/i.test(value) ? value : "#";
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isHeading(
  slot: NormalizedContentSlot,
): slot is Extract<NormalizedContentSlot, { kind: "heading" }> {
  return slot.kind === "heading";
}

function isRichText(
  slot: NormalizedContentSlot,
): slot is Extract<NormalizedContentSlot, { kind: "rich-text" }> {
  return slot.kind === "rich-text";
}

function isImage(
  slot: NormalizedContentSlot,
): slot is Extract<NormalizedContentSlot, { kind: "image" }> {
  return slot.kind === "image";
}

function isLink(
  slot: NormalizedContentSlot,
): slot is Extract<NormalizedContentSlot, { kind: "link" }> {
  return slot.kind === "link";
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
