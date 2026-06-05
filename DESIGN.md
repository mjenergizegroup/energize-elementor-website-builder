# DESIGN.md - Energize Website Builder

A design specification for the Energize Website Builder, an internal app for producing dental
practice websites. This document defines the product, the design system, the screens, and
the acceptance criteria. A coding agent should read this before writing or changing UI code,
and should match the design language exactly.

The reference implementation of the redesigned UI lives in `energize-build-tool.html`. When
this document and the HTML disagree, this document wins, but the HTML is the source of truth
for exact spacing, shadows, and markup structure.

---

## 1. Product overview

The Energize Website Builder turns approved dental practice content into live-ready WordPress sites.
A producer runs a single client through a six-step wizard, then the tool injects content into
theme-specific Elementor JSON and pushes to the client's WordPress (WP Engine) target.

There are two top-level surfaces:

1. **Dashboard** - recent builds and saved clients, plus a "New Build" entry point.
2. **New Build wizard** - a six-step linear flow that collects everything needed for one build.

The redesign goal is to make a tool that is run many times a day feel fast, legible, and
trustworthy, not like a default web form. The aesthetic is refined utility: a warm paper
canvas, an ink-and-teal palette, one confident sans-serif typeface, and a left-rail stepper
that shows progress.

### Primary user
An internal website producer at Energize Group. They are technical, repeat the flow constantly,
and care about speed, clarity, and not losing in-progress work.

---

## 2. Design language

### 2.1 Two separate palettes (do not confuse these)

There are two distinct color sets in this app.

**App chrome palette** is the fixed UI of the tool itself. It never changes per client.

**Client brand palette** is data the producer enters on the Brand Kit step. It is stored per
client and injected into the built site. It must never be hardcoded into the app chrome, and
the app chrome must never be driven by client values. The Brand Kit fields are inputs, not theme
variables for this app.

### 2.2 App chrome tokens

Use these as CSS custom properties on `:root`. Values are taken from the reference HTML.

```css
:root {
  /* text */
  --ink:        #15212b;  /* primary text, headings */
  --ink-soft:   #3c4a55;  /* secondary text, labels */
  --muted:      #74828c;  /* tertiary text, hints, captions */

  /* lines and surfaces */
  --line:        #e4e0d8; /* default borders */
  --line-strong: #d2cdc2; /* hover borders, dashed dropzones */
  --paper:       #f6f3ec; /* app background */
  --paper-2:     #fbf9f4; /* inset / muted panel background */
  --card:        #ffffff; /* cards, panels, inputs */

  /* brand accents (chrome) */
  --primary:      #1e6091; /* primary actions, active step */
  --primary-deep: #164a70; /* gradient end, hover */
  --secondary:    #168aad; /* focus rings, gradient partner */
  --accent:       #d9a566; /* highlights, client pill dot, CTA in previews */
  --accent-deep:  #b9863f;
  --good:         #2f7a55; /* completed steps, autosave tick, success */

  --radius: 16px;          /* cards and panels */
  /* inputs and buttons use 11px, swatches 12px, chips 9px */

  --shadow:    0 1px 2px rgba(21,33,43,.04), 0 12px 30px -18px rgba(21,33,43,.22);
  --shadow-lg: 0 2px 4px rgba(21,33,43,.05), 0 28px 60px -28px rgba(21,33,43,.3);
}
```

Background atmosphere: layer two soft radial gradients over `--paper` (teal at top right,
accent at bottom left, both very low opacity) plus a fixed grain overlay at about 3.5 percent
opacity. See the `body` and `.grain` rules in the reference HTML.

### 2.3 Typography

The entire app is sans-serif. Use one typeface family.

- **Display / UI font:** `Bricolage Grotesque` (Google Fonts), weights 400 to 800.
- **Mono font:** `IBM Plex Mono`, used only for hex codes and URLs.
- Do not introduce a serif. Do not use Inter, Roboto, Arial, or system-ui as the primary face.

Type scale (approximate, from the reference):

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Page title (h1) | 42px | 700 | letter-spacing -0.025em |
| Panel title (h2) | 24px | 700 | letter-spacing -0.02em |
| Section / group label | 11px | 600 | uppercase, letter-spacing 0.15em, muted |
| Body / inputs | 14px | 400 to 500 | |
| Field label | 12.5px | 600 | ink-soft |
| Caption / hint | 11.5px to 13px | 400 to 500 | muted |
| Mono (hex, url) | 11px to 13.5px | 500 | IBM Plex Mono |

### 2.4 Spacing and layout

- App max width: `1240px`, centered, with `34px` horizontal page padding.
- Wizard layout: two columns, `264px` fixed left rail and a fluid right panel, `28px` gap.
- Cards and panels use `--radius` (16px), `1px` `--line` border, and `--shadow` or `--shadow-lg`.
- Panels are structured as head, body, foot. Head and foot sit on `--paper-2`, body on `--card`.
- Below `980px` width, collapse to a single column and make the rail static (not sticky).

### 2.5 Motion

Keep motion subtle and purposeful. Transitions of about 0.18s ease on hover for steps, swatches,
buttons, and dropzones. Primary buttons lift 1px on hover. The only looping animation allowed is a
slow pulse on a live status dot if one is present. No scattered micro-animations.

---

## 3. Components

All components below exist in the reference HTML. Match markup and styling.

### 3.1 Top bar
Sticky, blurred translucent background over `--paper`, bottom `--line` border. Left: a 34px
gradient logo mark (primary to secondary) plus the product name "Energize Website Builder" and a small
uppercase tag. Right: ghost text links (Dashboard, Docs, Cancel) and a 36px circular avatar.

### 3.2 Page head
A large h1 plus a muted subline on the left. On the right, a **client pill**: a rounded `--card`
chip with an accent dot, showing the current client name and theme. The pill persists across all
wizard steps so the producer always knows which build they are in.

### 3.3 Stepper rail
A sticky `--card` card containing an uppercase "Build Steps" title and one row per step. Each row
has a 26px square number badge and a label with a small sub-line describing the step. States:

- **done:** badge is `--good` with a checkmark, connector line below is `--good` at 40 percent.
- **active:** row has a faint primary gradient background, badge is `--primary` with shadow,
  label is `--primary-deep`.
- **default:** muted badge on `--paper`, ink-soft label.

A 2px connector line runs between badges. The rail foot has a gradient progress bar
(primary to secondary) and a "X% complete" label with a time estimate.

### 3.4 Main panel
`--shadow-lg` card with three regions:

- **panel-head:** a 42px rounded icon tile (faint primary tint), the step title, and a one-line
  description.
- **panel-body:** the step's fields, grouped under uppercase section labels. A section label is
  text followed by a thin rule that fills the remaining width.
- **panel-foot:** Back button on the left (ghost style), an autosave indicator in the center
  ("Saved to [client name]" with a green tick), and the primary forward button on the right.

### 3.5 Form controls

- **Text input / textarea:** `--card`, `1px --line`, 11px radius, 14px text. Focus state:
  `--secondary` border plus a 3px `rgba(22,138,173,.15)` ring.
- **Select:** custom caret, same border and focus treatment.
- **Color swatch (Brand Kit):** a row with a 40px rounded color chip, a uppercase role label, and a
  monospace hex input. Hover lifts 1px and strengthens the border. Editing the hex updates the chip.
- **Dropzone (uploads):** dashed `--line-strong` border, `--paper-2` fill, centered upload icon,
  title, and a size hint. Hover turns the border `--secondary`.

### 3.6 Buttons

- **Primary:** gradient `--primary` to `--primary-deep`, white text, soft primary shadow, lifts on hover.
- **Ghost:** transparent with a `--line` border and muted text; darkens on hover.
- Both: 14px weight 600, 11px radius, about 12px by 22px padding.

---

## 4. Screens and steps

The wizard is strictly linear with six steps. Each step validates before advancing. In-progress
state autosaves to the client record (the dashboard shows a "partial" badge for incomplete builds).

### Step 1 - Theme
- **Field:** theme select. Options are the seven themes (Harbor, Radiance, Summit, Elevate, Aurora,
  Lux, Pediatrics Dental). Default shown in screenshots is `elevate`.
- Below the select, show the page list the theme produces, for example for Elevate:
  Homepage, About, Service Page, First Visit, Amenities, Insurance & Financing, Contact, Thank You.
- The page list must come from theme config, not be hardcoded inline.

### Step 2 - Practice Info
Fields, in order: Practice name; Slug (hint: "Used as the saved client identifier"); Address;
Phone and Email (two columns); Hours (textarea); Doctors (repeatable group of Name + Bio with an
"Add doctor" control). Doctors is an array; support adding and removing entries.

### Step 3 - Brand Kit (fully realized in the reference HTML)
- **Color Palette** group, swatches in a three-column grid: Primary `#1e6091`, Secondary `#168aad`,
  Accent `#d9a566`, Text `#1b2a33`, Background `#ffffff`. These default values are examples; they are
  editable per client and are stored as the client brand palette.
- **Typography** group: Heading font and Body font selects (two columns). Defaults Poppins and Inter.
- **Assets** group: Logo dropzone (PNG, JPG, SVG, max 2MB) and Favicon dropzone (PNG or ICO, max 500KB).
- There is no live site preview on this step. (It was removed by request.)

### Step 4 - WP Target
- Destination WordPress site for the build. At minimum a site URL field
  (for example `https://marltonmodernd.wpenginepowered.com`). Include whatever credentials or
  environment selector the existing backend requires; confirm against the repo before adding fields.

### Step 5 - Content
- Inject approved markdown content into the selected theme. Provide a way to paste or upload the
  per-page markdown that the build pipeline consumes.

### Step 6 - Review
- Read-only summary of all prior steps grouped by section, each with an edit link back to its step.
- Primary action builds the site. Show progress and a clear success or failure result.

### Dashboard
- Header with title "Dashboard" and a primary "New Build" button.
- **Recent builds** card: rows showing client name, a status badge (for example `partial`), theme,
  and a timestamp.
- **Saved clients** card: rows showing client name, a "theme · url" subline, and a "Rebuild" action
  that starts a new build prefilled from the saved client.

---

## 5. Decisions already made

These are locked. Do not relitigate them.

1. Sans-serif only, single family (Bricolage Grotesque). No serif anywhere.
2. Six-step linear wizard with a left vertical stepper rail, not top tabs.
3. App chrome palette and client brand palette are strictly separate.
4. No live site preview on the Brand Kit step.
5. Warm paper canvas with subtle radial gradients and a grain overlay, not flat white.
6. Client context (name + theme pill) is visible on every wizard step.
7. Autosave per client; incomplete builds are marked "partial" on the dashboard.
8. House style for any generated copy or labels: no em dashes anywhere, no "welcome" or
   "welcoming" language, benefit-driven and patient-first wording, no fabricated practice data.

---

## 6. Tech stack and integration notes

The current app runs at `localhost:3001` and appears to be a React single-page app. Confirm the
existing stack from the repo before scaffolding anything new. Recommended defaults if greenfield:

- React with a component-per-step structure for the wizard.
- CSS custom properties for the chrome tokens exactly as listed in section 2.2. A utility framework
  is fine, but the tokens above are the source of truth for color, radius, and shadow.
- Client and build state held in app state and persisted to whatever store the backend already uses;
  do not invent a new persistence layer without checking.
- Build, content injection, and WP push are backend concerns. This document covers the UI; wire the
  forms to the existing API endpoints rather than reimplementing the pipeline.

Do not add new dependencies, change the backend contract, or rename existing data fields without
confirming against the current codebase first. Extend the existing patterns.

---

## 7. Acceptance criteria

A change is done when all of the following hold.

- [ ] The chrome uses the exact tokens in section 2.2 via CSS variables.
- [ ] All text renders in Bricolage Grotesque; hex codes and URLs render in IBM Plex Mono. No serif.
- [ ] The wizard shows a left stepper rail with done / active / default states and a working
      progress bar that reflects the current step.
- [ ] All six steps exist with the fields listed in section 4, validate before advancing, and
      support going back without losing entered data.
- [ ] The client pill shows the current client name and theme on every wizard step.
- [ ] Brand Kit shows five editable color swatches in a three-column grid, heading and body font
      selects, and logo and favicon dropzones with the stated file constraints. No live preview.
- [ ] The Doctors field on Practice Info supports adding and removing multiple entries.
- [ ] The dashboard lists recent builds with a status badge and timestamp, and saved clients with a
      "theme · url" subline and a working Rebuild action.
- [ ] Layout collapses cleanly to a single column below 980px and the rail becomes static.
- [ ] No client brand value is hardcoded into the app chrome, and no chrome color is driven by a
      client brand value.
- [ ] Any user-facing copy follows the house style in section 5, item 8.
