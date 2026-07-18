# Energize Website Builder

Internal web app for the Energize Group website team. It builds Elementor V4
pages from the shared Energize Atomic Foundation and pushes finished pages to
client WordPress sites as drafts through a custom WPCode bridge snippet.

See [BUILD_BRIEF.md](BUILD_BRIEF.md) for the full product brief.
The approved Page Plan redesign and implementation milestones are documented in
[docs/WEBSITE_BUILDER_UX_SPEC.md](docs/WEBSITE_BUILDER_UX_SPEC.md).

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind v4 + shadcn/ui
- Clerk auth
- Neon (Postgres) via Prisma
- Deployed on Vercel

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run db:generate
# Review the target and schema first, then run db:push when approved.
npm run dev
```

### Environment variables

See [.env.example](.env.example). Required:

| Var | Purpose |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Neon Postgres (pooled / direct for migrations) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk auth |
| `ENCRYPTION_KEY` | 32-byte hex (`openssl rand -hex 32`) for AES-256-GCM of WP credentials |
| `ENERGIZE_PLUGIN_SECRET` | Shared secret matching the live `ENERGIZE_BUILD_SECRET` line in each client's WPCode bridge snippet |

## Architecture

```
src/lib/elementor/atomic/ Shared V4 variables, classes, elements, components,
                          and the deterministic Atomic page builder
src/lib/injection/        Visual preset discovery and historical template
                          compatibility layer
src/lib/parser/           Compatibility import to structured page content
src/lib/wp/               Server-side WordPress client + brand-kit mapping
src/lib/deploy/           Deploy orchestration (yields progress events)
src/lib/migration/        Resumable cleanup, media, conversion, blogs, and deploy
src/lib/layouts/          Reusable layout sanitation, residue scanning, and library
src/lib/page-plan/        Destination page planning, validation, and persistence
src/lib/website-builds/   Immutable build plans, no-write checks, and safe retries
src/app/api/deploy/       Streaming NDJSON deploy route (auth, rate limit, audit)
src/app/api/migrations/   Authenticated resumable migration routes
src/app/api/parse/        Markdown parse route
src/components/build-wizard.tsx   Multi-step form + live deploy progress
theme-templates/{theme}/  Historical V3 references and preset page coverage
artifacts/                Generated Elementor Design System import ZIP
wordpress-plugin/         energize-build-tool.php (WPCode-compatible snippet)
```

Migration project state and its authenticated API are documented in
[docs/MIGRATION_PROJECTS.md](docs/MIGRATION_PROJECTS.md).

## Current site migration flow

Version 4.2.0 uses the complete five-step layout-first workflow. The Page Plan is created
before the current website is imported, and deterministic matching shows only
Matched, Check match, or No source content. Matched content is then fitted into
the selected JSON layout section by section. Related headings, paragraphs,
lists, and calls to action stay together, while safe overflow remains with its
matching content section. Internal links are rebuilt, reviewed destination media
is used when available, empty image regions remain visible for WordPress review,
and a final source-residue check runs. Review & Build automatically
runs a no-write check, pins the exact prepared inputs, and enables the explicit
Create WordPress drafts action only after that check passes. The approved end
state is documented in
[docs/WEBSITE_BUILDER_UX_SPEC.md](docs/WEBSITE_BUILDER_UX_SPEC.md).

1. Add and sanitize reusable layouts in the authenticated Template Library.
2. Build the destination Page Plan using friendly page names, URLs, title tags,
   and Ready layout choices. One service layout can be reused by every service.
3. Import the current website after the plan. Strong matches require no action,
   ambiguous matches ask one plain-language question, and missing content makes
   an empty draft.
4. Add brand and destination settings. The server prepares revisioned Atomic
   drafts from the sanitized layout and matched content.
5. Review plain-language readiness. The builder automatically runs a no-write
   check, then creates drafts only after the user selects the final action.
   Successful drafts are preserved if another page fails, and retry processes
   only the failed pages.

Crawl-backed migrations do not require an exported or re-uploaded content file.
The prepared-content import remains a compatibility option for projects that do
not have stored source pages.

The dashboard lists owned migration projects for resume. Source review, current
wizard step, non-secret practice and brand fields, compiled templates, and
dependency decisions are restored. WordPress application passwords are excluded
from the wizard snapshot and remain protected by the existing saved-client
encryption path.

The build wizard does not ask the user to choose a theme or visual preset.
Historical preset metadata remains server-side for compatibility with existing
new-site builds.

### Injection flow

1. Parser turns approved markdown into structured page content.
2. The Atomic page builder composes V4 flexboxes, headings, paragraphs, buttons,
   and global classes from that content and regenerates every element ID.
3. The deploy layer verifies the Atomic Foundation on the target site, updates
   semantic color and font variables, seeds missing components, pushes each page,
   updates site identity and assets, and flushes the Elementor CSS cache.
4. Pages default to the `elementor_header_footer` WordPress page template so the
   active theme header and footer render. Use `elementor_canvas` only when a
   page explicitly requests a standalone canvas layout.

Classic widgets are rejected except for isolated HTML, shortcode, and map
embeds. Components are Atomic-only.

### Verify the injection engine

```bash
npm run verify:injection
npm run verify:bridge
```

### Verify the complete application

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The test suite uses synthetic inputs and mocked WordPress gateways. It does not
download external media or modify a WordPress site.

### Release verification

Version 4.2.0 fixes the website content-fitting path against the saved J.
Bradford Smith project. The Import Content step now visibly confirms that the
website crawl completed and how many pages were cleaned. Source-page selectors
always show human-readable titles and paths instead of internal IDs. Prepared
drafts use the layout's semantic slot map and fit cleaned markdown by major
content section. Lists and multiple calls to action retain their structure,
safe icon lists and icon boxes no longer block drafts, and missing destination
media keeps a clear image placeholder instead of deleting the layout region.
This release does not change the database schema.

Version 4.1.0 adds content-free visual previews for reusable layouts. Template
Library cards open a large scrollable preview, and every Page Plan layout picker
has a preview action beside it. The preview is derived on demand from the exact
sanitized section and column structure, then represented with safe placeholder
text and images. This release does not change the database schema.

Version 4.0.1 corrects generated layout names from their assigned category,
shows those friendly names in Page Plan selectors, and adds persistent drag and
drop JSON intake to the Template Library. New filenames are used only to suggest
an initial layout category. This patch does not change the database schema.

Version 4.0.0 completes the Page Plan workflow. Revisioned `PreparedDraft`
records replace source titles with Page Plan values, internal links are rebuilt
from destination paths, only uploaded
reviewed media can enter the artifact, extra content moves into one standard
section, empty placeholders are removed, and source-template residue blocks
readiness. An immutable no-write build plan pins prepared revisions, content
matches, Page Plan values, brand settings, and the destination before WordPress
can be contacted. Draft creation preserves successful pages, recovers exact
draft slugs, and retries only failed pages. The daily workflow shows only
plain-language readiness and progress.

Version 4.0.0 passes the complete automated suite, TypeScript checking, ESLint,
migration security checks, Atomic and bridge checks, injection verification,
and the optimized Next.js production build. Authenticated browser QA remains a
manual rollout check because the local in-app browser proxy could not reach the
loopback development server.

Before pushing this schema-bearing release, generate the Prisma client and sync
the selected Neon database. The Template Library requires the new
`LayoutTemplate`, `LayoutRevision`, `PagePlanItem`, `ContentMatch`, and
`PreparedDraft` tables:

```bash
npm run db:generate
npm run db:push
```

## Adding an Atomic visual preset

Visual presets share the same variables, global classes, and components. Add a
new preset without forking the design system:

1. Add its metadata folder under `/theme-templates/{preset}/` for discovery and
   page coverage.
2. Add the preset key to `AtomicVisualPreset`.
3. Add only the visual composition differences to the Atomic page builder.
4. Reuse existing global class IDs and semantic variables.

The preset then becomes available to the server-side compatibility layer
(presets are discovered from disk). The build wizard does not expose preset
selection.

## The WPCode bridge snippet

Paste `artifacts/energize-build-tool-wpcode-snippet.txt` into a PHP snippet in
WPCode on the blank WP template install. Choose Run Everywhere and replace the
placeholder in the live configuration near the top of the snippet:

```php
define('ENERGIZE_BUILD_SECRET', 'PASTE_YOUR_EXISTING_SECRET_HERE');
```

Endpoints (all POST, all require `X-Energize-Secret`): `/wp-json/energize/v1/`
`health`, `page`, `logo`, `favicon`, `flush-css`. Atomic variables, global
classes, and components use Elementor's authenticated V4 REST APIs. Auth
failures are logged to a custom table.

The `/page` endpoint requires Elementor 4.1.1 or newer and rejects classic
layout or content widgets. The only accepted classic widgets are the explicit
embed exceptions.

Theme Builder display-condition deployment is not exposed through this bridge.
Migration preflight names those targets as blockers rather than creating an
incorrect normal page. See [docs/MIGRATION_OPERATIONS.md](docs/MIGRATION_OPERATIONS.md)
for staging and recovery procedures.

### Verify the Elevate parser

Parses the real sample (`reference-skills/anchor-periodontics-elevate-content.md`)
and injects every detected page:

```bash
npm run verify:parser
```

## Atomic Foundation

Read [docs/ATOMIC_FOUNDATION.md](docs/ATOMIC_FOUNDATION.md) for the default-site
installation workflow, WPCode bridge setup, naming contract, t-shirt scales,
component catalog, and regeneration commands. The existing V3 JSON files remain
as visual and content references only. New website and landing-page deploys do
not load them.
