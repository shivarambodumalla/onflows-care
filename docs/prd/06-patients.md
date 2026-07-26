# Part 6 — Patients

The patient record is the centre of the product. Everything else — appointments, treatments, follow-ups, leads — exists to put something on it or act on what is already there.

## Patient list

**Objective.** Get from a name, a phone number or a patient code to the right record in seconds.

**Layout.** Page header with count → search + doctor filter + density toggle → status tabs (Active / Archived / All) → table.

**Columns.** Patient (avatar, name, code, age, phone) · Age · Primary doctor · Last visit · Next appointment · Tags. All sortable except Tags.

**Search** matches name, patient code, phone (whitespace-insensitive) and email, as a substring — because a caller gives you *"Sharma, something like 98765"*, not an exact string. The query is held in the URL (`?q=`) so a filtered list can be shared.

**Row actions.** Open record · Archive (or Restore).

**Empty states.** No patients at all → invite registration. No patients matching the filter → *"No patients match 'x'"* with the hint to try a partial name, the code, or the last digits of a phone number.

## Patient record

**Objective.** Everything known about one patient, in one place, with the clinical detail one tab away.

### Identity header
Avatar, name, archived badge, tags, code, age, gender, click-to-call phone, branch. **Allergies render as a red banner directly under the identity line** — an allergy discovered after prescribing is a patient-safety failure, so it is not behind a tab.

Actions: Record visit · Book · overflow (Edit details, Archive/Restore).

### At-a-glance strip
Last visit · Next appointment · Open follow-ups · Total visits. These four answer the questions a doctor asks before opening anything.

### Tabs

| Tab | Contents |
|---|---|
| **Timeline** | Every event on this patient, newest first, with actor and field-level changes |
| **Treatments** | Visit records: observations, adjustment, prescription, doctor's notes, next-visit interval |
| **Appointments** | Full booking history with status and cancellation reasons |
| **Documents** | Reports, scans, consent forms, invoices — *simulated storage* |
| **Notes** | Free-text notes, pinnable, with author and time |

### Sidebar
Details (code, contact, DOB, primary doctor, branch, source, registration date, origin lead) · Address · Medical history (conditions, allergies) · Open follow-ups · Emergency contact · Lifetime value (financial permission only).

## Timeline

The single patient timeline is a **view over the global event stream** filtered to this patient — not a separate log. Because every mutation emits an event, the timeline is complete by construction; no feature can forget to write to it.

Each entry shows a tone-coded icon, a human summary, the actor, a relative timestamp, and — for audited events — the fields that changed with before/after values.

## Medical history

Conditions and allergies are free-text lists rather than coded vocabularies. This is deliberate for a prototype: coding systems (ICD, SNOMED) are a large decision that should be made with clinical input, and pretending to have made it would be worse than leaving it open.

Both are gated behind `patients.viewClinical`.

## Treatment history

Reverse-chronological visit cards. Each shows treatment type and category, date, doctor, and — for clinical roles — observations, adjustment, prescription table and private doctor's notes. Non-clinical roles see the card with the detail replaced by an explanation, so reception still knows a visit happened.

## Documents

Attach, list and delete. Kind, size, uploader and date. **Storage is simulated** and labelled as such on the screen; no file is ever uploaded. Deletion is undoable via toast.

## Notes

Chronological, pinned first. `⌘↵` saves. Notes are visible to everyone with record access — they are operational ("prefers morning appointments", "hard to reach on phone"), not clinical.

## Search

See Part 12. The list's own search box is a filter; the global palette is the way in from elsewhere.

## Archive

Archiving is **reversible but consequential**, so the dialog states its side effects before asking:

- Cancels future scheduled appointments
- Cancels open follow-ups and their tasks
- Removes the patient from active lists, keeping them searchable under Archived

A reason is required. Both archive and restore are audited and undoable via toast.

## Business rules

- **Duplicate phone numbers are rejected at registration.** Two records for one person is how a patient history silently splits in half, and it is nearly impossible to merge afterwards.
- Only name and phone are required. Everything else can be filled in later; a patient standing at the desk should not wait for a complete form.
- Patient codes are sequential (`OC-1042`), generated from the highest existing number.
- Conditions, allergies and tags accept comma-separated entry.
- Registration drafts autosave and are restored if the drawer is reopened.

## Permissions

| Action | Owner | Admin | Manager | Doctor | Receptionist |
|---|:--:|:--:|:--:|:--:|:--:|
| View list and record | ● | ● | ● | ● | ● |
| Register | ● | ● | ● | · | ● |
| Edit details | ● | ● | ● | ● | ● |
| See clinical detail | ● | ● | ● | ● | · |
| Archive / restore | ● | ● | ● | · | · |

## Acceptance criteria

1. Typing the last five digits of a phone number filters the list to that patient.
2. Registering a patient with an existing phone number is refused with an explanatory message.
3. A new patient appears in the list and has a timeline entry recording who registered them.
4. Opening a record as a receptionist shows the patient but withholds observations, notes and prescriptions, with an explanation rather than a blank panel.
5. Allergies are visible without scrolling or opening a tab.
6. Archiving reports its side effects first, requires a reason, and is undoable from the toast.
7. Every action taken on a patient appears on their timeline with the actor's name.
