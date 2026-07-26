# Part 15 — Tasks

## Objective

Give every piece of outstanding work an owner and a due date, in one inbox.

Tasks are where the follow-up engine's output becomes somebody's problem — in the useful sense.

## Inbox

Defaults to **open tasks assigned to you**. An inbox showing everyone's work is an inbox nobody owns; the *Everyone* toggle is one click away for managers covering a desk.

Four KPIs: open · overdue · escalated · auto-generated. The last one shows how much of the workload the engine is creating, which is the honest measure of whether the automation is helping or generating noise.

Tabs: Open · Overdue · Completed · All.

## Assignments

Auto-generated tasks are assigned by the rule's role, preferring someone at the relevant branch. Manual tasks are assigned at creation, defaulting to the creator.

Reassignment requires `tasks.assign` (manager and above) and is audited — quiet reassignment of accountability is exactly the kind of thing an audit trail exists for.

## Overdue

Any open task past its due date. Badged with the number of days late, sorted worst-first, counted on the dashboard and in the sidebar in red.

Escalated tasks (past their rule's escalation window) additionally carry an *Escalated* badge and high priority.

## Completed

Retained with completion time, who completed it, and an outcome note. Completing a task closes the reminder behind it.

Completion is undoable from the toast, which is why there is no confirmation step — confirmation dialogs on routine actions train people to click through them.

## History

Completed and cancelled tasks feed the follow-ups report: completion rates, who is clearing work, which rules generate the most.

## Task shape

Title · description · branch · assignee · related patient or lead · due date · status · priority · origin (`auto` / `manual`) · escalated flag · outcome.

Auto-generated tasks are marked with a sparkle icon so their provenance is visible — someone should never have to wonder where a task came from.

## Business rules

- Snoozing moves the task and its reminder together.
- Completing either the task or its reminder closes both.
- Closing a subject record (archived patient, lost lead) cancels its open tasks.
- Tasks are branch-scoped.
- Reopening a completed task clears its completion metadata.

## Acceptance criteria

1. The inbox defaults to your own open tasks and says so.
2. Auto-generated tasks are visually distinguishable from manual ones.
3. Overdue tasks show days late and sort worst-first.
4. Completing a task is undoable from the toast and closes its reminder.
5. Reassignment is restricted to managers and above, and is audited.
6. Snoozing moves both task and reminder.
7. Archiving a patient cancels their open tasks.
8. Switching to *Everyone* shows the branch's full workload.
