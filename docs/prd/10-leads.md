# Part 10 — Leads

## Objective

Make sure no enquiry is forgotten, and make it obvious which ones are going cold.

An enquiry that nobody chases is a patient the clinic never had — and unlike a missed follow-up, there is no record to notice its absence. The pipeline exists to give absence a shape.

## Pipeline

`enquiry → interested → booked → converted | lost`

| Stage | Meaning |
|---|---|
| **Enquiry** | Someone asked. Nothing has happened yet. |
| **Interested** | Contacted, engaged, not committed. |
| **Booked** | An appointment exists. |
| **Converted** | They became a patient. Terminal. |
| **Lost** | They are not coming, with a reason. Terminal. |

Stages are moved by hand. Automatic promotion on booking was considered and rejected: a booking that is later cancelled would leave the pipeline silently wrong, and the pipeline's value is that it is trustworthy.

## Views

**Pipeline board** (default) — five columns, cards showing name, phone, source and next-follow-up badge. Overdue chases are badged red. The board is the view that makes a stalled stage obvious at a glance.

**List** — sortable table for working through volume, sorted by next follow-up.

## Capture

Name and phone are the only requirements. Source, interested-in treatment, owner and next-follow-up date are pre-filled with sensible defaults.

**Every lead gets a next-follow-up date at creation — defaulting to a week out.** Nothing enters the pipeline without a next action; that is the entire mechanism by which enquiries stop evaporating.

Drafts autosave.

## Weekly follow-ups

The `lead_follow_up` rule generates a chase every 7 days for any lead that is neither converted nor lost, assigned to a receptionist, escalating after 4 days.

This runs whether or not anyone remembers the enquiry exists.

## Lead record

A drawer showing contact details, interest, next follow-up, a stage stepper, and the **call log**.

The call log is the substance of the record. *"Sent price list on WhatsApp"*, *"asked for a weekend slot"*, *"wants instalment options"* — this is what makes the fifth call useful instead of insulting.

## Conversion

**Convert to patient** creates a real patient record carrying name, phone, email and source across, sets `convertedFromLeadId`, moves the lead to converted, cancels its open chases, closes its tasks with the outcome *"Converted to patient"*, and navigates to the new record.

The new patient's timeline **begins with where they came from**, not at zero. The link is bidirectional: the patient record shows its origin enquiry, and the enquiry shows the patient it became. This is what makes source attribution in the conversions report real rather than guessed.

## Lost

Requires a reason from a fixed list plus optional free text. Open chases are cancelled.

Lost leads are retained and counted. The reasons are the point: *"cost concerns"* appearing twenty times is a pricing problem, and only a captured reason will ever tell you that.

## Business rules

- Converted and lost leads carry no next-follow-up date and generate no chases.
- Converting a lead that already has a patient returns the existing record rather than creating a duplicate.
- Conversion rate = converted ÷ (converted + lost). Open enquiries are excluded — counting them as failures would make the number drift with pipeline volume rather than performance.
- Leads are branch-scoped.

## Permissions

Doctors have **no lead access at all** — it is not clinical work and would only be noise. Reception, managers, admins and owners have full access.

## Acceptance criteria

1. Logging an enquiry takes name and phone only, and always sets a next-follow-up date.
2. An open enquiry generates a chase task every 7 days without anyone scheduling it.
3. Overdue chases are visibly badged on both the board and the dashboard.
4. Converting creates a patient carrying the source across, links both records, and navigates to the new patient.
5. The converted patient's timeline shows the original enquiry.
6. Marking lost requires a reason and cancels outstanding chases.
7. Conversion rate excludes still-open enquiries.
8. A doctor cannot reach the leads module.
