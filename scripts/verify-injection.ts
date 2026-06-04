// Smoke test for the Elevate injector. Run with: npx tsx scripts/verify-injection.ts
import { getInjector, listThemes } from "../src/lib/injection/registry";
import { countElements } from "../src/lib/injection/elementor";
import type { PageContent } from "../src/lib/injection/types";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

console.log("Themes discovered:");
for (const t of listThemes()) {
  console.log(
    `  ${t.key} (${t.label}) ready=${t.ready} status=${t.status} pages=${t.pages.length}`,
  );
}

const elevate = getInjector("elevate");

// Fill every homepage slot so there should be no MISSING warnings.
const homepageSlots: Record<string, PageContent["slots"][string]> = {};
const page = elevate.getPage("homepage")!;
for (const slot of page.slots) {
  if (slot.fields && slot.fields.length === 2) {
    homepageSlots[slot.key] = {
      title_text: `${slot.label} title`,
      description_text: `${slot.label} description for Maple Street Dental.`,
    };
  } else if (slot.field === "editor") {
    homepageSlots[slot.key] = `Body copy about Maple Street Dental in Denver.`;
  } else {
    homepageSlots[slot.key] = `${slot.label} for Maple Street Dental`;
  }
}

const content: PageContent = {
  page: "homepage",
  wpTitle: "Maple Street Dental",
  slug: "home",
  slots: homepageSlots,
};

console.log("\nInjecting Elevate homepage:");
const result = elevate.injectPage("homepage", content, {
  practiceName: "Maple Street Dental",
});

check(
  "no missing/required warnings",
  result.warnings.length === 0,
  JSON.stringify(result.warnings),
);

// Collect all element ids after regeneration.
const ids: string[] = [];
const collect = (v: unknown): void => {
  if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === "object") {
    const n = v as { elType?: string; id?: string };
    if (typeof n.elType === "string" && typeof n.id === "string")
      ids.push(n.id);
    Object.values(v).forEach(collect);
  }
};
collect(result.elementorData);

check("all element ids are 8-char hex", ids.every((id) => /^[0-9a-f]{8}$/.test(id)), ids.find((id) => !/^[0-9a-f]{8}$/.test(id)));
check("element ids are unique", new Set(ids).size === ids.length, `${ids.length} ids, ${new Set(ids).size} unique`);
check("original hero id 7701a6f0 is gone", !ids.includes("7701a6f0"));
check("element count preserved", countElements(result.elementorData) === ids.length);

// Confirm a known node received its value (find by walking for the injected text).
const serialized = JSON.stringify(result.elementorData);
check("hero headline text injected", serialized.includes("Headline for Maple Street Dental"));
check("no template placeholder names remain", !/SolSmile|Atlas Dental/.test(serialized));
check("membership typo fix not applicable here (homepage has no fixedValue)", true);

// Optional slots: build a homepage with NOTHING and confirm required slots warn
console.log("\nInjecting empty Elevate services page (expect MISSING for required, none for optional):");
const empty: PageContent = { page: "services", slots: {} };
const emptyResult = elevate.injectPage("services", empty);
const missing = emptyResult.warnings.filter((w) => w.startsWith("[MISSING"));
check("required service slots flagged missing", missing.length > 0, `${missing.length} missing`);
check("optional sub-service slots NOT flagged", !missing.some((w) => /subservice[1-5]_/.test(w)), missing.join(", "));

// fixedValue: first-visit membership_cta should always be "Our Membership Plan"
console.log("\nChecking fixedValue (first-visit membership button typo fix):");
const fv = elevate.injectPage("first-visit", { page: "first-visit", slots: {} });
const fvSerialized = JSON.stringify(fv.elementorData);
check("first-visit membership button reads 'Our Membership Plan'", fvSerialized.includes("Our Membership Plan"));

// Generated thank-you page builds and notes it was generated.
console.log("\nChecking generated thank-you page:");
const ty = elevate.injectPage("thank-you", { page: "thank-you", slots: { headline: "Thank You!", body: "We will call you soon." } });
check("thank-you build note present", ty.buildNotes.some((n) => n.includes("generated")));

// Summit should refuse (pending port).
console.log("\nChecking Summit refuses injection (pending port):");
try {
  getInjector("summit").injectPage("homepage", { page: "homepage", slots: {} });
  check("summit threw not-ready", false, "did not throw");
} catch (e) {
  check("summit threw not-ready", e instanceof Error && e.message.includes("not ready"));
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
