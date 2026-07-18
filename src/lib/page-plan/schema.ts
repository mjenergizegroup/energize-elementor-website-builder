import { z } from "zod";
import { PAGE_TYPES } from "./types";

const pageTypes = PAGE_TYPES as unknown as [
  (typeof PAGE_TYPES)[number],
  ...(typeof PAGE_TYPES)[number][],
];

export const pagePlanItemSchema = z.object({
  id: z.string().min(1).max(100),
  position: z.number().int().min(0).max(199),
  pageName: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .max(180)
    .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]*(?:-[a-z0-9]+)*$/),
  titleTag: z.string().trim().max(160),
  pageType: z.enum(pageTypes),
  layoutRevisionId: z.string().min(1).max(100),
  emptyDraftAllowed: z.boolean(),
  status: z.enum(["planned", "matched", "check", "empty", "ready", "needs_attention"]),
});

export const pagePlanRequestSchema = z.object({
  items: z.array(pagePlanItemSchema).max(100),
});

export function hasUniquePagePlanSlugs(items: Array<{ slug: string }>): boolean {
  return new Set(items.map((item) => item.slug)).size === items.length;
}
