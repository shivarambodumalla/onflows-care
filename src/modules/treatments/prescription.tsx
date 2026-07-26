import { useEffect, useMemo, useState } from 'react'
import { Pill, Plus, Printer, Trash2 } from 'lucide-react'
import { Badge, Button, Drawer, Input, Select, cn, useToast } from '@/design-system'
import { addPrescription } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { patientById, patientTreatments, treatmentTypeById } from '@/data/selectors'
import { formatDate, isToday } from '@/lib/dates'
import { uid } from '@/lib/id'
import type { PrescriptionItem, Treatment } from '@/data/types'

/* -------------------------------------------------------------------------- */
/* Summary — the prescription, readable without opening anything              */
/* -------------------------------------------------------------------------- */

/**
 * One-line prescription summary for lists and timelines.
 *
 * A doctor reviewing a patient should see what was prescribed without opening
 * the visit record. "Ibuprofen 400mg, Pantoprazole 40mg +1 more" answers the
 * question in place; a link that says "3 medications" does not.
 */
export function PrescriptionSummaryLine({
  items,
  max = 2,
  className,
}: {
  items: PrescriptionItem[]
  max?: number
  className?: string
}) {
  if (items.length === 0) return null

  const shown = items.slice(0, max)
  const rest = items.length - shown.length

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5 text-xs', className)}>
      <Pill aria-hidden className="size-3 shrink-0 text-subtle" />
      <span className="text-muted">
        {shown.map((item) => `${item.medication}${item.dosage ? ` ${item.dosage}` : ''}`).join(', ')}
        {rest > 0 && ` +${rest} more`}
      </span>
    </span>
  )
}

/** Full prescription table, used inside visit cards and timeline detail. */
export function PrescriptionTable({ items }: { items: PrescriptionItem[] }) {
  if (items.length === 0) return null

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-surface-sunken px-2.5 py-1.5 text-sm"
        >
          <span className="font-medium text-text">{item.medication}</span>
          <span className="text-xs text-muted">
            {[item.dosage, item.frequency, `${item.durationDays} days`].filter(Boolean).join(' · ')}
          </span>
          {item.instructions && (
            <span className="w-full text-2xs text-subtle">{item.instructions}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/* Print action                                                               */
/* -------------------------------------------------------------------------- */

export function PrintPrescriptionButton({
  onPrint,
  size = 'sm',
  label = 'Print',
}: {
  onPrint: () => void
  size?: 'sm' | 'md'
  label?: string
}) {
  return (
    <Button variant="secondary" size={size} icon={<Printer />} onClick={onPrint}>
      {label}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/* Quick add                                                                  */
/* -------------------------------------------------------------------------- */

const COMMON: { medication: string; dosage: string; frequency: string }[] = [
  { medication: 'Ibuprofen', dosage: '400mg', frequency: 'Twice daily after food' },
  { medication: 'Paracetamol', dosage: '650mg', frequency: 'Three times daily' },
  { medication: 'Pantoprazole', dosage: '40mg', frequency: 'Once daily before food' },
  { medication: 'Chlorzoxazone', dosage: '250mg', frequency: 'Twice daily' },
  { medication: 'Methylcobalamin', dosage: '1500mcg', frequency: 'Once daily' },
  { medication: 'Calcium + D3', dosage: '500mg', frequency: 'Once daily' },
]

const blankItem = (): PrescriptionItem => ({
  id: uid('rx'),
  medication: '',
  dosage: '',
  frequency: '',
  durationDays: 7,
})

/**
 * Prescribe without reopening the whole visit drawer.
 *
 * This is the doctor's most repeated action. Routing it through the full
 * treatment form — re-confirming treatment type, doctor, observations — is
 * the friction the request was about, so this drawer does one thing.
 */
export function AddPrescriptionDrawer({
  open,
  onClose,
  patientId,
  treatmentId,
}: {
  open: boolean
  onClose: () => void
  patientId: string
  /** Target visit. Defaults to the patient's most recent one. */
  treatmentId?: string
}) {
  const { db, apply } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [items, setItems] = useState<PrescriptionItem[]>([blankItem()])
  const [targetId, setTargetId] = useState('')
  const [error, setError] = useState('')

  const patient = patientById(db, patientId)
  // Memoised: `patientTreatments` builds a new array every call, and an
  // unmemoised one in the effect below re-ran it on every render — a setState
  // loop that only shows up at runtime.
  const visits = useMemo(() => patientTreatments(db, patientId), [db, patientId])
  const latestVisitId = visits[0]?.id

  useEffect(() => {
    if (!open) return
    setItems([blankItem()])
    setError('')
    setTargetId(treatmentId ?? latestVisitId ?? '')
  }, [open, treatmentId, latestVisitId])

  const target = visits.find((v) => v.id === targetId)

  const update = (id: string, patch: Partial<PrescriptionItem>) =>
    setItems((current) => current.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  const submit = () => {
    const filled = items.filter((i) => i.medication.trim())
    if (filled.length === 0) return setError('Add at least one medication')
    if (!target) return setError('There is no visit to attach this prescription to')

    apply((db) => addPrescription(db, ctx, target.id, filled))
    onClose()
    toast.success(
      `Prescribed for ${patient?.name}`,
      `${filled.length} medication${filled.length === 1 ? '' : 's'} added to the ${formatDate(target.performedAt)} visit`,
    )
  }

  if (!patient) return null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add prescription"
      description={`${patient.name} · ${patient.code}`}
      width="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Save prescription
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

        {patient.allergies.length > 0 && (
          <p className="rounded-lg border border-danger/25 bg-danger-bg px-3 py-2 text-sm font-medium text-danger-text">
            Allergies: {patient.allergies.join(', ')}
          </p>
        )}

        {visits.length === 0 ? (
          <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text">
            This patient has no recorded visit yet. Record a visit first — a prescription belongs to
            a consultation.
          </p>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Attach to visit</span>
            <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {visits.slice(0, 12).map((visit) => (
                <option key={visit.id} value={visit.id}>
                  {formatDate(visit.performedAt)}
                  {isToday(visit.performedAt) ? ' (today)' : ''} —{' '}
                  {treatmentTypeById(db, visit.treatmentTypeId)?.name}
                </option>
              ))}
            </Select>
          </label>
        )}

        {target && target.prescription.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Already prescribed at this visit</p>
            <PrescriptionTable items={target.prescription} />
          </div>
        )}

        {/* Common medications — most prescriptions are repeats. */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Quick add</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON.map((med) => (
              <button
                key={med.medication}
                type="button"
                onClick={() =>
                  setItems((current) => [
                    ...current.filter((i) => i.medication.trim()),
                    { ...blankItem(), ...med },
                  ])
                }
                className="cursor-pointer rounded-lg border border-default bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:bg-brand-bg hover:text-brand-text"
              >
                + {med.medication} {med.dosage}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Medications</p>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus />}
              onClick={() => setItems((current) => [...current, blankItem()])}
            >
              Add row
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="grid gap-2 rounded-lg border border-default bg-surface-sunken p-2.5 sm:grid-cols-[1.4fr_1fr_1.4fr_0.7fr_auto]"
              >
                <Input
                  value={item.medication}
                  onChange={(e) => update(item.id, { medication: e.target.value })}
                  placeholder="Medication"
                  aria-label="Medication"
                />
                <Input
                  value={item.dosage}
                  onChange={(e) => update(item.id, { dosage: e.target.value })}
                  placeholder="Dosage"
                  aria-label="Dosage"
                />
                <Input
                  value={item.frequency}
                  onChange={(e) => update(item.id, { frequency: e.target.value })}
                  placeholder="Frequency"
                  aria-label="Frequency"
                />
                <Input
                  type="number"
                  min={1}
                  value={item.durationDays}
                  onChange={(e) => update(item.id, { durationDays: Number(e.target.value) })}
                  aria-label="Duration in days"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove medication"
                  disabled={items.length === 1}
                  onClick={() => setItems((current) => current.filter((i) => i.id !== item.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-subtle">
          Saving amends the visit record and is written to the audit trail. Print the prescription
          from the visit once saved.
        </p>
      </div>
    </Drawer>
  )
}

/* -------------------------------------------------------------------------- */

/** Compact badge showing how many medications a visit carries. */
export function PrescriptionCount({ treatment }: { treatment: Treatment }) {
  if (treatment.prescription.length === 0) return null
  return (
    <Badge tone="info" size="sm">
      <Pill aria-hidden className="size-2.5" />
      {treatment.prescription.length} Rx
    </Badge>
  )
}
