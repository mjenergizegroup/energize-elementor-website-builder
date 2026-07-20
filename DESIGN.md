# Energize Website Builder Design System

Version: 4.4.1
Register: product
Status: implemented

## Design direction

Energize Website Builder is calm, precise production software for team members
who spend long work sessions planning, importing, reviewing, and creating
WordPress drafts. The interface uses a light canvas, restrained blue accents,
borderless rounded controls, and clear sentence-case labels.

The visual reference is a modern operational dashboard viewed on a bright
desktop display. The interface should feel dependable and easy to scan without
becoming decorative or resembling a generic marketing dashboard.

The red Energize E tile remains as a small continuity marker. Blue owns primary
actions, current navigation, focus, progress, and selected states everywhere
else.

## Design principles

1. Show the next decision clearly and keep technical detail secondary.
2. Use whitespace, hierarchy, and subtle surface changes instead of decorative
   borders.
3. Keep one primary action visually dominant in each working area.
4. Use familiar product controls with complete hover, focus, disabled, loading,
   success, warning, and error states.
5. Use restrained motion only to communicate state changes.
6. Keep dense production data readable on desktop and structurally responsive.

## Color tokens

All runtime values are defined in `src/app/globals.css` and mirrored in
`tailwind.config.ts`. Components must reference token names instead of raw
color values.

| Role | Token | Value |
|---|---|---|
| Primary | `--color-primary` | `#3973D2` |
| Primary hover | `--color-primary-hover` | `#2E63BC` |
| Primary tint | `--color-primary-tint` | `#E9F0FB` |
| Success | `--color-success` | `#1FA47C` |
| Success tint | `--color-success-tint` | `#E7F7F1` |
| Success dot | `--color-success-dot` | `#34C79A` |
| Warning | `--color-warning` | `#B45309` |
| Warning tint | `--color-warning-tint` | `#FEF3E2` |
| Danger | `--color-danger` | `#C0392B` |
| Danger tint | `--color-danger-tint` | `#FCEBEB` |
| Page background | `--color-page-background` | `#F7F9FC` |
| Surface | `--color-surface` | `#F4F6F8` |
| Raised surface | `--color-surface-raised` | `#FFFFFF` |
| Default border | `--color-border-default` | `transparent` |
| Strong border | `--color-border-strong` | `transparent` |
| Primary text | `--color-text-primary` | `#1A1D21` |
| Secondary text | `--color-text-secondary` | `#667085` |
| Faint text | `--color-text-faint` | `#98A2B3` |
| Row hover | `--color-row-hover` | `#F2F5FA` |
| Brand tile | `--color-brand-red` | `#BF2E31` |

Color strategy is restrained. Primary blue is reserved for actions, current
selection, focus, and progress. Semantic colors communicate status and must be
paired with text or an icon so state never depends on color alone.

## Radius and elevation

| Role | Token | Value |
|---|---|---|
| Small | `--radius-sm` | `8px` |
| Medium | `--radius-md` | `10px` |
| Large | `--radius-lg` | `16px` |
| Pill | `--radius-pill` | `999px` |

Cards and large panels use the large radius. Inputs and buttons use the medium
radius. Compact chips use the small radius. Statuses, avatars, and step circles
use the pill radius.

| Role | Token | Use |
|---|---|---|
| Extra small | `--shadow-xs` | Inputs, buttons, compact controls |
| Small | `--shadow-sm` | Cards and panels |
| Medium | `--shadow-md` | Dialogs, menus, elevated hover states |

Shadows stay low-opacity and are never used as decoration. Surface fills and
spacing define groups. Keyboard focus uses a visible blue ring without changing
control size.

## Typography

Inter is the only application family.

| Style | Size | Weight | Use |
|---|---:|---:|---|
| Page title | 30px to 40px | 700 | Route and workflow titles |
| Stat value | 36px to 40px | 700 | Dashboard metrics |
| Section title | 16px to 18px | 600 | Panels, tables, dialogs |
| Body | 14px | 400 | Supporting copy and data |
| Body label | 14px | 500 | Fields and navigation |
| Eyebrow | 12px | 600 | Rare grouping label |

Sentence case is the default. Uppercase is limited to muted eyebrow labels at
0.04em tracking. Body copy should remain within 65 to 75 characters per line
when it is prose rather than data.

## Layout and spacing

- Application width is capped at 1440px.
- Desktop page padding is 24px horizontally with 20px to 32px vertical rhythm.
- Card padding is 20px to 24px.
- Section gaps are 20px to 24px.
- Table rows are at least 56px tall.
- Stat cards use four columns on large screens, two on tablets, and one on
  narrow screens.
- Wizard rails remain visible on desktop and collapse structurally with the
  existing responsive grid.
- Tables remove nonessential columns and stack values when space is limited.

## Components

### Navigation

Desktop navigation uses a persistent 232px white sidebar with icon and text
links. The active route uses a blue tint and primary blue text. The sidebar
becomes a compact two-row navigation bar on tablets and an icon-first bar on
phones. The E tile remains red and the account control stays at the bottom of
the desktop rail.

### Page headers

Page headers sit directly on the canvas without a container outline. The title
is bold but not heavy. Supporting text is muted. The primary route action is a
blue button with a small shadow.

### Cards and stats

Cards use a raised surface, large radius, and small shadow without an outline.
Stat labels are 14px and muted. Values are 38px and bold. Supporting lines are
neutral unless they communicate a real semantic state.

### Tables and section blocks

Section blocks use a white raised surface without an outer border. Headers are
inside the surface and never use a black bar. Table headers use the light gray
surface and sentence-case 12px labels. Rows use spacing, a restrained inset
separator, and the row-hover token.

### Status pills

- Success: success tint with success text
- Partial or warning: warning tint with warning text
- Failure: danger tint with danger text
- In progress: primary tint with primary text
- Neutral: light gray fill with secondary text

Pills use 12px semibold text and the pill radius.

### Buttons

Primary buttons use primary blue, white text, medium radius, and an extra-small
shadow. Secondary buttons use a raised white or light gray fill without a
border. Tertiary actions use primary-hover text without a filled background.
Icons use Lucide and remain 16px to 18px.

### Inputs

Inputs use the raised surface, medium radius, low elevation, and comfortable
44px height. Focus uses a soft blue ring. Placeholders use faint text. Invalid
fields use a danger ring without changing layout.

### Wizard

The wizard rail uses soft gray navigation rows. Step numbers are circular.
Active steps use a primary tint, blue number circle, and blue left accent.
Completed steps use a green check circle. Progress uses a rounded gray track
and blue fill. Selection cards use a blue tint and soft ring only when selected.

### Dialogs and menus

Dialogs use raised white surfaces, large radius, and medium shadow without an
outline. Headers remain light. Backdrops use a low-opacity dark neutral. Menus
and dropdowns use medium radius and medium shadow.

### Footer

The release label uses muted 11px text at the bottom of the desktop sidebar. It
has no outline or decorative separator.

## Motion

Transitions run 150ms to 250ms with ease-out curves. Motion communicates hover,
selection, progress, or loading state only. Reduced-motion preferences remove
nonessential animation. Layout properties are not animated.

## Accessibility

- Every interactive control has a visible keyboard focus state.
- Status never relies on color alone.
- Contrast must remain readable on the page, surface, and tint colors.
- Touch targets should reach 44px where practical.
- Dialog focus is trapped and returns to its trigger.
- Responsive order stays predictable for keyboard and screen-reader users.

## Anti-patterns

- No black header bars or hard two-pixel structural borders
- No all-caps labels except small muted eyebrows
- No square controls or square status badges
- No ornamental gradients, glass effects, or decorative motion
- No nested cards when spacing or a divider is sufficient
- No decorative colored outlines on controls, cards, panels, dialogs, or tables
- No source IDs, filenames, plugin ledgers, or other implementation detail in
  the daily builder workflow
- No em dash characters in UI copy, comments, or generated content
