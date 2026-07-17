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

The source ingest endpoint re-runs deterministic cleanup and classification on
every request. It stores raw and cleaned markdown, stable content checksums, and
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

## Dependency resolution

Compiled template artifacts produce a deterministic dependency ledger for
images, internal pages, blog references, and external URLs. Duplicate
dependencies share one stable ledger entry while retaining every source
reference.

Each entry must be marked `resolved`, explicitly `accepted`, or `blocked`.
Unresolved and blocked entries keep the migration review gate closed. Accepted
entries are intentional exceptions recorded in project state, not silently
ignored dependencies.

## Database rollout

The Prisma schema includes the `MigrationProject` model. Do not run
`npm run db:push` against Neon until the database change is explicitly approved
for that environment. Local Prisma client generation does not modify Neon.
