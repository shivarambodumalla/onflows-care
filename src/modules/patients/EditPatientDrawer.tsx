import { useEffect, useState } from 'react'
import { Button, Drawer, Field, Input, Select, Textarea, useToast } from '@/design-system'
import { updatePatient } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { doctorsIn } from '@/data/selectors'
import { LEAD_SOURCE_LABELS, type Gender, type LeadSource, type Patient } from '@/data/types'

/** Editing reuses the registration fields, pre-filled and diffed for the audit trail. */
export function EditPatientDrawer({
  open,
  onClose,
  patient,
}: {
  open: boolean
  onClose: () => void
  patient: Patient
}) {
  const { db, apply } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [form, setForm] = useState(() => toForm(patient))
  const [error, setError] = useState('')

  // Re-seed whenever the drawer opens, so a cancelled edit does not linger.
  useEffect(() => {
    if (open) {
      setForm(toForm(patient))
      setError('')
    }
  }, [open, patient])

  const set = <K extends keyof ReturnType<typeof toForm>>(
    key: K,
    value: ReturnType<typeof toForm>[K],
  ) => setForm((current) => ({ ...current, [key]: value }))

  const submit = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are both required')
      return
    }

    apply((db) =>
      updatePatient(db, ctx, patient.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        dob: form.dob || undefined,
        gender: form.gender,
        address: form.address.trim() || undefined,
        primaryDoctorId: form.primaryDoctorId || undefined,
        source: form.source,
        conditions: splitList(form.conditions),
        allergies: splitList(form.allergies),
        tags: splitList(form.tags),
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
      }),
    )
    onClose()
    toast.success('Patient details updated')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Edit ${patient.name}`}
      description={patient.code}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Save changes
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            {({ id }) => <Input id={id} value={form.name} onChange={(e) => set('name', e.target.value)} />}
          </Field>
          <Field label="Phone" required>
            {({ id }) => <Input id={id} value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />}
          </Field>
          <Field label="Email">
            {({ id }) => <Input id={id} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />}
          </Field>
          <Field label="Date of birth">
            {({ id }) => <Input id={id} type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />}
          </Field>
          <Field label="Gender">
            {({ id }) => (
              <Select id={id} value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
                <option value="undisclosed">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            )}
          </Field>
          <Field label="Source">
            {({ id }) => (
              <Select id={id} value={form.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
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
                value={form.primaryDoctorId}
                onChange={(e) => set('primaryDoctorId', e.target.value)}
              >
                <option value="">No preference</option>
                {doctorsIn(db, patient.branchId).map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Address">
          {({ id }) => (
            <Textarea id={id} rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Conditions" hint="Comma separated">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={form.conditions}
                onChange={(e) => set('conditions', e.target.value)}
              />
            )}
          </Field>
          <Field label="Allergies" hint="Comma separated">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={form.allergies}
                onChange={(e) => set('allergies', e.target.value)}
              />
            )}
          </Field>
          <Field label="Tags" hint="Comma separated" className="sm:col-span-2">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={form.tags}
                onChange={(e) => set('tags', e.target.value)}
                placeholder="e.g. VIP, Insurance"
              />
            )}
          </Field>
          <Field label="Emergency contact">
            {({ id }) => (
              <Input
                id={id}
                value={form.emergencyContactName}
                onChange={(e) => set('emergencyContactName', e.target.value)}
              />
            )}
          </Field>
          <Field label="Emergency phone">
            {({ id }) => (
              <Input
                id={id}
                value={form.emergencyContactPhone}
                onChange={(e) => set('emergencyContactPhone', e.target.value)}
                inputMode="tel"
              />
            )}
          </Field>
        </div>
      </div>
    </Drawer>
  )
}

function toForm(patient: Patient) {
  return {
    name: patient.name,
    phone: patient.phone,
    email: patient.email ?? '',
    dob: patient.dob ?? '',
    gender: patient.gender,
    address: patient.address ?? '',
    primaryDoctorId: patient.primaryDoctorId ?? '',
    source: patient.source,
    conditions: patient.conditions.join(', '),
    allergies: patient.allergies.join(', '),
    tags: patient.tags.join(', '),
    emergencyContactName: patient.emergencyContactName ?? '',
    emergencyContactPhone: patient.emergencyContactPhone ?? '',
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
