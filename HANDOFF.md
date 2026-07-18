# Energize Website Builder Handoff

This document carries the product decisions, implementation state, constraints,
source references, and next objective from the previous Codex task. A new Codex
task should read this file completely before making changes.

## Active objective - Page Plan redesign

Mark approved a simpler layout-first website workflow after testing version
`3.5.0`. The complete product, UX, sanitation, data-model, test, and milestone
specification is in
[`docs/WEBSITE_BUILDER_UX_SPEC.md`](docs/WEBSITE_BUILDER_UX_SPEC.md).

Milestones 1 through 4 are complete through version `3.9.0`. The authenticated
Template Library owns reusable sanitized layouts, and the persistent Page Plan
owns destination page names, URLs, title tags, order, and layout choices. The
current-site import follows the Page Plan and stores automatic content matches,
with only ambiguous choices shown. Revisioned prepared drafts now fit that
content into sanitized layouts, rebuild links, map reviewed destination media,
append overflow, remove empty placeholders, regenerate Atomic IDs, and block
source residue. The next implementation milestone completes simplified review,
automatic dry run, draft creation, partial failure, and retry. Do not start with
landing pages or AI rewriting.
The daily builder must not expose raw content review, template metadata,
filenames, plugins, external template domains, global IDs, or dependency-ledger
decisions.

The destination Page Plan will own page names, URLs, title tags, and layout
choices. Reusable Ready layouts will own safe structure only. The crawl will run
after the Page Plan exists and will supply content only. One service layout must
be reusable across any number of service pages.

Version 3.9.0 adds owned `PreparedDraft` revisions and the semantic preparation
boundary. Page Plan identity wins, template copy never supplies fallback,
destination links are rebuilt, only uploaded reviewed media is accepted, and a
second residue scan gates Ready status. Extra crawl sections enter one standard
Atomic content region and unused placeholders are removed.

Version 3.8.0 added owned `ContentMatch` records, a deterministic path, name,
synonym, heading, and history matcher, and the five-step Project, Plan Pages,
Import Content, Brand & Destination, and Review & Build flow. Strong matches
need no input, ambiguous matches ask one plain-language source-page question,
and missing content creates an empty draft. Confirmed choices survive a
re-import.

Version 3.7.0 added owned `PagePlanItem` records and a simple Plan Pages workspace
with individual pages, bulk services, Ready layout reuse, duplicate, reorder,
delete, destination URL, and title-tag controls. It resumes the saved plan and
removes the legacy content and dependency workspaces from the daily flow.

Version 3.6.0 added owned `LayoutTemplate` and `LayoutRevision` records, a
Template Library and technical setup detail screen, deterministic sanitation,
semantic slots, source-identity fingerprints, and residue scanning. The library
cards expose friendly names, categories, structural previews, and Ready status.
Raw filenames and technical analysis are restricted to Template Manager detail.
The Ready-only API excludes layouts that need setup.

Each implementation milestone must update the version, pass appropriate
verification, and receive its own local commit. Do not push, deploy, or modify
an external WordPress site.

## Completion update - July 17, 2026

The autonomous migration-content objective documented below is complete at
application version `3.5.0`.

- The build wizard has no user-facing theme-selection step.
- Selected crawl pages are stored directly in an owned migration project.
- Raw and deterministic cleanup versions remain immutable during review.
- Editable approved content is revisioned and loses approval when changed.
- Approved project content maps directly into selected JSON page templates by
  exact slug and theme-neutral page role.
- Media inventory and blog drafts use the approved content revision.
- Export is an optional source backup. Crawl-backed migrations do not require a
  content-file re-upload or an external cleanup handoff.
- The dashboard resumes owned projects, including non-secret wizard state,
  approved source content, template bundles, and dependency decisions.
- WordPress application passwords are excluded from resumable wizard state and
  remain protected by the saved-client encryption path.
- Server preparation and deployment reject stale, excluded, or unapproved
  revisioned content mappings.
- Full automated tests, type checks, lint, security verification, injection
  verification, and the production build pass locally.
- Authenticated browser QA remains manual because the local in-app browser proxy
  could not reach either loopback URL. No authentication bypass was attempted.
- No remote push, deployment, external WordPress write, or secret exposure was
  performed.

The Prisma schema now includes both `crawlJobId` and `wizardWorkspace` on
`MigrationProject`. Run `npm run db:generate` and `npm run db:push` against the
intended Neon environment before pushing the release for Vercel to build.

## Start here

Read these files in this order:

1. `AGENTS.md`
2. `HANDOFF.md`
3. `README.md`
4. `BUILD_BRIEF.md`
5. The recent Git history and current working tree

Useful commands:

```bash
git status --short
git log -8 --oneline --decorate
node -p "require('./package.json').version"
```

The product direction in this handoff supersedes the theme-selection portions
of `BUILD_BRIEF.md`. Do not remove the historical theme or injection code simply
because the user-facing theme selection is being removed. Existing code may
still be needed as compatibility logic while the JSON-driven workflow is built.

## Current repository state

- Repository: Energize Website Builder
- Workspace: `/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-website-builder`
- Stack: Next.js 15 App Router, TypeScript, Tailwind v4, base-ui shadcn/ui,
  Clerk, Prisma, Neon, and WordPress server integrations
- Current application version before this documentation-only handoff: `2.3.0`
- Current branch at handoff creation: `main`
- Current HEAD at handoff creation: `952a8fe`
- HEAD commit: `Add portable template compilation workflow`
- Previous commit: `0d40c90 Add template mapping import to migration wizard`
- The working tree was clean before this `HANDOFF.md` update.
- No autonomous goal was started in the previous task.

The standing user rule is to update the application version for every completed
implementation milestone. Documentation-only housekeeping does not represent a
new application milestone. Every future implementation milestone must end with
its own version bump and local Git commit.

## Inherited environment notes and earlier caveats

The following facts came from the repository's earlier technical handoff. Treat
them as historical context and reverify anything environment-dependent:

- Next.js 15.5.19 is intentionally pinned instead of Next.js 16.
- Prisma 6.19.3 is intentionally pinned instead of Prisma 7.
- Prisma CLI commands use `.env.local` through the repository scripts, while
  Next.js also reads `.env.local`.
- Clerk control components such as `SignedIn` and `SignedOut` were not available
  in the installed Clerk version. Existing code uses server `auth()` and client
  hooks/components instead.
- A previous session reported that the Neon schema had been pushed and the core
  dashboard, encrypted-client storage, rate limiting, audit logging, and NDJSON
  deployment progress were working. Reverify the current database and
  environment rather than assuming the external Neon state is unchanged.
- The WordPress deployment path has evolved from the original fixed-theme
  implementation to the current Atomic Foundation and WPCode-compatible bridge.
  The current repository code and README are authoritative.
- A true end-to-end deployment against a staging WordPress site has not been
  established as complete in this handoff. Real deployment testing requires
  explicit authorization and a suitable staging target.
- An older task recorded that development Clerk and Neon secrets appeared in an
  earlier chat transcript while `.env.local` was being configured. The file was
  gitignored, but those credentials should be considered for rotation before
  production use. Never repeat their values in a task or documentation.

## Product direction from Mark

The builder is pivoting from a fixed theme-selection system to a flexible,
JSON-driven site migration system.

The intended experience is:

1. Upload a batch of Elementor JSON templates.
2. Analyze every file without assuming all files share the same structure.
3. Let the user map each JSON file to a page role and destination page.
4. Let the user select which pages belong in the build.
5. Support optional pages. Some sites have membership or amenities pages and
   others do not.
6. Mix and match layouts from different previous websites. A homepage can come
   from one design and an about page from another.
7. Inject destination content and brand data into the selected templates.
8. Migrate full-resolution images with reviewed alt text and useful filenames.
9. Migrate blogs and their images as WordPress drafts.
10. Compile, review, and safely deploy selected pages as WordPress drafts.

The user does not want a theme-selection step in the build wizard anymore. The
next implementation milestone must remove that user-facing step and update the
wizard navigation, validation, review screen, and downstream assumptions. Keep
any necessary internal preset/default compatibility until the deployment layer
no longer requires the old `theme` value.

The uploaded sample files are Elementor V3 exports, but future uploads may be
completely different. Do not hardcode the analyzer or compiler around the nine
samples. Use detection, versioned schemas, and additive strategy registries.

Mark specifically wants the UI to be intuitive and user-friendly. He likes the
animations and interaction feel on [BeUI](https://beui.dev/). The current import
interface uses Motion for restrained BeUI-inspired interactions and honors
reduced-motion preferences. Keep that direction consistent rather than copying
the BeUI website literally.

## Standing user instructions

- Remove the theme-selection portion of the build tool.
- Continue toward a complete, integrated migration system.
- Make reasonable product and technical decisions without repeatedly asking for
  approval.
- Update the application version after every completed implementation milestone.
- Create a descriptive local Git commit after every completed milestone.
- Run relevant tests, lint, type-checking, and build verification before each
  milestone commit.
- Do not push commits to a remote unless Mark explicitly asks.
- Do not deploy to production or modify an external WordPress site without
  explicit authorization.
- Do not delete legacy source material.
- Never expose, print, copy, or commit secrets.
- Use WordPress drafts. Publishing remains a manual team decision.
- Stop only for a genuine blocker involving missing credentials, required
  external authorization, or a major product choice that cannot be safely
  inferred.

## Repository rules that must remain in force

These are summarized from `AGENTS.md`. Read that file for the authoritative
version.

- No em dash characters in code comments, UI copy, or generated content.
- The injection layer uses a strategy pattern.
- Additions to historical theme support must remain additive.
- WordPress credentials and the plugin secret are server-only.
- All WordPress and plugin calls happen in route handlers or server modules
  marked `server-only`.
- This project uses base-ui shadcn components. Do not use `asChild`.
- Run `npm run verify:injection` after modifying `src/lib/injection/` or
  `theme-templates/`.

## Completed milestone: bulk analysis and mapping

Commit: `0d40c90 Add template mapping import to migration wizard`

The migration wizard now includes a bulk JSON template interface.

Implemented behavior:

- Multiple JSON file selection and drag-and-drop upload
- Maximum 20 files per batch
- Maximum 2 MB per file and 10 MB per batch on the server
- Authenticated server-side analysis route
- SHA-256 checksums and duplicate-content detection
- Format and Elementor export-version detection
- Structure, widget, dependency, external-host, global-style, shortcode,
  dynamic-binding, plugin, and duplicate-ID analysis
- Suggested page role, title, and slug with confidence
- Ready, review, and blocked states
- Per-file page-role mapping
- Editable WordPress title and slug
- Per-page inclusion selection and select-all behavior
- Optional-page support through user selection
- Mapping-manifest export
- Expandable warning and dependency details
- Motion-based metric updates, checkboxes, upload feedback, and list transitions
- Reduced-motion handling

Primary files:

- `src/app/api/template-import/analyze/route.ts`
- `src/components/template-importer.tsx`
- `src/components/motion/animated-number.tsx`
- `src/components/motion/checkbox.tsx`
- `src/lib/template-import/analyze.ts`
- `src/lib/template-import/analyze.test.ts`
- `src/lib/template-import/types.ts`

## Completed milestone: portable template compiler

Commit: `952a8fe Add portable template compilation workflow`

Application version: `2.3.0`

Implemented behavior:

- Additive compiler strategy interface and registry
- Elementor export compiler strategy named `elementor-v3-portable`
- Authenticated multipart compile endpoint
- Strict mapping-manifest validation
- Server-side checksum verification and re-analysis before compilation
- Exact source-file and selected-mapping matching
- Rejection of blocked mappings, duplicate sources, oversized batches, and
  unsupported formats
- Regeneration of every Elementor element ID as unique 8-character hex
- Repair of duplicate source IDs
- Clearing of source WordPress media IDs while retaining media URLs
- Preservation and reporting of external hosts, custom global IDs, plugins,
  unsupported widgets, shortcodes, and dynamic bindings
- Normal page and Elementor Theme Builder target classification
- Portable compile result UI
- Ready, review, and blocked result totals
- Per-page transformation counts
- Portable bundle JSON export
- Clear UI statement that compilation does not send anything to WordPress

Primary files:

- `src/app/api/template-import/compile/route.ts`
- `src/lib/template-import/compiler/types.ts`
- `src/lib/template-import/compiler/registry.ts`
- `src/lib/template-import/compiler/manifest.ts`
- `src/lib/template-import/compiler/elementor-v3.ts`
- `src/lib/template-import/compiler/compiler.test.ts`
- `src/components/template-importer.tsx`
- `src/components/build-wizard.tsx`
- `src/lib/template-import/types.ts`

Security properties:

- Analyze and compile routes require Clerk authentication.
- Uploaded files are processed on the server.
- Compile requests are matched by checksum and filename.
- No WordPress credentials are sent to the browser.
- The compiler does not call WordPress.
- The compiler does not deploy or publish anything.

## Important compiler limitation

The portable compiler is not a complete Elementor V3-to-V4 Atomic converter.

It currently makes source exports safer and portable by regenerating IDs,
clearing target-bound media IDs, detecting dependencies, and producing a review
bundle. It intentionally preserves unsupported or unresolved structures and
marks them for review.

Do not tell the user that full V3-to-V4 conversion is complete. A later adapter
layer still needs to translate supported classic V3 structures and widgets into
the Energize V4 Atomic Foundation, or define explicit preserved embed exceptions
where conversion is not possible.

## Results from the nine supplied JSON files

All nine supplied files are V3-era examples. All nine produced portable
artifacts and were classified for review because their real dependencies still
need resolution. None were deployed.

Observed transformation results:

| File | IDs regenerated | Media IDs cleared | Target |
|---|---:|---:|---|
| `clear-aligners.json` | 52 | 6 | WordPress page |
| `about-us.json` | 34 | 3 | WordPress page |
| `home.json` | 78 | 7 | WordPress page |
| `Blog Page Archive.json` | 16 | 1 | WordPress page for current mapping |
| `Blog Single Post.json` | 14 | 1 | Elementor Theme Builder template |
| `marlton-membership.json` | 18 | 1 | WordPress page |
| `Our Technology.json` | 13 | 2 | WordPress page |
| `Contact - Radiance Theme.json` | 14 | 1 | WordPress page |
| `Frist visit - Radiance Theme.json` | 13 | 3 | WordPress page |

Source paths supplied by Mark:

```text
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-Work-Dowloads/Eckley-Family-and-Cosmetic-Dentistry/clear-aligners.json
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-Work-Dowloads/about-us.json
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-Work-Dowloads/home.json
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-Work-Dowloads/Blog Page Archive.json
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-Work-Dowloads/Blog Single Post.json
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-Work-Dowloads/marlton-membership.json
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-Work-Dowloads/Our Technology.json
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-Work-Dowloads/Contact - Radiance Theme.json
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-Work-Dowloads/Frist visit - Radiance Theme.json
```

These files are test fixtures and examples, not a guaranteed production schema.
Do not modify the originals.

## Legacy migration system analysis

The reliable Python migration system is not inside this repository now. It is
available at these external paths:

```text
/Users/markjohnson/Desktop/Energize-Claude-Cowork/Legacy-site-migration
/Users/markjohnson/Desktop/Energize-Claude-Cowork/EG-Website-Team/tools/Legacy-site-migration
```

Treat it as read-only reference material unless Mark explicitly authorizes
changes. Do not copy its `sites/` directory or per-site configuration files into
this repository. Some site configurations contain WordPress application
passwords and other sensitive operational data.

The useful behavior to port into server-side TypeScript modules is:

### Pipeline structure

- `01-raw`: Firecrawl markdown output
- `02-processed/core-pages`: cleaned non-blog pages
- `02-processed/blog-posts`: cleaned blog posts
- `03-content`: consolidated content prepared for content transformation
- `04-json`: generated template/page artifacts in the legacy workflow

### `cleanup.py`

- Removes duplicate form variants and obvious crawl junk.
- Filters sitemap, legal, cookie, accessibility, feed, index, pagination, and
  syndicated-library noise.
- Classifies remaining files as core pages or blog posts.
- Strips light Firecrawl metadata and navigation noise.
- Produces a reviewable cleanup report.

### `consolidate.py`

- Combines cleaned pages with clear source delimiters.
- Removes repeated CTA, navigation, social, and footer noise.
- Reports size and recommends when content should be split.

The new application should keep per-page structured records rather than relying
on a single pasted consolidated file, but the cleanup rules are valuable.

### `push-images.py`

- Extracts and deduplicates image URLs from crawled markdown.
- Skips icons, trackers, favicons, UI chrome, placeholders, and tiny files.
- Supports reviewed alt-text overrides.
- Strips Sanity resize query parameters to retrieve original full-resolution
  assets.
- Generates SEO-friendly filenames from alt text.
- Truncates overly long filenames safely.
- Checks the destination media library to make retries idempotent.
- Uploads through the WordPress media REST endpoint.
- Writes title and alt text to the media record.

### `push-blogs.py`

- Parses titles, dates, slugs, front matter, and featured-image candidates.
- Removes navigation, footer, repeated CTA, address, social, and cookie noise.
- Promotes standalone bold headings when source CMS markup lost heading levels.
- Converts cleaned markdown into Gutenberg block markup.
- Uses WordPress Application Password authentication.
- Supports dry runs and limited test batches.
- Defaults to WordPress drafts.

### Other scripts

- `fix-featured-images.py` repairs post-to-media relationships.
- `fix-image-metadata.py` repairs title and alt metadata.
- `setup.py` and per-site templates establish repeatable site folders.

### Behavioral rules worth preserving

- Old sites do not always use a `/blog/` prefix. Discover posts from actual
  listing/category data and verify counts.
- Always migrate blog images with their posts.
- Use full-resolution source assets.
- Use reviewed alt text and human-readable filenames.
- Make media and post operations idempotent so retries do not create duplicates.
- Test with a dry run or tiny batch before a real external migration.
- Create drafts unless Mark explicitly authorizes publishing.

## Existing application systems to reuse

Do not rebuild working infrastructure unnecessarily.

- `src/lib/firecrawl/` already contains crawl client, filter, export, storage,
  and type modules.
- `src/app/api/crawl/` already contains crawl routes and job export behavior.
- `src/lib/wp/client.ts` contains the server-side WordPress client.
- `src/lib/deploy/` contains deployment schemas, progress events, and
  orchestration.
- `src/app/api/deploy/route.ts` contains authenticated streaming deployment.
- `src/lib/elementor/atomic/` contains the V4 Atomic Foundation and page builder.
- `src/lib/injection/` contains historical theme compatibility strategies.
- `wordpress-plugin/energize-build-tool.php` is the WordPress bridge source.
- `src/lib/crypto.ts`, `src/lib/clients.ts`, `src/lib/audit.ts`, and Prisma models
  cover encrypted credentials, saved clients, and audit records.

The integration work should place new migration capabilities behind server-only
modules and authenticated route handlers, then reuse the existing progress and
audit patterns.

## Theme-selection removal requirements

The current theme choice is still threaded through several systems. Relevant
locations found during handoff creation include:

- `src/components/build-wizard.tsx`
- `src/lib/deploy/schema.ts`
- `src/lib/deploy/types.ts`
- `src/lib/deploy/orchestrate.ts`
- `prisma/schema.prisma`

The next milestone should:

1. Remove the Theme step from the user-facing wizard.
2. Renumber and relabel all remaining steps.
3. Remove theme selection validation and review UI.
4. Update progress calculations and edit-step links.
5. Preserve a safe internal default only where the current Atomic or deploy
   implementation still requires a preset.
6. Avoid a destructive database migration solely to remove the existing theme
   column. It can remain as compatibility metadata until a later data-model
   migration is justified.
7. Update tests and copy so the workflow no longer implies the user selected a
   complete fixed-site theme.

## Work that is not complete

- Theme selection is still visible and required in the current wizard.
- The current compiler does not fully convert V3 widgets to V4 Atomic elements.
- Source content is not yet mapped into arbitrary uploaded template slots.
- Media URLs are detected and source media IDs are cleared, but assets are not
  yet imported and remapped into compiled templates.
- Custom global style IDs are detected but not mapped to destination Atomic
  variables and classes.
- Plugin, widget, shortcode, and dynamic-binding dependencies do not yet have an
  interactive resolution workflow.
- The legacy cleanup, blog, image, featured-image, and metadata pipeline has not
  yet been ported into this application.
- Portable compiler artifacts are not connected to the existing WordPress draft
  deployment orchestrator.
- Blog archive and Theme Builder display-condition deployment need explicit
  destination adapters.
- Retry, resume, rollback, and idempotency need full migration-job coverage.
- Full authenticated browser testing of the new import UI has not been completed.
- Production build completion remains environment-sensitive as described below.
- `BUILD_BRIEF.md` still describes the old theme-selection product and should be
  revised once the new flow stabilizes.

## Recommended milestone order

Use the safest logical order and keep each milestone independently testable and
committable.

### Milestone 1: remove user-facing theme selection

- Simplify the wizard flow.
- Retain internal compatibility defaults where needed.
- Update version, tests, and local Git commit.

### Milestone 2: migration project and source-content model

- Represent crawl output, cleaned pages, blog posts, assets, selected templates,
  mappings, and resolution state as a resumable migration job.
- Reuse Firecrawl modules and existing Prisma/audit conventions.
- Port deterministic cleanup and classification rules with fixtures and tests.

### Milestone 3: media inventory and migration

- Build deduplicated source-asset inventory.
- Preserve original/full-resolution sources.
- Add alt-text review, SEO filename generation, upload, metadata update, and
  source-to-destination media mapping.
- Make retries idempotent.

### Milestone 4: content-to-template mapping and conversion

- Define normalized content slots independently of any one sample JSON shape.
- Add versioned template adapters.
- Translate supported V3 structures to V4 Atomic structures.
- Surface unsupported regions as explicit review items rather than silently
  dropping content.

### Milestone 5: dependency-resolution UI

- Resolve media, globals, plugins, unsupported widgets, shortcodes, dynamic
  bindings, Theme Builder targets, and display conditions.
- Make deployment readiness deterministic and explain every blocker.

### Milestone 6: blog migration

- Port blog cleanup and Gutenberg conversion behavior.
- Preserve dates, titles, slugs, images, alt text, featured images, and drafts.
- Add dry-run and small-batch verification modes.

### Milestone 7: WordPress draft deployment

- Connect resolved compile artifacts to the existing server-side WordPress and
  deployment infrastructure.
- Add preflight, progress, audit, retry, recovery, and result links.
- Do not perform real external deployment without Mark's explicit permission.

### Milestone 8: hardening and documentation

- Responsive and accessibility QA.
- Authenticated end-to-end tests.
- Failure and recovery tests.
- Security review for uploads, credentials, SSRF, and external media fetching.
- Update README, BUILD_BRIEF, and operational documentation.

## Verification already completed for version 2.3.0

The following passed after the compiler milestone:

- `npm run typecheck`
- `npm run lint -- --max-warnings=0`
- `npx tsx src/lib/template-import/analyze.test.ts`
- `npx tsx src/lib/template-import/compiler/compiler.test.ts`
- `npm run verify:injection`
- `git diff --check`
- Search for prohibited em dash and en dash characters in changed files

Notes:

- Direct `npx tsx` test execution passed. In the restricted sandbox, some
  `npm run` wrappers around `tsx` encountered an `EPERM` temporary IPC socket
  error. That was an environment restriction, not a test assertion failure.
- The first production build attempt failed because the sandbox could not reach
  Google Fonts for `next/font`.
- With network access allowed, the build reached `Creating an optimized
  production build` and then produced no output for 90 seconds. It was
  terminated. No TypeScript, lint, or webpack compilation error was reported in
  that second attempt.
- Browser QA redirected to the configured Clerk sign-in domain. The user's
  browser security policy explicitly prohibits that domain. Do not bypass the
  policy, disable authentication, or switch browser surfaces to circumvent it.

## Security boundaries for the next task

- Never put legacy per-site configuration files in Git.
- Never print an application password, encryption key, Clerk secret, plugin
  secret, database URL, or credential-bearing `.env` content.
- Do not send source files or credentials to third parties.
- Treat uploaded JSON and crawled markdown as untrusted input.
- Defend media fetching against SSRF, private-network targets, redirects, file
  bombs, invalid MIME types, and excessive sizes before enabling server-side
  downloads.
- Keep all WordPress and plugin requests server-side.
- Re-analyze and validate files on every state-changing server request.
- Deploy only drafts.
- Real WordPress writes require explicit user authorization at action time.

## Exact autonomous goal requested for the new task

Mark asked to use the following goal, with local milestone commits and no remote
pushes:

> Create a goal to autonomously finish the Energize Website Builder. Continue
> working until the complete site-migration workflow is implemented, tested, and
> documented.
>
> Remove the theme-selection step from the build wizard because themes are no
> longer selected during this workflow. Update the wizard navigation, state,
> validation, review screens, and related tests accordingly. Preserve underlying
> theme and injection code unless removing it is clearly safe and necessary.
>
> Complete the remaining workflow in logical milestones:
>
> 1. Bulk JSON upload and analysis.
> 2. Page mapping and build-page selection.
> 3. Dependency resolution for media, global styles, plugins, widgets,
>    shortcodes, and dynamic content.
> 4. Portable template compilation.
> 5. WordPress draft deployment and safe failure handling.
> 6. Build progress, results, retry, and recovery interfaces.
> 7. Responsive UI, accessibility, BeUI-inspired motion, testing, and
>    documentation.
>
> Make reasonable product and technical decisions without asking me. Follow the
> repository's AGENTS.md, README, BUILD_BRIEF, existing architecture, and
> security rules. Keep credentials server-only and never expose or commit
> secrets.
>
> After every completed milestone:
>
> - Update the application version number.
> - Run all relevant tests, linting, type-checking, and build verification.
> - Create a descriptive local Git commit containing only that milestone.
> - Do not push commits or deploy anything externally.
>
> Do not delete legacy files, deploy to production, modify external WordPress
> sites, or perform irreversible actions without explicit authorization.
> Continue automatically until the objective is complete. Stop only for a
> genuine blocker involving missing credentials, required external approval, or
> a major product decision that cannot be safely inferred. Finish with a detailed
> report covering completed milestones, versions, commits, test results,
> remaining limitations, and any manual steps I need to perform.

## First actions for the new task

1. Read every required context file listed at the top of this handoff.
2. Inspect `git status`, recent commits, and the current package version.
3. Confirm that the 2.3.0 analyzer and compiler milestones are present.
4. Create the explicit autonomous goal only after Mark requests it in the new
   task.
5. Begin with the user-facing theme-selection removal milestone.
6. Keep the underlying injection strategies intact.
7. Verify the milestone, bump the version, and create the first local milestone
   commit before proceeding.
