# Part 18 — Settings

## Objective

Configure the product for *this* clinic — including the choice that makes it a different product for a different kind of clinic.

## Clinic

Name, tagline, support email and phone, appointment slot length. Slot length drives the calendar grid and default booking granularity.

## Treatments

**The most important screen in Settings**, and the one that makes the product domain-neutral.

| Field | Effect |
|---|---|
| Name, category | Labels throughout the product |
| Duration | Calendar slot length for this treatment |
| Price | Revenue reporting |
| Default follow-up days | **Seeds the follow-up engine** for this treatment |
| Requires doctor | Whether booking demands a clinician |
| Colour | Calendar identification |
| Active | Available for booking; inactive types are retained for history |

A chiropractic clinic fills this with adjustments and therapy sessions; a dental practice with RCTs and scaling; a physiotherapy centre with assessments and rehab blocks. **Nothing else in the product needs to change.** That is the whole reason treatments are configuration rather than code.

Types are deactivated, never deleted — deleting one would orphan every historical visit that used it.

## Reminder rules

Configured on the Follow-ups screen (Part 9) rather than here, because rules are only comprehensible next to the reminders they produce. Settings owns *what the clinic offers*; Follow-ups owns *what the clinic chases*.

## Branches

Name, short code, address, phone, opening hours, closed days. Each branch card shows its staff and patient counts.

Opening hours drive the calendar grid and the booking slot range. Closed days shade the calendar and warn on booking.

## Doctors

Managed under Users (Part 17); a doctor is a user with the doctor role and a specialisation. A separate doctor entity would duplicate identity and immediately diverge.

## Notifications

Per-channel toggles. Only in-app is live; email, SMS and WhatsApp are **labelled simulated** on the row itself, not in a footnote.

## Demo data

Prototype-only. Record counts across every entity, and a destructive **Reset demo data** action that rebuilds the dataset from the deterministic seed, dated relative to today.

Reset is behind a confirmation dialog stating that session changes will be discarded — one of the few genuinely unrecoverable actions in the product, since it clears the undo stack too.

## Business rules

- Settings changes are audited with field-level before/after.
- Editing clinic details requires `settings.editClinic`; managers can view Settings but not change it.
- Treatment and branch changes are immediate and affect new bookings only; existing appointments keep their recorded duration.
- Deactivating a treatment type removes it from booking without touching history.

## Acceptance criteria

1. Adding a treatment type makes it immediately bookable.
2. Changing a type's default follow-up days changes what new visits schedule, leaving existing follow-ups alone.
3. Deactivating a type removes it from booking while historical visits still display it.
4. Branch opening hours change the calendar grid and slot range.
5. Simulated channels are labelled on the row.
6. Reset demo data confirms first, then rebuilds a dataset dated relative to today.
7. A manager can open Settings but cannot save changes.
