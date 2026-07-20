# Agent notes

This is the Energize Website Builder (Next.js 15 App Router, TypeScript, Tailwind v4,
shadcn/ui, Clerk, Prisma + Neon). Read [HANDOFF.md](HANDOFF.md) completely, then
[README.md](README.md) and [BUILD_BRIEF.md](BUILD_BRIEF.md), before making changes.

House rules:

- No em dashes anywhere in code comments, UI copy, or generated content. Use
  regular hyphens or rewrite. This is a team-wide rule with no exceptions.
- The injection layer is a strategy pattern and adding a v2 theme must stay
  purely additive. Do not refactor existing theme code to add a new theme.
- WP credentials and the plugin secret are server-only. Never send them to the
  browser. All WP and plugin calls happen in route handlers or server modules
  marked `server-only`.
- shadcn components here are base-ui based (no `asChild`). For link-styled
  buttons use `buttonVariants()` on a `<Link>`.
- Verify the injection engine with `npm run verify:injection` after touching
  anything under `src/lib/injection/` or `theme-templates/`.
- Mark is new to Git and GitHub. Explain branches, commits, pull requests,
  merges, deployments, and their consequences in plain language when they are
  relevant. Before a GitHub state change, say whether it affects only a working
  branch, the official `main` branch, or a live deployment.
- Do not push, merge, deploy, publish, or modify an external WordPress site
  without Mark's explicit authorization. A push, pull request, merge, Vercel
  deployment, and WordPress draft creation are separate actions.
