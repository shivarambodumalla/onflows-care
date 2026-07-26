# Part 24 — Conceptual Data Model

Defined in `src/data/types.ts`. These types are the contract the whole prototype codes against, and become the API contract when the backend arrives.

Dates are **ISO 8601 strings, never `Date` objects**, so everything survives a `localStorage` round-trip and later a JSON API without a serialisation layer.

## Entities

### Patient
`id · code · name · phone · email · dob · gender · address · branchId · primaryDoctorId · status · tags · allergies · conditions · emergencyContact · source · convertedFromLeadId · referredBy · timestamps · archive metadata`

`code` is the human-facing number (`OC-1042`). `convertedFromLeadId` preserves origin, which is what makes source attribution real.

### Appointment
`id · patientId · doctorId · branchId · treatmentTypeId · startAt · endAt · status · kind · reason · lifecycle timestamps · cancelReason · rescheduledFromId · rescheduledToId · treatmentId`

Bidirectional reschedule links mean the timeline shows that a change happened rather than quietly rewriting the original.

### Treatment
`id · patientId · appointmentId · doctorId · branchId · treatmentTypeId · performedAt · observations · adjustment · doctorNotes · prescription[] · nextVisitInDays · nextVisitAppointmentId · attachmentIds`

`nextVisitInDays` is the trigger the follow-up engine reads. `adjustment` is first-class rather than a note, because deviation from plan is exactly what the next clinician needs.

### TreatmentType
`id · name · category · durationMinutes · price · defaultFollowUpDays · requiresDoctor · colour · active`

The configuration row that makes the product domain-neutral.

### Reminder & ReminderRule
Rule: `trigger · offsetDays · channels · assigneeRole · escalateAfterDays · treatmentTypeIds · active`
Reminder: `ruleId · patientId|leadId · dueAt · status · channels · sourceType · sourceId · snoozedUntil · taskId · escalated`

A reminder records *what should happen*; the task records *who is doing it*.

### Task
`title · description · branchId · assigneeId · patientId|leadId · dueAt · status · priority · origin · reminderId · escalated · completion metadata · outcome`

`origin` distinguishes engine-generated work from human-created work — essential for judging whether the automation helps.

### TimelineEvent
`at · actorId · branchId · entity · entityId · action · summary · patientId|leadId · changes[] · audit`

The spine. Patient timeline, activity feed and audit trail are all filters over this one stream.

### Lead
`name · phone · email · source · interestedInTypeId · stage · ownerId · branchId · notes[] · nextFollowUpAt · appointmentId · patientId · lostReason`

### User, Branch, Session
`User`: identity, role, branch scope, specialisation, active flag.
`Branch`: name, code, address, opening hours, closed days.
`Session`: device, IP, sign-in and last-seen — the basis for revocation.

### Supporting
`Note` · `PatientDocument` · `CalendarBlock` · `AppNotification` · `ClinicSettings` · `PrescriptionItem`

## Relationships

```
Branch ──┬─< User
         ├─< Patient ──┬─< Appointment ──── Treatment ──< PrescriptionItem
         │             ├─< Note
         │             ├─< Document
         │             └─< Reminder ──── Task
         ├─< Lead ─────────┘ (converts to Patient)
         └─< CalendarBlock

TimelineEvent ──▶ any entity (append-only)
```

## Design decisions

**One `Database` object.** The whole state is a single serialisable object. Trivial to snapshot — which is what makes the undo stack a one-liner — and trivial to inspect.

**No foreign-key enforcement.** Deliberate for a prototype: selectors tolerate missing references and render a fallback rather than crashing on partial data.

**Soft delete throughout.** Patients archive, leads close, treatment types and users deactivate. Hard deletion would orphan history, and history is the product.

**Denormalised branch on most entities.** Every scoped entity carries `branchId` directly rather than being resolved through a chain, because branch scoping runs on every query and a join per read is the wrong trade at this scale.

**Events are append-only.** Nothing in the product updates or deletes a `TimelineEvent`.

## Path to production

- `types.ts` → API contract; the zod schemas planned alongside it become request validation
- `repo`/`storage` → swap `localStorage` for HTTP; nothing above the data layer changes
- `permissions.ts` → mirror to server-side authorisation
- `followUpEngine.ts` → lift to a server cron, unchanged; it is already pure
- `TimelineEvent` → move to append-only, separately durable storage
