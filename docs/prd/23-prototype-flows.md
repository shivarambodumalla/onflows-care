# Part 23 — Prototype Flows

Four journeys. These are the acceptance test for the prototype: each must be completable end to end, without touching devtools and without hitting a dead end.

Use the **Acting as** switcher in the top bar to change role.

---

## 1. Reception journey

*A walk-in arrives.*

1. Dashboard → **Walk-in** (or Appointments → Walk-in).
2. Search the patient by name or phone. Not found → **Register** inline, without losing the booking.
3. Enter name and phone — the only required fields — and register.
4. The new patient is selected automatically. Choose treatment, doctor and slot. Taken slots are struck through.
5. Save. The walk-in is created **already checked in**, because the patient is standing there.
6. They appear in **In the clinic now** on the dashboard and at the top of the doctor's queue.

**Proves:** minimal-click registration, no dead end on a missing patient, slot-clash prevention, walk-in handling.

---

## 2. Doctor journey

*Seeing today's patients.* — switch to **Doctor**.

1. Dashboard shows only that doctor's appointments.
2. Appointments → find the checked-in patient → **Start**.
3. **Record visit.** The drawer shows allergies as a red banner before any prescribing.
4. Enter observations, add prescription rows, set the next visit — pre-filled from the treatment type, editable.
5. Save. The appointment closes as completed, the visit record is written, and **a follow-up is created automatically**.
6. On the patient record, the prescription is visible **without opening anything** — summarised in the header strip and inline on the timeline entry.
7. **Print** produces a clean prescription sheet; printing is recorded on the timeline.
8. **Prescribe** adds medication to an existing visit without reopening the full visit form.

**Proves:** the follow-up engine firing from clinical work, patient-safety information placed before the risk, and the doctor's highest-frequency action reduced to one drawer.

---

## 3. Owner journey

*Reviewing the business.* — switch to **Owner**.

1. Dashboard KPIs across the branch.
2. Reports → **Conversions**: funnel, conversion by source, and **why enquiries are lost**.
3. Switch branch scope to **All branches** — available only to owner and admin.
4. Reports → **Doctors**: load, unique patients, no-show rate and revenue per clinician.
5. Reports → **Follow-ups**: whether the automation is being acted on, and how much it escalates.
6. Timeline → **Audit trail**: every sensitive change with actor and before/after values.

**Proves:** drill-down from headline numbers, cross-branch comparison, financial gating, and an audit trail with real content.

---

## 4. Lead conversion journey

*An enquiry becomes a patient.* — switch to **Receptionist**.

1. Dashboard → **New enquiry**. Name and phone only; a follow-up date defaults to a week out.
2. The enquiry appears in the pipeline at **Enquiry**, and a chase task is generated automatically.
3. Open it → **Log a call**, record what was said, move to **Interested**.
4. **Convert to patient** — creates the patient record carrying the source across, cancels the open chases, and navigates to the new record.
5. The new patient's timeline **begins with the original enquiry**, not at zero.
6. Reports → Conversions now counts them, attributed to their original source.

**Proves:** nothing enters the pipeline without a next action, conversion preserves history, and source attribution is real rather than guessed.

---

## Cross-cutting checks

- `⌘K` from any screen finds a patient by partial name, code or phone.
- `⌘Z` undoes the last write; destructive actions offer Undo in their toast.
- Switching to **Receptionist** hides clinical detail on a patient record and blocks Settings with an explanatory denial.
- Settings → Demo data → **Reset** rebuilds the dataset dated relative to today.
