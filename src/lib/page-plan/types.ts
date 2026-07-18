import type { LayoutLibraryItem } from "@/lib/layouts/types";

export const PAGE_TYPES = ["home", "standard", "service", "contact", "custom"] as const;
export type PagePlanPageType = (typeof PAGE_TYPES)[number];
export type PagePlanStatus =
  | "planned"
  | "matched"
  | "check"
  | "empty"
  | "ready"
  | "needs_attention";

export interface PagePlanItemInput {
  id: string;
  position: number;
  pageName: string;
  slug: string;
  titleTag: string;
  pageType: PagePlanPageType;
  layoutRevisionId: string;
  emptyDraftAllowed: boolean;
  status: PagePlanStatus;
}

export interface PagePlanItem extends PagePlanItemInput {
  migrationProjectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PagePlanValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
  firstError?: string;
}

export function normalizePageSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/^-+|-+$/g, "");
  return normalized === "home" ? "" : normalized;
}

export function pagePath(slug: string): string {
  const normalized = normalizePageSlug(slug);
  return normalized ? `/${normalized}/` : "/";
}

export function suggestedTitleTag(pageName: string, practiceName: string): string {
  const page = pageName.trim();
  const practice = practiceName.trim();
  if (!practice) return page.slice(0, 160);
  if (!page || /^home$/i.test(page)) return practice.slice(0, 160);
  return `${page} | ${practice}`.slice(0, 160);
}

export function validatePagePlan(
  items: PagePlanItemInput[],
  layouts: LayoutLibraryItem[],
): PagePlanValidationResult {
  const errors: Record<string, string[]> = {};
  const readyRevisions = new Set(
    layouts
      .filter((layout) => layout.status === "ready" && layout.activeRevisionId)
      .map((layout) => layout.activeRevisionId as string),
  );
  const slugs = new Map<string, string>();

  if (items.length === 0) {
    return {
      valid: false,
      errors: { plan: ["Add at least one page to the Page Plan."] },
      firstError: "Add at least one page to the Page Plan.",
    };
  }

  for (const item of items) {
    const itemErrors: string[] = [];
    const slug = normalizePageSlug(item.slug);
    if (!item.pageName.trim()) itemErrors.push("Page name is required.");
    if (item.pageName.length > 120) itemErrors.push("Page name must be 120 characters or fewer.");
    if (item.titleTag.length > 160) itemErrors.push("Title tag must be 160 characters or fewer.");
    if (!readyRevisions.has(item.layoutRevisionId)) itemErrors.push("Choose a Ready layout.");
    const existingId = slugs.get(slug);
    if (existingId && existingId !== item.id) itemErrors.push(`${pagePath(slug)} is already used.`);
    else slugs.set(slug, item.id);
    if (itemErrors.length > 0) errors[item.id] = itemErrors;
  }

  const firstError = Object.values(errors)[0]?.[0];
  return { valid: !firstError, errors, firstError };
}
