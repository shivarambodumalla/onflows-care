import { useEffect, useMemo, useState } from 'react'
import { Button, Drawer, Field, Input, Select, cn, useToast } from '@/design-system'
import { rescheduleAppointment } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { appointmentsOn, patientById, scopedAppointments, treatmentTypeById } from '@/data/selectors'
import { addMinutes, formatDateTime, formatSlot, fromDateAndTime, timeSlots, toISODate } from '@/lib/dates'
import type { Appointment } from '@/data/types'

const REASONS = ['Patient requested', 'Doctor unavailable', 'Clinic rescheduled', 'Other']

/**
 * Rescheduling creates a new appointment and links it back to the original,
 * rather than mutating the old one — so the patient timeline shows the change
 * happened instead of quietly rewriting history.
 */
export function RescheduleDrawer({
  appointment,
  onClose,
}: {
  appointment: Appointment | null
  onClose: () => void
}) {
  const { db, branch, role, user, applyWith } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState(REASONS[0]!)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!appointment) return
    setDate(toISODate(appointment.startAt))
    setTime('')
    setReason(REASONS[0]!)
    setError('')
  }, [appointment])

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )

  const taken = useMemo(() => {
    if (!appointment || !date) return new Set<string>()
    const sameDay = appointmentsOn(scopedAppointments(db, scope), date).filter(
      (a) => a.doctorId === appointment.doctorId && a.status !== 'cancelled' && a.id !== appointment.id,
    )
    const slots = new Set<string>()
    for (const item of sameDay) {
      for (let t = new Date(item.startAt); t < new Date(item.endAt); t = addMinutes(t, 30)) {
        slots.add(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`)
      }
    }
    return slots
  }, [appointment, date, db, scope])

  if (!appointment) return null

  const patient = patientById(db, appointment.patientId)
  const type = treatmentTypeById(db, appointment.treatmentTypeId)
  const slots = timeSlots(branch.opensAt, branch.closesAt, 30)

  const submit = () => {
    if (!time) {
      setError('Pick a new time slot')
      return
    }

    applyWith((db) =>
      rescheduleAppointment(db, ctx, appointment.id, fromDateAndTime(date, time), reason),
    )
    onClose()
    toast.success(`Rescheduled ${patient?.name}`, `${formatSlot(time)} on ${date}`)
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Reschedule appointment"
      description={`${patient?.name} · ${type?.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Reschedule
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        )}

        <div className="rounded-lg border border-default bg-surface-sunken px-3 py-2">
          <p className="text-2xs tracking-wide text-subtle uppercase">Currently</p>
          <p className="mt-0.5 text-sm font-medium">{formatDateTime(appointment.startAt)}</p>
        </div>

        <Field label="New date" required>
          {({ id }) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">
            New time <span className="text-danger">*</span>
          </p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {slots.map((slot) => {
              const unavailable = taken.has(slot)
              const selected = slot === time
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={unavailable}
                  onClick={() => setTime(slot)}
                  aria-pressed={selected}
                  className={cn(
                    'tnum cursor-pointer rounded-lg border px-1 py-1.5 text-xs font-medium transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    selected
                      ? 'border-brand bg-brand text-brand-fg'
                      : unavailable
                        ? 'border-default bg-surface-sunken text-subtle line-through'
                        : 'border-default bg-surface hover:border-brand hover:bg-brand-bg',
                  )}
                >
                  {formatSlot(slot)}
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Reason" required>
          {({ id }) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <p className="text-xs text-subtle">
          The original slot is released and marked as rescheduled. Both appointments stay linked on
          the patient's timeline.
        </p>
      </div>
    </Drawer>
  )
}
