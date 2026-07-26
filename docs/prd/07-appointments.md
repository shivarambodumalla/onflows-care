# Part 7 — Appointments

## Objective

Run the clinic day: see who is coming, move them through the visit, and handle the three things that always go wrong — people don't turn up, people cancel, people need a different time.

## Views

### Day (default)
A list, not a grid. Reception works from a list: time, patient, treatment, doctor, status, and the one action that moves this appointment forward.

Day is the default because it is the only view that answers "what happens next".

### Week
Seven day-columns showing up to four appointments each with an overflow count. Clicking a day drills to Day view. This is a planning view — enough to spot a thin Tuesday, not enough to work from.

### Month
A calendar grid with per-day counts and completed totals. Used for spotting patterns and finding a date, not for operating.

## The appointment lifecycle

```
scheduled ──check in──▶ checked_in ──start──▶ in_progress ──record visit──▶ completed
    │                        │
    ├──no show──▶ no_show    └──────────────┐
    ├──cancel──▶ cancelled                  │
    └──reschedule──▶ cancelled + new scheduled
```

Each transition is one click from the row. The available action changes with status, so the row always offers exactly the next step rather than a menu of everything.

| Status | Primary action | Tone |
|---|---|---|
| Scheduled | Check in | info |
| Checked in | Start | brand |
| In progress | Record visit | warning |
| Completed | View record | success |
| No show | — | danger |
| Cancelled | — | neutral |

## Walk-ins

A walk-in is registered through the same drawer with `kind: 'walk_in'`, and is **created already checked in** — the patient is physically present, so making reception check them in as a second step is a wasted click. Walk-ins carry a distinguishing badge; they are a meaningful proportion of clinic volume and reporting separates them.

## No show

One click from the row menu. Recorded on the patient's timeline and counted in the no-show rate. Undoable via toast, because it is easily mis-clicked on the wrong row.

## Cancelled

Requires a reason from a fixed list plus optional free text. The reason is what makes the cancellation report useful — *"doctor on leave"* and *"patient cancelled"* are entirely different problems.

The slot is freed immediately.

## Rescheduled

Rescheduling **creates a new appointment and cancels the original**, linking them in both directions (`rescheduledFromId` / `rescheduledToId`).

It would be simpler to mutate the existing record's time. That is rejected deliberately: it erases the fact that a change happened, and "why did this patient's appointment move three times?" is a question the timeline should be able to answer.

The drawer shows the current slot, then a slot grid for the new date with the doctor's existing bookings struck through.

## Completed

Completion happens by **recording a visit**, not by a status button. An appointment marked complete with no clinical record is a hole in the patient's history, so the two are one action (see Part 8).

## Booking

**Order: patient → treatment → doctor → date → slot.**

- Patient search matches name, code and phone; if there is no match, register inline without losing the booking in progress.
- Treatment choice determines duration, which determines slot length.
- The slot grid **strikes through times the chosen doctor is already booked**. Booking blind into a clash is the fastest way to lose the room's trust in the system.
- Booking on a day the branch is normally closed, or into a doctor's blocked time, produces a **warning rather than a block** — clinics make exceptions, and software that forbids them gets worked around.
- The drawer states the follow-up interval that will be scheduled, so the automation is visible before it fires.

## Filters

Doctor, status, and the date range implied by the view. Filters are additive and reflected in the header counts.

## Business rules

- Cancelled appointments remain visible, dimmed, so the day's history stays intact.
- Slot availability is computed per doctor, not per branch — two doctors can see patients at the same time.
- Appointment end time derives from the treatment type's duration.
- Deep link `?appointment=<id>` jumps to that appointment's day in Day view.
- Doctors see only their own appointments by default.

## States

**Empty** — distinguishes "nothing booked this day" from "nothing matches these filters".
**Permission** — a doctor sees no booking or cancellation actions.
**Offline** — banner; the list still renders.

## Acceptance criteria

1. From the day list, a scheduled patient can be checked in, started, and have a visit recorded without leaving the page.
2. The slot grid never offers a time the selected doctor is already booked for.
3. Booking into a closed day or blocked time warns but permits, and says why.
4. Cancelling requires a reason and frees the slot immediately.
5. Rescheduling leaves the original appointment visible as cancelled, linked to its replacement.
6. A walk-in is created already checked in and badged as a walk-in.
7. Every lifecycle transition appears on the patient's timeline.
