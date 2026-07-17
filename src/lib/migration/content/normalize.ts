import { createHash } from "node:crypto";
import type { MigrationSourcePage } from "../types";
import type { NormalizedContentSlot, NormalizedPageContent } from "./types";

export function normalizePageContent(page: MigrationSourcePage): NormalizedPageContent {
  const slots: NormalizedContentSlot[] = [];
  const blocks = page.cleanedMarkdown.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  for (const block of blocks) {
    const heading = block.match(/^(#{1,6})\s+([\s\S]+)$/);
    if (heading) {
      slots.push({ id: slotId(page.id, slots.length), kind: "heading", text: heading[2].trim(), level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6 });
      continue;
    }
    const image = block.match(/^!\[([^\]]*)\]\(([^\s\)]+)[\s\S]*\)$/);
    if (image) {
      slots.push({ id: slotId(page.id, slots.length), kind: "image", sourceUrl: image[2], altText: image[1].trim() });
      continue;
    }
    const link = block.match(/^\[([^\]]+)\]\((https?:\/\/[^\)]+)\)$/);
    if (link) {
      slots.push({ id: slotId(page.id, slots.length), kind: "link", label: link[1], href: link[2] });
      continue;
    }
    slots.push({ id: slotId(page.id, slots.length), kind: "rich-text", html: markdownToHtml(block) });
  }
  return {
    schemaVersion: "1",
    sourcePageId: page.id,
    title: page.title,
    slug: new URL(page.normalizedUrl).pathname.split("/").filter(Boolean).pop() ?? "home",
    slots,
  };
}

function markdownToHtml(value: string): string {
  return value.split("\n").map((line) => `<p>${escapeHtml(line.replace(/^[-*+]\s+/, ""))}</p>`).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slotId(pageId: string, index: number): string {
  return createHash("sha256").update(`${pageId}:${index}`).digest("hex").slice(0, 16);
}
