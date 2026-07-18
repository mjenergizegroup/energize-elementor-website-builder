import assert from "node:assert/strict";
import type { MigrationSourcePage } from "@/lib/migration/types";
import type { PagePlanItemInput } from "@/lib/page-plan/types";
import { findSourceByCandidatePath, matchPagePlanToSource } from "./matcher";

function plan(
  id: string,
  pageName: string,
  slug: string,
  pageType: PagePlanItemInput["pageType"] = "standard",
): PagePlanItemInput {
  return {
    id,
    position: 0,
    pageName,
    slug,
    titleTag: pageName,
    pageType,
    layoutRevisionId: "layout-1",
    emptyDraftAllowed: true,
    status: "planned",
  };
}

function source(
  id: string,
  title: string,
  path: string,
  markdown = `# ${title}\n\nUseful practice content.`,
): MigrationSourcePage {
  return {
    id,
    sourceUrl: `https://old.example.com${path}`,
    normalizedUrl: `https://old.example.com${path}`,
    title,
    sourceChecksum: `${id}-checksum`,
    rawMarkdown: markdown,
    cleanedMarkdown: markdown,
    approvedMarkdown: markdown,
    contentRevision: 2,
    classification: "core-page",
    classificationReason: "site content page",
    included: true,
    reviewed: false,
    metadata: {},
  };
}

const exact = matchPagePlanToSource(
  [plan("home", "Home", "", "home"), plan("emergency", "Emergency Dentistry", "emergency-dentistry", "service")],
  [source("old-home", "Dentist in Columbia", "/"), source("old-emergency", "Emergency Dentist in Columbia", "/emergency-dentistry/")],
);
assert.equal(exact[0].status, "matched");
assert.equal(exact[0].sourcePageId, "old-home");
assert.equal(exact[1].status, "matched");
assert.equal(exact[1].sourcePageId, "old-emergency");
assert.equal(exact[1].normalizedContentRevision, 2);

const ambiguous = matchPagePlanToSource(
  [plan("about", "About Us", "about-us")],
  [
    source("about-a", "About Us", "/our-practice/", "# About Us\n\nFirst practice overview."),
    source("about-b", "About Us", "/meet-our-team/", "# About Us\n\nSecond practice overview."),
  ],
);
assert.equal(ambiguous[0].status, "check");
assert.equal(ambiguous[0].sourcePageId, undefined);
assert.equal(ambiguous[0].candidates.length, 2);
assert.deepEqual(
  ambiguous[0].candidates.map((candidate) => candidate.path).sort(),
  ["/meet-our-team", "/our-practice"],
);

const empty = matchPagePlanToSource(
  [plan("membership", "Membership", "membership")],
  [source("contact", "Contact Us", "/contact-us/")],
);
assert.equal(empty[0].status, "empty");
assert.equal(empty[0].sourcePageId, undefined);

const skipped = source("policy", "Membership", "/privacy-policy/");
skipped.classification = "skipped";
skipped.included = false;
assert.equal(
  matchPagePlanToSource([plan("membership", "Membership", "membership")], [skipped])[0].status,
  "empty",
);

const history = matchPagePlanToSource(
  [plan("service", "Implant Dentistry", "dental-implants", "service")],
  [
    source("implant-a", "Dental Implant Dentistry", "/implant-dentistry/"),
    source("implant-b", "Dental Implant Dentistry", "/dental-implants-columbia/"),
  ],
  { service: "implant-b" },
);
assert.equal(
  history[0].candidates.find((candidate) => candidate.sourcePageId === "implant-b")?.signals.includes("Previously selected for this page"),
  true,
);

const recrawled = source("about-new-revision", "About Our Practice", "/about-us/");
assert.equal(
  findSourceByCandidatePath([recrawled], {
    path: "/about-us",
  })?.id,
  "about-new-revision",
);

console.log("content matching checks passed");
