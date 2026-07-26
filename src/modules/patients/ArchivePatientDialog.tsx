import { useEffect, useState } from 'react'
import { Button, Dialog, Field, Select, Textarea, useToast } from '@/design-system'
import { archivePatient, restorePatient } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { nextAppointment, patientReminders } from '@/data/selectors'
import type { Patient } from '@/data/types'

const REASONS = [
  'Moved out of the city',
  'Duplicate record',
  'Requested closure',
  'No contact for 2 years',
  'Deceased',
  'Other',
]

/**
 * Archiving is reversible but consequential — it cancels future appointments
 * and stops the follow-up engine chasing. The dialog says so explicitly
 * rather than letting staff discover it afterwards.
 */
export function ArchivePatientDialog({
  patient,
  onClose,
}: {
  patient: Patient | null
  onClose: () => void
}) {
  const { db, apply } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const [reason, setReason] = useState(REASONS[0]!)
  const [detail, setDetail] = useState('')

  useEffect(() => {
    if (patient) {
      setReason(REASONS[0]!)
      setDetail('')
    }
  }, [patient])

  if (!patient) return null

  const upcoming = nextAppointment(db, patient.id)
  const openReminders = patientReminders(db, patient.id).filter(
    (r) => r.status === 'pending' || r.status === 'snoozed',
  )

  const confirm = () => {
    const full = reason === 'Other' && detail.trim() ? detail.trim() : reason
    apply((db) => archivePatient(db, ctx, patient.id, full))
    onClose()
    toast.undoable(`${patient.name} archived`, () => {
      apply((db) => restorePatient(db, ctx, patient.id))
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Archive ${patient.name}?`}
      description="The record stays searchable and can be restored at any time."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm}>
            Archive patient
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {(upcoming || openReminders.length > 0) && (
          <div className="rounded-lg border border-warning/25 bg-warning-bg px-3 py-2.5 text-sm text-warning-text">
            <p className="font-medium">Archiving will also:</p>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {upcoming && <li>Cancel the upcoming appointment on {new Date(upcoming.startAt).toLocaleDateString('en-IN')}</li>}
              {openReminders.length > 0 && (
                <li>
                  Cancel {openReminders.length} open follow-up
                  {openReminders.length === 1 ? '' : 's'}
                </li>
              )}
            </ul>
          </div>
        )}

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
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={2}
                placeholder="Why is this record being archived?"
              />
            )}
          </Field>
        )}
      </div>
    </Dialog>
  )
}
