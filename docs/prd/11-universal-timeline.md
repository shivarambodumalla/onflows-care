# Part 11 — Universal Timeline

## Objective

One chronological record of everything that happens in the clinic, from which the patient timeline, the activity feed and the audit trail are all derived.

## The design decision

Every mutating operation in `src/data/actions.ts` routes through a single `emit()` helper that appends a `TimelineEvent`. This is structural rather than conventional: a feature cannot forget to log itself, because logging is not a separate step it could skip.

The consequence is that three quite different products — a patient history, an operations feed and a compliance audit trail — are three filters over one array, and **cannot disagree with each other**. The alternative (per-feature logging) guarantees that they eventually will.

## Event shape

| Field | Purpose |
|---|---|
| `at`, `actorId`, `branchId` | When, who, where |
| `entity`, `entityId` | What kind of record, and which one |
| `action` | Past-tense verb: `created`, `checked_in`, `cancelled`, `converted` |
| `summary` | Human sentence shown in the feed |
| `patientId` / `leadId` | Attaches the event to a subject's timeline |
| `changes[]` | Field-level before/after, for audited events |
| `audit` | Whether this belongs in the compliance subset |

## All activities

`/timeline` is the clinic-wide feed: newest first, grouped by day, with search and filters for record type and person. Entries link to their subject.

Icons and tones come from one mapping (`eventPresentation.tsx`) shared with the patient timeline, so the same event never looks like two different things depending on where it is read.

## Audit trail

The same screen switched to audit mode, filtered to `audit: true` — the security- and compliance-sensitive subset:

- Patient detail edits, archive and restore
- Treatment amendments
- User creation, edits, activation, deactivation, session termination
- Role and permission changes
- Settings, treatment catalogue, branch and reminder-rule changes
- Note and document deletion
- Task reassignment

Routine operational events — bookings, check-ins, visits — are recorded on the timeline but not marked audited. Marking everything as audit-relevant produces a log nobody can read, which is functionally the same as no log.

Audited entries render their field-level changes inline: `phone: +91 98765 43210 → +91 98765 11111`.

## Chronological view

Reverse-chronological, day-grouped (*Today*, then dates). Paginated by a *Load older activity* control showing how many remain — infinite scroll makes it impossible to tell how much history exists.

## Business rules

- Events are append-only. Nothing in the product updates or deletes one.
- Timeline is branch-scoped like everything else.
- Audit mode requires `audit.view` (owner and admin); the toggle is hidden otherwise.
- Events survive the deletion of what they describe — a deleted note leaves its deletion event.

## Production note

In this prototype the event stream lives in the same `localStorage` object as everything else, so it is only as immutable as the browser. In production the audit stream must be **append-only and separately durable**, ideally write-once storage the application cannot rewrite. The screen says so.

## Acceptance criteria

1. Every mutation produces exactly one timeline entry naming the actor.
2. A patient's timeline contains every event touching that patient, with nothing missing.
3. Audit mode shows only audited events, with before/after values for changed fields.
4. Audit mode is unreachable for managers, doctors and receptionists.
5. Filtering by record type and person narrows both modes.
6. Clicking an entry opens the record it describes.
7. Events remain after their subject record is deleted.
