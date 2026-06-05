/**
 * End-to-end test for the Elevate builder.
 * Uses the parser to convert sample markdown, then runs each page through
 * the builder against the real cleaned templates.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../../parser";
import { buildElevatePage, slugToServiceName } from "./index";
import { findNode } from "./injectors";
import type { ElementorJSON } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (e) {
    console.error(`FAIL: ${name}`);
    console.error(e);
    process.exit(1);
  }
}

function loadTemplate(name: string): ElementorJSON {
  return JSON.parse(
    readFileSync(join(REPO_ROOT, "theme-templates", "elevate", `${name}.json`), "utf-8")
  ) as ElementorJSON;
}

function getWidgetValue(json: ElementorJSON, id: string, field: string): unknown {
  const node = findNode(json.content, id);
  if (!node) return null;
  const settings = node.settings as Record<string, unknown> | undefined;
  return settings?.[field];
}

// -----------------------------------------------------------------------------
// Fixture: a complete content file
// -----------------------------------------------------------------------------

const sampleContent = `# SITE

practice_name: Acme Dental
doctor_primary: Dr. Jane Smith, DMD
doctor_primary_short: Dr. Smith
city: Brooklyn
state: NY
phone: 555-123-4567
phone_tel: tel:555-123-4567
booking_url: https://book.example.com/acme
membership_url: https://member.example.com/acme
address_line1: 123 Main St, Suite 1
address_city: Brooklyn
address_state: NY
address_zip: 11201

# PAGE: homepage

## hero

### heading
Exceptional Care in {city}, {state}

### body
{practice_name} delivers advanced dental care with a personal touch.

### trust_points
- 5-Star Rated by Patients
- Same-Day Crowns
- Easy Financing Options

### cta_label
Schedule Your Visit

## promo_bar

### promo_1_eyebrow
New Patient Special

### promo_1_body
Complete exam, X-rays, and cleaning for $99.

### promo_2_eyebrow
Free Consultation

### emergency_eyebrow
Dental Emergency?

### emergency_body
Same-day appointments available for urgent needs.

## about_intro

### heading
{city}'s Choice for Advanced Care

### body
{doctor_primary} brings years of experience to every patient.

### cta_label
Learn More About Us

### image
url: https://example.com/team.jpg
alt: {doctor_primary} with team

## services

### section_heading
Our Dental Services

### section_body
From cleanings to cosmetic work, we cover the full spectrum.

### card
heading: Cleanings
body: Routine cleanings keep your smile healthy.
cta_label: Learn More
image_url: https://example.com/cleanings.jpg
image_alt: dental cleaning

### card
heading: Fillings
body: Tooth-colored fillings restore your teeth naturally.
cta_label: Learn More
image_url: https://example.com/fillings.jpg
image_alt: dental filling

### card
heading: Crowns
body: Custom-fit crowns restore strength and appearance.
cta_label: Learn More
image_url: https://example.com/crowns.jpg
image_alt: dental crown

### card
heading: Emergency
body: We see urgent cases same-day.
cta_label: Call Now
image_url: https://example.com/emergency.jpg
image_alt: emergency dental

### card
heading: Whitening
body: Brighten your smile in one visit.
cta_label: Learn More
image_url: https://example.com/whitening.jpg
image_alt: teeth whitening

### card
heading: Implants
body: Permanent solutions for missing teeth.
cta_label: Learn More

## doctor_feature

### eyebrow
Meet Your Dentist

### heading
{doctor_primary}

### body
{doctor_primary} earned her DMD with a focus on cosmetic dentistry.

### cta_label
Meet {doctor_primary_short}

## final_cta

### heading
Dental Care Built Around You

### body
Every patient at {practice_name} gets a plan shaped to their needs.

### cta_label
Book Your Appointment

# PAGE: service-page-cosmetic-dentistry

## hero

### heading
{service_name} in {city}, {state}

### body
Personalized smile makeovers crafted just for you.

### cta_label
Schedule Your Visit

## overview

### heading
Creating Your Dream Smile

### body
{doctor_primary_short} combines artistry with modern technique.

### cta_label
Schedule a Consultation

## final_cta

### heading
Ready to transform your smile?

### body
Schedule a consultation with {doctor_primary_short}.

### cta_label
Book Your Consultation

# PAGE: contact

## hero

### heading
Contact Us

### body
Let's Get In Touch!

### cta_label
Schedule Your Visit

## contact_info

### heading
We Are Here to Help

### body
Reach out by phone, email, or the form below.
`;

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

test("slugToServiceName converts hyphenated slugs", () => {
  assert.equal(slugToServiceName("cosmetic-dentistry"), "Cosmetic Dentistry");
  assert.equal(slugToServiceName("dental-implants"), "Dental Implants");
  assert.equal(slugToServiceName("all-on-4"), "All On 4");
});

test("homepage build injects hero, body, trust_points, and CTA", () => {
  const parsed = parse(sampleContent);
  const template = loadTemplate("homepage");
  const { json, warnings, buildNotes } = buildElevatePage({
    pageType: "homepage",
    site: parsed.site,
    pageData: parsed.pages.homepage,
    template,
  });

  assert.equal(getWidgetValue(json, "efa68b", "title"), "Exceptional Care in Brooklyn, NY");
  assert.match(
    String(getWidgetValue(json, "cd7eaeb", "editor")),
    /<p>Acme Dental delivers/
  );
  const trustList = getWidgetValue(json, "fac7f25", "icon_list") as Array<{ text: string }>;
  assert.equal(trustList[0].text, "5-Star Rated by Patients");
  assert.equal(trustList[2].text, "Easy Financing Options");
  assert.equal(getWidgetValue(json, "1e12af9a", "text"), "Schedule Your Visit");

  // Booking URL should be resolved into the button's link
  const heroBtn = findNode(json.content, "1e12af9a");
  const link = (heroBtn?.settings as Record<string, unknown>)?.link as Record<string, unknown>;
  assert.equal(link.url, "https://book.example.com/acme");

  console.log(`  ${warnings.length} warnings, ${buildNotes.length} build notes`);
});

test("homepage build populates all 6 service cards", () => {
  const parsed = parse(sampleContent);
  const template = loadTemplate("homepage");
  const { json } = buildElevatePage({
    pageType: "homepage",
    site: parsed.site,
    pageData: parsed.pages.homepage,
    template,
  });

  // First card
  assert.equal(getWidgetValue(json, "3c739629", "title"), "Cleanings");
  assert.match(String(getWidgetValue(json, "73ae4a15", "editor")), /Routine cleanings/);
  assert.equal(getWidgetValue(json, "1a650f30", "text"), "Learn More");
  const img1 = getWidgetValue(json, "3580e5f3", "image") as Record<string, unknown>;
  assert.equal(img1.url, "https://example.com/cleanings.jpg");
  assert.equal(img1.alt, "dental cleaning");

  // 6th card has no image widget in template - should still work for the others
  assert.equal(getWidgetValue(json, "434e1c4f", "title"), "Implants");
  assert.equal(getWidgetValue(json, "ee8cb27", "text"), "Learn More");

  // 4th card's button has urlSource: 'phone_tel'
  const emergencyBtn = findNode(json.content, "41379f12");
  const link = (emergencyBtn?.settings as Record<string, unknown>)?.link as Record<string, unknown>;
  assert.equal(link.url, "tel:555-123-4567");
});

test("homepage build handles promo_bar including missing promo_2_body", () => {
  const parsed = parse(sampleContent);
  const template = loadTemplate("homepage");
  const { json, warnings } = buildElevatePage({
    pageType: "homepage",
    site: parsed.site,
    pageData: parsed.pages.homepage,
    template,
  });

  assert.equal(getWidgetValue(json, "625ff7ce", "title"), "New Patient Special");
  assert.match(String(getWidgetValue(json, "5fd49c8a", "editor")), /Complete exam/);
  assert.equal(getWidgetValue(json, "72696a60", "title"), "Free Consultation");
  assert.equal(getWidgetValue(json, "57c319a8", "title"), "Dental Emergency?");
  assert.match(String(getWidgetValue(json, "39035b53", "editor")), /Same-day appointments/);

  // No widget warnings for promo_2_body (we intentionally don't map it)
  const promoWarnings = warnings.filter((w) => w.includes("promo_2_body"));
  assert.equal(promoWarnings.length, 0);
});

test("service-page build derives service_name from slug", () => {
  const parsed = parse(sampleContent);
  const template = loadTemplate("service-page");
  const { json } = buildElevatePage({
    pageType: "service-page",
    slug: "cosmetic-dentistry",
    site: parsed.site,
    pageData: parsed.service_pages["cosmetic-dentistry"],
    template,
  });

  // {service_name} should be substituted into the hero heading
  assert.equal(getWidgetValue(json, "1352ddf1", "title"), "Cosmetic Dentistry in Brooklyn, NY");
});

test("service-page build requires slug", () => {
  const parsed = parse(sampleContent);
  const template = loadTemplate("service-page");
  assert.throws(
    () =>
      buildElevatePage({
        pageType: "service-page",
        site: parsed.site,
        pageData: parsed.service_pages["cosmetic-dentistry"],
        template,
      }),
    /slug/
  );
});

test("contact build auto-injects practice name, address, phone", () => {
  const parsed = parse(sampleContent);
  const template = loadTemplate("contact");
  const { json } = buildElevatePage({
    pageType: "contact",
    site: parsed.site,
    pageData: parsed.pages.contact,
    template,
  });

  assert.equal(getWidgetValue(json, "6489253", "title"), "Contact Us");
  assert.equal(getWidgetValue(json, "6fc73827", "title"), "Acme Dental");
  const addrDesc = getWidgetValue(json, "20ce5125", "description_text");
  assert.match(String(addrDesc), /123 Main St/);
  assert.match(String(addrDesc), /Brooklyn, NY 11201/);
  assert.equal(getWidgetValue(json, "7643f4a", "description_text"), "555-123-4567");

  // Phone button on hero
  assert.equal(getWidgetValue(json, "4b9e626e", "text"), "555-123-4567");
});

test("build returns build notes for omitted optional sections", () => {
  const parsed = parse(sampleContent);
  const template = loadTemplate("homepage");
  const { buildNotes } = buildElevatePage({
    pageType: "homepage",
    site: parsed.site,
    pageData: { hero: parsed.pages.homepage.hero }, // only hero, everything else omitted
    template,
  });

  // Should produce build notes for all the missing sections
  assert.ok(buildNotes.some((n) => n.includes("promo_bar")));
  assert.ok(buildNotes.some((n) => n.includes("services")));
  assert.ok(buildNotes.some((n) => n.includes("final_cta")));
});

test("build clones template (does not mutate caller's input)", () => {
  const parsed = parse(sampleContent);
  const template = loadTemplate("homepage");
  const originalHeroTitle = getWidgetValue(template, "efa68b", "title");
  buildElevatePage({
    pageType: "homepage",
    site: parsed.site,
    pageData: parsed.pages.homepage,
    template,
  });
  // Template untouched
  assert.equal(getWidgetValue(template, "efa68b", "title"), originalHeroTitle);
});

test("text-editor wraps plain text in <p> tags", () => {
  const parsed = parse(sampleContent);
  const template = loadTemplate("homepage");
  const { json } = buildElevatePage({
    pageType: "homepage",
    site: parsed.site,
    pageData: parsed.pages.homepage,
    template,
  });
  const body = String(getWidgetValue(json, "cd7eaeb", "editor"));
  assert.ok(body.startsWith("<p>"));
  assert.ok(body.endsWith("</p>"));
});

test("MISSING markers pass through as-is", () => {
  const contentWithMissing = `# SITE
city: Test
phone: 555
phone_tel: tel:555
booking_url: x
practice_name: x
doctor_primary: x
state: x
address_line1: x
address_city: x
address_state: x
address_zip: x

# PAGE: homepage

## hero

### heading
[MISSING: client to confirm headline]

### body
[MISSING: client to write intro]
`;
  const parsed = parse(contentWithMissing);
  const template = loadTemplate("homepage");
  const { json } = buildElevatePage({
    pageType: "homepage",
    site: parsed.site,
    pageData: parsed.pages.homepage,
    template,
  });

  assert.equal(getWidgetValue(json, "efa68b", "title"), "[MISSING: client to confirm headline]");
  assert.match(String(getWidgetValue(json, "cd7eaeb", "editor")), /\[MISSING:/);
});

console.log("\nAll builder tests passed.");
