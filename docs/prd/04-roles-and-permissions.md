# Part 4 — Roles & Permissions

Five roles. The matrix below is **generated from `src/data/permissions.ts`**, the same module the application enforces with — the in-app version at `/users → Roles & permissions` renders from that module too, so specification, interface and behaviour cannot drift apart.

## The roles

### Owner
The clinic's principal — in this product's model, a practising clinician who also runs the business. Holds everything, including the two powers nobody else has: **changing other people's roles**, and clinical recording alongside full administration.

### Admin
Runs the system, not the clinic floor. Configures treatments, branches, reminder rules and users; sees every branch's reports and the audit trail.

**Deliberately not clinical.** An admin cannot record a treatment or prescribe. System administration is not a licence to practise, and conflating the two is how audit trails become worthless.

### Branch Manager
Accountable for one branch. Everything a receptionist can do, plus archiving patients, completing appointments, assigning tasks, managing blocked time, and branch-level reporting including revenue. Cannot change clinic-wide configuration or see other branches.

### Doctor
Clinical work only. Records treatments, prescribes, amends visit records, sees full clinical history. Scoped by default to **their own** patients and schedule.

Cannot book, cancel or reschedule — that is the front desk's job, and letting clinicians quietly move their own diary is how double-bookings appear.

### Receptionist
The front desk. Registers patients, books, checks in, cancels, reschedules, handles enquiries and works the follow-up queue.

**Cannot see clinical detail** — `patients.viewClinical` is withheld. They see that a visit happened, who performed it and when; observations, doctor's notes and prescriptions are hidden. This is the single most important boundary in the matrix.

## Scoping rules

Beyond the permission checks, two scoping rules apply:

- **Branch scope.** Owners and admins see every branch. Everyone else is limited to the branches on their user record. (`seesAllBranches`)
- **Self scope.** Doctors default to their own appointments and patients rather than the whole branch's. (`scopedToSelf`)

## Permission matrix

● granted · withheld

| Permission | Owner | Admin | Branch Manager | Doctor | Receptionist |
|---|:--:|:--:|:--:|:--:|:--:|
| **Patients** |  |  |  |  |  |
| `patients.archive` | ● | ● | ● | · | · |
| `patients.create` | ● | ● | ● | · | ● |
| `patients.edit` | ● | ● | ● | ● | ● |
| `patients.view` | ● | ● | ● | ● | ● |
| `patients.viewClinical` | ● | ● | ● | ● | · |
| **Appointments** |  |  |  |  |  |
| `appointments.cancel` | ● | ● | ● | · | ● |
| `appointments.complete` | ● | ● | ● | ● | · |
| `appointments.create` | ● | ● | ● | · | ● |
| `appointments.edit` | ● | ● | ● | · | ● |
| `appointments.view` | ● | ● | ● | ● | ● |
| **Treatments** |  |  |  |  |  |
| `treatments.create` | ● | · | · | ● | · |
| `treatments.edit` | ● | · | · | ● | · |
| `treatments.prescribe` | ● | · | · | ● | · |
| `treatments.view` | ● | ● | ● | ● | ● |
| **Follow-ups** |  |  |  |  |  |
| `followups.manageRules` | ● | ● | · | · | · |
| `followups.snooze` | ● | ● | ● | ● | ● |
| `followups.view` | ● | ● | ● | ● | ● |
| **Leads** |  |  |  |  |  |
| `leads.convert` | ● | ● | ● | · | ● |
| `leads.create` | ● | ● | ● | · | ● |
| `leads.edit` | ● | ● | ● | · | ● |
| `leads.view` | ● | ● | ● | · | ● |
| **Tasks** |  |  |  |  |  |
| `tasks.assign` | ● | ● | ● | · | · |
| `tasks.complete` | ● | ● | ● | ● | ● |
| `tasks.create` | ● | ● | ● | ● | ● |
| `tasks.view` | ● | ● | ● | ● | ● |
| **Calendar** |  |  |  |  |  |
| `calendar.manageBlocks` | ● | ● | ● | · | · |
| `calendar.manageOwnLeave` | ● | ● | ● | ● | ● |
| `calendar.view` | ● | ● | ● | ● | ● |
| **Timeline & audit** |  |  |  |  |  |
| `audit.view` | ● | ● | · | · | · |
| `timeline.view` | ● | ● | ● | ● | ● |
| **Reports** |  |  |  |  |  |
| `reports.export` | ● | ● | ● | · | · |
| `reports.view` | ● | ● | ● | ● | · |
| `reports.viewAllBranches` | ● | ● | · | · | · |
| `reports.viewFinancial` | ● | ● | ● | · | · |
| **Users** |  |  |  |  |  |
| `users.create` | ● | ● | · | · | · |
| `users.edit` | ● | ● | · | · | · |
| `users.endSessions` | ● | ● | · | · | · |
| `users.manageRoles` | ● | · | · | · | · |
| `users.view` | ● | ● | ● | · | · |
| **Settings** |  |  |  |  |  |
| `settings.editBranches` | ● | ● | · | · | · |
| `settings.editClinic` | ● | ● | · | · | · |
| `settings.editTreatments` | ● | ● | · | · | · |
| `settings.resetDemoData` | ● | ● | · | · | · |
| `settings.view` | ● | ● | ● | · | · |

## How permissions are applied in the interface

Three mechanisms, in order of preference:

1. **Hide what cannot be done.** Navigation items and action buttons are filtered by permission. A receptionist never sees a Settings link — offering a door that is locked wastes a click and erodes trust.
2. **Show the wall where hiding would confuse.** Guarded routes render an explicit *Permission denied* state naming the current role, rather than redirecting. A silent redirect leaves the user unsure whether they mis-clicked or are being refused.
3. **Degrade content, don't blank the page.** A receptionist opening a patient record sees the record, with the clinical sections replaced by an explanatory panel. The patient is still findable, bookable and contactable.

## Security note

Every check in this prototype is **client-side and advisory** — it shapes the interface, nothing more. In production the same matrix must be enforced server-side on every request; the client copy exists only so the interface doesn't offer actions that will be rejected.

The matrix is written once and consumed everywhere (`can()`, `<Can>`, `usePermission`, `RouteGuard`), which is what makes mirroring it to a server a mechanical job rather than an archaeology exercise.
