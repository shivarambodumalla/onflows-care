# Part 9 — Follow-up Engine

The engine is the product's reason to exist. Everything else could be replaced by a good spreadsheet; this cannot.

## Objective

Guarantee that a patient who needs to come back is chased by a named person, without anyone having to remember.

## The chain

```
clinical event ──▶ rule ──▶ reminder ──▶ (falls due) ──▶ task in someone's inbox
                                                              │
                                                    (unactioned past window)
                                                              ▼
                                                          escalated
```

Each arrow is automatic. The only human step is *doing the task*.

## Reminder rules

A rule says: when **X** happens, someone should do something **N days** later, by these **channels**, and if it is still not done after **M days**, escalate it.

| Field | Meaning |
|---|---|
| Trigger | `after_treatment` · `before_appointment` · `no_visit_since` · `lead_follow_up` |
| Offset days | Days relative to the trigger; negative means before |
| Channels | in-app · email · SMS · WhatsApp (only in-app is live) |
| Assignee role | Which role picks the task up |
| Escalate after | Days overdue before flagging; 0 disables |
| Applies to | Specific treatment types, or empty for all |
| Active | Rules are disabled, not deleted — history stays interpretable |

Seeded rules: post-treatment check-in (3d), review consultation due (14d, consultations only), appointment reminder (−1d), lapsed patient win-back (90d), weekly lead follow-up (7d), annual health check (365d, inactive).

## Auto-generated tasks

A reminder that has fallen due **materialises into a task**. This is the pivotal design decision: a reminder sitting in a table is not a reminder, because nobody opens the table. A task lands in a named person's inbox and is counted on their dashboard.

The assignee is resolved from the rule's role, preferring someone at the reminder's branch.

## Escalations

An open task still unactioned `escalateAfterDays` past its due date is flagged and raised to high priority. It is **not reassigned**. Silent reassignment destroys accountability — the point is that the original owner and their manager both see it, not that the system quietly finds someone else.

Escalation also raises an in-app notification.

## Snooze

Snoozing sets a wake date on both the reminder and its task together — snoozing one while the other keeps nagging would make the feature useless. An optional reason is captured, because a pattern of *"patient travelling"* is different from a pattern of *"no answer"*.

Presets: 3 days · 1 week · 1 month. On the wake date the catch-up pass returns it to pending with its due date moved forward.

## The catch-up pass

`runFollowUpEngine()` runs on every load and after every relevant write. Three things happen in order:

1. **Wake** snoozed reminders and tasks whose snooze has expired.
2. **Materialise** pending reminders that have fallen due into tasks.
3. **Escalate** open tasks past their rule's window.

This is why a prototype opened after a two-week gap shows a realistic pile of overdue work rather than a frozen snapshot — and why the seeded dataset is itself produced by running the engine, so the demo state is always something the app could have produced on its own.

The function is **pure**: state in, state out, no I/O. It lifts to a server-side cron job unchanged.

## History

Completed and cancelled reminders are retained. The follow-ups report is built on this history — *"which rules generate the most work"* and *"what proportion actually gets actioned"* are the questions that tell you whether the automation is working or merely generating noise.

## Screen

`/follow-ups` has five tabs — Due now · Upcoming · Snoozed · History · Rules — over four KPIs (due now, escalated, upcoming, active rules).

Showing rules and their output on one screen is deliberate: it makes the automation legible. You can see the rule and the work it produced side by side, instead of wondering where a task came from.

## Business rules

- Closing a record (archiving a patient, losing or converting a lead) cancels its open reminders and tasks. A queue full of work about closed records trains people to ignore the queue.
- Completing a task closes its reminder, and vice versa. One action, not two.
- Disabling a rule stops new reminders but leaves existing ones alone.
- Rules with `escalateAfterDays: 0` never escalate.

## Permissions

Viewing and snoozing: all roles. **Managing rules: owner and admin only** — a rule change silently alters everyone's workload, so it belongs with configuration, not operations.

## Acceptance criteria

1. Recording a treatment with a next visit creates a reminder due on that date.
2. A reminder that falls due becomes a task assigned to a real person.
3. A task left past its rule's escalation window is flagged, raised to high priority, and notifies its assignee.
4. Escalation never changes the assignee.
5. Snoozing moves both the reminder and its task, and both wake together.
6. Archiving a patient cancels their open follow-ups.
7. Completing the task closes the reminder behind it.
8. Loading the app after a long gap produces accurate overdue counts.
