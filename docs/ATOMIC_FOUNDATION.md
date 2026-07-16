# Energize Atomic Foundation

The Energize Atomic Foundation is the shared Elementor V4 design-system layer
for full websites and landing pages. It replaces Elementor V3 Site Settings,
Global Colors, Global Fonts, and per-widget styling with a controlled set of
variables, global classes, Atomic elements, and reusable components.

## Default-theme workflow

1. Install Elementor 4.1.1 or newer and Elementor Pro on the blank WP Engine
   default site.
2. Connect an active Elementor Pro license to the site's current domain.
   Elementor requires the Pro access tier to create and insert Components.
3. Enable the Atomic Editor, Global Classes, Variables, and Components features.
4. Download `artifacts/energize-build-tool-wpcode-snippet.txt` and paste its
   complete contents into a WPCode PHP snippet. Set it to Run Everywhere,
   replace `PASTE_YOUR_EXISTING_SECRET_HERE` in the live configuration line,
   save it, and activate it. The value must match `ENERGIZE_PLUGIN_SECRET` in
   the website builder.
5. In Elementor, open Website Templates, then Import / Export, then Import.
6. Import `artifacts/energize-atomic-foundation.zip`, choose the Design System
   options for variables and classes, and use **Override all** on the blank
   default site. This preserves the deterministic IDs used by generated pages.
7. Run one branding-only build against the default site. The builder validates
   the foundation, repairs any class that Elementor skipped during import,
   seeds the 12 Energize components, and applies the default brand values.
8. Import `artifacts/energize-atomic-style-guide.json` as an Elementor page
   template, create the `/style-guide` page, and set it to noindex.
9. Duplicate that site for each client. The cloned variables, class IDs, and
   component post IDs become the stable base for future builds.

The builder preflight checks both the WordPress Application Password and the
WPCode bridge secret. A connection is not reported as ready until both pass.

Do not import the foundation separately into every client clone. The normal
path is to import it once into the default site and then duplicate that site.

## Naming contract

Variables use semantic kebab-case names because Elementor variable labels do
not allow spaces in stored collections and the editor accepts letters, numbers,
hyphens, and underscores.

- Colors: `color-primary`, `color-primary-80`, `color-surface`
- Fonts: `font-heading`, `font-body`
- Spacing: `space-xs` through `space-3xl`
- Type: `text-xs` through `text-3xl`
- Radius: `radius-xs` through `radius-3xl`
- Borders: `border-s`, `border-m`, `border-l`
- Containers: `container-s`, `container-m`, `container-l`, `container-xl`
- Icons: `icon-xs` through `icon-xl`
- Semantic layout: `section-y`, `section-y-tablet`, `section-y-mobile`,
  `container-x`, `container-x-mobile`

Global classes are intentionally finite. They cover page structure, stacks,
clusters, grids, type roles, buttons, cards, media, badges, radii, shadows, and
a small set of responsive utilities. New classes should represent a repeated
design decision, not a single page adjustment.

The main width wrapper is labeled `site-container`. Elementor 4.1.4 reserves
the bare class label `container`, so the foundation does not use that name.

## T-shirt scale

The shared scale is `xs`, `s`, `m`, `l`, `xl`, `2xl`, and `3xl`. The same names
are used for spacing, typography, and radii so builders can make predictable
choices without memorizing one-off values.

## Components

The default library contains 12 compact dental patterns:

- Energize Button Primary
- Energize Section Heading
- Energize Service Card
- Energize Review Card
- Energize Team Card
- Energize Hero Standard
- Energize Feature Row
- Energize Before After
- Energize Logo Strip
- Energize CTA Inline
- Energize Stats Strip
- Energize CTA Band

Components contain Atomic elements only. Dynamic GHL forms, maps, reviews, and
shortcodes remain narrowly isolated legacy exceptions and are never saved
inside a component.

## Regeneration and verification

```bash
npm run verify:atomic
npm run verify:bridge
npm run build:atomic-foundation
```

The ZIP is a generated artifact. Edit the TypeScript foundation source, verify
it, and rebuild the ZIP instead of hand-editing files inside the archive.
The build also copies the same ZIP to `public/downloads/` so it is available
from the New Build screen in the deployed app.
