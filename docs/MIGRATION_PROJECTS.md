# Migration Projects

Migration projects are resumable, versioned records for the site-migration
pipeline. They retain source pages, cleaned core pages, blog posts, assets,
template selections, mappings, and dependency resolutions between requests.

## State model

- `status` tracks the overall lifecycle from draft through completion.
- `stage` identifies the current pipeline gate.
- `schemaVersion` protects future additive state migrations.
- JSON collections preserve review state without assuming one template format.
- `createdBy` scopes every project query to the authenticated team member.
- `clientId` is optional until a destination client is selected.

An existing-site crawl creates its owned migration project immediately. The
source ingest endpoint accepts the crawl job and selected URLs, retrieves the
selected pages server-side, and re-runs deterministic cleanup and classification
on every request. It stores raw and cleaned markdown, stable content checksums, and
the reason for each classification. Blog detection uses metadata and content
signals in addition to URL paths.

## API

- `GET /api/migrations` lists projects owned by the current user.
- `POST /api/migrations` creates a project.
- `GET /api/migrations/{projectId}` resumes a project.
- `POST /api/migrations/{projectId}/source` validates, cleans, classifies, and
  stores a source-page batch.

Source ingest accepts up to 1,000 pages, 2MB per page, and 20MB per request.
Every route requires Clerk authentication. Project creation and source ingest
write audit records.

## Media workflow

`POST /api/migrations/{projectId}/media` supports `inventory`, `review`, and
`migrate` actions. Migration defaults to a dry run. Execute mode requires a
saved destination client and keeps WordPress credentials server-only.

The inventory deduplicates source URLs, strips known Sanity resize parameters,
keeps stable source-to-page references, and generates readable filenames with a
short deterministic suffix. Remote downloads reject private networks,
credentials, unusual ports, unsafe redirects, unsupported MIME types, invalid
file signatures, and files over 15MB. Uploaded media records store their
destination IDs and URLs so retries skip completed work.

## Content conversion

Cleaned pages normalize into versioned heading, rich-text, image, and link
slots without depending on an Elementor sample shape. The additive conversion
registry currently includes `elementor-v3-to-atomic` version 1. It translates
classic sections, columns, containers, headings, text, buttons, and images into
V4 Atomic elements. Legacy embeds and unsupported widgets remain explicit
review items, so an incomplete conversion is never marked deployable.

Approved structured content is matched to selected templates by exact slug and
then page role. Heading, rich-text, image, and link slots replace compatible
Atomic placeholders in document order. Unused source placeholders are removed,
and approved content that exceeds the template slot count is appended in a
standard Atomic section. Existing Atomic layout classes and local styles remain
in place. Classic source layouts receive semantic Atomic Foundation classes
during conversion.

The wizard persists the normalized mapping, reconstructs reviewable source pages
for media inventory, dry-runs media, uploads only after the explicit final
action, and prepares the page artifacts again with destination media IDs and
reviewed alt text before the no-write page dry run.

## Dependency resolution

Compiled template artifacts produce a deterministic dependency ledger for
images, internal pages, blog references, and external URLs. Duplicate
dependencies share one stable ledger entry while retaining every source
reference.

Each entry must be marked `resolved`, explicitly `accepted`, or `blocked`.
Unresolved and blocked entries keep the migration review gate closed. Accepted
entries are intentional exceptions recorded in project state, not silently
ignored dependencies.

## Blog drafts

`POST /api/migrations/{projectId}/blogs` supports `prepare` and `migrate`
actions. Preparation parses front matter and source metadata, promotes short
standalone bold labels to headings, and produces Gutenberg heading, paragraph,
list, quote, code, and image blocks. Dates, titles, slugs, excerpts, inline
images, reviewed alt text, and featured-image relationships remain explicit in
the resumable project record.

Migration defaults to a dry run and a three-post batch, with a hard maximum of
20 posts per request. A post is blocked until all of its images have destination
media IDs. Execute mode only creates or updates WordPress drafts. Exact-slug
drafts are reused on retry, while a matching non-draft post is treated as a
conflict and is never overwritten.

## Draft page deployment

`POST /api/migrations/{projectId}/deploy` prepares, preflights, dry-runs, and
executes a saved compile bundle. The server regenerates the expected dependency
ledger from the bundle on every state change, so a caller cannot omit a blocker.
It also revalidates artifact size, depth, node count, Elementor IDs, unsafe
object keys, and credential-like fields before using compiled content.

The build wizard runs a dry run before its explicit create-drafts action.
Execute mode checks the saved WordPress connection, applies reviewed media and
global mappings, and sends only normal page targets to the existing server-side
WordPress bridge. Theme Builder targets remain a named preflight blocker until
a compatible bridge adapter is available.

Each page retains attempts, errors, draft IDs, edit links, and preview links.
Successful drafts are skipped on retry. If WordPress created a draft before a
network interruption, an exact-slug retry recovers that draft instead of making
a duplicate. Matching non-draft pages are never overwritten. Every real attempt
also creates a standard build-history record and audit entries.

## Database rollout

The Prisma schema includes the `MigrationProject` model and its blog-draft
state. Do not run
`npm run db:push` against Neon until the database change is explicitly approved
for that environment. Local Prisma client generation does not modify Neon.
