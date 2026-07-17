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

## Database rollout

The Prisma schema includes the `MigrationProject` model. Do not run
`npm run db:push` against Neon until the database change is explicitly approved
for that environment. Local Prisma client generation does not modify Neon.
