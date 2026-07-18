# Energize Website Builder - Current Product Brief

## Purpose

Energize Website Builder is an internal migration and build tool for the
Energize Group website team. It moves legacy dental-practice content and design
references into WordPress and Elementor while keeping publishing a manual team
decision.

The primary workflow is site migration. A team member can crawl or upload source
content, import multiple Elementor JSON references, select a different source
layout for each destination page, resolve dependencies, convert supported
classic structures to Elementor V4 Atomic elements, and create recoverable
WordPress drafts.

The application also retains the existing new-website and landing-page builders.
Internal visual-preset metadata remains for backward compatibility, but no
theme or preset is selected in the build wizard.

## Approved next product direction

The approved website-builder workflow is the layout-first Page Plan in
[docs/WEBSITE_BUILDER_UX_SPEC.md](docs/WEBSITE_BUILDER_UX_SPEC.md).

That redesign makes the destination Page Plan the source of truth, analyzes and
sanitizes layouts before crawling content, allows one layout to serve any number
of pages, and removes raw content review and dependency resolution from the
daily builder experience. Landing-page workflow changes and content rewriting
are outside its current scope.

Milestones 1 through 4 are implemented through version 3.9.0. The builder now has a
reusable Template Library, revisioned sanitized layout artifacts, semantic
slots, residue scanning, and a persistent Page Plan with individual and bulk
page creation. The crawl follows the plan and stores deterministic automatic
content matches, with only ambiguous choices exposed. Matched content is fitted
into sanitized layouts, extra content enters a standard section, internal links
use Page Plan destinations, reviewed media is mapped, and residue checks gate
revisioned prepared drafts. Simplified dry run and build review remain next.

## Users and access

- Three internal Energize team members use Clerk authentication.
- Dashboard and API routes require authentication.
- Saved clients retain encrypted WordPress Application Passwords for rebuilds.
- The application has no customer-facing publishing features.

## Legacy deployment engine

1. Choose an existing site crawl or a new-site source.
2. Enter practice information and destination identity.
3. Review the brand kit and validated logo and favicon files.
4. Select or create a saved WordPress destination.
5. For migration builds:
   - Review the stored raw, cleaned, and editable approved content revisions.
   - Upload up to 20 JSON templates per batch.
   - Review format, page-role suggestions, dependencies, and blockers.
   - Match approved stored pages to destination templates by slug and
     theme-neutral page role.
   - Compile portable artifacts and regenerate Elementor IDs.
   - Resolve or explicitly accept every dependency.
   - Run deterministic preflight and an automatic no-write dry run.
   - Create WordPress page drafts after the user explicitly selects the final
     action.
6. Review progress, failures, edit links, preview links, and retry failed drafts.
7. Migrate cleaned blog posts through the separate dry-run-first Gutenberg draft
   endpoint after their media is mapped.

## Migration pipeline

The resumable `MigrationProject` state contains:

- raw, cleaned, and revisioned approved source pages;
- classified core pages, blog indexes, and blog posts;
- media inventory and source-to-destination media mappings;
- compiled template bundle and selected page roles;
- dependency decisions;
- non-secret wizard fields and the current step;
- prepared Gutenberg blog drafts;
- page deployment attempts, events, errors, and WordPress result links.

Source cleanup is deterministic. It removes crawl noise, reports duplicate
sections, and classifies posts using URL, metadata, listing, and published-date
signals rather than relying only on a `/blog/` path.

Crawl-backed migrations keep content inside the project from selection through
deployment. Export is an optional backup, and no content-file re-upload is
required. A compatibility import remains available for projects without stored
source pages.

Owned projects appear on the dashboard and resume in the build wizard. Template
bundles and dependency decisions save as they change. Revision and approval
checks run again on the server before preparation and deployment, so stale
content mappings cannot create drafts.

Media migration preserves original source URLs, removes known resize parameters,
requires reviewed alt text, generates readable filenames, and stores destination
IDs so retries do not duplicate uploads.

Template conversion uses an additive adapter registry. The current adapter maps
classic sections, columns, containers, headings, rich text, buttons, images, and
approved embed exceptions into Atomic structures. Unsupported regions remain
explicit review items.

## WordPress behavior

- Page and blog operations create drafts only.
- Existing exact-slug drafts are recovered on retry.
- A matching non-draft page or post is a conflict and is never overwritten.
- Real WordPress writes require an authenticated, explicit user action.
- Dry-run and preflight requests never call WordPress.
- Every real page deployment creates standard build-history and audit records.
- WordPress credentials and the bridge secret remain server-only.

Normal page drafts use the existing `/wp-json/energize/v1/page` bridge. The
bridge validates Atomic content, writes Elementor metadata, and returns admin
and preview links. The existing new-site workflow also verifies the Atomic
Foundation, applies brand variables and assets, updates site identity, and
flushes Elementor CSS.

Elementor Theme Builder templates are analyzed and represented in dependency
state, but automated display-condition deployment is intentionally blocked.
Elementor documents the condition extension and cache contracts but does not
provide a stable public REST contract for remotely creating and assigning these
templates. Add a destination-side bridge adapter and test it on staging before
enabling this target.

## Security requirements

- AES-256-GCM protects WordPress Application Passwords at rest.
- Clerk protects every private page and API route.
- Client and migration-project lookups are scoped to the authenticated user.
- JSON uploads are limited by file count, per-file bytes, batch bytes, nesting,
  node count, unsafe keys, and credential-like field names.
- Brand assets are checked after base64 decoding. File signatures must match
  filenames, and SVG active content and external references are rejected.
- Remote media fetches validate protocol, credentials, ports, DNS results,
  redirects, response size, MIME type, and file signature.
- Private, local, link-local, carrier-grade NAT, documentation, multicast, and
  reserved IP ranges are blocked.
- Deploy requests are rate-limited and audited.
- Secrets must never be printed, sent to the browser, committed, or placed in
  audit metadata.
- The resumable wizard snapshot excludes WordPress application passwords.

## Definition of done

- The wizard has no theme-selection step or theme choice in its user-facing
  build tables.
- Bulk JSON analysis, mapping, compilation, dependency review, and draft page
  deployment are connected end to end.
- Source cleanup, media migration, content conversion, and blog draft migration
  are deterministic, resumable, and covered by synthetic tests.
- Page deployment supports preflight, dry-run, progress history, partial
  failure, retry, exact-slug recovery, and result links.
- Responsive controls, keyboard interaction, reduced motion, live status, and
  progress semantics are present.
- Lint, type checks, focused tests, injection checks, bridge checks, and the
  production build pass locally.
- Database schema rollout, authenticated browser QA, staging WordPress writes,
  publishing, remote pushes, and production deployment remain explicit manual
  operations.

## Stack

- Next.js 15 App Router and TypeScript
- Tailwind v4 and base-ui based shadcn components
- Clerk authentication
- Prisma with Neon Postgres
- WordPress Application Passwords and the Energize WPCode bridge
- Elementor V4 Atomic Foundation

See [README.md](README.md), [docs/MIGRATION_PROJECTS.md](docs/MIGRATION_PROJECTS.md),
and [docs/MIGRATION_OPERATIONS.md](docs/MIGRATION_OPERATIONS.md) for setup,
state, testing, rollout, and recovery procedures.
