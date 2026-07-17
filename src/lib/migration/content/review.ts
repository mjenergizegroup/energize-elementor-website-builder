import { createHash } from "node:crypto";
import type { MigrationSourcePage } from "../types";

export interface MigrationSourcePageUpdate {
  id: string;
  title?: string;
  approvedMarkdown?: string;
  included?: boolean;
  reviewed?: boolean;
}

export function normalizeMigrationSourcePage(
  page: MigrationSourcePage,
): MigrationSourcePage {
  const approvedMarkdown =
    typeof page.approvedMarkdown === "string"
      ? page.approvedMarkdown
      : page.cleanedMarkdown;
  const reviewed = Boolean(page.reviewed && approvedMarkdown.trim());
  return {
    ...page,
    approvedMarkdown,
    reviewed,
    contentRevision:
      Number.isInteger(page.contentRevision) && page.contentRevision > 0
        ? page.contentRevision
        : 1,
    approvedChecksum: reviewed
      ? page.approvedChecksum || checksum(`${page.title}\n${approvedMarkdown}`)
      : undefined,
    approvedAt: reviewed ? page.approvedAt : undefined,
  };
}

export function normalizeMigrationSourcePages(
  pages: MigrationSourcePage[],
): MigrationSourcePage[] {
  return pages.map(normalizeMigrationSourcePage);
}

export function applyMigrationSourceUpdates(
  inputPages: MigrationSourcePage[],
  updates: MigrationSourcePageUpdate[],
  now = new Date().toISOString(),
): MigrationSourcePage[] {
  const pages = normalizeMigrationSourcePages(inputPages);
  const byId = new Map(pages.map((page) => [page.id, page]));
  const seen = new Set<string>();

  for (const update of updates) {
    if (seen.has(update.id)) {
      throw new Error(`Source page ${update.id} was updated more than once.`);
    }
    seen.add(update.id);
    const current = byId.get(update.id);
    if (!current) throw new Error(`Source page ${update.id} does not exist.`);

    const title = update.title === undefined ? current.title : update.title.trim();
    if (!title) throw new Error("Every included source page needs a title.");
    const approvedMarkdown =
      update.approvedMarkdown === undefined
        ? current.approvedMarkdown
        : normalizeMarkdown(update.approvedMarkdown);
    const included = update.included ?? current.included;
    const contentChanged =
      approvedMarkdown !== current.approvedMarkdown || title !== current.title;
    let reviewed = contentChanged ? false : current.reviewed;
    if (update.reviewed !== undefined) reviewed = update.reviewed;
    if (reviewed && !included) {
      throw new Error("A page must be included before it can be approved.");
    }
    if (reviewed && !approvedMarkdown.trim()) {
      throw new Error("Approved page content cannot be empty.");
    }

    byId.set(update.id, {
      ...current,
      title,
      approvedMarkdown,
      included,
      reviewed,
      contentRevision: contentChanged
        ? current.contentRevision + 1
        : current.contentRevision,
      approvedChecksum: reviewed
        ? checksum(`${title}\n${approvedMarkdown}`)
        : undefined,
      approvedAt: reviewed ? now : undefined,
    });
  }

  return pages.map((page) => byId.get(page.id) ?? page);
}

export function sourceContentSummary(pages: MigrationSourcePage[]) {
  const normalized = normalizeMigrationSourcePages(pages);
  const included = normalized.filter((page) => page.included);
  return {
    total: normalized.length,
    included: included.length,
    approved: included.filter((page) => page.reviewed).length,
    needsReview: included.filter((page) => !page.reviewed).length,
    corePages: included.filter((page) => page.classification === "core-page").length,
    blogPosts: included.filter((page) => page.classification === "blog-post").length,
  };
}

function normalizeMarkdown(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function checksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
