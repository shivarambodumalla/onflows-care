# Part 8 — Treatments

## Objective

Let a doctor record what happened in under a minute, and — as a side effect of that recording — guarantee the patient will be chased for their next visit.

This is the most consequential write in the product. It closes the appointment, writes the clinical record, and creates the follow-up.

## Treatment entry

A wide drawer opened from the appointment row or the patient record.

**Fields**

| Field | Required | Notes |
|---|:--:|---|
| Treatment | ● | Defaults from the appointment; changing it re-defaults the follow-up interval |
| Treating doctor | ● | Defaults to the current user when they are a doctor |
| Observations | | What was seen and what the patient reported |
| Adjustment | | What changed from the planned treatment, and why |
| Prescription | | Repeatable rows: medication, dosage, frequency, duration, instructions |
| Doctor's notes | | Private working notes |
| Next visit | | Days until the follow-up — pre-filled, always editable |

**Allergies are shown as a red banner inside the drawer**, above the prescription fields. Prescribing without allergy information in view is a patient-safety failure; it is not acceptable to require the doctor to have remembered it from the previous screen.

## Adjustment

A first-class field, not a note. Clinics routinely deviate from the planned treatment — reduced intensity after soreness, a gentler technique during a flare-up — and that deviation is exactly what the next clinician needs to know. Burying it in free text loses it.

## Prescription

Repeatable rows rather than a text blob, so prescriptions are countable, reportable and eventually printable. Rows with an empty medication name are discarded on save; a row with a name but no dosage is allowed, because half-recorded is better than not recorded.

## Doctor notes

Separated from observations. Observations are the clinical record; notes are the doctor's working thoughts ("patient anxious about prognosis — reassured"). Both are gated behind `patients.viewClinical`.

## Next visit — where automation replaces memory

The field sits in a highlighted panel with quick presets (3d / 7d / 14d / 30d / None) and a live preview of the resulting date.

**Precedence:** the doctor's explicit interval always wins over the treatment type's default, which wins over the reminder rule's offset. The clinic's rule is a starting point; the clinician's judgement is the decision.

On save, `remindersForTreatment()` creates a reminder per applicable active rule. When it falls due, the engine turns it into a task in a named person's inbox (Part 9).

Setting *None* is a legitimate choice and creates no follow-up — for a discharge, that is correct.

## Attachments

Treatments carry an `attachmentIds` array linking to patient documents. Document storage is simulated in this prototype and labelled as such.

## Cross-patient ledger

`/treatments` lists every recorded visit for the branch: date, patient, treatment, doctor, observations, prescription count, next-visit interval. Filters for doctor, treatment type, time range and free text.

Non-clinical roles see the ledger with observations replaced by *"Restricted"*, and a panel explaining why. They can still see that visits happened and who performed them, which is what reception needs for scheduling.

## Business rules

- Recording a visit against an appointment sets it to `completed` and links the two records.
- A visit can be recorded without an appointment (retrospective entry, home visit).
- Amendments are permitted and audited with field-level before/after values. Clinical records are corrected, never silently overwritten.
- Draft treatment entries autosave per patient and are restored on reopen.
- The follow-up engine re-runs immediately after saving, so the new follow-up is visible without a reload.

## Permissions

Recording, amending and prescribing require the **doctor** role or the **owner** (who, in this product's model, is a practising clinician). Admins and branch managers explicitly cannot: administering the system is not a licence to practise.

## Acceptance criteria

1. Recording a visit with a next-visit interval creates a follow-up due on exactly that date.
2. Changing the treatment type re-defaults the next-visit interval to that type's default.
3. Setting next visit to *None* creates no follow-up.
4. Saving marks the linked appointment completed and links it to the visit record.
5. Patient allergies are visible in the drawer without scrolling.
6. Prescription rows can be added and removed; empty rows are discarded on save.
7. A partially completed entry survives closing and reopening the drawer.
8. Amending a saved record produces an audit entry showing what changed.
