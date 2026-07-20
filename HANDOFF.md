# Energize Website Builder Handoff

Updated July 20, 2026. This is the authoritative handoff for the next Codex
chat. Read this file completely before making changes.

## Start here

Read these files in order:

1. `AGENTS.md`
2. `HANDOFF.md`
3. `README.md`
4. `BUILD_BRIEF.md`
5. `PRODUCT.md`
6. `docs/WEBSITE_BUILDER_UX_SPEC.md`

Then inspect the repository:

```bash
git status --short
git log -8 --oneline --decorate
node -p "require('./package.json').version"
```

`HANDOFF.md`, `README.md`, `PRODUCT.md`, and the approved UX specification
supersede the old user-facing theme workflow described in parts of
`BUILD_BRIEF.md`. Keep historical theme and injection code for compatibility.

## Current repository state

- Workspace: `/Users/markjohnson/Desktop/Energize-Claude-Cowork/Energize-website-builder`
- Branch: `codex/frontend-reskin`
- Application version: `4.4.2`
- Current implementation: complete frontend reskin with a persistent sidebar,
  official Energize branding, reusable side drawers, and a borderless light
  dashboard design system, while preserving the version 4.3 migration behavior
- Current version work: `Add branded side drawers` on the local
  `codex/frontend-reskin` branch
- Base reskin commit: `54a1d9d Reskin frontend with light dashboard system`,
  pushed to `origin/codex/frontend-reskin`
- Main merge commit: `6d0a3e9 Merge pull request #2 from
  mjenergizegroup/agent/preserve-elementor-layout-design`
- Pull request: `#2`, merged into `main` on July 20, 2026
- Local `main` contains the earlier documentation refresh plus the version 4.4.0
  reskin commit. Those commits have not been pushed to `origin/main`.
- Stack: Next.js 15 App Router, TypeScript, Tailwind v4, base-ui shadcn/ui,
  Clerk, Prisma 6, Neon PostgreSQL, and server-only WordPress integrations.

## Current GitHub state

- Repository: `mjenergizegroup/energize-elementor-website-builder`
- Remote: `https://github.com/mjenergizegroup/energize-elementor-website-builder.git`
- Active GitHub CLI account: `mjenergizegroup`
- Git uses the GitHub CLI credential helper backed by the macOS Keychain.
- Pull request #2 is merged. Do not recreate or remerge it.
- The pull request Vercel preview checks passed before merge.
- Version 4.4.1 is pushed to `origin/codex/frontend-reskin`. Version 4.4.2 is
  currently local only.
- A production Vercel deployment triggered from the merged `main` branch was
  not explicitly verified in this chat.
- The historical branch `agent/preserve-elementor-layout-design` may still
  exist locally and remotely. It is already merged and does not need more work.
- Mark is new to GitHub terminology. Explain the purpose and effect of a branch,
  commit, push, pull request, merge, or deployment in plain language before an
  external state change.

## Product direction

The website builder uses a simple layout-first workflow. It is an internal
production tool for Mark, Ariel, David, and future web-team members. The daily
interface must remain understandable to teammates who are not highly technical.

The approved five-step website workflow is:

1. Project
2. Plan Pages
3. Import Content
4. Brand & Destination
5. Review & Build

Core product rules:

- Do not show a user-facing theme-selection step.
- Reusable JSON layouts own safe structure only.
- The Page Plan owns destination page names, URLs, title tags, order, and layout
  choices.
- One service layout can be reused for any number of service pages.
- The current-site crawl runs after the Page Plan and supplies content only.
- Crawl-backed migrations do not require exporting content to Claude or
  re-uploading approved markdown.
- Content should be parsed and matched automatically. The daily workflow should
  not expose a large raw-content editor.
- Do not expose source filenames, original page titles, source domains, plugin
  ledgers, global IDs, dependency terminology, or unrelated JSON metadata in the
  daily builder.
- Only ambiguous content matches should require a plain-language choice.
- WordPress output is created as drafts. Publishing remains manual.
- Landing-page workflow changes and AI rewriting are postponed until the
  website workflow has been tested with real builds.

## Completed implementation

All planned website milestones are complete through version `4.4.2`.

### Version 4.4.2: branded side drawers

- Added one reusable Base UI side-drawer primitive with focus trapping,
  backdrop and Escape dismissal, responsive sizing, and reduced-motion support.
- Moved New Build selection and Template Library JSON intake into right-side
  drawers without changing their routes, validation, or upload behavior.
- Moved the Page Plan add-page and add-services flows into the same drawer
  pattern while retaining the centered layout preview for wide visual content.
- Replaced the temporary E tile with the official supplied Energize Group logo
  in the application shell, public landing page, sign-in page, and sign-up page.
- Preserved the borderless product language and all existing keyboard focus
  states.
- No database schema change was required.

### Version 4.4.1: sidebar and borderless product surfaces

- Replaced the horizontal application navigation with a persistent desktop
  sidebar and compact responsive navigation on smaller screens.
- Added clear Lucide icons, active-route fill, account placement, and release
  information to the sidebar without changing routes or access behavior.
- Removed decorative border colors across shared controls, cards, panels,
  tables, dialogs, workspace components, and Clerk surfaces.
- Preserved visible keyboard focus through outlines and rings.
- Preserved all workflows, API boundaries, Clerk behavior, Prisma behavior,
  server-only credential boundaries, and WordPress workflows.
- No database schema change was required.

### Version 4.4.0: complete frontend visual reskin

- Replaced the black, white, and red brutalist interface with a soft, modern
  light dashboard system inspired by the supplied CRM reference.
- Centralized the primary blue, neutral surfaces, semantic status colors,
  border colors, radii, and shadow elevations in `globals.css` and the Tailwind
  configuration.
- Restyled the persistent navigation, dashboard summary cards, build and client
  tables, Template Library, Page Plan, content matching, technical workspaces,
  dialogs, authentication, and both build wizards.
- Standardized shared buttons, inputs, text areas, selectors, tabs, progress,
  cards, labels, and badges so every route inherits the same interaction states.
- Preserved the compact red E brand tile as the only prominent red brand accent.
- Preserved all routes, data loading, form state, API calls, Clerk behavior,
  Prisma behavior, server-only credential boundaries, and WordPress workflows.
- No database schema change was required.

### Version 4.3.0: preserve layout design while fitting content

- Ready sanitized V3 Elementor layouts are filled in place instead of being
  rebuilt as generic Atomic blocks.
- Original containers, sections, columns, responsive settings, spacing,
  typography, backgrounds, and other sanitized presentation settings remain in
  the prepared document.
- Elementor 4 hybrid documents may contain the preserved V3 layout plus native
  Atomic overflow when true overflow is unavoidable.
- Extra headings, body copy, lists, images, and calls to action stay inside the
  corresponding existing layout region when capacity allows.
- Global color bindings from recognized template roles become destination brand
  color markers during sanitation and resolve during preparation.
- Icon-box `title_text` and `description_text` fields are now semantic content
  slots. Description fields are no longer mistaken for script fields.
- A final cleanup pass removes repeated standalone CTA groups and trailing
  cookie or accessibility chrome from older stored crawls.
- The homepage uses `home` as its WordPress draft slug instead of passing an
  empty slug that can collide with an existing published homepage.
- WPCode Bridge v2.3.0 accepts only native Atomic elements and an explicit
  allowlist of sanitized classic elements. The build stops before draft creation
  when a target with preserved V3 layouts has an older bridge.
- Sanitizer v1 artifacts are blocked because their discarded presentation data
  cannot be reconstructed. Add the original JSON again and reselect the new
  Ready layout in the Page Plan.
- No database schema change was required.

### Version 4.2.0: section-aware content fitting

- Import Content now always shows whether the current website crawl completed
  and how many pages were cleaned, including when a saved project resumes.
- Content-match selectors render human-readable source titles and paths without
  briefly exposing internal source-page IDs.
- Cleaned markdown is grouped by major heading and fitted into the corresponding
  sections of the selected JSON layout.
- Related paragraphs and lists remain together, multiple standalone calls to
  action remain separate buttons, and safe overflow stays with its matching
  section when possible.
- The prepared-draft engine now uses the saved semantic slot order instead of
  filling every widget from independent type-only queues.
- Safe icon-list and icon-box regions no longer make an otherwise sanitized
  layout fail conversion.
- Missing reviewed destination media leaves a clear WordPress image placeholder
  instead of deleting the layout's image region.
- Regenerated Elementor ID fields no longer create false source-ID residue
  matches. A source ID copied anywhere else still blocks the draft.
- No database schema change was required.

### Version 3.6.0: reusable Template Library

- Added owned `LayoutTemplate` and immutable `LayoutRevision` records.
- Added authenticated JSON layout upload and deterministic sanitation.
- Added semantic slots, source-residue fingerprints, structural summaries,
  Ready and Needs Setup states, and a Ready-only builder boundary.
- Restricted technical analysis to the template-management surface.

### Version 3.7.0: persistent Page Plan

- Added owned `PagePlanItem` records.
- Added individual pages, bulk service pages, layout reuse, duplicate, reorder,
  delete, URL, title-tag, and resume behavior.
- Removed legacy template-metadata and dependency-resolution screens from the
  daily website flow.

### Version 3.8.0: automatic content matching

- Added owned `ContentMatch` records.
- Added deterministic path, name, synonym, heading, and history matching.
- Strong matches require no action.
- Ambiguous matches ask one plain-language question.
- Missing source content creates an allowed empty draft.

### Version 3.9.0: prepared drafts

- Added immutable `PreparedDraft` revisions.
- Page Plan names, slugs, and titles override all source identity.
- Sanitized layout structure receives matched content through semantic slots.
- Internal links are rebuilt for destination paths.
- Only reviewed destination media can enter prepared artifacts.
- Extra content enters one standard Atomic section.
- Empty placeholders are removed and all Atomic IDs are regenerated.
- A second source-residue scan blocks unsafe drafts.

### Version 4.0.0: safe website build flow

- Added automatic no-write readiness checks.
- Added immutable prepared build plans and stale-input rejection.
- WordPress cannot be contacted until the no-write check passes and the user
  explicitly chooses to create drafts.
- Successful drafts survive partial failures.
- Exact draft slugs are recovered.
- Retry processes only failed pages.
- No dry run contacts WordPress.

### Version 4.0.1: layout names and JSON drag and drop

- Fixed Page Plan selectors that displayed internal revision IDs.
- Existing generated names now use their actual category, such as Home Layout,
  About Layout, and Service Layout.
- Added drag and drop to the Template Library JSON intake.
- New filenames suggest an initial category without carrying source-site names
  into the daily builder.
- No database schema change was required.

Commit: `dc614ed Fix layout names and JSON drop zone`

### Version 4.1.0: visual layout previews

- Template Library cards now open a large scrollable preview popup.
- Every Page Plan layout selector includes a preview button.
- Preview geometry is derived on demand from the owned sanitized artifact and
  semantic slots.
- Source text, source branding, and source images are never shown. Neutral
  placeholders represent headings, text, images, and buttons.
- The API reads only layouts owned by the authenticated user.
- Preview responses do not expose the sanitized artifact or semantic slot IDs.
- No database schema change was required.

Commit: `e337d89 Add visual layout previews`

The preview is a content-free structural visualization, not a pixel-perfect
Elementor screenshot. It accurately distinguishes saved section and column
arrangements while intentionally omitting source styling and content.

## Current database state

The intended Neon database was successfully synchronized with the Prisma schema
on July 17, 2026. Mark ran:

```bash
npm ci
npm run db:push
```

Prisma reported that the database was in sync and generated Prisma Client
6.19.3. The layout, page-plan, content-match, prepared-draft, and build-plan
tables are available.

Versions 4.0.1 through 4.4.2 do not change the Prisma schema. Do not ask Mark to
run `db:push` for these releases.

Never print or document database credentials. Reverify external state if a
future schema change is introduced.

## Verification completed for version 4.4.2

The following passed locally for the branded side-drawer follow-up:

- `npm run typecheck`
- `npm run lint`
- Optimized `npm run build`
- Complete `npm test` suite
- `git diff --check`
- Prohibited em dash and en dash scan on every changed file

The protected drawer flows compiled successfully. Authenticated browser review
remains manual because the Clerk development account domain is not available to
the automated browser session.

## Verification completed for version 4.4.1

The following passed locally for the sidebar and borderless visual follow-up:

- Complete `npm test` suite
- Migration security, Atomic Foundation, WordPress bridge, and injection checks
- `npm run typecheck`
- `npm run lint`
- Optimized `npm run build`
- `git diff --check`
- Prohibited em dash and en dash scan on every changed file
- Public desktop browser review at 1440 by 1000 pixels

The public landing surface rendered the borderless control and panel language
correctly. The protected dashboard compiled successfully, but authenticated
browser review remains manual because the Clerk development account domain is
not available to the automated browser session.

## Verification completed for version 4.4.0

The following passed locally for the complete frontend reskin:

- Complete `npm test` suite
- Migration security, Atomic Foundation, WordPress bridge, and injection checks
- `npm run typecheck`
- `npm run lint`
- Optimized `npm run build`
- `git diff --check`
- Prohibited em dash scan on every changed file

The production build needed normal network access to fetch the configured Inter
font from Google during compilation. It did not deploy or modify any external
system.

Authenticated browser QA remains a manual rollout check because the local Clerk
development domain requires a separate sign-in session. All public and protected
routes compiled successfully in the optimized build.

## Verification completed for version 4.3.0

The following passed locally for the design-preserving content-fitting fix:

- Complete `npm test` suite
- Layout sanitation, migration cleanup, content conversion, semantic fitting,
  prepared-draft, and website-build checks
- Upload security and WordPress-client checks
- Migration security, Atomic Foundation, WordPress bridge, and injection checks
- `npm run typecheck`
- `npm run lint`
- Optimized `npm run build`
- `git diff --check`
- Prohibited em dash scan on changed files
- Read-only exact-file preparation with the supplied Bristol templates and
  Myrtle Grove cleaned markdown:
  - About retained all 5 template sections and produced 295 classic Elementor
    settings, with no top-level Atomic overflow, stale footer, or layout residue.
  - General Dentistry retained all 8 template sections and produced 401 classic
    Elementor settings, with no top-level Atomic overflow, stale footer, or
    layout residue.

Local browser QA reached the protected route but redirected to the separate
Clerk development sign-in in both available browser sessions. No credentials
were entered. Authenticated wizard QA remains a manual rollout check.

A read-only check against the saved Neon layouts confirmed distinct preview
structures:

- About layout: five sections, including a three-column region
- Home layout: seven sections with one- and two-column regions
- Service layout: seven sections with one- and two-column regions

No database records were changed by that verification.

## What has not been done

- The production Vercel deployment state after merging pull request #2 has not
  been explicitly verified.
- Version 4.4.0 is pushed to the `codex/frontend-reskin` preview branch but has
  not been merged into `main` or promoted to a production deployment.
- Version 4.4.1 is pushed to the `codex/frontend-reskin` preview branch but has
  not been merged into `main` or promoted to a production deployment.
- Version 4.4.2 has not been pushed, merged, or deployed. Its work exists only
  on the local `codex/frontend-reskin` branch.
- No external WordPress site was modified while building these milestones.
- An authenticated local browser smoke test is still manual because the local
  Clerk development domain requires a separate sign-in session.
- A full real migration build against J. Bradford Smith has not yet been
  accepted as production-tested by Mark.
- The structural preview is not a final brand-styled website rendering.
- Reviewed destination image migration is still separate from text fitting.
  Missing images remain visible placeholders for completion in WordPress.
- Landing-page workflow refactoring remains postponed.
- AI content rewriting remains postponed.

## Recommended next objective

Version 4.3.0 is already pushed and merged into GitHub's `main`. Versions 4.4.0
and 4.4.1 are available on the `codex/frontend-reskin` preview branch. Version
4.4.2 adds official branding and side drawers locally on that same branch. The
next step is an authenticated visual review of the dashboard and both build
workflows at desktop and mobile widths. If Mark approves the local result,
request separate authorization before pushing, opening a pull request, merging,
or deploying.
Codex must not modify WordPress, deploy, publish, or make a GitHub state change
unless Mark explicitly asks.

Production smoke-test order:

1. Add the original Home, About, Contact, and Service JSON files to Template
   Library again, then select those new Ready layouts in the Page Plan.
2. Replace the active WPCode bridge with v2.3.0 and preserve the existing shared
   secret.
3. Open J. Bradford Smith in the website builder.
4. Confirm one Service layout can be reused across all service pages.
5. Import the current site and confirm the crawl-complete summary and routine
   automatic matches.
6. Continue through Brand & Destination.
7. Run Review & Build and confirm the no-write check passes before any draft
   action becomes available.
8. With Mark's explicit approval, create drafts on staging.
9. Preview About and General Dentistry and confirm the supplied template design,
   spacing, typography, and responsive layout remain intact.
10. Confirm stale cookie/accessibility content and repeated CTA groups are absent.
11. Confirm Home is created or recovered as the `home` draft without touching a
    published homepage.

If Mark reports a production issue, diagnose the exact failing screen and Vercel
server log before changing code. Do not reintroduce the old content editor,
dependency ledger, or theme selector as a workaround.

After one or more successful website test builds, the next product-planning task
is the landing-page workflow. Keep it separate from website builder hardening.

## Important files

- `PRODUCT.md`: users, purpose, anti-references, and strategic design principles
- `DESIGN.md`: visual system and component rules
- `docs/WEBSITE_BUILDER_UX_SPEC.md`: approved website workflow specification
- `src/components/template-library.tsx`: reusable layout library and JSON intake
- `src/components/layout-preview-dialog.tsx`: visual preview popup
- `src/components/page-plan-workspace.tsx`: Page Plan and layout assignment
- `src/components/content-match-workspace.tsx`: ambiguous-match choices
- `src/components/build-wizard.tsx`: five-step migration workflow
- `src/lib/layouts/sanitize.ts`: safe layout sanitation
- `src/lib/layouts/preview.ts`: structural preview derivation
- `src/lib/content-matches/`: deterministic source matching
- `src/lib/prepared-drafts/`: semantic content-to-layout preparation
- `src/lib/migration/content/inject-elementor-v3.ts`: preserved V3 layout fitting
- `src/lib/website-builds/`: no-write check, build plan, draft progress, retry
- `src/lib/wp/`: server-only WordPress integrations
- `wordpress-plugin/energize-build-tool.php`: v2.3.0 hybrid-document bridge
- `prisma/schema.prisma`: owned migration data model

## Repository and security rules

Follow `AGENTS.md` as the authority. Important rules include:

- No em dash characters in code comments, UI copy, or generated content.
- Use base-ui shadcn components. Do not use `asChild`.
- WordPress credentials and plugin secrets are server-only.
- WordPress and plugin requests belong in route handlers or `server-only`
  modules.
- Treat uploaded JSON, crawled content, and remote media as untrusted input.
- Preserve the additive injection strategy pattern.
- Run `npm run verify:injection` after changes under `src/lib/injection/` or
  `theme-templates/`.
- Never expose, print, copy, or commit secrets.
- Do not delete legacy material.
- Do not push, deploy, publish, or modify external WordPress sites without
  explicit authorization.
- Use WordPress drafts. Publishing is a manual team decision.

## Milestone discipline

For every future implementation milestone:

1. Make one cohesive change.
2. Update the application version.
3. Update `README.md` and this handoff.
4. Run appropriate targeted tests and the complete verification suite.
5. Run TypeScript, ESLint, and the optimized production build.
6. Create a descriptive local Git commit.
7. Do not push or deploy unless Mark explicitly asks.

Documentation-only handoff maintenance does not require an application version
bump.

## Instructions for the next Codex chat

Do not restart the old autonomous goal. Its website milestones are complete.
Do not begin landing-page work unless Mark asks.

Start by reading the required files and inspecting Git. Then ask Mark what he
observed during staging or production testing, or proceed with the specific
issue included in his new-chat request. Do not redo pull request #2 or the
version 4.3.0 merge. Continue autonomously through routine implementation and
testing. Explain GitHub actions in plain language. Stop only for a genuine
blocker, a required external write, or a major product choice that cannot be
safely inferred.
