import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Button,
  Drawer,
  Field,
  Input,
  Select,
  Textarea,
  useToast,
} from '@/design-system'
import { createPatient, type NewPatient } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { doctorsIn } from '@/data/selectors'
import { LEAD_SOURCE_LABELS, type Gender, type LeadSource } from '@/data/types'
import { useAutosave } from '@/hooks/useAutosave'

interface Draft {
  name: string
  phone: string
  email: string
  dob: string
  gender: Gender
  address: string
  primaryDoctorId: string
  source: LeadSource
  conditions: string
  allergies: string
  emergencyContactName: string
  emergencyContactPhone: string
}

const EMPTY: Draft = {
  name: '',
  phone: '',
  email: '',
  dob: '',
  gender: 'undisclosed',
  address: '',
  primaryDoctorId: '',
  source: 'walk_in',
  conditions: '',
  allergies: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
}

/**
 * Registration is the reception desk's most time-critical form, so it is a
 * drawer over the list rather than a full page: the queue stays visible, and
 * only name and phone are required to get someone into the system.
 */
export function NewPatientDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (patientId: string) => void
}) {
  const { db, branch, applyWith } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const navigate = useNavigate()

  const { draft, setDraft, clear, restored } = useAutosave<Draft>('new-patient', EMPTY, open)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})

  useEffect(() => {
    if (open) setErrors({})
  }, [open])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const doctors = doctorsIn(db, branch.id)

  const submit = () => {
    const next: Partial<Record<keyof Draft, string>> = {}
    if (!draft.name.trim()) next.name = 'A name is required'
    if (!draft.phone.trim()) next.phone = 'A phone number is required'
    // Duplicate phone numbers are the main cause of split patient histories.
    else if (db.patients.some((p) => p.phone.replace(/\D/g, '') === draft.phone.replace(/\D/g, ''))) {
      next.phone = 'A patient with this number already exists'
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return

    const input: NewPatient = {
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim() || undefined,
      dob: draft.dob || undefined,
      gender: draft.gender,
      address: draft.address.trim() || undefined,
      branchId: branch.id,
      primaryDoctorId: draft.primaryDoctorId || undefined,
      source: draft.source,
      conditions: draft.conditions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      allergies: draft.allergies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      emergencyContactName: draft.emergencyContactName.trim() || undefined,
      emergencyContactPhone: draft.emergencyContactPhone.trim() || undefined,
    }

    const patient = applyWith((db) => createPatient(db, ctx, input))
    clear()
    onClose()
    toast.success(`${patient.name} registered`, patient.code)

    if (onCreated) onCreated(patient.id)
    else navigate(`/patients/${patient.id}`)
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Register a patient"
      description={`${branch.name} · only name and phone are required`}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Register patient
          </Button>
        </>
      }
    >
      {restored && (
        <p className="mb-4 rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text">
          Restored an unsaved draft from earlier.
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={errors.name}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Ananya Sharma"
                autoComplete="off"
              />
            )}
          </Field>

          <Field label="Phone" required error={errors.phone}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={draft.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+91 98765 43210"
                inputMode="tel"
                autoComplete="off"
              />
            )}
          </Field>

          <Field label="Email">
            {({ id }) => (
              <Input
                id={id}
                type="email"
                value={draft.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="optional"
              />
            )}
          </Field>

          <Field label="Date of birth">
            {({ id }) => (
              <Input id={id} type="date" value={draft.dob} onChange={(e) => set('dob', e.target.value)} />
            )}
          </Field>

          <Field label="Gender">
            {({ id }) => (
              <Select id={id} value={draft.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
                <option value="undisclosed">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            )}
          </Field>

          <Field label="How did they find us?">
            {({ id }) => (
              <Select
                id={id}
                value={draft.source}
                onChange={(e) => set('source', e.target.value as LeadSource)}
              >
                {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Primary doctor" className="sm:col-span-2">
            {({ id }) => (
              <Select
                id={id}
                value={draft.primaryDoctorId}
                onChange={(e) => set('primaryDoctorId', e.target.value)}
              >
                <option value="">No preference</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                    {doctor.specialisation ? ` — ${doctor.specialisation}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Address">
          {({ id }) => (
            <Textarea
              id={id}
              value={draft.address}
              onChange={(e) => set('address', e.target.value)}
              rows={2}
              placeholder="optional"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Known conditions" hint="Comma separated">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={draft.conditions}
                onChange={(e) => set('conditions', e.target.value)}
                placeholder="e.g. Hypertension, Migraine"
              />
            )}
          </Field>

          <Field label="Allergies" hint="Comma separated">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={draft.allergies}
                onChange={(e) => set('allergies', e.target.value)}
                placeholder="e.g. Penicillin"
              />
            )}
          </Field>

          <Field label="Emergency contact">
            {({ id }) => (
              <Input
                id={id}
                value={draft.emergencyContactName}
                onChange={(e) => set('emergencyContactName', e.target.value)}
                placeholder="optional"
              />
            )}
          </Field>

          <Field label="Emergency phone">
            {({ id }) => (
              <Input
                id={id}
                value={draft.emergencyContactPhone}
                onChange={(e) => set('emergencyContactPhone', e.target.value)}
                placeholder="optional"
                inputMode="tel"
              />
            )}
          </Field>
        </div>
      </div>
    </Drawer>
  )
}
