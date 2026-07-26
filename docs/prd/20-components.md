# Part 20 — Components

Every component below is exercised live at `/design-system`.

## Buttons

Variants: `primary` (one per view — the thing you most likely came to do) · `secondary` · `ghost` · `danger` · `link`.
Sizes: `sm` · `md` · `lg` · `icon`.

A `loading` button is disabled and shows a spinner, which is what prevents the double-submit that creates duplicate records.

`ButtonGroup` joins related controls into one segmented unit (previous / today / next).

## Tables

`DataTable` is the workhorse — patients, treatments, tasks, leads, users, sessions, settings all render through it.

- Click-to-sort, three-state (asc → desc → unsorted), with `aria-sort`
- Sticky headers
- Rows are focusable and activatable by `↵` or `Space` when clickable
- Row actions appear on hover **and on focus-within**, so keyboard users can reach them
- Built-in loading skeleton and empty state, so no caller re-implements them
- Columns can hide below `sm` rather than forcing horizontal scroll
- Sorting copies before ordering; the caller's array is never mutated

## Forms

`Field` owns label, hint, error and the `aria-describedby` wiring, and passes generated ids to its control via render prop. Every control in the product is wrapped in one, so accessibility associations are never hand-rolled per form.

Controls: `Input` · `Textarea` · `Select` · `Checkbox` · `Switch` · `SegmentedControl`.

Errors are text plus red, never red alone, and are announced with `role="alert"`.

## Cards

`Card` and `CardHeader` (title, description, action) — the standard container. `PageHeader` handles title, description and page actions.

`KpiTile` shows a label, a large tabular value, an optional delta with an explicit `goodWhen` direction (a rising no-show rate is not good news), and links wherever the number can be decomposed.

## Timeline

`Timeline`, `TimelineItem`, `TimelineDivider` — shared by the patient record, the universal timeline and the audit trail, so an event looks identical wherever it is read. Items carry a tone-coded icon, title, description, timestamp, optional body and metadata; the connector rail stops at the last item.

## Dialogs

`Dialog` and `ConfirmDialog`. Focus is trapped, `Escape` closes, focus returns to the trigger, the page behind is scroll-locked with scrollbar-width compensation so nothing jumps.

Reserved for confirmation and destruction.

## Drawers

`Drawer` — same behaviour, entering from the right at three widths. The default surface for creating and editing, because it keeps the working list visible behind.

## Feedback

`StateView` — the single implementation of all five screen states (Part 22).
`Toast` — via `useToast()`, with `undoable()` for reversible actions.
`Spinner`, `Skeleton`, `SkeletonRows` — the last shaped like a table so loading preserves the page's rhythm.

## Navigation

`Menu` — dropdown with arrow-key navigation, outside-click and `Escape` dismissal, destructive-item styling.
`Tabs` with counts · `Breadcrumbs` · `Badge` and `Count` · `Avatar` with deterministic per-name colour so the same person looks the same everywhere.

## Composition rules

1. Reach for an existing component before writing one. Every new component is a consistency risk.
2. Components take semantic tokens, never raw colours.
3. Components own their own accessibility; callers should not have to remember `aria-*`.
4. Layout is the caller's job; components do not impose outer margins.
