# Part 25 — Future Roadmap

Sequenced by the constraint that matters: each phase should be shippable on its own and should make the next one cheaper.

## Phase 1 — Make it real

Turn the prototype into a product for one clinic.

- **Backend and persistence.** Replace `localStorage` with a real API behind the existing repository seam. `types.ts` is already the contract.
- **Authentication and server-side authorisation.** The permission matrix mirrors to the server; the client copy becomes advisory only, as it always should have been.
- **The follow-up engine as a scheduled job.** Already pure — it lifts unchanged.
- **Real document storage.** The most conspicuous simulation in the prototype.
- **Durable audit log.** Append-only, separately stored, not rewritable by the application.

## Phase 2 — Reach the patient

Everything so far helps staff. This phase reaches the person the clinic is trying not to lose.

- **WhatsApp** — the channel most likely to actually be read in this market, and the reason the channel abstraction exists already. Appointment reminders first, then follow-up nudges.
- **SMS and email** as fallbacks.
- **Two-way confirmation** — a patient replying "yes" should update the appointment.
- **Delivery tracking** — sent, delivered, read, on the timeline.

Expected to move the no-show rate more than any interface change.

## Phase 3 — Mobile

- **Doctor app** — today's list, patient history, record a visit, prescribe. Mobile matters most where a desktop is least available: ward rounds, home visits, between rooms.
- **Reception tablet** for check-in.
- **Patient-facing booking**, once the messaging loop is trusted.

The design system's semantic tokens and component contracts carry across; the layout does not.

## Phase 4 — Payments

- Invoicing against recorded treatments — prices already exist in the catalogue.
- Payment capture and reconciliation, treatment packages and instalments, insurance claim tracking.

Deliberately late: billing is the most regulated and clinic-specific area, and getting the clinical record right first means invoices can be derived from it rather than maintained alongside it.

## Phase 5 — Analytics

- Cohort retention, forecasting, capacity planning, marketing attribution end to end.
- Charts, once the tables have settled which numbers matter.

## Phase 6 — AI

Sequenced last on purpose. AI applied to a thin or unreliable record produces confident nonsense; the value depends entirely on the quality of the timeline built in the earlier phases.

Highest-value applications, roughly in order:

- **Visit summarisation** — draft observations from dictation, doctor edits and signs. Saves the most time per day.
- **No-show prediction** — flag likely no-shows for confirmation calls, using real historical patterns.
- **Lapse risk** — identify patients drifting away *before* they are gone, which is the follow-up engine's next logical step.
- **Smart scheduling** — slot suggestions from actual attendance behaviour.
- **Natural-language search** — *"patients with back pain who haven't visited in 3 months"*.

Non-negotiable constraints: every AI output is a **draft a clinician approves**, never an automatic clinical action; nothing is sent to a model without an explicit data-handling decision; and any AI-touched record says so on the timeline.

## Recommendation

**Do Phase 1 and Phase 2 first, and resist everything else until they are solid.**

The product's entire claim is *never miss a patient*. Phase 1 makes the record trustworthy; Phase 2 closes the loop to the patient. Mobile, payments and AI are all more attractive to demo and none of them matter if the follow-up never reaches the person it is about.

The prototype in this repository exists to prove the flows are right before that work starts.
