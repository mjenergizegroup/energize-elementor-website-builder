import { CLASS_IDS } from "@/lib/elementor/atomic/foundation";
import {
  button,
  flexbox,
  heading,
  image,
  paragraph,
} from "@/lib/elementor/atomic/elements";
import type { AtomicElement, AtomicProp } from "@/lib/elementor/atomic/types";
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

export function injectNormalizedContent(
  source: unknown[],
  content: NormalizedPageContent,
): ContentInjectionResult {
  const elementorData = structuredClone(source) as AtomicElement[];
  const queues = {
    heading: content.slots.filter(isHeading),
    richText: content.slots.filter(isRichText),
    image: content.slots.filter(isImage),
    link: content.slots.filter(isLink),
  };
  let replaced = 0;
  let removedPlaceholders = 0;

  const injectNodes = (nodes: AtomicElement[]): AtomicElement[] =>
    nodes.flatMap((node) => {
      const originalChildCount = node.elements?.length ?? 0;
      node.elements = injectNodes(node.elements ?? []);
      if (node.widgetType === "e-heading") {
        const slot = queues.heading.shift();
        if (!slot) {
          removedPlaceholders += 1;
          return [];
        }
        node.settings.title = htmlValue(safeText(slot.text));
        node.settings.tag = typed("string", `h${slot.level}`);
        replaced += 1;
      } else if (node.widgetType === "e-paragraph") {
        const slot = queues.richText.shift();
        if (!slot) {
          removedPlaceholders += 1;
          return [];
        }
        node.settings.paragraph = htmlValue(safeText(slot.html));
        replaced += 1;
      } else if (node.widgetType === "e-image") {
        const slot = queues.image.shift();
        if (!slot) {
          removedPlaceholders += 1;
          return [];
        }
        node.settings.image = imageValue(
          safeImageUrl(slot.sourceUrl),
          safeText(slot.altText),
        );
        replaced += 1;
      } else if (node.widgetType === "e-button") {
        const slot = queues.link.shift();
        if (!slot) {
          removedPlaceholders += 1;
          return [];
        }
        node.settings.text = htmlValue(safeText(slot.label));
        node.settings.link = linkValue(safeLink(slot.href));
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

  const injected = injectNodes(elementorData);
  const remaining = [
    ...queues.heading.map((slot) =>
      heading(safeText(slot.text), `h${slot.level}`, [headingClass(slot.level)]),
    ),
    ...queues.richText.map((slot) =>
      paragraph(safeText(slot.html), [CLASS_IDS.body]),
    ),
    ...queues.image.map((slot) =>
      image(safeImageUrl(slot.sourceUrl), safeText(slot.altText), [CLASS_IDS.media]),
    ),
    ...queues.link.map((slot) =>
      button(safeText(slot.label), safeLink(slot.href), [
        CLASS_IDS.button,
        CLASS_IDS.buttonPrimary,
      ]),
    ),
  ];
  if (remaining.length > 0) {
    injected.push(
      flexbox(
        [CLASS_IDS.section],
        [flexbox([CLASS_IDS.container, CLASS_IDS.stack], remaining)],
        "section",
      ),
    );
  }
  return {
    elementorData: injected,
    replaced,
    appended: remaining.length,
    removedPlaceholders,
  };
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
  return decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
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
