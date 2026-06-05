# Elevate Theme Structured Content Schema (v1)

Single source-of-truth content format for Elevate theme builds. The Claude.ai cleanup Project outputs a file matching this spec, and the Energize Build Tool parser reads it deterministically (no LLM).

One file per practice. All Elevate pages for that practice live in one document.

---

## File format

Plain markdown. Three structural levels:

- `# SITE` (first heading): site-wide values used by every page. The parser substitutes these wherever they appear in page templates.
- `# PAGE: <name>` (page delimiter): everything below until the next `# PAGE:` belongs to this page.
- `## <section>` and `### <field>`: section grouping + named field. Field bodies are the prose between the field heading and the next heading.

### Page name conventions

| Page | `# PAGE:` value |
|---|---|
| Homepage | `homepage` |
| About | `about` |
| Contact | `contact` |
| Amenities | `amenities` |
| First Visit | `first-visit` |
| Insurance and Financing | `insurance-and-financing` |
| Service page (per service) | `service-page-<slug>` (e.g. `service-page-cosmetic-dentistry`) |

One `# PAGE: service-page-<slug>` block per service. Typical practice has ~7 service pages, sometimes more. The parser produces one JSON output file per service-page block.

### Conventions

| Convention | Example |
|---|---|
| Key/value at SITE level | `phone: 908-522-0077` |
| Field with prose body | `### body` followed by paragraphs |
| Field with list | `### trust_points` followed by `- item` lines |
| Image field | `### image` with `url:` and `alt:` as sub-keys |
| Repeating items in a section | The same `### card` (or `### doctor`, `### item`) heading appears N times in order |
| Missing content | `[MISSING: short explanation]` as the entire field body |
| Site value substitution | `{practice_name}`, `{doctor_primary}`, `{phone}`, `{city}`, etc. |

### What the parser does

1. Reads `# SITE` block into a dict.
2. Splits the rest into page blocks by `# PAGE:` delimiters.
3. For each page, walks `##` sections; inside each section, walks `###` fields.
4. Substitutes `{placeholder}` against the SITE dict in every field body.
5. Routes the result to the matching Elementor JSON template, where the website-builder skill maps widget IDs to field names.

### Image handling

Image URLs are filled by the cleanup Project from scraped sources when available. When no source exists (new sites or pages with no scraped equivalent), the URL is marked `[MISSING: David to add]`. Alt text is always written by the cleanup Project, regardless of URL availability.

### Optional sections

If a practice doesn't have something (e.g. no membership plan), the relevant section is omitted entirely from the file. The website-builder skill hides or removes the corresponding widgets from the JSON output. Sections that can be omitted are flagged below as "Optional."

### Final CTA

Every page has its own `## final_cta` section. No fallback — each page authors its own heading, body, and CTA label. This lets each page close with copy that fits its context (e.g. service pages close differently from the About page).

---

## SITE block

```markdown
# SITE

practice_name: Summit Family & Cosmetic Dentistry
doctor_primary: Dr. Blake Bandeff, DMD
doctor_primary_short: Dr. Bandeff
city: Summit
state: NJ
phone: 908-522-0077
phone_tel: tel:908-522-0077
email: hello@summitdental.com
booking_url: https://book.modento.io/summit-family-cosmetic-dentistry-nj/reason-for-visit
address_line1: 33 Overlook Rd, Suite 402
address_city: Summit
address_state: NJ
address_zip: 07901
google_maps_query: 33 Overlook Rd Suite 402, Summit, NJ 07901
membership_url: https://member.clerri.com/?slug=XXXX
```

**Required**: `practice_name`, `doctor_primary`, `city`, `state`, `phone`, `phone_tel`, `booking_url`, `address_line1`, `address_city`, `address_state`, `address_zip`.

**Optional**: `doctor_primary_short`, `email`, `google_maps_query`, `membership_url`. If `membership_url` is absent, all membership CTA sections across all pages are skipped automatically.

---

## PAGE: homepage

### Section: hero
```markdown
## hero

### heading
Exceptional Care, Beautiful Smiles in {city}, {state}

### body
2-3 sentence intro paragraph introducing the practice and primary doctor.

### trust_points
- 5-Star Rated by Patients
- Cosmetic Specialists
- Easy Financing Options

### cta_label
Schedule Your Visit
```

Slots: 1 H1, 1 body paragraph, 3 trust points, 1 button.

### Section: promo_bar
```markdown
## promo_bar

### promo_1_eyebrow
$179 Complete New Patient Package

### promo_1_body
Comprehensive exam, digital X-rays, professional cleaning, and personalized treatment plan.

### promo_2_eyebrow
[MISSING: client to confirm second promotional offer]

### promo_2_body
[MISSING: client to confirm second promotional offer]

### emergency_eyebrow
Dental Emergency?

### emergency_body
We reserve same-day appointments for urgent dental needs.
```

3 boxes: promo 1, promo 2, emergency. Each with eyebrow + body. Optional — omit the section entirely if the practice doesn't run promotions.

### Section: about_intro
```markdown
## about_intro

### heading
{city}'s Choice for Advanced, Compassionate Dental Care

### body
2-3 sentence paragraph about the practice's approach.

### cta_label
Learn More About Us

### image
url: https://source-url.com/image.jpg
alt: Dr. {doctor_primary_short} consulting with a patient
```

### Section: services
```markdown
## services

### section_heading
Our Dental Services

### section_body
1-2 sentence intro to the services grid.

### card
heading: Dental Crowns
body: When a tooth needs more support than a filling can give, custom crowns restore strength and appearance.
cta_label: Learn About Crowns
image_url: https://source-url.com/crowns.jpg
image_alt: dental crown procedure

### card
heading: Dental Fillings
body: Cavities happen, even with great brushing. Tooth-colored fillings restore your tooth quickly and comfortably.
cta_label: See Filling Care
image_url: https://source-url.com/fillings.jpg
image_alt: tooth-colored fillings

(repeat for 6 cards total)
```

Exactly 6 cards. Each card: `heading`, `body`, `cta_label`, `image_url`, `image_alt`.

### Section: doctor_feature
```markdown
## doctor_feature

### eyebrow
Meet Your Dentist

### heading
{doctor_primary}

### body
3-4 sentence doctor bio paragraph.

### cta_label
Meet {doctor_primary_short}

### image
url: https://source-url.com/doctor.jpg
alt: {doctor_primary} portrait
```

### Section: final_cta
```markdown
## final_cta

### heading
Dental Care Built Around You

### body
1-2 sentence closing pitch.

### cta_label
Book Your Appointment
```

Required on every page.

---

## PAGE: about

### Section: hero
```markdown
## hero

### heading
About Us

### body
Learn more about {practice_name}

### cta_label
Schedule Your Visit
```

Inner-page hero. Phone-button text auto-resolves from `{phone}`.

### Section: practice_intro
```markdown
## practice_intro

### heading
A Trusted Dental Home in {city}, {state}

### body
3-5 sentence practice history and philosophy paragraph.
```

### Section: doctors
```markdown
## doctors

### doctor
heading: {doctor_primary}
body: Full bio for primary doctor (4-6 sentences).
image_url: https://source-url.com/doctor-1.jpg
image_alt: {doctor_primary} portrait

### doctor
heading: Dr. Drew Hanna
body: Bio for second doctor.
image_url: https://source-url.com/doctor-2.jpg
image_alt: Dr. Hanna portrait

### doctor
heading: Dr. Mina Salib
body: Bio for third doctor.
image_url: https://source-url.com/doctor-3.jpg
image_alt: Dr. Salib portrait
```

Repeat `### doctor` 1-3 times. Extra slots in the template are hidden if fewer than 3.

### Section: team
```markdown
## team

### member
name: Teresa
role: Office Manager
image_url: https://source-url.com/teresa.jpg
image_alt: Teresa portrait

### member
name: Emmily
role: Hygienist
image_url: https://source-url.com/emmily.jpg
image_alt: Emmily portrait
```

Repeat `### member` 0-6 times. Each member: `name`, `role` (optional), `image_url`, `image_alt`. Optional — omit if the practice doesn't feature team members.

### Section: location
```markdown
## location

### heading
Conveniently Located in {city}, {state}

### body
Office address, parking, public transit notes.
```

### Section: final_cta
Same shape as homepage `final_cta`. Required.

---

## PAGE: service-page-<slug>

Repeated per service. One block per service, slug matches the service URL.

### Section: hero
```markdown
## hero

### heading
{service_name} in {city}, {state}

### body
One-sentence pitch for this service.

### cta_label
Schedule Your Visit
```

### Section: overview
```markdown
## overview

### heading
Creating Your Dream Smile Today

### body
3-5 sentence overview of the service and approach.

### cta_label
Schedule Your {service_name} Consultation

### image
url: https://source-url.com/service-image.jpg
alt: {service_name} treatment in progress
```

### Section: featured_sub_services
```markdown
## featured_sub_services

### section_heading
Your Path to a Perfect Smile

### item
title: Invisalign
body: Straighten your teeth discreetly with comfortable clear aligners.

### item
title: Clear Aligners
body: Alternative clear orthodontic options for a straighter smile.

### item
title: Implants
body: Permanent solutions that look, feel, and function like natural teeth.
```

Exactly 3 items. Optional — omit the section if the service doesn't have featured sub-services (e.g. a single-procedure page like Teeth Whitening).

### Section: benefits
```markdown
## benefits

### heading
{service_name} Benefits

### body
4-6 sentence summary of patient benefits.

### cta_label
Schedule Your {service_name} Consultation
```

### Section: treatment_journey
```markdown
## treatment_journey

### heading
{service_name} Treatment Journey

### body
3-5 sentence walk-through of the patient experience.
```

### Section: faq
```markdown
## faq

### eyebrow
Common Questions

### heading
Most Popular Questions

### item
q: How long does treatment take?
a: 1-3 sentence answer.

### item
q: Is it painful?
a: 1-3 sentence answer.
```

Repeat `### item` 4-8 times.

### Section: final_cta
Same shape as homepage `final_cta`. Required.

---

## PAGE: contact

### Section: hero
```markdown
## hero

### heading
Contact Us

### body
Let's Get In Touch!

### cta_label
Schedule Your Visit
```

### Section: contact_info
```markdown
## contact_info

### heading
We Are Here to Help

### body
Reach out by phone, email, or the form below, and a team member will respond shortly.
```

Address, phone, email, and hours are auto-injected from SITE-level values into the icon-box widgets. Hours stay as-is in the template — the website-builder skill or David sets them manually post-build.

### Section: final_cta
Required.

---

## PAGE: amenities

### Section: hero
```markdown
## hero

### heading
The Amenities at Our Dental Lounge
```

### Section: intro
```markdown
## intro

### eyebrow
No more anxiety, fear, or avoiding the dentist.

### heading
Experience a refreshing and relaxing space designed for you.

### body
4-6 sentence description of the practice atmosphere.

### cta_label
Request Appointment
```

### Section: comfort_menu
```markdown
## comfort_menu

### heading
Comfort Menu

### body
1-2 sentence intro to comfort offerings.

### item
image_url: https://source-url.com/headphones.jpg
image_alt: noise-canceling headphones

### item
image_url: https://source-url.com/blankets.jpg
image_alt: warm blankets

### item
image_url: https://source-url.com/aromatherapy.jpg
image_alt: aromatherapy

### item
image_url: https://source-url.com/beverages.jpg
image_alt: cold-pressed beverages

### item
image_url: https://source-url.com/entertainment.jpg
image_alt: streaming entertainment
```

Exactly 5 items.

### Section: membership_cta
```markdown
## membership_cta

### heading
Membership Plan

### body
For patients without dental insurance, join our membership plan for cleanings, exams, and savings on treatment.

### cta_label
Our Membership Plan
```

Optional. Omit if the practice has no membership plan (`membership_url` absent at SITE level).

### Section: final_cta
Required.

---

## PAGE: first-visit

### Section: hero
```markdown
## hero

### heading
Enjoy a Relaxing First Dentist Visit
```

### Section: intro
```markdown
## intro

### heading
Judgment-Free Care. Personalized Dentistry.

### body
3-5 sentence intro about the first-visit experience.

### cta_label
Request Appointment
```

### Section: what_to_expect
```markdown
## what_to_expect

### heading
Your First Visit

### body
4-6 sentence walk-through of the first appointment.

### cta_label
Request Appointment
```

### Section: comfort_menu
Same shape as Amenities `comfort_menu`. Optional. If both Amenities and First Visit reference the comfort menu, the cleanup Project may reuse the same items.

### Section: insurance_teaser
```markdown
## insurance_teaser

### heading
Insurance and Financing

### body
2-3 sentence summary of accepted insurance and financing options.

### cta_label
Insurance & Financing Info
```

### Section: membership_cta
Optional. Same rules as Amenities.

### Section: final_cta
Required.

---

## PAGE: insurance-and-financing

### Section: hero
```markdown
## hero

### heading
Dental Insurance and Financing for Peace of Mind
```

### Section: insurance
```markdown
## insurance

### heading
Accepting Most Major Dental Insurances

### body
3-5 sentence summary of insurance acceptance.
```

Insurance logo carousel images stay in the JSON template (fixed library asset swapped by David per practice). Not part of the content schema.

### Section: financing
```markdown
## financing

### heading
Financing

### body
2-4 sentence summary of CareCredit, Cherry, Sunbit, or other financing partners.

### cta_label
Request Appointment
```

### Section: membership_cta
Optional.

### Section: final_cta
Required.

---

## Parser contract (for Codex)

The parser must:

1. Read the file as UTF-8.
2. Locate `# SITE` and parse `key: value` lines until the next `# PAGE:`. Strip whitespace.
3. For each `# PAGE: <name>` block:
   - Walk `## <section>` blocks.
   - Inside each section, walk `### <field>` blocks.
   - Field bodies are everything between the `### field` line and the next `###`, `##`, or `#` heading.
   - Inline `key: value` lines inside a field body (e.g. inside `### image`, `### card`, `### doctor`, `### item`) are parsed as sub-fields.
   - Repeating `### card` / `### doctor` / `### member` / `### item` headings within the same section accumulate into an ordered list.
4. After parsing, substitute every `{placeholder}` in field bodies against the SITE dict. Unknown placeholders log a warning, not an error.
5. For service-page blocks (`# PAGE: service-page-<slug>`), produce one JSON output file per block, named by slug.
6. Pass the resulting nested dict to the page-specific injection function in the website-builder skill.

Markdown formatting inside field bodies (bold, italics, links, lists) is preserved and passed through to Elementor text-editor widgets, which render HTML.

If a section is absent from a page, the website-builder skill removes or hides the corresponding widgets in the JSON output.
