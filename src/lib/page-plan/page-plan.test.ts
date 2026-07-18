import assert from "node:assert/strict";
import type { LayoutLibraryItem } from "@/lib/layouts/types";
import {
  normalizePageSlug,
  pagePath,
  suggestedTitleTag,
  validatePagePlan,
  type PagePlanItemInput,
} from "./types";
import { hasUniquePagePlanSlugs, pagePlanRequestSchema } from "./schema";

const layout: LayoutLibraryItem = {
  id: "layout-1",
  friendlyName: "Service Split Hero",
  category: "service",
  status: "ready",
  activeRevisionId: "revision-1",
  thumbnail: { sectionCount: 4, headingSlots: 3, bodySlots: 3, imageSlots: 2, buttonSlots: 2 },
  structuralSummary: "hero and headings, image regions, content sections, call to action",
  revisionVersion: 1,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
const item = (id: string, name: string, slug: string): PagePlanItemInput => ({
  id,
  position: 0,
  pageName: name,
  slug,
  titleTag: suggestedTitleTag(name, "Example Dental"),
  pageType: "service",
  layoutRevisionId: "revision-1",
  emptyDraftAllowed: true,
  status: "planned",
});

assert.equal(normalizePageSlug(" https://example.com/Emergency Dentistry/?x=1 "), "emergency-dentistry");
assert.equal(normalizePageSlug("home"), "");
assert.equal(pagePath(""), "/");
assert.equal(pagePath("preventive-dentistry"), "/preventive-dentistry/");
assert.equal(suggestedTitleTag("Emergency Dentistry", "Example Dental"), "Emergency Dentistry | Example Dental");
assert.equal(validatePagePlan([item("1", "Emergency Dentistry", "emergency-dentistry")], [layout]).valid, true);

const duplicate = validatePagePlan(
  [
    item("1", "Emergency Dentistry", "emergency-dentistry"),
    item("2", "Emergency Dentistry Two", "emergency-dentistry"),
  ],
  [layout],
);
assert.equal(duplicate.valid, false);
assert.match(duplicate.firstError ?? "", /already used/);

assert.equal(
  validatePagePlan([{ ...item("1", "Emergency Dentistry", "emergency"), layoutRevisionId: "missing" }], [layout]).valid,
  false,
);
assert.equal(validatePagePlan([], [layout]).valid, false);
assert.equal(pagePlanRequestSchema.safeParse({ items: [item("1", "Emergency Dentistry", "emergency-dentistry")] }).success, true);
assert.equal(
  pagePlanRequestSchema.safeParse({
    items: [{ ...item("1", "Emergency Dentistry", "Emergency Dentistry"), slug: "Emergency Dentistry" }],
  }).success,
  false,
);
assert.equal(
  hasUniquePagePlanSlugs([
    { slug: "emergency-dentistry" },
    { slug: "emergency-dentistry" },
  ]),
  false,
);

console.log("page plan checks passed");
