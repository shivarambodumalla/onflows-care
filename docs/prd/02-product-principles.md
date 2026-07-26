# Part 2 — Product Principles

Five principles. Each one is a decision rule: when two designs are both reasonable, these break the tie. Each is also enforced somewhere in the code, not just asserted here.

---

## 1. Never miss a patient

If a patient needs to come back, the system — not a person — is responsible for making sure someone chases them.

**What it means in practice**
- Recording a treatment with a "next visit" always produces a follow-up. There is no way to complete a visit and leave the next step to memory.
- Follow-ups that fall due become **tasks in a named person's inbox**. A reminder sitting in a table nobody opens is not a reminder.
- Tasks that go unactioned past their rule's window are **escalated** — flagged and raised in priority — but never silently reassigned, because silent reassignment destroys accountability.
- Closing a record (archiving a patient, losing a lead) cancels its open follow-ups, so the queue never fills with work that no longer matters.

**Enforced by** `src/data/followUpEngine.ts` and the `recordTreatment` mutation.

---

## 2. Everything searchable

Any record a staff member can think of, they can reach by typing.

**What it means in practice**
- One index spans patients, appointments, leads, tasks, documents and staff — not a separate filter box per module.
- Search matches the three things a caller can actually give you: **name, patient code, phone number**. Partial matches count.
- `⌘K` opens search from anywhere, including inside a form.
- Ranking puts exact and prefix matches on identifying fields above incidental matches buried in an address.

**Enforced by** `src/data/search.ts` and the command palette.

---

## 3. Single patient timeline

There is exactly one place to find out what happened to a patient, and it is complete.

**What it means in practice**
- Every mutating operation emits a `TimelineEvent`. This is structural: features cannot forget to log themselves, because logging is not a separate step they could skip.
- The patient timeline, the clinic-wide activity feed and the audit trail are **three views over one event stream**. They cannot disagree with each other.
- Rescheduling creates a new appointment linked to the old one rather than editing history in place — the timeline shows that a change happened.

**Enforced by** the `emit()` helper that every mutation in `src/data/actions.ts` routes through.

---

## 4. Automation over memory

Anything a person would have to remember is a design defect.

**What it means in practice**
- Follow-ups are generated from clinical events, not entered by hand.
- Enquiries get a next-follow-up date by default at creation — nothing enters the pipeline without a next action.
- Form drafts autosave; an interrupted receptionist does not lose work.
- The follow-up engine runs a catch-up pass on every load, so a system left alone for two weeks comes back with an accurate picture rather than a frozen one.
- Where the clinic's default and a clinician's judgement conflict, **the human wins**: the treatment type suggests a follow-up interval, the doctor can override it.

**Enforced by** `runFollowUpEngine` on boot and after every relevant write, and `useAutosave`.

---

## 5. Minimal clicks

The front desk is measured in seconds, with a patient standing there.

**What it means in practice**
- **Drawers, not pages,** for creating and editing: the working list stays visible behind.
- **Dialogs are reserved for confirmation and destruction** — they interrupt, so they must be worth it.
- Only genuinely required fields are required. Registering a patient needs a name and a phone number; everything else can follow.
- Actions live where the record is: check in, start, record a visit, reschedule and cancel are all reachable from the appointment row.
- Destructive actions are **undoable via a toast** rather than guarded by a confirmation step that trains people to click through.

**Enforced by** the drawer-first pattern across modules and the undo stack in `src/data/store.tsx`.

---

## Applying the principles

When these conflict, the order above is the priority order. Concretely:

- *Never miss a patient* beats *minimal clicks* — this is why the next-visit field is prominent in treatment entry rather than tucked away.
- *Single patient timeline* beats *minimal clicks* — this is why cancellations ask for a reason: an unexplained cancellation is a hole in the record.
- *Minimal clicks* beats visual polish everywhere.
