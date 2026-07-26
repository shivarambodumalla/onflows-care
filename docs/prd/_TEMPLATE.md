# Screen template

Every screen specification in `docs/prd/screens/` follows this structure. Copy this file when adding one.

The order matters: it walks from *why the screen exists* to *how you know it is finished*, so a reviewer can stop reading at any point and still have understood the most important thing so far.

---

## Objective

One or two sentences. What is this screen **for**, and what question does it answer for the person looking at it? If you cannot state the objective without listing features, the screen is doing too much.

## User story

`As a <role>, I want to <do something>, so that <outcome>.`

One primary story. Secondary stories go in a short list beneath it.

## Entry points

Every route into this screen — navigation, links from other screens, deep links, search results, notifications, keyboard shortcuts. If a screen has only one entry point, say so explicitly; it usually means something is buried.

## Layout

Structure top to bottom, then the responsive behaviour. Name the regions (header, filter bar, content, sidebar) so the rest of the document can refer to them. State what collapses or reflows below the `sm` breakpoint.

## Components

Which design-system components this screen uses, and any screen-specific composition. Reference existing components by name — a new component here should be justified, because every new one is a maintenance cost and a consistency risk.

## Actions

Each action the user can take: its label, what it does, where it appears, whether it is destructive, whether it is undoable, and which permission gates it.

## Business rules

The logic that is not obvious from the layout. Validation, defaults, derived values, side effects, ordering, what happens to related records. This is the section engineers will read most closely — be exhaustive and unambiguous rather than brief.

## Empty states

What the screen shows with no data, and — separately — with no data *matching the current filters*. These are different situations and deserve different copy. State the recovery action offered.

## Error states

What can fail, what the user sees, and how they recover. Include the offline case where relevant.

## Permissions

Which roles can reach this screen, and how it degrades for roles with partial access. Be explicit about whether restricted content is hidden, redacted, or replaced with an explanation.

## Interaction notes

Hover, focus, keyboard, autosave, animation, optimistic updates, scroll and sticky behaviour. Anything a developer would otherwise have to guess at.

## Acceptance criteria

A numbered checklist, each item independently verifiable by someone driving the built screen. Written so that "done" is a matter of observation, not opinion.

> Good: *"Typing the last five digits of a patient's phone number into the search field filters the list to that patient within one keystroke of the final digit."*
>
> Bad: *"Search works well."*
