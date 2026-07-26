# Part 21 — Interaction Specs

## Hover

Hover is a *hint*, never the only route to a function — it does not exist on touch, and it is invisible to keyboard users.

- Rows: background shifts to `--surface-hover`
- **Row actions appear on hover *and* on `focus-within`** — the second half is what makes them reachable without a mouse
- Buttons transition background, colour and shadow over 120ms
- Truncated text carries a `title` with the full value

## Keyboard

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open search from anywhere |
| `/` | Open search (outside a text field) |
| `⌘Z` | Undo the last change (outside a text field) |
| `↑` `↓` | Move through palette results and menus |
| `↵` | Open the highlighted result; activate a focused row |
| `Space` | Activate a focused row |
| `Esc` | Close palette, drawer, dialog or menu |
| `⌘↵` | Save, in multi-line fields |
| `Tab` | Move forward; trapped inside overlays |

**Shortcuts never fire while typing.** `⌘Z` inside a textarea undoes text, not the last database write — hijacking it would be actively harmful.

Every overlay traps focus, closes on `Esc`, and **returns focus to the element that opened it**.

## Animations

| Motion | Duration | Use |
|---|---|---|
| Fade in | 180ms | Scrims, tooltips |
| Slide up | 180ms | Toasts, menus, dialogs |
| Slide in right | 240ms | Drawers |
| Colour transitions | 120ms | Hover and focus |
| Shimmer | 1.4s loop | Skeletons |

Nothing exceeds 240ms. Motion explains where a thing came from; it is not decoration. `prefers-reduced-motion` disables all of it globally.

## Undo

Every mutation snapshots the previous state onto a 25-deep stack. Undo restores it wholesale.

This is why destructive actions are **undoable rather than confirmed**. A confirmation dialog on a routine action trains people to click through dialogs, which is precisely what you do not want when the dialog finally matters. Toasts carrying an Undo action stay for 8 seconds instead of 4.

Dialogs are reserved for the genuinely unrecoverable: resetting demo data, and actions with side effects the user should read first (archiving a patient).

## Autosave

Multi-field drawers — registration, enquiry capture, treatment entry — autosave to `localStorage` 400ms after typing stops, and restore on reopen with a visible *"Restored an unsaved draft"* notice.

Reception gets interrupted constantly. A half-filled registration surviving that interruption is the difference between a system that is used and one that is worked around. Drafts clear on successful save.

## Optimistic updates

All writes are synchronous against local state, so the interface never waits. When a real backend arrives, `apply()` becomes an optimistic mutation with rollback — the seam already exists.

## Scroll and sticky

Table headers stick. The top bar sticks. Overlays scroll-lock the page behind them **with scrollbar-width compensation**, so opening a drawer does not shift the layout underneath.

Wide content scrolls inside its own container; the page body never scrolls horizontally.

## Focus

One focus ring everywhere: 2px `--border-focus`, 2px offset, applied globally through `:focus-visible` so it appears for keyboard users without cluttering mouse interaction.
