import { useEffect, useState } from 'react'
import { Button, Dialog, Field, Select, Textarea, useToast } from '@/design-system'
import { cancelAppointment } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { patientById, treatmentTypeById } from '@/data/selectors'
import { formatDateTime } from '@/lib/dates'
import type { Appointment } from '@/data/types'

const REASONS = [
  'Patient unavailable',
  'Patient cancelled',
  'Doctor on leave',
  'Clinic closed',
  'Personal emergency',
  'Other',
]

export function CancelAppointmentDialog({
  appointment,
  onClose,
}: {
  appointment: Appointment | null
  onClose: () => void
}) {
  const { db, apply } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const [reason, setReason] = useState(REASONS[0]!)
  const [detail, setDetail] = useState('')

  useEffect(() => {
    if (appointment) {
      setReason(REASONS[0]!)
      setDetail('')
    }
  }, [appointment])

  if (!appointment) return null

  const patient = patientById(db, appointment.patientId)
  const type = treatmentTypeById(db, appointment.treatmentTypeId)

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Cancel this appointment?"
      description={`${patient?.name} · ${type?.name} · ${formatDateTime(appointment.startAt)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const full = reason === 'Other' && detail.trim() ? detail.trim() : reason
              apply((db) => cancelAppointment(db, ctx, appointment.id, full))
              onClose()
              toast.undoable('Appointment cancelled', () => {
                // Undo restores the whole database snapshot, so the appointment
                // returns to exactly the status it held before.
              })
            }}
          >
            Cancel appointment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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

        {reason === 'Other' && (
          <Field label="Details">
            {({ id }) => (
              <Textarea
                id={id}
                rows={2}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="What happened?"
              />
            )}
          </Field>
        )}

        <p className="text-xs text-subtle">
          The slot is freed immediately and the cancellation is recorded on the patient's timeline.
        </p>
      </div>
    </Dialog>
  )
}
