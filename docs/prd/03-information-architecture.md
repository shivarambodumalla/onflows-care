# Part 3 — Information Architecture

## Navigation model

A persistent left sidebar grouped by *when you use it*, not by data model. A staff member should find things by asking "what am I doing right now?"

| Group | Items | Rationale |
|---|---|---|
| **Today** | Dashboard, Appointments, Tasks | Opened constantly; the working surface |
| **Clinic** | Patients, Treatments, Follow-ups, Calendar | Records and clinical work |
| **Growth** | Leads, Reports | Business, not operations |
| **Records** | Timeline, Users, Settings | Reference and administration |
| **Reference** | Design system, Product docs | Prototype-only; removed in production |

Navigation items are **filtered by permission**. A receptionist never sees Users or Settings — an empty section is worse than an absent one.

Live counts badge three items: today's appointments, overdue tasks (red), and open enquiries. Badges show pressure, so only things that can be *behind* get one.

Source of truth: `src/app/nav.ts`. The sidebar, the command palette's "go to" list and breadcrumb roots all read from that one declaration, so they cannot disagree.

## Top bar

Persistent, and carries the controls that make the prototype demonstrable:

- **Global search** — click or `⌘K`, the fastest route to any record.
- **Branch selector** — hidden when the user has only one branch.
- **Notification tray** — in-app only; other channels are labelled simulated.
- **Theme toggle** — light/dark.
- **Acting as \<role\>** — the demo role switcher. Prototype-only; in production this becomes the account menu.
- **Undo** — appears only when there is something to undo.

## Route map

```
/                        Dashboard
/patients                Patient list
/patients/:patientId     Patient record — timeline · treatments · appointments · documents · notes
/appointments            Day / week / month, walk-ins, lifecycle actions
/treatments              Cross-patient visit ledger
/follow-ups              Due · upcoming · snoozed · history · rules
/tasks                   Inbox — open · overdue · completed · all
/leads                   Pipeline board and list
/calendar                By doctor · reception · branch; leave and blocked time
/timeline                Universal activity feed and audit trail
/search                  Full results with filters and saved searches
/reports                 Patients · doctors · appointments · follow-ups · conversions
/users                   Users · roles & permissions · sessions
/settings                Clinic · treatments · branches · notifications · demo data
/design-system           Live component gallery
/docs, /docs/:slug       This PRD, rendered in-app
```

Routing uses **hash URLs** (`/#/patients/:id`). GitHub Pages has no SPA rewrite, so path-based routes would 404 on refresh and on any shared deep link.

## Page, drawer, dialog — when to use which

This is the most consequential IA decision in the product, so the rule is explicit.

| Surface | Use for | Never use for |
|---|---|---|
| **Page** | Browsing and analysis: lists, records, reports | Short create/edit forms |
| **Drawer** | Creating and editing: registration, booking, treatment entry, rules, users | Confirmation |
| **Dialog** | Confirmation, destruction, short decisions | Anything with more than ~3 fields |
| **Toast** | Confirming what just happened, offering undo | Anything the user must act on |

The reasoning: at a reception desk the list behind the form is context — who is waiting, what else is booked. A drawer keeps it; a modal page throws it away.

## Drawers in the product

Quick-create: patient, appointment, walk-in, enquiry, task, calendar block.
Edit: patient, reminder rule, treatment type, branch, user.
Clinical: record a visit (the widest drawer — it carries prescription rows).
Detail: lead record, log a call, mark lost.

## Dialogs in the product

Archive patient · cancel appointment · reset demo data · generic confirm.
Each states its **side effects** before asking. Archiving tells you it will cancel the upcoming appointment and N open follow-ups.

## Breadcrumbs

Shown only where there is real hierarchy — currently the patient record (`Patients › Amit Agarwal`). Top-level pages don't get a breadcrumb that says only their own name; that is noise.

## Deep links

These are shareable and land in the right context:

- `#/patients/:id` and `#/patients/:id?tab=treatments`
- `#/appointments?appointment=:id` — jumps the calendar to that day
- `#/leads?lead=:id` — opens the lead drawer
- `#/tasks?task=:id`, `#/users?user=:id`
- `#/search?q=...`

## URL as state

Filters that a user might want to share or return to live in the URL (patient search `?q=`, record tab `?tab=`). Ephemeral view state — row density, calendar lens — stays in component state, because a link that restores someone else's row density is not useful.
