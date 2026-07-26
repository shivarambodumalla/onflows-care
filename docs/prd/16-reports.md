# Part 16 — Reports

## Objective

Let an owner or manager answer questions about the business, and drill from any number into the records behind it.

## Why tables, not charts

The first pass is deliberately tabular, with proportion bars rather than plotted charts.

The purpose of this stage is to agree **which numbers matter**. Charts are cheap to add once the columns are settled and expensive to redo if they are not — and a chart makes a number look decided in a way that discourages the argument you actually want to have. Charts arrive in the depth pass.

## Controls

Time range (30 / 90 / 365 days) and branch scope. Cross-branch comparison requires `reports.viewAllBranches` (owner and admin). Revenue requires `reports.viewFinancial` — doctors and receptionists see a different tile in that slot rather than a gap.

## Headline KPIs

New patients · visits recorded · no-show rate · conversion rate · revenue (or cancellations, without financial permission).

## Patients

New patients by source · patients by primary doctor · most common conditions · **retention** (share of patients with more than one recorded visit).

Retention is the single most important number in the set. A clinic that acquires well and retains badly is a clinic with an expensive problem, and it is invisible in appointment counts.

## Doctors

Per doctor: booked · visits completed · unique patients · no-show rate · revenue.

No-show rate is per doctor because it varies by clinician far more than people expect, and the cause is usually scheduling behaviour rather than the patients.

## Appointments

Outcomes (completed / no-show / cancelled / still scheduled) · by treatment type · booking channel (walk-in vs. booked ahead) · busiest weekdays.

## Follow-ups

Outcomes (completed / open / overdue / snoozed) · volume by rule · escalation count · completions by person.

This section audits the automation itself. A rule generating hundreds of never-actioned tasks is worse than no rule, and this is where that shows up.

## Conversions

Enquiry funnel with stage proportions · conversion by source · **reasons enquiries are lost** · conversion by owner.

Loss reasons are the highest-value output in the module: they turn "we lose a lot of enquiries" into "we lose them on price".

## Business rules

- Every figure is computed live from current state; there is no reporting cache to go stale.
- Conversion rate excludes still-open enquiries.
- Revenue is derived from treatment-type prices on recorded visits — an indicative figure, not billing.
- Export is **simulated** and says so when used.

## Acceptance criteria

1. Changing the time range recomputes every figure.
2. Cross-branch comparison is available only to owner and admin.
3. Financial figures are hidden from doctors and receptionists.
4. Percentages are consistent with the counts beside them.
5. The follow-ups section reflects real engine output.
6. Loss reasons are broken out individually.
7. Export declares itself simulated rather than failing silently.
