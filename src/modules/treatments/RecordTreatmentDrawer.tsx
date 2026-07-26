import { useEffect, useMemo, useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Drawer,
  Field,
  Input,
  Select,
  Textarea,
  useToast,
} from '@/design-system'
import { recordTreatment } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { doctorsIn, patientById, treatmentTypeById } from '@/data/selectors'
import { addDays, formatDate } from '@/lib/dates'
import { uid } from '@/lib/id'
import type { Appointment, PrescriptionItem } from '@/data/types'
import { useAutosave } from '@/hooks/useAutosave'

interface Draft {
  treatmentTypeId: string
  doctorId: string
  observations: string
  adjustment: string
  doctorNotes: string
  nextVisitInDays: string
  prescription: PrescriptionItem[]
}

/**
 * Part 8 — Treatment entry.
 *
 * The doctor's screen, and the one write that makes the follow-up engine fire.
 * The "next visit" field is pre-filled from the treatment type's default but
 * stays editable: the clinic's rule is a starting point, the doctor's judgement
 * is the decision.
 */
export function RecordTreatmentDrawer({
  open,
  onClose,
  patientId,
  appointment,
}: {
  open: boolean
  onClose: () => void
  patientId: string
  appointment?: Appointment
}) {
  const { db, branch, user, applyWith } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const patient = patientById(db, patientId)
  const types = useMemo(() => db.treatmentTypes.filter((t) => t.active), [db.treatmentTypes])
  const doctors = useMemo(() => doctorsIn(db, branch.id), [db, branch.id])

  const empty = useMemo<Draft>(
    () => ({
      treatmentTypeId: appointment?.treatmentTypeId ?? types[0]?.id ?? '',
      doctorId: appointment?.doctorId ?? (user.role === 'doctor' ? user.id : doctors[0]?.id ?? ''),
      observations: '',
      adjustment: '',
      doctorNotes: '',
      nextVisitInDays: '',
      prescription: [],
    }),
    [appointment, types, user, doctors],
  )

  const { draft, setDraft, clear, restored } = useAutosave<Draft>(
    `treatment-${patientId}`,
    empty,
    open,
  )
  const [error, setError] = useState('')

  const type = treatmentTypeById(db, draft.treatmentTypeId)

  // Default the follow-up interval from the treatment type whenever it changes.
  useEffect(() => {
    if (!open || !type) return
    setDraft((current) =>
      current.nextVisitInDays === ''
        ? { ...current, nextVisitInDays: String(type.defaultFollowUpDays || '') }
        : current,
    )
  }, [open, type, setDraft])

  useEffect(() => {
    if (open) setError('')
  }, [open])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const addMedication = () =>
    set('prescription', [
      ...draft.prescription,
      { id: uid('rx'), medication: '', dosage: '', frequency: '', durationDays: 7 },
    ])

  const updateMedication = (id: string, patch: Partial<PrescriptionItem>) =>
    set(
      'prescription',
      draft.prescription.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const removeMedication = (id: string) =>
    set(
      'prescription',
      draft.prescription.filter((item) => item.id !== id),
    )

  if (!patient) return null

  const submit = () => {
    if (!draft.treatmentTypeId) return setError('Choose what was done')
    if (!draft.doctorId) return setError('Choose the treating doctor')

    const incomplete = draft.prescription.some((rx) => !rx.medication.trim())
    if (incomplete) return setError('Every prescribed medication needs a name')

    const days = Number(draft.nextVisitInDays)

    applyWith((db) =>
      recordTreatment(db, ctx, {
        patientId,
        appointmentId: appointment?.id,
        doctorId: draft.doctorId,
        branchId: branch.id,
        treatmentTypeId: draft.treatmentTypeId,
        observations: draft.observations.trim() || undefined,
        adjustment: draft.adjustment.trim() || undefined,
        doctorNotes: draft.doctorNotes.trim() || undefined,
        prescription: draft.prescription.filter((rx) => rx.medication.trim()),
        nextVisitInDays: Number.isFinite(days) && days > 0 ? days : undefined,
      }),
    )

    clear()
    onClose()
    toast.success(
      `Visit recorded for ${patient.name}`,
      days > 0 ? `Follow-up scheduled for ${formatDate(addDays(new Date(), days))}` : undefined,
    )
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Record a visit"
      description={`${patient.name} · ${patient.code}`}
      width="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Save visit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error && (
          <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        )}

        {restored && (
          <p className="rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text">
            Restored an unsaved draft for this patient.
          </p>
        )}

        {patient.allergies.length > 0 && (
          <p className="rounded-lg border border-danger/25 bg-danger-bg px-3 py-2 text-sm font-medium text-danger-text">
            Allergies: {patient.allergies.join(', ')}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Treatment" required>
            {({ id }) => (
              <Select
                id={id}
                value={draft.treatmentTypeId}
                onChange={(e) => {
                  const nextType = db.treatmentTypes.find((t) => t.id === e.target.value)
                  setDraft((current) => ({
                    ...current,
                    treatmentTypeId: e.target.value,
                    nextVisitInDays: String(nextType?.defaultFollowUpDays || ''),
                  }))
                }}
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Treating doctor" required>
            {({ id }) => (
              <Select id={id} value={draft.doctorId} onChange={(e) => set('doctorId', e.target.value)}>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Observations" hint="What you saw and what the patient reported">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              rows={3}
              value={draft.observations}
              onChange={(e) => set('observations', e.target.value)}
              placeholder="e.g. Pain down from 7/10 to 4/10. Range of motion improving."
            />
          )}
        </Field>

        <Field
          label="Adjustment"
          hint="Anything you changed from the planned treatment, and why"
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              rows={2}
              value={draft.adjustment}
              onChange={(e) => set('adjustment', e.target.value)}
              placeholder="optional"
            />
          )}
        </Field>

        {/* --- Prescription ---------------------------------------------- */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Prescription</p>
            <Button size="sm" variant="secondary" icon={<Plus />} onClick={addMedication}>
              Add medication
            </Button>
          </div>

          {draft.prescription.length === 0 ? (
            <p className="rounded-lg border border-dashed border-default px-3 py-4 text-center text-sm text-subtle">
              Nothing prescribed
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {draft.prescription.map((rx) => (
                <li
                  key={rx.id}
                  className="grid gap-2 rounded-lg border border-default bg-surface-sunken p-2.5 sm:grid-cols-[1.4fr_1fr_1.4fr_0.7fr_auto]"
                >
                  <Input
                    value={rx.medication}
                    onChange={(e) => updateMedication(rx.id, { medication: e.target.value })}
                    placeholder="Medication"
                    aria-label="Medication"
                  />
                  <Input
                    value={rx.dosage}
                    onChange={(e) => updateMedication(rx.id, { dosage: e.target.value })}
                    placeholder="Dosage"
                    aria-label="Dosage"
                  />
                  <Input
                    value={rx.frequency}
                    onChange={(e) => updateMedication(rx.id, { frequency: e.target.value })}
                    placeholder="Frequency"
                    aria-label="Frequency"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={rx.durationDays}
                    onChange={(e) =>
                      updateMedication(rx.id, { durationDays: Number(e.target.value) })
                    }
                    aria-label="Duration in days"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMedication(rx.id)}
                    aria-label="Remove medication"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field label="Doctor's notes" hint="Private working notes — not shown to the patient">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              rows={2}
              value={draft.doctorNotes}
              onChange={(e) => set('doctorNotes', e.target.value)}
              placeholder="optional"
            />
          )}
        </Field>

        {/* --- Next visit — where automation replaces memory ---------------- */}
        <div className="rounded-lg border border-brand/25 bg-brand-bg px-3 py-3">
          <div className="flex items-start gap-2">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
            <div className="flex-1">
              <p className="text-sm font-medium text-brand-text">Next visit</p>
              <p className="mt-0.5 text-xs text-brand-text/80">
                Saving creates the follow-up automatically. Nobody has to remember to chase.
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={draft.nextVisitInDays}
                  onChange={(e) => set('nextVisitInDays', e.target.value)}
                  aria-label="Days until the next visit"
                  className="w-24"
                />
                <span className="text-sm text-brand-text">days</span>

                {Number(draft.nextVisitInDays) > 0 && (
                  <Badge tone="brand" size="sm">
                    due {formatDate(addDays(new Date(), Number(draft.nextVisitInDays)))}
                  </Badge>
                )}

                <div className="ml-auto flex gap-1">
                  {[3, 7, 14, 30].map((days) => (
                    <Button
                      key={days}
                      size="sm"
                      variant="ghost"
                      onClick={() => set('nextVisitInDays', String(days))}
                    >
                      {days}d
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => set('nextVisitInDays', '0')}>
                    None
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
