# Part 12 — Search

## Objective

Reach any record by typing, from anywhere, in under ten seconds.

## Global search

One index spanning **patients, appointments, leads, tasks, documents and staff** — not a filter box per module. The distinction matters: per-module search requires the user to already know which module the thing is in, which is exactly the knowledge they lack when searching.

Rebuilt from state on demand. At clinic scale (~1,000 entries) a linear scan is instant; a search library would be complexity without benefit.

## Command palette

`⌘K` (or `/` outside a field) opens the palette from any screen, including inside an open form.

- Empty query → navigation targets, permission-filtered
- Typed query → records first, then matching navigation, then *"Search everywhere for …"*
- Arrow keys move, `↵` opens, `Esc` closes
- The highlighted row scrolls into view

Records outrank navigation once the user has typed, because a typed query is almost always about finding a record.

## Ranking

| Signal | Weight |
|---|---|
| Exact match on name / code / phone | 100 |
| Prefix match on those fields | 50 |
| Substring match on those fields | 25 |
| Match anywhere in the record | 10 |
| Patient record | +5 |

The identifying-field weighting is what makes typing a phone number land on the right patient rather than on an appointment that happens to mention them. The patient bonus breaks ties toward what staff look for most.

Multi-word queries require **every** term to appear somewhere, so adding words narrows rather than broadens.

## Results page

`/search?q=` — full results grouped by record type, with kind-filter chips carrying live counts (computed before filtering, so the chips stay informative), and saved searches.

## Filters

Toggleable chips: Patients · Appointments · Leads · Tasks · Documents · Users. Multi-select; chips with no matches dim rather than disappear, so their absence is informative.

## Saved searches

Persisted to `localStorage`, capped at 12, most recent first. Saves the query and any kind filters. Aimed at the queries a clinic runs weekly — *"insurance"*, *"package"*.

## What is indexed

| Record | Matched on |
|---|---|
| Patient | Name, code, phone, email, address, tags, conditions |
| Lead | Name, phone, email, stage, source |
| Appointment | Patient name and code, treatment, reason, status — last 60 days and future only |
| Task | Title, description — open tasks only |
| Document | Name, kind, patient name |
| User | Name, email, role, specialisation |

Old appointments and completed tasks are excluded: nobody searches for last year's slot, and including them would push live records down the list.

## Business rules

- Results are scoped to branches the user can see.
- Phone matching ignores whitespace, so `98765 43210` and `9876543210` both work.
- Search is case-insensitive throughout.
- The palette query is not persisted; the results-page query lives in the URL and is shareable.

## Acceptance criteria

1. `⌘K` opens search from any screen, including with a drawer open.
2. Typing three characters of a patient's name surfaces them within one keystroke.
3. Typing the last five digits of a phone number finds the patient.
4. A patient code returns that patient first.
5. Arrow keys and `↵` operate the palette without a mouse.
6. Results never include records from branches the user cannot see.
7. Kind chips show counts and narrow the results.
8. A saved search restores both its query and its filters.
