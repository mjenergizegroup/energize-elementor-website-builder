/**
 * Widget injectors for the Elevate theme.
 *
 * Each injector takes a widget node and a value from the parsed schema,
 * mutates the node's `settings` in place, and returns nothing.
 *
 * All injectors are pure with respect to the node passed in - they
 * mutate that one node only. The caller is responsible for deep-cloning
 * the template before calling these.
 */

import type { SiteData } from "./types";

// -----------------------------------------------------------------------------
// Node helpers
// -----------------------------------------------------------------------------

/**
 * Recursively find the first node with the given `id` in an Elementor tree.
 * Returns null if not found.
 */
export function findNode(tree: unknown, id: string): Record<string, unknown> | null {
  if (Array.isArray(tree)) {
    for (const item of tree) {
      const r = findNode(item, id);
      if (r) return r;
    }
    return null;
  }
  if (tree && typeof tree === "object") {
    const node = tree as Record<string, unknown>;
    if (node.id === id) return node;
    const elements = node.elements;
    if (Array.isArray(elements)) {
      for (const child of elements) {
        const r = findNode(child, id);
        if (r) return r;
      }
    }
  }
  return null;
}

function getSettings(node: Record<string, unknown>): Record<string, unknown> {
  if (!node.settings || typeof node.settings !== "object") {
    node.settings = {};
  }
  return node.settings as Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// HTML helpers
// -----------------------------------------------------------------------------

/**
 * Wrap a plain-text body in `<p>` tags for text-editor widgets.
 * Multi-paragraph input is split on blank lines.
 * If the input already begins with an HTML tag, pass through as-is.
 */
export function toHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) return trimmed;
  const paragraphs = trimmed.split(/\n\s*\n/);
  return paragraphs.map((p) => `<p>${p.replace(/\n/g, " ").trim()}</p>`).join("");
}

// -----------------------------------------------------------------------------
// Per-widget injectors
// -----------------------------------------------------------------------------

export function injectHeading(node: Record<string, unknown>, title: string): void {
  const settings = getSettings(node);
  settings.title = title;
  // header_size is preserved from the template - never touched.
}

export function injectTextEditor(node: Record<string, unknown>, body: string): void {
  const settings = getSettings(node);
  settings.editor = toHtml(body);
}

export function injectButton(
  node: Record<string, unknown>,
  label: string,
  urlSource: string | undefined,
  site: SiteData
): void {
  const settings = getSettings(node);
  settings.text = label;

  // URL resolution. If urlSource is provided, use it from site config.
  // 'auto' means: infer from the label.
  if (urlSource && urlSource !== "auto") {
    const url = site[urlSource];
    if (url) {
      const link = (settings.link as Record<string, unknown>) || {};
      link.url = url;
      link.is_external = "";
      link.nofollow = "";
      settings.link = link;
    }
  } else if (urlSource === "auto") {
    // Heuristic: phone labels (digits/dashes/parens) to tel:phone
    // Otherwise leave existing link as-is
    const isPhone = /^[\d\s().+-]+$/.test(label.trim());
    if (isPhone && site.phone_tel) {
      const link = (settings.link as Record<string, unknown>) || {};
      link.url = site.phone_tel;
      settings.link = link;
    }
  }
  // If no urlSource specified, link remains whatever the template had.
}

export function injectIconBoxTitle(node: Record<string, unknown>, title: string): void {
  const settings = getSettings(node);
  settings.title_text = title;
}

export function injectIconBoxDesc(node: Record<string, unknown>, desc: string): void {
  const settings = getSettings(node);
  settings.description_text = desc;
}

export function injectIconBoxBoth(
  node: Record<string, unknown>,
  title: string,
  desc: string
): void {
  const settings = getSettings(node);
  settings.title_text = title;
  settings.description_text = desc;
}

/**
 * Replace the texts of the icon-list items.
 * The list is truncated or padded so it matches `texts.length`.
 * Icons are preserved from the first item (or left at template default).
 */
export function injectIconList(node: Record<string, unknown>, texts: string[]): void {
  const settings = getSettings(node);
  const existing = (settings.icon_list as Array<Record<string, unknown>>) || [];
  const template = existing[0] || {};

  const newList = texts.map((text, i) => {
    const base = existing[i] || { ...template };
    return { ...base, text, _id: base._id || `item${i}` };
  });

  settings.icon_list = newList;
}

export function injectImage(
  node: Record<string, unknown>,
  url: string,
  alt: string
): void {
  const settings = getSettings(node);
  const existing = (settings.image as Record<string, unknown>) || {};
  settings.image = {
    ...existing,
    url,
    alt,
    source: existing.source || "library",
  };
}

export function injectImageBox(
  node: Record<string, unknown>,
  title: string,
  desc: string,
  imageUrl?: string,
  imageAlt?: string
): void {
  const settings = getSettings(node);
  settings.title_text = title;
  settings.description_text = desc;
  if (imageUrl) {
    const existing = (settings.image as Record<string, unknown>) || {};
    settings.image = {
      ...existing,
      url: imageUrl,
      alt: imageAlt || "",
      source: existing.source || "library",
    };
  }
}

export function injectElementskitHeading(
  node: Record<string, unknown>,
  title: string
): void {
  const settings = getSettings(node);
  settings.ekit_heading_title = title;
}
