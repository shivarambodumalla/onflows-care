# Part 14 — Calendar

## Objective

Answer "who is actually available, and when?" — the question reception asks before every booking.

Distinct from Appointments, which is about *working the day*. Calendar is about *capacity*.

## Three lenses

### By doctor
One row per doctor, seven day-columns. Shows each doctor's week at a glance, with leave and blocked time replacing the appointment list on affected days. This is the lens for "can Dr. Rao see someone on Thursday?"

### Reception
A time-grid: hours down, days across, every appointment in its slot, colour-coded by treatment type. This is the whole desk's week — the lens for spotting a gap or an overloaded morning.

### Branch
Capacity per day: booked count, a load bar against theoretical capacity, closed-day markers, and the week's leave and blocked time in a side panel. The lens for planning rather than booking.

## Leaves

Multi-day, per user, with a reason. Any staff member can record **their own** leave; managers and above can record anyone's.

Leave does not cancel existing appointments. It **warns at booking time** instead. Automatically cancelling a doctor's day because leave was entered would be a destructive surprise; surfacing the conflict and letting a human decide is correct.

## Blocked time

Same mechanism, different intent: conferences, admin blocks, case reviews. Distinguished from leave in reporting and tone.

## Holidays

Branch-wide closures with no user attached. Only managers and above can create them.

## Business rules

- Branch opening hours drive the time grid and the load calculation.
- Closed days are shaded and labelled; booking into one warns but is permitted.
- Load = booked ÷ (doctors × slots). Green under 50%, amber 50–80%, red above.
- Blocks are branch-scoped.
- Creating and removing a block is audited.

## Permissions

| Action | Owner | Admin | Manager | Doctor | Receptionist |
|---|:--:|:--:|:--:|:--:|:--:|
| View | ● | ● | ● | ● | ● |
| Own leave | ● | ● | ● | ● | ● |
| Anyone's leave / blocks / holidays | ● | ● | ● | · | · |

## Acceptance criteria

1. All three lenses render the same week consistently.
2. A doctor on leave shows as unavailable in the doctor lens.
3. Booking into blocked time warns and explains, without blocking.
4. A doctor can record their own leave but not a colleague's.
5. Closed days are visibly distinct.
6. The branch lens load bar reflects actual bookings against capacity.
7. Creating and removing blocks appears in the audit trail.
