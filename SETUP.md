# Setup

How to get the Energize Website Builder running locally and deployed to Vercel.
You never paste secrets into chat or commit them to git. They live in two places
you control: `.env.local` (local, gitignored) and the Vercel dashboard
(production).

There are 6 environment variables. The names are fixed; you supply the values.

## 1. Neon (database)

1. Create a project at [neon.tech](https://neon.tech) (any region near you).
2. Open **Connect** / **Connection Details** and copy two strings:
   - **`DATABASE_URL`** - the **pooled** string (host contains `-pooler`). Choose
     "Prisma" if a dropdown is offered.
   - **`DIRECT_URL`** - the **direct** (non-pooled) string. Used only for the
     schema push / migrations.

## 2. Clerk (login)

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com).
   You can disable public sign-up in Clerk settings since this is internal.
2. On **API Keys**, copy:
   - **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** (starts with `pk_`)
   - **`CLERK_SECRET_KEY`** (starts with `sk_`)

## 3. Generated secrets (no signup)

Run twice in a terminal:

```bash
openssl rand -hex 32
```

- First value -> **`ENCRYPTION_KEY`** (AES-256-GCM key for WP passwords at rest)
- Second value -> **`ENERGIZE_PLUGIN_SECRET`** (must match `ENERGIZE_BUILD_SECRET`
  in each client site's `wp-config.php`)

`.env.local` already ships with pre-generated values for these two, fine for
local dev. Generate fresh ones for production.

## 4. Local development

1. Open `.env.local` in the repo root. Replace the four `PASTE_HERE` values with
   your Neon and Clerk values. Save.
2. Create the database tables:
   ```bash
   npm run db:push
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and sign in.

`.env.local` is gitignored and stays on your machine. The Prisma commands
(`db:push`, `db:studio`) read it via dotenv automatically.

## 5. Production (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. In **Project -> Settings -> Environment Variables**, add all 6 variables
   (same names as `.env.local`), set to the **Production** environment (and
   Preview if you want preview deploys):
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `ENCRYPTION_KEY`
   - `ENERGIZE_PLUGIN_SECRET`
3. Deploy. Vercel runs `prisma generate` automatically (via `postinstall`).
4. After the first deploy, run the schema push against the production database
   once. Easiest path: temporarily point your local `.env.local`
   `DATABASE_URL`/`DIRECT_URL` at the production Neon branch and run
   `npm run db:push`, then switch back.
5. Point `build.energizegroup.com` at the Vercel project (Vercel -> Domains).

## 6. WordPress mu-plugin (for real deploys)

1. Copy `wordpress-plugin/energize-build-tool.php` to
   `/wp-content/mu-plugins/energize-build-tool.php` on the blank WP template.
2. In that site's `wp-config.php`, add:
   ```php
   define('ENERGIZE_BUILD_SECRET', 'the same value as ENERGIZE_PLUGIN_SECRET');
   ```
3. Make sure Elementor is active. The plugin exposes `/wp-json/energize/v1/`
   endpoints used by the deploy step.

## Quick reference: where each value goes

| Variable | `.env.local` (local) | Vercel (production) |
|---|---|---|
| `DATABASE_URL` | yes | yes |
| `DIRECT_URL` | yes | yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | yes |
| `CLERK_SECRET_KEY` | yes | yes |
| `ENCRYPTION_KEY` | yes | yes |
| `ENERGIZE_PLUGIN_SECRET` | yes | yes |
