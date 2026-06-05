# Energize Website Builder - Agent Handoff

Dense technical handoff for a continuing AI agent. Read `BUILD_BRIEF.md` (product
spec), `AGENTS.md` (house rules), `README.md`, and `SETUP.md` alongside this.

## 1. Purpose & Stack

Internal tool for the Energize Group web team (3 users) to migrate ~50 dental
sites to WordPress/Elementor by Sept 1. It injects approved markdown content +
a brand kit into theme Elementor JSON templates, regenerates element IDs, and
pushes finished pages to client WP sites **as drafts** via a custom mu-plugin,
then sets brand colors/fonts/logo/favicon and flushes Elementor CSS.

- **Next.js 15.5.19** (App Router) - **pinned**, not 16 (create-next-app gave 16;
  downgraded to match brief + avoid Next 16 breaking changes).
- **TypeScript**, **Tailwind v4**, **shadcn/ui** (base-ui based - see gotchas).
- **Clerk 7.4.3** auth.
- **Prisma 6.19.3** (pinned, not 7 - v7 moved datasource URLs out of schema and
  needs driver adapters) + **Neon** Postgres.
- **zod** validation. Deployed target: **Vercel**, domain `build.energizegroup.com`.
- Node 24, npm 11.

## 2. Status

### Fully working (verified)
- Build/lint/typecheck all green: `npm run build`, `npm run lint`, `npx tsc --noEmit`.
- **Injection engine** (`src/lib/injection/`): data-driven from `_meta.json`,
  8-char hex element ID regeneration, `findNode`, `toHtml`. Verified by
  `npm run verify:injection` (unique IDs, count preserved, placeholder names
  stripped, fixedValue typo-fix, MISSING flags for required-but-absent slots,
  optional slots skipped, pending themes refuse).
- **Elevate parser** (`src/lib/parser/elevate.ts`): deterministic, anchored to
  the real `dental-content-writer` markdown format. Verified by
  `npm run verify:parser` against `reference-skills/anchor-periodontics-elevate-content.md`:
  parses **9 pages (incl 3 service pages), 0 missing required slots**, builds
  HTML for body slots, plain text for headings, handles promo panels / service
  cards / sub-services / contact locations / `> [FLAG]` notes, reuses the
  homepage Personalized Care CTA on service pages.
- **Auth**: Clerk middleware protects all routes except `/`, `/sign-in`,
  `/sign-up`. `/sign-in` and `/sign-up` pages render. Protected routes 307 into
  the Clerk dev handshake (normal). ClerkProvider sets signIn/signUp URLs and
  post-auth redirect to `/dashboard`.
- **DB**: schema pushed to Neon (`npm run db:push` succeeded; tables exist).
- **Dashboard** (`/dashboard`): lists recent builds (status badges, page links)
  and saved clients (Rebuild link). Server component, `force-dynamic`.
- **Wizard** (`src/components/build-wizard.tsx`): 6 steps (Theme, Practice Info,
  Brand Kit, WP Target, Content, Review). Color pickers + hex, Google Fonts
  dropdown (static list), logo/favicon upload + preview + size/type validation,
  markdown upload that auto-parses and renders detected pages with editable
  title/slug, live NDJSON deploy progress, success screen with draft links and
  build notes.
- **Crypto** (AES-256-GCM), **DB-backed rate limit** (5 deploys/user/min),
  **audit logging**, **client save/rebuild** with encrypted WP app password.

### Partially built / pending
- **Summit & Lux themes**: templates copied to `theme-templates/{summit,lux}/`,
  but `_meta.json` are **stubs** (`status: "pending-port"`, empty `pages`), so
  their injectors refuse (`ready === false`) and parsers throw
  `ParserNotImplementedError`. Node maps exist in the skill SKILL.md files and in
  the cached content references (see Next Steps).
- **`theme-templates/elevate/thank-you.json`**: generated (the Elevate skill
  shipped no thank-you template), flagged `generated: true` in `_meta`. Layout
  unverified.
- **`_widget-library.json`** (all themes): committed stubs, not used by the v1
  deterministic pipeline (reserved for v2 LLM section generation).
- **Real WP deploy path**: code-complete but **never exercised end to end**
  against a live WP site + mu-plugin. `WpClient.checkConnection` (Basic Auth
  pre-flight) and the 6 mu-plugin endpoints are unverified against real WordPress.

### Broken / blocked / caveats
- **Deploy cannot complete without a staging WP site.** The deploy stream's
  first step is a live connection check; without a WP site that has the mu-plugin
  installed and `ENERGIZE_BUILD_SECRET` set, it fails there (expected, not a bug).
  A "failed" Build row + audit entry are still written.
- **Uncommitted local changes** (made while bringing the app up): `/sign-up`
  route, ClerkProvider sign-in/up URLs, `outputFileTracingRoot` in
  `next.config.ts`, `/sign-up(.*)` added to public routes in middleware. Not yet
  committed/pushed.
- **Secrets exposure**: dev Clerk secret + Neon password appeared in the chat
  transcript when `.env.local` was saved; rotate before production. `.env.local`
  is gitignored (never committed).

## 3. Architecture

### Repo layout (key files)
```
BUILD_BRIEF.md / AGENTS.md / README.md / SETUP.md / HANDOFF.md
prisma/schema.prisma                 Client, Build, AuditLog (theme/status are STRINGS, not enums, to stay additive)
next.config.ts                       outputFileTracingIncludes theme-templates/**, outputFileTracingRoot pinned
middleware.ts                        clerkMiddleware; public: /, /sign-in*, /sign-up*

theme-templates/{elevate,summit,lux}/
  *.json                             one Elementor export per page ({content[],page_settings,version,title,type})
  _meta.json                         slot map: pages[].slots[] = {key,section,label,nodeId,widget,field|fields,optional?,fixedValue?}
  _widget-library.json               stub

src/lib/
  env.ts          server-only validated env accessors
  crypto.ts       AES-256-GCM encrypt/decrypt ("v1:iv:tag:cipher" hex), key=ENCRYPTION_KEY (32 bytes hex)
  prisma.ts       PrismaClient singleton
  types.ts        client-safe types: BrandKit, BrandColors, BrandFonts, UploadedAsset, PracticeInfo, WpTarget, PageSelection
  audit.ts        audit(userId, action, clientId?, metadata?) -> AuditLog
  rate-limit.ts   checkDeployRateLimit (counts Build rows in last 60s)
  clients.ts      resolveClient(): load+decrypt existing OR upsert+encrypt new; brandKit stored as JSON
  google-fonts.ts static font list
  injection/
    types.ts      SlotValue (string | {title_text,description_text} | string[]), PageContent, ParsedContent, *Meta, InjectedPage, ThemeInjector
    elementor.ts  generateElementId() = randomBytes(4).hex (8 chars); findNode; regenerateElementIds (only nodes with elType); toHtml; countElements
    loader.ts     loadThemeMeta/loadTemplate (fs, cwd-relative, theme-key sanitized), discoverThemeKeys() (fs scan)
    base.ts       BaseThemeInjector: injectPage() -> load template, write each slot by nodeId/field, REGENERATE IDS AFTER injection, collect warnings/buildNotes
    registry.ts   getInjector(theme) cache; OVERRIDES map {elevate,summit,lux}; listThemes() from discoverThemeKeys()
    themes/elevate.ts|summit.ts|lux.ts   subclasses (currently thin; Summit hero mirror/accordions go here when ported)
  parser/
    index.ts      parseContent(ParseInput) dispatcher; ParserNotImplementedError (summit/lux still throw)
    markdown.ts   normalize, stripAnnotation, splitPages(# H1), splitSections(## H2), extractLabeledSlots(**Label:** value), extractFlags(> [FLAG:]), toParagraphHtml, toPlainText
    elevate.ts    parseElevate(): PAGE_SPECS per page (section->{labels|special}); special handlers parsePromotions/parseServiceCards/parseSubServices/parseLocations; editorSlots() from _meta drives HTML-vs-plain; front-matter (practiceName/doctor/city); multi service-page support; Personalized Care CTA reuse
  wp/
    client.ts     WpClient: postPlugin() with X-Energize-Secret; createPage/setBrandColors/setBrandFonts/setLogo/setFavicon/flushCss; checkConnection() (Basic Auth pre-flight to /wp-json/wp/v2/users/me); WpApiError
    brand.ts      toSystemColors/toCustomColors (primary/secondary/text/accent system; background custom); toSystemTypography (heading->primary+secondary, body->text+accent)
  deploy/
    types.ts      DeployRequest {theme,siteUrl,content,brandKit,elementorVersion?}; DeployEvent {type:step|done|fatal,step,status,label,message,data,buildNotes,warnings}; DeployedPageRecord
    orchestrate.ts runDeploy(): async generator. Iterates content.pages (NOT a separate selection) -> inject -> wp.createPage; then brand-colors, brand-fonts, logo?, favicon?, flush-css; yields events

src/app/
  layout.tsx                ClerkProvider (signInUrl /sign-in, signUpUrl /sign-up, fallbackRedirect /dashboard) + Toaster
  page.tsx                  public landing; server auth() -> link to /dashboard or /sign-in
  sign-in/[[...sign-in]]/page.tsx, sign-up/[[...sign-up]]/page.tsx   Clerk <SignIn>/<SignUp>
  dashboard/layout.tsx      header + <UserButton/>
  dashboard/page.tsx        recent builds + saved clients (force-dynamic)
  dashboard/new/page.tsx    loads listThemes() + optional ?clientId (prefills, NEVER sends app password); renders <BuildWizard/>
  api/parse/route.ts        POST {theme,markdown,pages?} -> parseContent -> {content} | 501 parser_pending
  api/deploy/route.ts       POST; auth -> zod validate -> rate limit -> resolveClient -> create Build(in_progress) -> audit start -> ReadableStream NDJSON of runDeploy events -> finalize Build(success|partial|failed) + audit finish. runtime nodejs, maxDuration 120

wordpress-plugin/energize-build-tool.php   mu-plugin (see below)
scripts/verify-injection.ts, verify-parser.ts   tsx smoke tests
```

### Data flow (the core pipeline)
```
markdown (.md from dental-content-writer)
  -> POST /api/parse -> parseContent({theme,markdown}) -> ParsedContent
       ParsedContent = { practiceName, city?, doctorName?, pages: PageContent[] }
       PageContent  = { page (template key), wpTitle, slug, slots: {slotKey: SlotValue}, buildNotes[] }
       (multiple pages can share page:"services"; each is its own entry)
  -> wizard shows detected pages (selectable, editable title/slug)
  -> POST /api/deploy { clientId?, client{...}, brandKit, content }
       runDeploy iterates content.pages:
         getInjector(theme).injectPage(page.page, page, ctx)
           -> loadTemplate -> for each _meta slot: findNode(nodeId) + write field(s)
              (editor field => toHtml; icon-box dual => {title_text,description_text}; icon-list => settings.icon_list[i].text)
           -> regenerateElementIds(content)   // AFTER injection; slots target ORIGINAL ids
           -> InjectedPage { title, slug, wpPageTemplate, elementorVersion, elementorData[], buildNotes[], warnings[] }
         WpClient.createPage -> mu-plugin /page (writes _elementor_data + meta server-side)
       then brand-colors, brand-fonts, logo, favicon, flush-css
  -> NDJSON stream of DeployEvent -> wizard renders live progress + draft links
```
ID-regeneration ordering is load-bearing: inject by original template IDs first,
regenerate all element IDs last. `regenerateElementIds` only rewrites `id` on
objects that have `elType` (leaves repeater `_id`/gallery ids alone).

### State management
- **Wizard** (`build-wizard.tsx`, client component, `useState` only): theme,
  practice fields, brand colors/fonts, logo/favicon (base64 + objectURL preview),
  WP target, `markdownName`, `parsing`, `practiceMeta`, `detectedPages`
  (`DetectedPage extends PageContent { selected }`), deploy `events`,
  `deployedLinks`, `buildNotes`, `warnings`, `finished`. Markdown is parsed on
  upload via `/api/parse`; deploy posts `content.pages` filtered to selected.
  NDJSON stream read via `res.body.getReader()`; `upsertEvent()` updates step rows
  by label.
- **Server**: stateless route handlers. Deploy persistence is in the
  `ReadableStream.start()` closure (create Build -> stream -> finalize). Theme
  injectors cached in a module-level `Map` in `registry.ts`. No global app state.
- **DB** is the source of truth for clients/builds/audit; brand kit (incl base64
  logo/favicon) stored as JSON on `Client` so rebuilds need no re-entry.

### Data model (`prisma/schema.prisma`)
```
Client  { id, name, slug @unique, wpSiteUrl, wpUsername, wpAppPasswordEncrypted,
          theme:String, brandKit:Json, createdAt, updatedAt, createdBy, builds[] }
Build   { id, clientId->Client, pagesDeployed:Json?, status:String(default pending|in_progress|success|partial|failed),
          deployedAt?, deployedBy, errorLog?, createdAt }
AuditLog{ id, userId, action, clientId?, metadata:Json?, timestamp }
```
`theme` and `status` are Strings (not enums) so adding a v2 theme needs no migration.

### mu-plugin (`wordpress-plugin/energize-build-tool.php`)
Must-use plugin at `/wp-content/mu-plugins/`. All endpoints POST-only under
`/wp-json/energize/v1/`, require header `X-Energize-Secret == ENERGIZE_BUILD_SECRET`
(wp-config.php constant; matches Vercel `ENERGIZE_PLUGIN_SECRET`). Auth failures
logged to `{prefix}energize_build_auth_log` (created via dbDelta on init).
- `POST /page` - create page; writes `_elementor_data` (wp_slash(json)),
  `_elementor_edit_mode=builder`, `_elementor_template_type=wp-page`,
  `_elementor_version`, `_wp_page_template`. Returns id/slug/edit_url/view_url.
- `POST /brand-colors` - merge system_colors+custom_colors into active kit
  `_elementor_page_settings`.
- `POST /brand-fonts` - merge system_typography (+custom) into active kit.
- `POST /logo` (base64 -> media -> set_theme_mod custom_logo),
  `POST /favicon` (base64 -> media -> update_option site_icon).
- `POST /flush-css` - `\Elementor\Plugin::$instance->files_manager->clear_cache()`.

## 4. Next Steps

### What we were doing right now (in-flight)
Bringing the app up locally and verifying the flow:
- DONE: `npm run db:push` (Neon tables created); dev server running on :3000.
- DONE this turn (UNCOMMITTED): added `/sign-up` route, ClerkProvider sign-in/up
  URLs + `/dashboard` fallback redirect, `/sign-up(.*)` public route in
  middleware, `outputFileTracingRoot` in `next.config.ts`.
- IMMEDIATE TODO:
  1. **Commit + push** the uncommitted changes to `main` as author
     `Mark <mark@energize-group.com>` (history was squashed to a single commit
     `cef23d7`; keep the `Co-Authored-By: Claude Opus 4.8` trailer; repo
     `mjenergizegroup/energize-elementor-website-builder`, private).
  2. User to sign up in-browser and walk the wizard with
     `reference-skills/anchor-periodontics-elevate-content.md`; confirm the
     detected-pages list (expect 9). Everything works up to the WP push.
  3. Stand up a **staging WP site** (mu-plugin installed, `ENERGIZE_BUILD_SECRET`
     set, app password created) to exercise the real deploy and verify Elementor
     renders styled. This is the first true end-to-end validation of `WpClient`
     + the mu-plugin endpoints; expect to iterate on Elementor meta/kit specifics.

### Build next (roadmap)
1. **Port Summit + Lux** (purely additive; do NOT refactor Elevate):
   - Fill `theme-templates/{summit,lux}/_meta.json` from the SKILL.md node maps in
     `reference-skills/_extracted/{summit,lux}-theme-website-builder/SKILL.md`,
     set `status: "ready"`.
   - Write `src/lib/parser/{summit,lux}.ts` anchored to
     `reference-skills/_extracted/dental-content-writer/references/{summit,lux}-theme.md`
     and wire into `parser/index.ts`. Get sample `.md` outputs to verify against.
   - Summit specifics: `{{accent}}` syntax (pass verbatim), `elementskit-heading`
     (`ekit_heading_title`), `jkit_button` (`button_text`), `image-box` cards,
     `icon-list` (5 items), nested-accordion FAQs (override `injectPage` in
     `themes/summit.ts`), and the homepage hero exists twice (desktop+mobile) -
     inject both.
   - Lux specifics: three heading widgets (`jkit_heading`->`sg_title_text`,
     `elementskit-heading`->`ekit_heading_title`, `gum_heading`->`main_heading`),
     eyebrow labels stored in `text-editor` as `<p>`, many text-editor nodes carry
     legacy Coraza/Oxygen HTML to fully replace.
2. Replace `theme-templates/elevate/thank-you.json` with a real export, or verify
   the generated one renders.
3. After live WP validation, tighten `WpClient`/mu-plugin error handling and the
   brand-kit -> Elementor global-kit mapping against real kit data.
4. Vercel deploy: connect repo, set the 6 env vars (see SETUP.md), point
   `build.energizegroup.com`, run schema push against prod Neon branch.

### Gotchas / conventions (do not relearn the hard way)
- **No em dashes** anywhere (code, comments, UI, generated content) - team rule.
- shadcn here is **base-ui** based: **no `asChild`**. For link-styled buttons use
  `buttonVariants({...})` on a `<Link>`.
- **Clerk 7.4.3 does NOT export `SignedIn`/`SignedOut`** from `@clerk/nextjs`; use
  server `auth()` (and `useUser`/`UserButton` on client). Control components are
  not available.
- **Prisma CLI reads `.env`, Next reads `.env.local`.** We consolidated on
  `.env.local`; `db:push`/`db:studio` are wrapped with
  `dotenv -e .env.local -- prisma ...`. `prisma generate` needs no DB env.
- Theme assets are read from disk at runtime (`loader.ts`) and included via
  `next.config.ts` `outputFileTracingIncludes`. Adding a theme = drop a folder +
  `_meta.json` (+ parser + optional subclass + one registry line). No edits to
  existing theme code.
- Verify after touching injection/templates: `npm run verify:injection`; after
  touching parser: `npm run verify:parser`.
- Env vars (6): `DATABASE_URL`, `DIRECT_URL`,
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ENCRYPTION_KEY`,
  `ENERGIZE_PLUGIN_SECRET`.
