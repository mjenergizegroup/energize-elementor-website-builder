import { CLASS_IDS } from "@/lib/elementor/atomic/foundation";
import {
  button,
  flexbox,
  heading,
  image,
  paragraph,
} from "@/lib/elementor/atomic/elements";
import type { AtomicElement, AtomicProp } from "@/lib/elementor/atomic/types";
import type { LayoutSemanticSlot } from "@/lib/layouts/types";
import type {
  NormalizedContentSlot,
  NormalizedPageContent,
} from "./types";

export interface ContentInjectionResult {
  elementorData: AtomicElement[];
  replaced: number;
  appended: number;
  removedPlaceholders: number;
}

export interface ContentInjectionOptions {
  semanticSlots?: LayoutSemanticSlot[];
  slotTargets?: Record<string, string>;
}

type AssignedContent =
  | Extract<NormalizedContentSlot, { kind: "heading" | "image" | "link" }>
  | { kind: "rich-text"; html: string };

export function injectNormalizedContent(
  source: unknown[],
  content: NormalizedPageContent,
  options: ContentInjectionOptions = {},
): ContentInjectionResult {
  const elementorData = structuredClone(source) as AtomicElement[];
  const targetOrder = semanticTargetOrder(options);
  const rootsWithTargets = elementorData
    .map((root, index) => ({ root, index, targets: collectTargets(root, targetOrder) }))
    .filter((entry) => entry.targets.all.length > 0);
  const contentGroups = groupContentSections(content.slots);
  const assignments = new Map<string, AssignedContent>();
  const appendedByRoot = new Map<number, AtomicElement[]>();
  let appended = 0;

  for (let index = 0; index < rootsWithTargets.length; index += 1) {
    const targetGroup = rootsWithTargets[index];
    const sourceGroup = contentGroups[index] ?? [];
    const consumed = new Set<string>();

    assignOneToOne(
      targetGroup.targets.heading,
      sourceGroup.filter(isHeading),
      assignments,
      consumed,
    );
    assignRichText(
      targetGroup.targets.richText,
      sourceGroup.filter(isRichText),
      assignments,
      consumed,
    );
    assignOneToOne(
      targetGroup.targets.image,
      sourceGroup.filter(isImage),
      assignments,
      consumed,
    );
    assignOneToOne(
      targetGroup.targets.link,
      sourceGroup.filter(isLink),
      assignments,
      consumed,
    );

    const remaining = sourceGroup
      .filter((slot) => !consumed.has(slot.id))
      .map(slotToAtomic);
    if (remaining.length > 0) {
      appendedByRoot.set(targetGroup.index, remaining);
      appended += remaining.length;
    }
  }

  const overflowGroups = contentGroups.slice(rootsWithTargets.length);
  const overflowSections = overflowGroups
    .map((group) => group.map(slotToAtomic))
    .filter((group) => group.length > 0)
    .map((group) => standardSection(group));
  appended += overflowGroups.reduce((sum, group) => sum + group.length, 0);

  let replaced = 0;
  let removedPlaceholders = 0;
  const injectNodes = (nodes: AtomicElement[]): AtomicElement[] =>
    nodes.flatMap((node) => {
      const originalChildCount = node.elements?.length ?? 0;
      node.elements = injectNodes(node.elements ?? []);
      if (isContentTarget(node)) {
        const assigned = assignments.get(node.id);
        if (!assigned) {
          if (node.widgetType === "e-image") {
            node.settings.image = imageValue("", "Add image in WordPress");
            return [node];
          }
          removedPlaceholders += 1;
          return [];
        }
        applyAssignment(node, assigned);
        replaced += 1;
      }
      if (
        node.elType === "e-flexbox" &&
        originalChildCount > 0 &&
        (node.elements?.length ?? 0) === 0
      ) {
        removedPlaceholders += 1;
        return [];
      }
      return [node];
    });

  const injected = elementorData.flatMap((root, index) => {
    const fitted = injectNodes([root]);
    const extra = appendedByRoot.get(index);
    if (fitted[0] && extra?.length) {
      fitted[0].elements.push(
        flexbox([CLASS_IDS.container, CLASS_IDS.stack], extra),
      );
    }
    return fitted;
  });

  return {
    elementorData: [...injected, ...overflowSections],
    replaced,
    appended,
    removedPlaceholders,
  };
}

function semanticTargetOrder(options: ContentInjectionOptions): Map<string, number> {
  const order = new Map<string, number>();
  for (const slot of options.semanticSlots ?? []) {
    const target = options.slotTargets?.[slot.id];
    if (target && !order.has(target)) order.set(target, slot.order);
  }
  return order;
}

function collectTargets(root: AtomicElement, order: Map<string, number>) {
  const all: AtomicElement[] = [];
  const walk = (node: AtomicElement) => {
    if (isContentTarget(node)) all.push(node);
    for (const child of node.elements ?? []) walk(child);
  };
  walk(root);
  all.sort((left, right) =>
    (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
  return {
    all,
    heading: all.filter((node) => node.widgetType === "e-heading"),
    richText: all.filter((node) => node.widgetType === "e-paragraph"),
    image: all.filter((node) => node.widgetType === "e-image"),
    link: all.filter((node) => node.widgetType === "e-button"),
  };
}

function groupContentSections(slots: NormalizedContentSlot[]): NormalizedContentSlot[][] {
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

function assignOneToOne<T extends Extract<NormalizedContentSlot, {
  kind: "heading" | "image" | "link";
}>>(
  targets: AtomicElement[],
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
  targets: AtomicElement[],
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

function applyAssignment(node: AtomicElement, slot: AssignedContent) {
  if (node.widgetType === "e-heading" && slot.kind === "heading") {
    node.settings.title = htmlValue(safeText(slot.text));
    node.settings.tag = typed("string", `h${slot.level}`);
    return;
  }
  if (node.widgetType === "e-paragraph" && slot.kind === "rich-text") {
    node.settings.paragraph = htmlValue(safeRichText(slot.html));
    return;
  }
  if (node.widgetType === "e-image" && slot.kind === "image") {
    node.settings.image = imageValue(
      safeImageUrl(slot.sourceUrl),
      safeText(slot.altText),
    );
    return;
  }
  if (node.widgetType === "e-button" && slot.kind === "link") {
    node.settings.text = htmlValue(safeText(slot.label));
    node.settings.link = linkValue(safeLink(slot.href));
  }
}

function slotToAtomic(slot: NormalizedContentSlot): AtomicElement {
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

function standardSection(elements: AtomicElement[]): AtomicElement {
  return flexbox(
    [CLASS_IDS.section],
    [flexbox([CLASS_IDS.container, CLASS_IDS.stack], elements)],
    "section",
  );
}

function isContentTarget(node: AtomicElement): boolean {
  return ["e-heading", "e-paragraph", "e-image", "e-button"].includes(
    node.widgetType ?? "",
  );
}

function typed<T>(type: string, value: T): AtomicProp<T> {
  return { $$type: type, value };
}

function htmlValue(value: string): AtomicProp {
  return typed("html-v3", {
    content: typed("string", value),
    children: [],
  });
}

function imageValue(url: string, alt: string): AtomicProp {
  return typed("image", {
    src: typed("image-src", {
      url: typed("url", url),
      alt: typed("string", alt),
    }),
    size: typed("string", "full"),
  });
}

function linkValue(url: string): AtomicProp {
  return typed("link", {
    destination: typed("url", url),
    isTargetBlank: typed("boolean", false),
  });
}

function headingClass(level: number): string {
  if (level === 1) return CLASS_IDS.h1;
  if (level === 2) return CLASS_IDS.h2;
  if (level === 3) return CLASS_IDS.h3;
  if (level === 4) return CLASS_IDS.h4;
  if (level === 5) return CLASS_IDS.h5;
  return CLASS_IDS.h6;
}

function safeText(value: string): string {
  const decoded = value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&amp;/gi, "&");
  return escapeText(
    decoded
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

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeImageUrl(value: string): string {
  return /^(?:https?:\/\/|\/)/i.test(value) ? value : "";
}

function safeLink(value: string): string {
  return /^(?:https?:\/\/|\/|#|mailto:|tel:)/i.test(value) ? value : "#";
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
