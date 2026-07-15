# Energize Website Builder

Internal web app for the Energize Group website team. It builds Elementor V4
pages from the shared Energize Atomic Foundation and pushes finished pages to
client WordPress sites as drafts through a custom WPCode bridge snippet.

See [BUILD_BRIEF.md](BUILD_BRIEF.md) for the full product brief.

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
npm run db:push              # create tables in Neon
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
src/lib/parser/           Markdown -> ParsedContent (per theme). PENDING, see below.
src/lib/wp/               Server-side WordPress client + brand-kit mapping
src/lib/deploy/           Deploy orchestration (yields progress events)
src/app/api/deploy/       Streaming NDJSON deploy route (auth, rate limit, audit)
src/app/api/parse/        Markdown parse route
src/components/build-wizard.tsx   Multi-step form + live deploy progress
theme-templates/{theme}/  Historical V3 references and preset page coverage
artifacts/                Generated Elementor Design System import ZIP
wordpress-plugin/         energize-build-tool.php (WPCode-compatible snippet)
```

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

## Adding an Atomic visual preset

Visual presets share the same variables, global classes, and components. Add a
new preset without forking the design system:

1. Add its metadata folder under `/theme-templates/{preset}/` for discovery and
   page coverage.
2. Add the preset key to `AtomicVisualPreset`.
3. Add only the visual composition differences to the Atomic page builder.
4. Reuse existing global class IDs and semantic variables.

The theme then appears automatically (themes are discovered from disk).

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
```
