import { Badge, cn } from '@/design-system'
import { useApp } from '@/data/store'
import { treatmentTypeById, userById } from '@/data/selectors'
import { formatDateTime, formatTimeRange } from '@/lib/dates'
import type { TimelineEvent } from '@/data/types'
import { PrescriptionTable } from '@/modules/treatments/prescription'

/**
 * The detail behind a timeline entry.
 *
 * A line reading "Therapy session recorded" tells you an event happened but
 * not what happened in it. Since the timeline is the one place a clinician
 * looks to understand a patient, each entry resolves its linked record and
 * shows the substance inline — the observations, what was prescribed, when
 * they were asked to come back — rather than making the reader navigate away
 * and lose their place in the history.
 */
export function EventDetail({ event }: { event: TimelineEvent }) {
  const { db, allows } = useApp()

  if (event.entity === 'treatment') {
    const treatment = db.treatments.find((t) => t.id === event.entityId)
    if (!treatment) return null

    // Reception can see that a visit happened, not what was found or given.
    if (!allows('patients.viewClinical')) {
      return (
        <p className="text-xs text-subtle italic">
          Clinical detail is restricted for your role.
        </p>
      )
    }

    const type = treatmentTypeById(db, treatment.treatmentTypeId)

    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {type && (
            <Badge tone={type.colour} size="sm">
              {type.name}
            </Badge>
          )}
          {treatment.nextVisitInDays ? (
            <Badge tone="info" size="sm">
              Next visit in {treatment.nextVisitInDays}d
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm">
              No follow-up set
            </Badge>
          )}
          {treatment.adjustment && (
            <Badge tone="warning" size="sm">
              Adjusted
            </Badge>
          )}
        </div>

        {treatment.observations && (
          <Detail label="Observations">{treatment.observations}</Detail>
        )}
        {treatment.adjustment && <Detail label="Adjustment">{treatment.adjustment}</Detail>}

        {treatment.prescription.length > 0 && (
          <div>
            <p className="mb-1 text-2xs font-semibold tracking-wider text-subtle uppercase">
              Prescription
            </p>
            <PrescriptionTable items={treatment.prescription} />
          </div>
        )}

        {treatment.doctorNotes && <Detail label="Doctor's notes">{treatment.doctorNotes}</Detail>}
      </div>
    )
  }

  if (event.entity === 'appointment') {
    const appointment = db.appointments.find((a) => a.id === event.entityId)
    if (!appointment) return null

    const type = treatmentTypeById(db, appointment.treatmentTypeId)

    return (
      <div className="flex flex-col gap-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {type && (
            <Badge tone={type.colour} size="sm">
              {type.name}
            </Badge>
          )}
          {appointment.kind === 'walk_in' && (
            <Badge tone="accent" size="sm">
              Walk-in
            </Badge>
          )}
        </div>
        <p className="text-muted">
          {formatTimeRange(appointment.startAt, appointment.endAt)} ·{' '}
          {userById(db, appointment.doctorId)?.name}
        </p>
        {appointment.reason && <Detail label="Reason">{appointment.reason}</Detail>}
        {appointment.cancelReason && <Detail label="Cancelled">{appointment.cancelReason}</Detail>}
        {appointment.checkedInAt && (
          <p className="text-subtle">Checked in {formatDateTime(appointment.checkedInAt)}</p>
        )}
      </div>
    )
  }

  if (event.entity === 'note') {
    const note = db.notes.find((n) => n.id === event.entityId)
    if (!note) return null
    return <p className="text-sm text-muted">{note.body}</p>
  }

  if (event.entity === 'reminder') {
    const reminder = db.reminders.find((r) => r.id === event.entityId)
    if (!reminder) return null
    const rule = db.reminderRules.find((r) => r.id === reminder.ruleId)
    return (
      <p className="text-xs text-muted">
        {rule?.name ?? 'Follow-up'} · due {formatDateTime(reminder.dueAt)} · {reminder.status}
      </p>
    )
  }

  if (event.entity === 'lead') {
    const lead = db.leads.find((l) => l.id === event.entityId)
    if (!lead) return null
    return (
      <p className="text-xs text-muted">
        {lead.phone} · {lead.stage}
        {lead.lostReason ? ` · ${lead.lostReason}` : ''}
      </p>
    )
  }

  return null
}

/** Whether an event has detail worth expanding for. */
export function hasDetail(event: TimelineEvent, db: ReturnType<typeof useApp>['db']): boolean {
  switch (event.entity) {
    case 'treatment':
      return db.treatments.some((t) => t.id === event.entityId)
    case 'appointment':
      return db.appointments.some((a) => a.id === event.entityId)
    case 'note':
      return db.notes.some((n) => n.id === event.entityId)
    case 'reminder':
      return db.reminders.some((r) => r.id === event.entityId)
    case 'lead':
      return db.leads.some((l) => l.id === event.entityId)
    default:
      return false
  }
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={cn('text-2xs font-semibold tracking-wider text-subtle uppercase')}>{label}</p>
      <p className="text-sm text-muted">{children}</p>
    </div>
  )
}
