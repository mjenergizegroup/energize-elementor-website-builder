# Migration Operations

This runbook covers schema rollout, staging verification, authorized draft
creation, failure recovery, and the remaining destination-side limitation.

## Safety model

- Preflight and dry-run actions do not contact WordPress.
- Media and blog routes default to dry-run.
- The build wizard runs a migration dry run before the final draft action.
- Real WordPress writes require an authenticated user to select that action.
- Every created page and post uses `draft` status.
- The application never publishes, deletes, or rolls back WordPress content.
- A matching published, private, pending, or otherwise non-draft slug is a hard
  conflict.

## One-time rollout

1. Back up the target Neon database.
2. Review `prisma/schema.prisma` and confirm the intended environment.
3. Regenerate the Prisma client with `npm run db:generate`.
4. Apply the schema with `npm run db:push` only after database approval.
5. Confirm the `MigrationProject` table includes `blogDrafts` and `deployment`
   JSON fields.
6. Install the checked-in WordPress bridge from
   `artifacts/energize-build-tool-wpcode-snippet.txt` on the staging template.
7. Replace only the live secret placeholder, choose Run Everywhere, and verify
   `/wp-json/energize/v1/health` through the application connection check.

Never copy `.env.local`, a WordPress Application Password, the encryption key,
or the bridge secret into logs, tickets, screenshots, or test fixtures.

## Staging verification

Use a staging WordPress copy with Elementor 4.1.1 or newer and the required
Atomic Foundation. Do not use a client production site for initial validation.

1. Sign in through the configured Clerk flow.
2. Create a migration build and select the staging destination.
3. Upload a small representative batch containing:
   - one normal page;
   - one page with an image mapping;
   - one explicit accepted dependency;
   - one deliberate blocker for the failure check.
4. Confirm keyboard access to upload, selection, mapping, dependency, review,
   and retry controls at narrow and wide viewport sizes.
5. Confirm reduced-motion mode removes layout animation while preserving state.
6. Verify that the blocker prevents review and server preflight.
7. Resolve it, prepare the migration, and confirm the dry run creates no
   WordPress content.
8. With explicit staging authorization, create the page drafts.
9. Open every returned edit and preview link. Confirm Atomic editor loading,
   image URLs, titles, slugs, and draft status.
10. Simulate one recoverable failure, then use Retry failed drafts. Confirm the
    completed page is skipped and the failed exact-slug draft is reused.
11. Prepare one blog, run a one-post dry run, then create a staging draft only
    after its inline and featured images have media IDs.
12. Check build history and audit records without exposing credential values.

Authenticated browser automation cannot run without a permitted Clerk session.
If browser policy blocks the configured Clerk domain, do not disable auth,
change browser surfaces, or bypass the policy. Complete this checklist in an
approved browser session instead.

## Failure and recovery

| Failure | Expected state | Recovery |
|---|---|---|
| JSON invalid, too deep, unsafe, or credential-like | Analysis blocked | Correct the source and upload again |
| Dependency unresolved or blocked | Review and preflight blocked | Add a real mapping, accept an intentional exception, or remove the page |
| Media fetch rejected | Asset failed with no upload | Correct the public source URL, MIME type, or file and retry |
| WordPress connection rejected | Deployment failed before page writes | Repair the saved URL, user, Application Password, or bridge secret |
| Request interrupted after draft creation | Page remains failed or unknown locally | Retry, which recovers the exact-slug draft |
| One page fails | Deployment partial | Use Retry failed drafts |
| Published slug collision | Page fails without overwrite | Choose a new slug or resolve the existing WordPress content manually |
| Blog image lacks destination media ID | Blog dry run fails | Complete media migration and prepare blogs again |
| Theme Builder target selected | Preflight blocked | Use a tested destination-side adapter or complete this target manually |

Deployment events, attempt counts, errors, build IDs, edit links, and preview
links remain in project state. No automatic delete or destructive rollback is
provided. If a staging draft must be removed, a WordPress administrator should
review it and move it to trash manually.

## Theme Builder targets

Normal pages and blog posts are automated. Elementor single-post Theme Builder
templates and their display conditions are not sent as normal pages. Elementor
provides extension and cache contracts for conditions, but the current bridge
does not expose a stable, tested endpoint to create a template and assign those
conditions remotely.

Keep these targets blocked until a bridge adapter has all of the following:

- explicit Elementor Pro version and license checks;
- draft `elementor_library` creation with the correct document type;
- validated include and exclude display-condition input;
- condition-cache regeneration;
- exact-target idempotency and non-draft conflict protection;
- staging fixtures and rollback instructions.

## Release verification

Run from the repository root:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Also search changed code, UI copy, and documentation for prohibited en dash and
em dash characters. The production build may need network access for the
configured Google Font. None of these commands should contact WordPress.
