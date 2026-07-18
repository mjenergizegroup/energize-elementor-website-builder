import type { MigrationSourcePage } from "../types";
import type { NormalizedContentSlot, NormalizedPageContent } from "./types";

const HEADING = /^(#{1,6})\s+(.+)$/;
const IMAGE = /^!\[([^\]]*)\]\(([^\s\)]+)(?:\s+["'][^"']*["'])?\)$/;
const LINK = /\[([^\]]+)\]\(([^\s\)]+)(?:\s+["'][^"']*["'])?\)/g;
const LIST_ITEM = /^\s*[-*+]\s+(.+)$/;

export function normalizePageContent(page: MigrationSourcePage): NormalizedPageContent {
  const slots: NormalizedContentSlot[] = [];
  const approvedMarkdown = page.approvedMarkdown || page.cleanedMarkdown;
  const blocks = approvedMarkdown
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const heading = block.match(HEADING);
    if (heading) {
      slots.push({
        id: slotId(page.id, slots.length),
        kind: "heading",
        text: heading[2].trim(),
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
      });
      continue;
    }

    const image = block.match(IMAGE);
    if (image) {
      slots.push({
        id: slotId(page.id, slots.length),
        kind: "image",
        sourceUrl: image[2],
        altText: image[1].trim(),
      });
      continue;
    }

    if (isListBlock(block)) {
      const items: string[] = [];
      let cursor = index;
      while (cursor < blocks.length && isListBlock(blocks[cursor])) {
        for (const line of blocks[cursor].split("\n")) {
          const item = line.match(LIST_ITEM)?.[1];
          if (item) items.push(inlineMarkdown(item));
        }
        cursor += 1;
      }
      slots.push({
        id: slotId(page.id, slots.length),
        kind: "rich-text",
        html: `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`,
      });
      index = cursor - 1;
      continue;
    }

    const links = standaloneLinks(block);
    if (links) {
      for (const link of links) {
        slots.push({
          id: slotId(page.id, slots.length),
          kind: "link",
          label: link.label,
          href: link.href,
        });
      }
      continue;
    }

    slots.push({
      id: slotId(page.id, slots.length),
      kind: "rich-text",
      html: markdownToHtml(block),
    });
  }

  return {
    schemaVersion: "1",
    sourcePageId: page.id,
    title: page.title,
    slug: new URL(page.normalizedUrl).pathname.split("/").filter(Boolean).pop() ?? "home",
    slots,
  };
}

function isListBlock(value: string): boolean {
  const lines = value.split("\n").filter((line) => line.trim());
  return lines.length > 0 && lines.every((line) => LIST_ITEM.test(line));
}

function standaloneLinks(value: string): Array<{ label: string; href: string }> | undefined {
  const matches = [...value.matchAll(LINK)];
  if (matches.length === 0) return undefined;
  const remainder = value.replace(LINK, "").trim();
  if (remainder) return undefined;
  return matches.map((match) => ({ label: match[1].trim(), href: match[2].trim() }));
}

function markdownToHtml(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${inlineMarkdown(line)}</p>`)
    .join("");
}

function inlineMarkdown(value: string): string {
  let html = "";
  let cursor = 0;
  for (const match of value.matchAll(LINK)) {
    html += escapeHtml(value.slice(cursor, match.index));
    const label = escapeHtml(match[1]);
    const href = safeHref(match[2]);
    html += href
      ? `<a href="${escapeHtml(href)}">${label}</a>`
      : label;
    cursor = (match.index ?? 0) + match[0].length;
  }
  html += escapeHtml(value.slice(cursor));
  return html;
}

function safeHref(value: string): string | undefined {
  return /^(?:https?:\/\/|\/|#|mailto:|tel:)/i.test(value) ? value : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slotId(pageId: string, index: number): string {
  return `${pageId}-${index}`;
}
