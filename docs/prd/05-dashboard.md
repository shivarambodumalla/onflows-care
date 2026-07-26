# Part 5 — Dashboard

## Objective

Answer one question the moment the product opens: **what needs me today?**

The dashboard is not a summary of the business — that is Reports. It is a work surface, and everything on it should be either something to act on or the context needed to act.

## Layout

1. **Greeting** — time-aware, today's date, current branch.
2. **Quick actions** — New patient · New enquiry · Book appointment, permission-filtered.
3. **KPI row** — five tiles.
4. **In the clinic now** (2/3 width) + **Needs you** (1/3).
5. **Up next** (2/3) + **Enquiries to chase** (1/3).

Below `lg` the columns stack; the KPI row goes from five across to three, then two.

## Widgets

### KPI tiles

| Tile | Value | Secondary | Links to |
|---|---|---|---|
| Today's appointments | Count excluding cancelled | % change vs. same day last week | `/appointments` |
| In the clinic now | Checked in + in progress | *N* completed | `/appointments` |
| Overdue follow-ups | Branch-wide overdue tasks | *N* due today | `/tasks` |
| Open enquiries | Leads not converted or lost | — | `/leads` |
| New patients this week | Registered in last 7 days | No-show rate, 30-day | `/patients` |

Overdue follow-ups turns red at any non-zero value. Every tile is a link — a number you cannot drill into is trivia.

### In the clinic now
Patients checked in or in progress, ordered by arrival. Shows treatment, doctor, appointment time and how long they have been waiting — the last of these is what stops someone being forgotten in a waiting room.

Empty: *"Nobody is waiting."*

### Needs you
**Scoped to tasks assigned to the current user**, split into Overdue and Due today.

The scope is deliberate and explicit. An earlier version silently fell back to branch-wide tasks when you had none of your own, which produced the absurdity of a KPI reading "76 overdue" beside a panel reading "nothing overdue". Now the panel names its scope, and when you personally have nothing overdue it links to the branch's count rather than pretending the clinic is clear.

### Up next
Today's remaining scheduled appointments with an inline **Check in** action.

**Once today's schedule is exhausted, this widget switches to tomorrow** and relabels itself *"Up next — tomorrow"*. At 7pm the useful question is no longer "who else is coming today". The check-in action is withheld when showing tomorrow, because you cannot check someone in for a visit that has not happened.

### Enquiries to chase
Open leads with a next-follow-up date, soonest first, overdue ones badged in red.

## Business rules

- All widgets respect the **current branch**; doctors additionally see only their own appointments.
- The week-on-week delta compares today's count against the same weekday last week, not yesterday — clinic volume is weekly-periodic.
- No-show rate is computed over a rolling 30 days, not today, so a single missed appointment doesn't read as a 100% failure.
- The follow-up engine's catch-up pass runs before the dashboard renders, so counts are accurate even if the app has not been opened for weeks.

## States

**Loading** — the boot screen covers seeding and the engine pass; genuinely asynchronous work, not a decorative delay.
**Empty** — each widget has its own empty state; the page never appears broken.
**Offline** — a persistent banner; data still renders from the local store.
**Permission** — quick actions and KPI links filter by role. A doctor sees no "New enquiry" button.

## Acceptance criteria

1. Opening the dashboard at any hour of any day shows a plausible clinic: some appointments, some follow-ups, no empty screen.
2. The overdue-follow-ups KPI and the "Needs you" panel never contradict each other; the panel states whose tasks it is showing.
3. Checking a patient in from "Up next" moves them into "In the clinic now" without a reload.
4. When today has no remaining appointments, "Up next" shows tomorrow's and says so.
5. Every KPI tile navigates to a screen where that number can be broken down.
6. Switching branch or role updates every widget.
