# Energize Build Tool

Internal web app for the Energize Group website team. It injects approved
content and a brand kit into theme Elementor JSON templates and pushes finished
pages to client WordPress sites as drafts via a custom mu-plugin.

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
| `ENERGIZE_PLUGIN_SECRET` | Shared secret matching `ENERGIZE_BUILD_SECRET` in each client's `wp-config.php` |

## Architecture

```
src/lib/injection/        Strategy-pattern injection layer
  types.ts                Shared interfaces (ThemeInjector, slots, ParsedContent)
  elementor.ts            findNode, regenerateElementIds (8-char hex), toHtml
  loader.ts               Reads theme-templates/{theme}/ from disk (additive)
  base.ts                 Data-driven injector (writes slots from _meta.json)
  themes/{theme}.ts       Per-theme module (subclass; thin unless quirks)
  registry.ts             Central dispatcher (theme -> injector)
src/lib/parser/           Markdown -> ParsedContent (per theme). PENDING, see below.
src/lib/wp/               Server-side WordPress client + brand-kit mapping
src/lib/deploy/           Deploy orchestration (yields progress events)
src/app/api/deploy/       Streaming NDJSON deploy route (auth, rate limit, audit)
src/app/api/parse/        Markdown parse route
src/components/build-wizard.tsx   Multi-step form + live deploy progress
theme-templates/{theme}/  Elementor JSON templates + _meta.json + _widget-library.json
wordpress-plugin/         energize-build-tool.php (mu-plugin)
```

### Injection flow

1. Parser turns approved markdown into `ParsedContent` (slot key -> value).
2. The theme injector loads the page template, writes each slot into its
   `nodeId` per `_meta.json`, then regenerates every element ID (8-char hex).
3. The deploy layer pushes each page to WP via the mu-plugin `/page` endpoint,
   sets brand colors/fonts/logo/favicon, and flushes the Elementor CSS cache.

### Verify the injection engine

```bash
npm run verify:injection
```

## Adding a v2 theme (purely additive)

No existing code changes are required:

1. Drop the theme builder skill into `/reference-skills/`.
2. Drop templates into `/theme-templates/{theme}/` (one JSON per page).
3. Author `theme-templates/{theme}/_meta.json` (slot map: section -> nodeId +
   widget + field), set `status` to `ready`.
4. Add a parser at `src/lib/parser/{theme}.ts` and a case in `parser/index.ts`.
5. Add a subclass in `src/lib/injection/themes/{theme}.ts` (only if the theme has
   quirks) and one line in `src/lib/injection/registry.ts`.

The theme then appears automatically (themes are discovered from disk).

## The mu-plugin

`wordpress-plugin/energize-build-tool.php` is a must-use plugin. Install it once
on the blank WP template install at `/wp-content/mu-plugins/`; it is copied with
full site duplication on WP Engine. Define the secret in `wp-config.php`:

```php
define('ENERGIZE_BUILD_SECRET', 'your-shared-secret');
```

Endpoints (all POST, all require `X-Energize-Secret`): `/wp-json/energize/v1/`
`page`, `brand-colors`, `brand-fonts`, `logo`, `favicon`, `flush-css`. Auth
failures are logged to a custom table.

### Verify the Elevate parser

Parses the real sample (`reference-skills/anchor-periodontics-elevate-content.md`)
and injects every detected page:

```bash
npm run verify:parser
```

## Known gaps / caveats

- **Elevate parser is implemented and verified** against the real Anchor
  Periodontics sample (9 pages including 3 service pages, 0 missing slots).
  Summit and Lux parsers still throw `ParserNotImplementedError` pending their
  markdown samples and `_meta` ports.
- **Elevate is the only ready theme.** Summit and Lux have templates copied and
  `_meta.json` stubs marked `pending-port`; their injectors refuse until ported.
- **`theme-templates/elevate/thank-you.json`** was generated (the skill shipped
  no thank-you template). Review its layout, or replace with a real export.
- **`_widget-library.json`** files are committed stubs (no source export yet);
  they are not used by the v1 deterministic pipeline.
```
