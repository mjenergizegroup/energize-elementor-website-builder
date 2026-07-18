# Website Builder Page Plan UX Specification

Status: Approved product direction for implementation planning  
Scope: Website migrations only  
Prepared: July 17, 2026

Implementation status: All five milestones are complete through version 4.0.0.
Landing pages and content rewriting remain separate future work.

Visual reference for the Template Library:
[template-library-concept.png](design/template-library-concept.png).
Visual reference for the Page Plan:
[page-plan-concept.png](design/page-plan-concept.png).

## 1. Product decision

The website builder will stop asking daily users to review raw content, template
metadata, plugin dependencies, external domains, global style IDs, Elementor
internals, or source-site residue.

The new workflow separates three sources of truth:

1. The Page Plan owns the destination page name, URL, title tag, selected
   layout, and whether the page belongs in the build.
2. A layout template owns structure, responsive behavior, and supported visual
   styling only.
3. The website crawl owns destination content only.

The system must understand and sanitize layouts before it crawls and maps
content. One layout can be reused by any number of destination pages. The user
can make final copy corrections later in WordPress because the builder creates
drafts only.

This document supersedes the current user-facing Content and Dependency
Resolution experiences for website builds. It does not remove the underlying
security analysis, deterministic conversion, project history, or deployment
preflight.

## 2. Goals

- Let a team member plan a complete site without understanding Elementor JSON.
- Let the same service layout create six, ten, or any other number of service
  pages.
- Keep all source-template names, content, URLs, IDs, metadata, plugins, and
  other residue out of destination drafts.
- Match crawled pages to the Page Plan automatically after layouts are ready.
- Show only decisions that a builder can understand and act on.
- Preserve resumability, deterministic processing, dry runs, and draft-only
  WordPress creation.
- Make the workflow comfortable for Mark, Ariel, David, and future team members
  with different levels of technical knowledge.

## 3. Non-goals for this release

- AI rewriting, tone changes, or content expansion
- Landing-page workflow changes
- Live WordPress publishing
- Editing full page content inside the builder
- Exposing Elementor node trees or raw JSON
- Asking daily users to resolve plugin, global-style, shortcode, host, or
  dynamic-binding ledgers
- Automatically creating Elementor Theme Builder display conditions

## 4. Product principles

### Plan first

The destination site is defined before content is crawled. This prevents source
navigation, filenames, and metadata from deciding the new site structure.

### Layouts are reusable

A JSON file is not a page. After analysis and sanitation, it becomes a named
layout that can be selected for many pages.

### Content stays content

The crawl supplies text and useful source media references. It does not control
the destination title, URL, SEO title, layout, or page count.

### Technical work is handled once

Template compatibility is resolved in a Template Manager, not repeatedly in
every build. Daily users choose only layouts marked Ready.

### Drafts are the recovery boundary

The builder creates WordPress drafts. Team members can inspect and refine the
result in WordPress before publishing.

### No silent source carryover

If the system cannot prove that a value belongs to the destination project, it
must strip the value or stop that layout from being used. It must never keep a
source value merely to make a draft look complete.

## 5. Users and permissions

### Builder

Builders create projects, choose Ready layouts, create the Page Plan, crawl the
source site, confirm uncertain matches, enter brand and WordPress details, run
the dry run, and create drafts.

The Builder experience must not show:

- raw filenames;
- source template page titles or slugs;
- dependency ledgers;
- Elementor export versions;
- plugin names;
- global IDs;
- source domains found inside templates;
- widget names;
- conversion terminology.

### Template Manager

Template Managers can upload, name, categorize, preview, test, replace, and
retire reusable layouts. They can see compatibility details when a layout needs
technical setup.

The initial release may grant Template Manager access to all authenticated team
members while still keeping it outside the normal build flow. The permission
boundary should remain explicit so it can be restricted later.

## 6. Information architecture

Primary navigation:

- Dashboard
- Website Builds
- Clients
- Template Library

Landing Pages remains a separate product area and is unchanged by this
specification.

The Template Library is not a numbered step in the daily website build. A
builder can upload a new layout from the layout picker, but the system analyzes
and sanitizes it before it becomes selectable.

## 7. Website build flow

The current six-step wizard becomes five user-facing steps:

1. Project
2. Plan Pages
3. Import Content
4. Brand & Destination
5. Review & Build

The order is intentional:

```text
Create project
    |
Choose or upload layouts
    |
Build the destination Page Plan
    |
Crawl the old website
    |
Match content to planned pages
    |
Apply brand and destination settings
    |
Dry run
    |
Create WordPress drafts
```

The wizard autosaves after every meaningful change and resumes on the last
incomplete step. WordPress passwords remain excluded from the resumable browser
snapshot.

## 8. Shared interaction model

- One clear primary action appears at the bottom right of every step.
- Back never discards saved work.
- Autosave state uses Saved, Saving, or Save failed. It does not use technical
  storage language.
- A step is marked complete only when its required outcome is satisfied.
- Warnings explain the effect and the next action in plain language.
- Technical details are available only in Template Manager and server logs.
- Motion remains restrained, honors reduced-motion preferences, and is used to
  explain state changes rather than decorate the screen.
- Destructive row actions require confirmation and name the affected page.
- Tables collapse into stacked page cards on small screens.

## 9. Screen specifications

### 9.1 Dashboard

Purpose: start or resume work without making the user reconstruct project state.

Each website build card shows:

- client or project name;
- source domain when applicable;
- current step;
- page count;
- last saved time;
- status: Planning, Importing, Ready to build, Drafts created, or Needs
  attention;
- Resume button.

Primary action: New website build.

The dashboard must not show layout filenames, dependency totals, content
revision counts, or JSON analysis statistics.

### 9.2 Step 1: Project

Required fields:

- Practice name
- Build type, fixed to Website for this flow
- Existing website URL, optional for a new site

Optional fields:

- Internal project note
- Saved client selection

The screen asks one plain-language source question:

- Existing website: import content later from the current site.
- New website: create the Page Plan without a crawl.

Primary action: Plan pages.

Validation:

- Practice name is required.
- Existing website URLs must use HTTP or HTTPS and pass the existing safe URL
  checks.
- The URL is a crawl source only. It does not determine destination URLs.

### 9.3 Step 2: Plan Pages

Purpose: define exactly what WordPress drafts will be created and which layout
each draft will use.

The page opens with a compact layout readiness summary:

- `3 layouts ready`
- `Add layout` secondary action
- `Open Template Library` tertiary link for Template Managers

Below it, the Page Plan is the main workspace.

Desktop structure:

```text
+--------------------------------------------------------------------------+
| PLAN PAGES                                      [Add pages] [Add services] |
| Choose the pages to create and the layout each one will use.              |
+--------------------------------------------------------------------------+
| Page name          | URL                 | Title tag        | Layout       |
| Home               | /                   | Dentist in ...   | Home A       |
| About Us           | /about-us/          | About Dr. ...    | About A      |
| Emergency Dentistry| /emergency-dentistry/| Emergency ...   | Service A    |
| Preventive Dentistry|/preventive-dentistry/| Preventive ... | Service A    |
+--------------------------------------------------------------------------+
| 4 pages planned                                      [Continue to import] |
+--------------------------------------------------------------------------+
```

#### Page Plan columns

Page name:

- Required.
- Becomes the WordPress page title.
- Never comes from template metadata.

URL:

- Generated from the page name.
- Editable.
- The Home page uses `/`.
- Duplicate URLs are blocked immediately.

Title tag:

- Suggested from the page name and practice name.
- Editable and optional during planning.
- Never comes from template metadata.
- Applying this value in WordPress requires a supported destination SEO adapter.
  Without one, the title remains in the build report for manual entry.

Layout:

- Required before continuing.
- Opens a visual layout picker with friendly names and thumbnails.
- Shows only Ready layouts by default.
- The same layout may be selected on unlimited rows.

Row actions:

- Duplicate
- Move up
- Move down
- Delete

Page type is stored internally as Home, Standard, Service, Contact, or Custom.
It is inferred from the add action and layout selection. It is not a required
technical dropdown in the table.

#### Add pages action

Add pages opens a focused dialog with:

- Page name
- URL, generated live
- Title tag, suggested live
- Layout

Save and add another keeps the dialog open. Add page closes it.

Suggested shortcuts appear above the form when missing from the plan:

- Home
- About Us
- Contact Us
- Patient Resources
- Membership
- Amenities

Suggestions are optional and never add pages without confirmation.

#### Add services action

Add services supports bulk entry for the common many-page case:

```text
Service page names, one per line

Emergency Dentistry
Preventive Dentistry
Dental Implants
Teeth Whitening

Layout for these pages: [Service A v]

[Cancel]                                      [Add 4 service pages]
```

For each line, the system creates a page name, URL, suggested title tag, and
Service page type. The selected layout is applied to every row. All fields stay
editable after creation.

#### Layout picker

Each layout card shows only:

- thumbnail;
- friendly layout name;
- category such as Home, About, Service, Contact, or Flexible;
- Ready status;
- short structural description such as `Hero, trust row, content sections,
  call to action`.

It does not show source practice, filename, original page title, source URL,
Elementor version, plugin list, global IDs, node count, or widget count.

If no Ready layout fits the current page, the picker offers Add layout. The
uploaded JSON is analyzed before it can be selected.

#### Empty state

`No pages planned yet. Add pages one at a time or add a list of services using
one shared layout.`

#### Continue rule

At least one page must exist and every page must have a unique URL and a Ready
layout.

### 9.4 Add layout flow

Purpose: turn a JSON file into a safe reusable layout without exposing its old
site as project data.

Builder-facing sequence:

1. Choose one or more JSON files.
2. The system shows `Checking layout` while it analyzes and sanitizes each file.
3. For a usable file, show a generated thumbnail and ask for:
   - Friendly layout name
   - Category
4. Save layout.

Successful result:

`Service Split Hero is ready to use.`

Recoverable result:

`This layout needs template setup before it can be used.`

Actions:

- Send to Template Manager
- Choose another file

Blocked result:

`This file cannot be used safely. Choose a different layout file.`

The daily flow never asks the builder to interpret dependencies or choose
Resolved with mapping, Accepted exception, Blocked, or Needs resolution.

### 9.5 Template Library

Purpose: prepare a layout once, then reuse it across builds.

Library cards show:

- thumbnail;
- friendly name;
- category;
- status: Ready, Needs setup, or Retired;
- last updated date;
- number of builds using the layout.

Actions:

- Preview
- Edit name and category
- Replace source JSON
- Run test build
- Retire

Retiring a layout prevents new selection but does not break saved projects.
Replacing JSON creates a new layout revision. Existing build plans stay pinned
to the revision they selected until the builder explicitly upgrades them.

#### Template Manager detail

The detail screen may show technical analysis, but it groups findings by effect:

- Safe and removed automatically
- Needs a supported replacement
- Cannot be used

The technical user can inspect source hosts, unsupported widgets, shortcodes,
plugins, dynamic bindings, globals, and conversion notes here. Decisions are
saved on the layout revision and never repeated in each build.

A layout becomes Ready only after:

- sanitation succeeds;
- every required structural element has a supported conversion;
- all source content and identity values are removed;
- a residue scan passes;
- a thumbnail can be rendered from the sanitized artifact;
- the layout has a friendly name and category.

### 9.6 Step 3: Import Content

Purpose: crawl the old site after the destination Page Plan is known, then
attach useful source content to planned pages.

The user enters or confirms the source website URL and chooses Start import.
The system crawls, normalizes, and matches in the background.

Progress copy:

- Finding website pages
- Cleaning crawl noise
- Matching content to your Page Plan
- Import complete

The user does not see raw markdown, cleaned markdown, editable content,
approval revisions, crawl query URLs, or skipped technical URLs.

#### Match results

Each planned page receives one simple status:

- Matched
- Check match
- No source content

Matched means one strong source match was found. The row shows the source page's
human-readable title only, with Change as a secondary action.

Check match means two or more plausible source pages were found. The row asks:

`Which current page contains the content for Emergency Dentistry?`

The chooser displays a human-readable title and clean path. It may include a
short text preview when titles are ambiguous. It does not expose query strings,
tracking parameters, crawl classifications, or raw markdown.

No source content is not a blocker. The user can:

- Create an empty draft
- Choose a different source page
- Remove the page from the plan

For a new website, every page starts as Create an empty draft.

#### Automatic matching order

The matcher uses deterministic signals in this order:

1. normalized planned URL and source canonical path;
2. normalized page name and source title;
3. service and page-type synonyms;
4. heading similarity;
5. existing project match history.

The matcher must not use the uploaded layout's old page title, slug, filename,
or source domain as a destination content signal.

#### Continue rule

No rows may remain in Check match. Matched and No source content rows can
continue.

### 9.7 Step 4: Brand & Destination

Purpose: collect destination identity, brand variables, assets, and WordPress
connection details in one step after the site plan is stable.

Sections:

1. Practice details
2. Brand colors and fonts
3. Logo and favicon
4. WordPress destination

The existing safe asset validation, saved-client credential encryption, and
server-only WordPress behavior remain in force.

The screen must clearly say:

`The builder creates drafts only. It will not publish pages.`

Connection testing is read-only. The user can save the client without starting
a build.

### 9.8 Step 5: Review & Build

Purpose: show the outcome, not implementation details.

Summary cards:

- Pages: `10 drafts planned`
- Content: `9 matched, 1 empty`
- Layouts: `3 ready layouts used`
- Destination: `Connected`
- Source check: `No source-site residue found`

Page review table:

- Page name
- URL
- Layout
- Content: Matched or Empty
- Readiness: Ready or Needs attention

The screen does not show dependencies, compile artifacts, template metadata,
revision IDs, adapter names, plugins, or global styles.

Actions:

1. Run dry run, automatic when the step opens or when inputs changed.
2. Create WordPress drafts, enabled only after the latest dry run passes.

The final action copy is `Create drafts`, never Publish or Deploy live.

### 9.9 Build progress and results

Progress is grouped by user outcome:

- Preparing destination
- Applying brand
- Creating 10 page drafts
- Final checks

Technical subevents remain in server logs and build history but are collapsed
from the default UI.

Partial failure behavior:

- Successful drafts remain successful.
- Failed pages name the plain-language issue and offer Retry failed drafts.
- Exact-slug draft recovery remains supported.
- Existing published-page conflicts are never overwritten.

Each successful row offers:

- Edit in WordPress
- Preview draft

## 10. Layout sanitation contract

The analyzer may read all source JSON values to understand the layout, but the
compiled reusable layout is an allowlisted artifact. It preserves only values
needed for safe structure and presentation.

### Preserve when supported

- container and section hierarchy;
- responsive ordering and visibility;
- supported spacing and sizing;
- supported typography roles;
- supported color roles mapped to destination brand variables;
- supported border, radius, and alignment settings;
- semantic content-slot positions;
- approved structural components;
- approved isolated embed placeholders with no source configuration.

### Always strip or replace

- source practice and person names;
- source page titles, slugs, SEO fields, and descriptions;
- original filenames from destination-facing data;
- source post, page, template, element, media, attachment, and revision IDs;
- source domains, internal links, external links, canonical links, and staging
  domains;
- source phone numbers, emails, addresses, booking links, form recipients, and
  social profile links;
- source image IDs, URLs, filenames, captions, alt text, and attachment
  metadata unless a separately reviewed crawl-media mapping supplies the
  destination value;
- source body copy, headings, labels, buttons, testimonials, provider names,
  prices, hours, and legal copy;
- plugin configuration and plugin-specific identifiers;
- shortcodes and dynamic tags unless a supported destination adapter generates
  a new value;
- tracking IDs, analytics IDs, pixels, scripts, custom code, and hidden HTML;
- source global style IDs and kit references;
- custom CSS selectors containing source identity;
- query strings, cache-busting values, and export timestamps;
- Elementor document settings that control page title, status, author,
  destination template, or source-site identity.

### Generated replacements

- fresh unique Elementor element IDs;
- destination brand-variable references;
- destination page name, URL, and title-tag values from the Page Plan;
- destination media IDs and URLs from reviewed media migration;
- destination links generated from the Page Plan;
- safe placeholders for supported forms, maps, booking, and social links until
  destination settings are available.

### Residue scan

Before a layout becomes Ready and again before each dry run, scan the compiled
artifact for:

- all strings and domains extracted from the source template;
- original filename stems;
- source post and media IDs;
- credential-like values;
- script, tracking, and plugin configuration patterns;
- source practice names discovered in text and metadata.

Any unexplained match blocks that layout revision. The builder sees a plain
message to choose another Ready layout or send it to Template Manager.

## 11. Content mapping contract

Content mapping is deterministic and does not rewrite copy.

### Input cleanup

For a matched crawl page, remove:

- navigation, footer, cookie, repeated call-to-action, and crawler noise;
- duplicate sections;
- query-string variants and tracking links;
- scripts, forms, style blocks, and hidden text;
- source-site chrome and unrelated recommended-content blocks.

Keep useful headings, paragraphs, lists, approved contact facts, and candidate
media references as structured content.

### Semantic slots

The sanitized layout exposes semantic slots such as:

- page title;
- hero summary;
- primary call to action;
- introduction;
- repeated content section;
- benefits list;
- supporting call to action;
- contact details;
- image role.

The mapper fills slots by meaning and order, not by source Elementor IDs.

Rules:

1. Page Plan values always win for page name, URL, title tag, and layout.
2. Destination practice and brand values always win over crawl values when the
   user entered them explicitly.
3. Never use the old content embedded in a template as fallback copy.
4. Remove unused template placeholders and their empty decorative wrappers
   when safe.
5. If source content has more sections than the layout, append the overflow to
   one supported standard content region before the final call to action.
6. If source content has fewer sections, remove unused repeatable sections.
7. If a structural mismatch cannot be handled safely, mark the page Needs
   attention at review and suggest a different layout. Do not expose the node
   tree.

## 12. Links, media, forms, and dynamic features

### Internal links

Rebuild internal links from the Page Plan. If the target page is absent, remove
the link while keeping its readable text and report a non-blocking review note.

### External links

External links found in crawled content may be preserved only when they are
normal visible content links and pass URL safety checks. External links found
only in the template are always removed.

### Media

Crawled media follows the existing reviewed media pipeline. Template media is
never treated as client media. A page can still be created with a safe image
placeholder when media is missing.

### Forms and booking

Template form recipients, provider IDs, calendars, embeds, and booking links are
always stripped. A supported destination configuration may generate them later.
Otherwise the review screen says `Booking setup needed in WordPress` without
blocking unrelated page drafts.

### Unsupported dynamic regions

If the region is optional, remove it and tell the builder what was omitted in
plain language. If it is essential to the layout, the layout cannot become
Ready until Template Manager provides a supported replacement.

## 13. Replace Dependency Resolution with automatic preflight

The current dependency ledger remains an internal analysis model, but it is no
longer a daily user interface.

The system resolves each finding through policy:

- Remove: source-only value is deleted.
- Regenerate: IDs and destination values are created fresh.
- Map: supported value is mapped to a known destination capability.
- Omit: optional unsupported region is removed.
- Block layout: essential unsupported behavior prevents Ready status.

Only the final effect reaches the builder. Examples:

- `Reviews section removed because this layout used an unsupported source
  widget.`
- `Booking button will need a destination link in WordPress.`
- `This layout cannot be used safely. Choose another layout.`

There are no builder-facing statuses named Needs resolution, Resolved with
mapping, Accepted exception, or Blocked.

## 14. Data model direction

The implementation should introduce or evolve these concepts without coupling
the UI directly to raw template JSON.

### LayoutTemplate

- id
- owner or organization scope
- friendlyName
- category
- status
- activeRevisionId
- thumbnail
- structuralSummary
- createdAt
- updatedAt
- retiredAt

### LayoutRevision

- id
- layoutTemplateId
- source checksum
- internal original filename
- analyzer version
- compiler version
- sanitized artifact
- semantic slot schema
- technical findings
- sanitation report
- residue-scan result
- createdAt

The original filename is internal audit data only and is never returned in the
daily build payload.

### PagePlanItem

- id
- migrationProjectId
- position
- pageName
- slug
- titleTag
- pageType
- layoutRevisionId
- contentMatchId, optional
- emptyDraftAllowed
- status

### ContentMatch

- id
- pagePlanItemId
- sourcePageId
- score
- signals
- status: matched, check, empty
- confirmedByUser
- normalizedContentRevision

### BuildPlan

The server derives an immutable BuildPlan for each dry run. It pins Page Plan,
layout, content, media, brand, adapter, and destination revisions. A real draft
run must reject stale inputs and require a new dry run.

## 15. State and recovery

- Every Page Plan edit saves independently.
- Bulk service creation is one recoverable transaction.
- Crawl progress is resumable and tied to the project.
- Re-crawling creates a new source revision and does not silently replace
  confirmed matches.
- Changing a page URL rechecks internal links and invalidates the latest dry
  run.
- Changing a layout invalidates only the affected page preview and dry run.
- Retired layouts remain pinned to existing projects but show an upgrade note.
- If the session expires, local unsaved input remains on screen and save resumes
  after authentication.
- WordPress credentials are never placed in the workspace snapshot.

## 16. Errors and empty states

Error messages use this structure:

1. What happened
2. What it affects
3. What the user can do next

Examples:

- `We could not read this layout file. No project pages were changed. Choose a
  different JSON export.`
- `The website import stopped after 8 pages. Your Page Plan is safe. Try the
  import again.`
- `Emergency Dentistry has two possible content matches. Choose the current
  page that contains its content.`
- `The WordPress connection could not be verified. No drafts were created.
  Check the saved client connection and try again.`

Raw stack traces, dependency keys, host inventories, and adapter names never
appear in builder-facing messages.

## 17. Accessibility and responsive behavior

- All actions are keyboard reachable and have visible focus states.
- Dialog focus is trapped and returns to its trigger when closed.
- Page rows support keyboard reordering in addition to pointer controls.
- Table headers remain associated with fields and statuses.
- Status changes are announced through polite live regions.
- Crawl and build progress use determinate progress when totals are known.
- Color is never the only status signal.
- Touch targets are at least 44 by 44 CSS pixels where practical.
- On narrow screens, each Page Plan row becomes a card with labeled fields and
  actions. No horizontal scrolling is required for the primary workflow.
- Reduced-motion preferences disable rearrangement and count animations.

## 18. Terminology

Use in the Builder experience:

- Layout
- Page Plan
- Import content
- Content match
- Ready
- Needs attention
- Create drafts
- Edit in WordPress

Reserve for Template Manager or logs:

- JSON manifest
- compile artifact
- dependency
- adapter
- widget
- shortcode
- global style ID
- dynamic binding
- node
- migration ledger

Do not use Deploy as the final daily action when the action only creates
WordPress drafts.

## 19. Acceptance criteria

### Page planning

- A builder can add one page and select a Ready layout without seeing a
  filename or template metadata.
- A builder can paste ten service names and create ten rows using one shared
  service layout.
- Every page can have its own name, URL, title tag, and layout.
- One layout can be reused across unlimited pages.
- Duplicate URLs and missing layouts are caught before content import.

### Import and mapping

- The crawl starts only after the destination Page Plan exists.
- Strong matches require no user action.
- Ambiguous matches require one plain-language source-page choice.
- Missing content can create an empty draft.
- No raw or cleaned markdown editor appears in the build flow.

### Sanitation

- Generated output contains zero source practice names unless the same value
  was explicitly entered for the destination.
- Generated output contains zero source-template domains, filename stems,
  source post IDs, source media IDs, source page titles, plugin configuration,
  analytics IDs, or global style IDs.
- Template content is never used as fallback content.
- All destination element IDs are regenerated.
- Internal links resolve from the Page Plan.
- A failing residue scan prevents the affected layout from becoming Ready.

### Safety and recovery

- Dry runs do not call WordPress.
- Real runs create drafts only.
- Existing published content is never overwritten.
- Failed drafts can be retried without duplicating successful drafts.
- Projects resume with Page Plan, layout revisions, content matches, and latest
  results intact.
- Credentials and secrets remain server-only.

## 20. Test matrix

The first implementation must include synthetic automated tests and manual
browser scenarios for:

1. J. Bradford Smith migration with Home, About, Contact, and multiple services.
2. Six service pages using one layout.
3. Ten service pages using one layout.
4. Mixed Home, About, Service, Amenities, and Membership layouts.
5. An unrecognized service filename that succeeds after the user names the
   layout in Template Manager.
6. A template containing a different practice name, title, slug, domain, phone,
   email, booking link, post IDs, media IDs, plugin settings, and tracking IDs.
7. A planned page with no crawled match that creates an empty draft.
8. Two ambiguous crawled matches that require one user choice.
9. Extra source content that flows into the standard overflow content region.
10. Missing source sections that remove unused layout placeholders.
11. An optional unsupported widget that is omitted with a simple review note.
12. An essential unsupported region that keeps the layout out of Ready status.
13. Layout revision replacement while an existing project stays pinned.
14. Autosave, refresh, sign-in recovery, and resume.
15. Dry-run invalidation after a Page Plan, layout, content, brand, or
    destination change.
16. Partial WordPress draft failure and retry using mocked gateways only.

Manual testing on an external WordPress staging site requires separate explicit
authorization. It is not part of local automated verification.

## 21. Implementation milestones

Each milestone requires an application version bump, relevant automated tests,
full verification proportional to the change, and its own local Git commit.
Do not push or deploy without explicit authorization.

### Milestone 1: Layout Library and sanitation boundary

- Add layout and revision persistence.
- Move template analysis and technical findings into Template Manager.
- Produce sanitized layout artifacts with semantic slots.
- Add source-residue scanning.
- Expose only Ready layouts to the normal builder.

Exit condition: a hostile sample layout cannot leak source identity or metadata,
and a Ready service layout can be selected by friendly name.

### Milestone 2: Page Plan

- Replace the current Content step with Plan Pages.
- Add individual pages, bulk services, duplicate, reorder, delete, title tag,
  URL, and layout picker behavior.
- Persist PagePlanItem state and resume it.
- Remove filename, template title, and technical analysis from the daily flow.

Exit condition: a user can plan J. Bradford Smith with multiple service pages
using one service layout.

### Milestone 3: Crawl after plan and automatic matching

- Move the crawl after Plan Pages.
- Normalize crawl results against the known destination plan.
- Add deterministic automatic and ambiguous matching.
- Remove the content editor and approval controls from the daily flow.
- Preserve internal revisions for recovery and audit.

Exit condition: every planned page is Matched or No source content, with user
input required only for ambiguous matches.

### Milestone 4: Semantic content fit and draft preparation

- Map normalized content into semantic layout slots.
- Remove unused placeholders.
- Add the standard overflow region.
- Rebuild internal links from the Page Plan.
- Integrate reviewed crawl media without using template media.

Exit condition: J. Bradford Smith content produces safe prepared drafts with no
template copy or source-template media.

### Milestone 5: Simplified review, build, and test builds

Status: Complete in version 4.0.0.

- Replace dependency review with automatic policy preflight.
- Add the simplified Review & Build summary.
- Keep technical events collapsed and preserve audit records.
- Verify dry run, partial failure, retry, and exact-slug recovery.
- Complete the full test matrix with mocked WordPress gateways.

Exit condition: a non-technical team member can complete the website flow using
only page, layout, content-match, brand, destination, and draft concepts.

## 22. Migration from the current workflow

- Existing migration projects retain their stored content, compiled bundles,
  and audit history.
- On first open after the new Page Plan release, derive draft Page Plan rows
  from selected mappings, then ask the user to confirm only page name, URL,
  title tag, and layout.
- Existing dependency decisions remain historical data but do not appear in the
  new daily flow.
- Existing uploaded templates must pass the new sanitation and residue scan
  before they can become Ready layouts.
- Do not infer a trusted layout merely because it compiled under the previous
  portable compiler.

## 23. Landing-page extension later

The Page Plan, LayoutTemplate, LayoutRevision, sanitation, content slots, and
BuildPlan concepts should be reusable for landing pages. The website release
must not refactor or replace the current landing-page wizard yet.

Future landing-page work can add landing-specific page types, campaign
metadata, form integrations, and layout categories while preserving the same
simple model: choose a safe layout, define the destination page, attach content,
review, and create a draft.

## 24. Recommended defaults

- New migrations begin with optional Home, About Us, Contact Us, and Patient
  Resources suggestions, but no pages are silently added.
- Bulk service creation uses the last selected Ready service layout.
- URLs are lowercase slugs with trailing slashes in the UI.
- Title tags are suggested as `Page Name | Practice Name` and remain editable.
- A planned page with no source match creates an empty draft when the user keeps
  it in the plan.
- Optional unsupported layout regions are removed.
- Essential unsupported regions keep a layout out of Ready status.
- The first release allows all authenticated team members to open Template
  Manager, while the navigation and data model preserve a separate role.
- Technical findings stay available for debugging and audit but are never
  required reading in the daily build.
