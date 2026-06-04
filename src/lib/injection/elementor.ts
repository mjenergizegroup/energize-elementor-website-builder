import { randomBytes } from "node:crypto";

// Low-level helpers for manipulating Elementor JSON. Ported from the find_node /
// to_html logic shared across the three theme builder skills, plus the element
// ID regeneration the brief requires (8-char hex).

export type ElementorNode = {
  id?: string;
  elType?: string;
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElementorNode[];
  [key: string]: unknown;
};

// 8 hex characters, matching Elementor's native element ID format.
export function generateElementId(): string {
  return randomBytes(4).toString("hex");
}

// Find the first node anywhere in the tree whose `id` equals targetId.
export function findNode(obj: unknown, targetId: string): ElementorNode | null {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findNode(item, targetId);
      if (found) return found;
    }
    return null;
  }
  if (obj && typeof obj === "object") {
    const node = obj as ElementorNode;
    if (node.id === targetId) return node;
    for (const value of Object.values(obj)) {
      const found = findNode(value, targetId);
      if (found) return found;
    }
  }
  return null;
}

// Regenerate the `id` of every real Elementor element (any object that carries
// an `elType`). Repeater item ids (`_id`) and gallery ids inside settings are
// intentionally left alone so internal references stay valid. Run this AFTER
// injection, since injection targets the original template ids.
export function regenerateElementIds(obj: unknown): void {
  if (Array.isArray(obj)) {
    for (const item of obj) regenerateElementIds(item);
    return;
  }
  if (obj && typeof obj === "object") {
    const node = obj as ElementorNode;
    if (typeof node.elType === "string" && typeof node.id === "string") {
      node.id = generateElementId();
    }
    for (const value of Object.values(obj)) regenerateElementIds(value);
  }
}

// Wrap plain text in a <p> tag unless it already looks like HTML. Mirrors the
// to_html() helper in the skills.
export function toHtml(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) return trimmed;
  return `<p>${trimmed}</p>`;
}

// Count every Elementor element in the tree (used for sanity checks/tests).
export function countElements(obj: unknown): number {
  let total = 0;
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
    } else if (value && typeof value === "object") {
      const node = value as ElementorNode;
      if (typeof node.elType === "string") total += 1;
      for (const v of Object.values(value)) walk(v);
    }
  };
  walk(obj);
  return total;
}
