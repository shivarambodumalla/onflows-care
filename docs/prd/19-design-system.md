# Part 19 — Design System

Rendered live at `/design-system`. That page is the deliverable — every component in it is the one the product renders, so it cannot go stale the way a screenshot or a Figma file does.

## Colour

Two layers, and the separation is the point.

**Raw ramps** (`--color-brand-*`, `--color-ink-*`, status ramps) exist only to be referenced by the layer above. Components never touch them.

**Semantic roles** (`--surface`, `--text-muted`, `--brand`, `--danger-bg`) are what components use. Because every component references a role rather than a colour, re-theming is a single file, and dark mode is a second set of values rather than a second set of components.

| Role group | Members |
|---|---|
| Surfaces | `bg`, `bg-subtle`, `surface`, `surface-raised`, `surface-sunken`, `surface-hover`, `surface-active` |
| Borders | `border`, `border-strong`, `border-focus` |
| Text | `text`, `text-muted`, `text-subtle`, `text-inverted` |
| Brand | `brand`, `brand-hover`, `brand-fg`, `brand-bg`, `brand-text` |
| Status | `success`, `warning`, `danger`, `info`, `accent` — each with `-bg` and `-text` |

Colours are authored in **oklch** for perceptually even ramps: equal numeric steps look like equal visual steps, which hex ramps do not deliver.

The brand is a calm clinical teal. Saturated colour is reserved for status, so that when something is red it means something.

### Light and dark

Built from the start, not retrofitted. Dark is not an inversion — surfaces lighten with elevation while shadows deepen, matching how the eye reads depth on a dark background.

Theme is applied to `<html data-theme>` by an inline script before first paint, so there is no flash of the wrong theme.

### Status colour is never alone

Every status carries an icon or text label alongside its colour. Colour-only status fails for colour-blind users and in print.

## Typography

System font stack — it renders instantly, matches the OS, and this is a working tool rather than a brand statement.

| Level | Size / weight | Use |
|---|---|---|
| Page title | 24px / 600 | One per screen |
| Section | 20px / 600 | Major divisions |
| Card title | 16px / 600 | Card and drawer headers |
| Body | 14px / 400 | Default |
| Secondary | 12px | Supporting detail |
| Label | 11px uppercase, tracked | Field labels, section eyebrows |

**Tabular figures** (`.tnum`) on everything countable — times, IDs, money, KPIs — so columns of numbers align and changing values do not shift width.

## Spacing, radius, elevation

4px base scale. Radius climbs with surface size: 4px marks, 6–8px controls, 12px cards, 16px overlays. Four elevation levels; shadows convey depth only, never decoration.

## Motion

Fast: 120ms · Base: 180ms · Slow: 240ms, on a single `ease-out-soft` curve.

Nothing in a working tool should take longer than 240ms. Motion exists to explain where something came from — a drawer sliding from the right, a toast rising — not to entertain.

`prefers-reduced-motion` is honoured globally.

## Icons

Lucide, 16px in controls and 20px in empty states, `currentColor` throughout. Decorative icons carry `aria-hidden`; meaningful ones carry a label.

## Accessibility

Treated as an acceptance criterion, not a polish pass:

- One consistent focus ring, applied globally via `:focus-visible`
- AA contrast in both themes
- Every control labelled; every error associated via `aria-describedby`
- Dialogs and drawers trap focus and restore it to the trigger on close
- Full keyboard operation, including tables and the command palette
