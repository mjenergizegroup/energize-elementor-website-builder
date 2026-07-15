# Energize Website Builder - Internal Web App

## What we're building

An internal web app for the Energize Group website team (3 users) to build dental practice WordPress sites without manually downloading/uploading Elementor JSON files. The tool injects approved content + brand kit into theme JSON templates and pushes finished pages to client WordPress sites as drafts via the WP REST API and a custom WPCode bridge snippet.

## Why

We have 50 legacy dental sites to migrate from Netlify/Sanity/Astro to WordPress/Elementor by September 1. Current workflow (Claude chat builds JSON → manual download → manual upload to WP → manual brand kit setup → manual cleanup) takes hours per site. This tool collapses that into one form submission and reduces post-deploy cleanup to 1-2 hours of refinement.

## Users

3 internal team members (Mark, David, Ariel). Shared login via 1Password. No public signup. No customer-facing features.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind + shadcn/ui
- Clerk for auth
- Neon (Postgres) via Prisma or Drizzle
- Hosted on Vercel
- Custom domain: build.energizegroup.com

## Core flow

1. User logs in via Clerk
2. Dashboard lists previously built clients + "New Build" button
3. User selects theme (3 themes supported in v1: Elevate, Summit, Lux -- Harbor, Radiance, Aurora, and Pediatrics Dental to be added in v2 once those skills are built)
4. User fills form across multiple steps:
   - **Practice info:** name, address, phone, email, hours, doctor names + bios, services list, social URLs
   - **Brand kit:** primary/secondary/accent/text/background colors (color pickers), heading font + body font (Google Fonts dropdowns), logo upload, favicon upload
   - **WP target:** site URL, username, application password (encrypted on save)
   - **Content:** upload approved markdown file(s) from the dental-content-writer skill
5. Backend orchestrates:
   - Injects content into theme JSON templates, regenerates element IDs
   - Pushes each page to WP as draft via REST API
   - Defaults each page to the `elementor_header_footer` template unless the page explicitly requests canvas
   - Updates the WP site name via core settings
   - Verifies the Energize Atomic Foundation, updates semantic V4 color and font variables, seeds components, and sets logo, favicon, and site identity
   - Flushes Elementor CSS cache
6. Success screen shows links to each draft page in WP admin + audit log entry

## Themes ready for v1

Three theme builder skills are production-ready and battle-tested:

- `elevate-theme-website-builder`
- `summit-theme-website-builder`
- `lux-theme-website-builder`

The following 4 themes are planned for v2 once their builder skills are completed:

- `harbor-theme-website-builder`
- `radiance-theme-website-builder`
- `aurora-theme-website-builder`
- `pediatrics-dental-theme-website-builder`

**Action for Claude Code:** read each v1 skill at `/reference-skills/{theme}-theme-website-builder/SKILL.md` and port the existing injection logic into TypeScript. Do not reinvent -- the slot mappings, element ID regeneration patterns, and brand token swaps are already solved. Mirror them.

Also reference the `dental-content-writer` skill to understand the exact markdown structure produced by content generation, since that is the input format the injector consumes.

## Architecture requirement: strategy pattern

Build the injection layer as a strategy pattern: one injector module per theme, all implementing the same interface, registered with a central dispatcher. This is critical. Adding v2 themes must be purely additive: drop the skill into `/reference-skills/`, drop templates into `/theme-templates/{theme}/`, write the injector module, register it. No refactoring of existing code.

## Theme template storage

Templates live in the repo at `/theme-templates/{theme}/`. Only Elevate, Summit, and Lux are populated in v1.

```
/theme-templates
  /elevate
    homepage.json
    about.json
    services.json
    first-visit.json
    amenities.json
    insurance.json
    contact.json
    thank-you.json
    _widget-library.json
    _meta.json
  /summit
    homepage.json
    about.json
    services.json
    membership.json
    payment.json
    contact.json
    _widget-library.json
    _meta.json
  /lux
    homepage.json
    about.json
    services.json
    membership.json
    payments.json
    contact.json
    _widget-library.json
    _meta.json
```

- `_meta.json` per theme: declares slot mappings (markdown section → JSON element ID path), theme version, default Elementor version
- `_widget-library.json` per theme: export of every available widget and section variant for that theme. Not used by the deterministic v1 injection pipeline, but committed now so v2 can use it as context for LLM-assisted custom section generation

## Critical technical requirements

**Element ID regeneration:** Every element ID in injected JSON must be regenerated (8-char hex) to avoid widget conflicts. Logic already exists in the theme skills -- port it directly.

**Elementor V4 meta keys to set on each page:**
- `_elementor_data` (JSON as string)
- `_elementor_edit_mode` = `builder`
- `_elementor_template_type` = `wp-page`
- `_elementor_version` (match the active target version, minimum `4.1.1`)
- `_wp_page_template` (defaults to `elementor_header_footer`; canvas only for explicit standalone pages)

**WP REST endpoint:** `POST /wp-json/wp/v2/pages` with `status: draft`. Auth via Application Passwords (Basic Auth: `username:app_password` base64-encoded). Elementor meta must be writable via REST -- the WPCode bridge snippet handles this reliably.

## Energize Website Builder WPCode bridge

A custom PHP snippet added through WPCode on the team's blank WP template install. Once the site is duplicated, every client site inherits the active snippet automatically.

**Snippet source:** `wordpress-plugin/energize-build-tool.php`

**Endpoints exposed (all under `/wp-json/energize/v1/`):**

| Endpoint | Purpose |
|---|---|
| `POST /health` | Confirm that WPCode is executing the bridge and the shared secret matches |
| `POST /page` | Create page with title, slug, template, and Elementor data in one call (writes `_elementor_data` and all related meta server-side, bypassing unreliable standard REST meta exposure for Elementor keys) |
| `POST /logo` | Accept logo file (base64), upload to media library, set `custom_logo` theme option |
| `POST /favicon` | Accept favicon file (base64), upload to media library, set `site_icon` option |
| `POST /flush-css` | Trigger Elementor CSS regeneration (equivalent to `wp elementor flush_css`) |

**Authentication:** every endpoint requires a shared secret header `X-Energize-Secret`. The secret is stored in the live configuration near the top of the WPCode snippet:

```php
define('ENERGIZE_BUILD_SECRET', '...');
```

For v1, use the same secret across all 50 migration sites. Store it once in Vercel env vars as `ENERGIZE_PLUGIN_SECRET`. If it ever leaks, rotate across all sites via SSH loop.

**Plugin security requirements:**
- POST only on all endpoints
- Reject requests without matching `X-Energize-Secret`
- Validate and sanitize all input
- Return JSON errors with appropriate HTTP status codes
- Log auth failures to a custom DB table for monitoring

**Where to place the plugin:** generate the PHP file at `/wordpress-plugin/energize-build-tool.php` in the repo. Mark will manually deploy it once to the blank WP template install. Future updates pushed via SSH loop across all sites.

## Data model

```
Client {
  id, name, slug, wpSiteUrl, wpUsername, wpAppPasswordEncrypted,
  theme, brandKit (json), createdAt, createdBy
}

Build {
  id, clientId, pagesDeployed (json), status,
  deployedAt, deployedBy, errorLog
}

AuditLog {
  id, userId, action, clientId, metadata (json), timestamp
}
```

## Security requirements

- All WP credentials encrypted at rest using AES-256-GCM with key from Vercel env var (`ENCRYPTION_KEY`)
- Mu-plugin shared secret stored in Vercel env var (`ENERGIZE_PLUGIN_SECRET`), never exposed to the browser
- All WP API and plugin calls happen server-side in Route Handlers or Server Actions only
- Clerk middleware protects every route except `/` and `/sign-in`
- Audit log every deploy: who, what client, what pages, when
- Validate uploaded files: markdown max 1MB, logos max 2MB (PNG/SVG/JPG), favicons max 500KB (PNG/ICO)
- Rate limit deploy endpoint: max 5 deploys per user per minute
- HTTPS only (Vercel default, do not disable)

## UI requirements

- Functional, not pretty. shadcn/ui defaults are fine.
- Multi-step form: Practice Info → Brand Kit → WP Target → Content → Review
- Color pickers with hex input fallback
- Logo and favicon upload with image preview
- Font dropdowns populated from a cached Google Fonts list (not a live API call)
- Deployment progress UI showing each step as it completes ("Validating Atomic Foundation... done. Creating homepage... done.")
- Dashboard shows recent builds with status badges and quick links to WP admin draft pages
- Saved client records are reusable so WP credentials do not need to be re-entered on rebuild

## Out of scope for v1

- Content generation (still happens in Claude chat using the dental-content-writer skill; user uploads the markdown output)
- LLM-powered custom section generation from the widget library (planned for v2)
- Image generation or AI photo processing
- Publishing pages (drafts only; team reviews and publishes manually)
- Bulk operations across multiple sites at once
- Email notifications
- Harbor, Radiance, Aurora, and Pediatrics Dental themes (v2)

## Definition of done for v1

- Logged-in team member can complete the form for any of the 3 v1 themes (Elevate, Summit, Lux), upload markdown, and click deploy
- All pages for the selected theme appear as drafts on the target WP site within 60 seconds
- Site name, Atomic brand variables, component library, logo, and favicon are set on the WP site
- Elementor CSS cache is flushed so pages render styled when opened in WP admin
- Element IDs are unique per page with no widget conflicts in the Elementor editor
- WP credentials and plugin secret are encrypted and never exposed to the browser
- Audit log captures every deploy with user, client, pages, and timestamp
- WPCode-compatible PHP bridge stored in `/wordpress-plugin/` for Mark to add to the blank WP template
- App is deployed at build.energizegroup.com with working Clerk auth

## Environment variables needed

```
DATABASE_URL=                          # Neon connection string
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ENCRYPTION_KEY=                        # 32-byte hex for AES-256 (run: openssl rand -hex 32)
ENERGIZE_PLUGIN_SECRET=                # shared secret matching ENERGIZE_BUILD_SECRET in wp-config.php on all client sites
```

## Style notes

- No em dashes anywhere in code comments, UI copy, or generated content (team-wide rule, no exceptions)
- Reference existing push-blogs.py script for the WP REST auth pattern (Application Passwords + Basic Auth)
- Reference all 3 v1 theme builder skills for injection logic -- do not reinvent
- Strategy pattern is required for the injection layer (see architecture requirement above)

## First session checklist

Before starting the Claude Code session, have ready:

1. Empty project folder created and opened in Claude Code
2. This file saved as `BUILD_BRIEF.md` at the project root
3. The 3 v1 theme builder skill folders copied into `/reference-skills/`:
   - `elevate-theme-website-builder/`
   - `summit-theme-website-builder/`
   - `lux-theme-website-builder/`
4. The `dental-content-writer` skill folder also copied into `/reference-skills/`
5. Neon database created, connection string ready
6. Clerk application created, publishable key and secret key ready
7. Encryption key generated: run `openssl rand -hex 32` in terminal
8. Plugin secret generated: run `openssl rand -hex 32` in terminal
9. Staging WordPress site available with an Application Password created for end-to-end testing
10. GitHub repo created (Vercel deploys from it)

## Opening message to Claude Code

> Read BUILD_BRIEF.md and all files in /reference-skills/. Ask any clarifying questions before scaffolding the project.
