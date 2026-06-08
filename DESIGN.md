---
version: alpha
name: Energize Website Builder
description: An internal dental agency production tool built on a brutalist grid
  system. Warm paper canvas floored at #F0EFEB, ruled everywhere by 2px solid
  #191919 borders and a single Energize Red accent. No border-radius on
  interactive elements, no drop shadows anywhere. Typography is Inter across all
  weights — the hierarchy lives entirely in size, weight, and uppercase tracking
  rather than color or decoration. The interface reads like precision engineering
  software: dense, fast, intentional.

colors:
  red:          "#bf2e31"
  red-dark:     "#9e2527"
  red-light:    "#f9ecec"
  black:        "#191919"
  canvas:       "#F0EFEB"
  surface:      "#FFFFFF"
  panel:        "#F7F6F2"
  muted:        "#5a5a5a"
  hairline:     "#D2CFC8"
  on-red:       "#FFFFFF"
  on-black:     "#FFFFFF"

typography:
  display:
    fontFamily: "'Inter', sans-serif"
    fontSize: 36px
    fontWeight: 900
    lineHeight: 1.0
    letterSpacing: -0.04em
  heading:
    fontFamily: "'Inter', sans-serif"
    fontSize: 32px
    fontWeight: 900
    lineHeight: 1.0
    letterSpacing: -0.04em
  subheading:
    fontFamily: "'Inter', sans-serif"
    fontSize: 20px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.025em
  body:
    fontFamily: "'Inter', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-strong:
    fontFamily: "'Inter', sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.01em
  label:
    fontFamily: "'Inter', sans-serif"
    fontSize: 10px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.12em
    textTransform: uppercase
  caption:
    fontFamily: "'Inter', sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  mono:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  none: 0px

spacing:
  xs:      4px
  sm:      8px
  md:      12px
  base:    16px
  lg:      24px
  xl:      32px
  2xl:     48px
  section: 80px

components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor:       "{colors.on-red}"
    borderColor:     "{colors.black}"
    borderWidth:     2px
    typography:      "{typography.label}"
    padding:         12px 24px
    rounded:         "{rounded.none}"
    hover:           "backgroundColor: {colors.red-dark}"

  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor:       "{colors.black}"
    borderColor:     "{colors.black}"
    borderWidth:     2px
    typography:      "{typography.label}"
    padding:         12px 20px
    rounded:         "{rounded.none}"
    hover:           "backgroundColor: {colors.panel}"

  badge-success:
    backgroundColor: "{colors.black}"
    textColor:       "{colors.on-black}"
    borderColor:     "{colors.black}"
    borderWidth:     2px
    typography:      "{typography.label}"
    padding:         3px 9px
    rounded:         "{rounded.none}"

  badge-partial:
    backgroundColor: "{colors.surface}"
    textColor:       "{colors.black}"
    borderColor:     "{colors.black}"
    borderWidth:     2px
    typography:      "{typography.label}"
    padding:         3px 9px
    rounded:         "{rounded.none}"

  badge-in-progress:
    backgroundColor: "{colors.red}"
    textColor:       "{colors.on-red}"
    borderColor:     "{colors.red}"
    borderWidth:     2px
    typography:      "{typography.label}"
    padding:         3px 9px
    rounded:         "{rounded.none}"

  nav-link:
    backgroundColor: "transparent"
    textColor:       "#777777"
    borderRight:     "1px solid #222222"
    typography:      "{typography.label}"
    padding:         0 20px
    height:          52px
    active-backgroundColor: "{colors.red}"
    active-textColor:       "{colors.on-red}"

  stat-cell:
    backgroundColor: "{colors.surface}"
    borderRight:     "2px solid {colors.black}"
    padding:         20px 22px
    labelTypography: "{typography.label}"
    valueTypography: "{typography.display}"
    deltaTypography: "{typography.caption}"
    deltaColor:      "{colors.red}"

  table-row:
    backgroundColor: "{colors.surface}"
    typography:      "{typography.body}"
    padding:         15px 20px
    borderBottom:    "1px solid {colors.hairline}"
    hover-backgroundColor: "{colors.panel}"

  step-tile:
    size:            26px
    borderWidth:     2px
    borderColor:     "{colors.black}"
    typography:      "{typography.label}"
    done-backgroundColor: "{colors.black}"
    done-textColor:       "{colors.on-black}"
    active-backgroundColor: "{colors.red}"
    active-textColor:       "{colors.on-red}"
    upcoming-backgroundColor: "{colors.surface}"
    upcoming-textColor:       "{colors.muted}"

  step-row:
    padding:         14px 16px
    borderBottom:    "1px solid {colors.black}"
    active-backgroundColor:  "{colors.red-light}"
    active-borderLeft:       "3px solid {colors.red}"
    done-backgroundColor:    "{colors.surface}"
    upcoming-opacity:        0.6

  page-chip:
    padding:         9px 16px
    borderWidth:     2px
    borderColor:     "{colors.black}"
    typography:      "{typography.label}"
    off-backgroundColor: "{colors.surface}"
    off-textColor:       "{colors.black}"
    on-backgroundColor:  "{colors.black}"
    on-textColor:        "{colors.on-black}"

  modal:
    backgroundColor:   "{colors.surface}"
    borderWidth:       2px
    borderColor:       "{colors.black}"
    rounded:           "{rounded.none}"
    header-backgroundColor: "{colors.black}"
    header-textColor:       "{colors.on-black}"
    overlay:           "rgba(25, 25, 25, 0.75)"
    maxWidth:          760px

  topnav:
    backgroundColor:   "{colors.black}"
    height:            52px
    borderBottom:      "2px solid {colors.black}"
    brand-mark-color:  "{colors.red}"
---

## Overview

Energize Website Builder is an internal production tool used by the Energize Group
web team to build, migrate, and deploy dental practice websites to WordPress on
WP Engine. The interface needs to feel fast and confident — this is a tool people
use daily, not a product they demo.

The aesthetic is **brutalist functional**: a warm paper canvas ({colors.canvas})
ruled by 2px {colors.black} borders everywhere, with {colors.red} (#bf2e31) as
the sole brand accent. There is no secondary brand color. Red carries every
primary CTA, active nav state, active step indicator, and the stat deltas. Used
at that frequency it stays energetic without becoming noise.

Inter is the only typeface. Hierarchy comes entirely from weight (400 to 900) and
size, with uppercase letter-tracked labels ({typography.label}) doing the
organizational work that color would do in a softer system.

Zero border-radius on interactive elements. Zero drop shadows anywhere. Depth
comes from layering {colors.canvas} under {colors.surface} white panels, divided
by {colors.black} 2px borders. The result is a grid-locked, highly legible
interface that looks nothing like a generic SaaS dashboard.

**Key Characteristics:**
- Single accent: {colors.red} carries all primary actions, active states, and brand moments.
- 2px solid {colors.black} borders on every interactive element and panel boundary.
- No border-radius on buttons, chips, badges, modals, or table containers.
- No drop shadows anywhere in the system.
- All category labels and button text in {typography.label} — 10px, 700 weight, 0.12em tracking, uppercase.
- Inter 900 weight for display headings at -0.04em tracking — tight, confident, loud.
- Warm canvas background ({colors.canvas}) with white ({colors.surface}) for cards and panels.
- Active wizard step uses {colors.red-light} background wash with a 3px red left border.
- Stat delta values always render in {colors.red} to signal direction and urgency.

---

## Colors

### Brand & Accent
- **Red** ({colors.red} — #bf2e31): The Energize brand color. Used on all
  primary buttons, the active nav link, active step tiles, badge-in-progress,
  the brand mark, and stat delta text. Never used for backgrounds except
  on CTA buttons and the active nav item.
- **Red Dark** ({colors.red-dark} — #9e2527): Button hover and pressed state only.
- **Red Light** ({colors.red-light} — #f9ecec): The active step row background
  wash in the wizard stepper. Subtle tint — communicates active without
  competing with the border accent.

### Surface
- **Canvas** ({colors.canvas} — #F0EFEB): The page floor. A warm off-white
  rather than pure white — lower glare, more character. All page backgrounds
  sit on this.
- **Surface** ({colors.surface} — #FFFFFF): White. Used for cards, table
  backgrounds, panels, and modal bodies. Floats one visible step above
  the canvas because of the 2px border.
- **Panel** ({colors.panel} — #F7F6F2): Slightly off-white. Used for table
  column headers, stepper footers, and any secondary surface that sits
  inside a white card.

### Text
- **Black** ({colors.black} — #191919): The primary text, border, and
  button-ghost color. Soft black rather than pure #000 — less harsh on
  the warm canvas.
- **Muted** ({colors.muted} — #5a5a5a): Secondary labels, timestamps, helper
  text, and placeholder values.

### Structure
- **Hairline** ({colors.hairline} — #D2CFC8): Row dividers inside tables and
  info panels. Lighter than the 2px structural borders — separates rows
  without competing with the outer panel border.

---

## Typography

Font family: Inter (Google Fonts). Full weight range 400–900 is used.
No fallback to system fonts in production — load Inter explicitly.

| Style          | Size  | Weight | Tracking   | Transform | Usage |
|----------------|-------|--------|------------|-----------|-------|
| display        | 36px  | 900    | -0.04em    | none      | Page headings, banner H1 |
| heading        | 32px  | 900    | -0.04em    | none      | Step panel H2 titles |
| subheading     | 20px  | 800    | -0.025em   | none      | Card H2, modal card titles |
| body-strong    | 13px  | 600    | -0.01em    | none      | Table names, client names |
| body           | 13px  | 400    | 0          | none      | Descriptions, helper text |
| label          | 10px  | 700    | 0.12em     | uppercase | Section headers, buttons, badges, field labels |
| caption        | 11px  | 500    | 0          | none      | Timestamps, sub-labels, stat deltas |
| mono           | 11px  | 400    | 0          | none      | Build IDs, technical values |

### Principles
Display and heading sizes lean on Inter Black (900) at aggressive negative
tracking (-0.04em). The tightness reads like compressed engineering notation —
intentional, not accidental. Body copy stays at regular 13px with zero
tracking for maximum readability at information density. Labels are
the organizational workhorse: 10px uppercase with wide positive tracking
creates clear visual separation between categories and content without
using color to do it.

---

## Layout

Container max-width: 1440px, centered with `margin: 0 auto`.
Page padding: 28px top, 32px horizontal on the `.app-wrap`.
The app shell itself is a single block element with `border: 2px solid {colors.black}`
that contains the topnav and all page content.

### Spacing scale
Uses the spacing tokens defined in YAML. The most common values in practice:
- `{spacing.base}` (16px): Default inner padding unit.
- `{spacing.lg}` (24px): Section gaps and card padding.
- `{spacing.xl}` (32px): Page body padding, wizard panel padding.
- `{spacing.2xl}` (48px): Banner and detail view top padding.

### Grid patterns
- **Stat grid**: 4 equal columns, each `border-right: 2px solid {colors.black}`.
- **Table**: Full-width with named column-template grids. Each table type
  (builds, clients, pages) has its own `grid-template-columns` defined.
- **Wizard**: 2-column — 230px fixed stepper sidebar + 1fr content panel,
  separated by `border-right: 2px solid {colors.black}`.
- **Build Detail**: 2-column — 1fr pages table + 280px fixed info sidebar.
- **Dashboard banner**: 2-column — 1fr copy + auto CTA button.

### Whitespace philosophy
Density over breathing room. Padding is consistent and tight. Borders do
the separating work — there is no need for large gaps when a 2px line
already creates a hard edge. Vertical rhythm comes from consistent row
heights (stat cells at ~70px, table rows at ~48px) rather than variable spacing.

---

## Elevation

There are no drop shadows in this design system. None. Ever.

Depth is created through two mechanisms only:
1. **Canvas vs Surface contrast** — {colors.canvas} (#F0EFEB) as the page
   floor, {colors.surface} (#FFFFFF) white for cards. The color step is
   small but the 2px border makes it unmistakable.
2. **Border weight** — 2px {colors.black} outer borders on panels, 1px
   {colors.hairline} inner row dividers. The weight difference signals
   structural hierarchy without shadows.

Modal overlays use `rgba(25, 25, 25, 0.75)` as the backdrop scrim. This is
the only transparency in the system.

---

## Components

**`button-primary`** — The main action button. Background {colors.red},
text {colors.on-red}, {typography.label} type, 12px × 24px padding,
border: 2px solid {colors.black}, zero radius. Hover shifts to {colors.red-dark}.
Used for: New Build, Continue in wizard, Rebuild, card Select actions.
Never use more than one primary button per visible panel.

**`button-ghost`** — Secondary action. Background {colors.surface}, text
{colors.black}, {typography.label}, 12px × 20px padding, border: 2px solid
{colors.black}. Hover background {colors.panel}. Used for: Back, Save progress,
Export, Cancel. Ghost buttons can stack edge-to-edge (margin-left: -2px) to
create a segmented button group with shared borders.

**`badge-success`** — Filled {colors.black} with {colors.on-black} text.
{typography.label}, 3px × 9px padding, 2px {colors.black} border. Communicates
a completed, successful build. Solid fill signals done.

**`badge-partial`** — Outlined. Background {colors.surface}, text and border
{colors.black}. Same padding and type as badge-success. Communicates an incomplete
or partially-failed build. Outline vs fill is the only difference — no color change.

**`badge-in-progress`** — Filled {colors.red}. Background {colors.red}, text
{colors.on-red}, border {colors.red}. Communicates an actively running build.

**`nav-link`** — Inside the topnav ({colors.black} bar, 52px tall). Text #777777
at rest, {typography.label}. `border-right: 1px solid #222222`. Active state:
background {colors.red}, text {colors.on-red}. No underlines, no hover background
other than a subtle #222 darkening.

**`stat-cell`** — Inside the 4-column stat grid. Background {colors.surface},
`border-right: 2px solid {colors.black}`. Label in {typography.label} and
{colors.muted}. Value in {typography.display} at {colors.black}. Delta line in
{typography.caption} at {colors.red} with an arrow prefix (↑ / ↓).

**`table-row`** — Grid-based row. Background {colors.surface}, padding 15px 20px,
`border-bottom: 1px solid {colors.hairline}`. {typography.body-strong} for the
primary name column. {typography.caption} for timestamps and secondary values.
Hover: background {colors.panel}. Action column text in {colors.red}, right-aligned,
{typography.label}, with ` →` appended.

**`step-tile`** — 26px × 26px square. Border: 2px solid {colors.black}.
Three states: upcoming (background {colors.surface}, text {colors.muted}),
done (background {colors.black}, text {colors.on-black}, showing ✓),
active (background {colors.red}, text {colors.on-red}). {typography.label} for
the number. Never rounded.

**`step-row`** — Full stepper row containing a step-tile and text. Padding 14px 16px,
`border-bottom: 1px solid {colors.black}`. Active state: `background: {colors.red-light}`,
`border-left: 3px solid {colors.red}`. Done and upcoming rows: white background,
full opacity for done, 0.6 opacity for upcoming. Title in {typography.body-strong},
sub-label in {typography.label} at {colors.muted}.

**`page-chip`** — Toggle chip for page selection. Padding 9px 16px,
`border: 2px solid {colors.black}`, {typography.label}. Chips stack edge-to-edge
using `margin: 0 -2px -2px 0` so their borders merge into a grid. Off state:
background {colors.surface}, text {colors.black}. On state: background {colors.black},
text {colors.on-black}.

**`modal`** — Centered overlay panel. Background {colors.surface},
`border: 2px solid {colors.black}`, no border-radius. Max-width 760px.
Backdrop: `rgba(25, 25, 25, 0.75)`. Header bar: background {colors.black}, text
{colors.on-black}, {typography.label}. Body padding 28px. Modal card grid is 3-up
inside a shared `border: 2px solid {colors.black}` wrapper, cards separated by
`border-right: 2px solid {colors.black}`.

**`topnav`** — Full-width bar, background {colors.black}, height 52px. Left: brand
mark (26px × 26px {colors.red} square with white E glyph) + product name in
{typography.body-strong} at {colors.on-black} + version in {typography.caption}
at #555. Center: nav-link list. Right: user chip (avatar + name).

---

## Responsive Behavior

| Breakpoint | Width      | Key changes |
|------------|------------|-------------|
| Desktop    | ≥ 1280px   | Full layout as designed. All columns visible. |
| Laptop     | 1024–1279px | Stat grid stays 4-up; table columns may truncate text. |
| Tablet     | 768–1023px | Wizard stepper collapses to top progress bar; tables drop secondary columns. |
| Mobile     | < 768px    | Not a target use case — this is a desktop production tool. |

This tool is used on desktop only. Mobile responsiveness is not a design priority.
The interface can scroll horizontally on small screens rather than reflow.

---

## Known Gaps

- Dark mode is not a documented variant. One canvas, one mode.
- Animation and transition timings are not specified. Hover transitions use
  `0.15s ease` by convention throughout.
- Error and empty states are not yet designed.
- The Landing Page build wizard steps are not yet designed — this is a planned
  addition with its own step sequence.
- Form validation states are not specified.
- The Clients page and Settings page layouts are not yet designed — they follow
  the same brutalist grid system but their specific column structures are TBD.
