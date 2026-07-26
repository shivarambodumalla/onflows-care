import { useEffect, useState } from 'react'
import { Button, Drawer, Field, Input, Select, useToast } from '@/design-system'
import { createLead } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { staffIn } from '@/data/selectors'
import { addDays, toISODate, todayISO } from '@/lib/dates'
import { LEAD_SOURCE_LABELS, type LeadSource } from '@/data/types'
import { useAutosave } from '@/hooks/useAutosave'

interface Draft {
  name: string
  phone: string
  email: string
  source: LeadSource
  interestedInTypeId: string
  ownerId: string
  nextFollowUp: string
}

const EMPTY: Draft = {
  name: '',
  phone: '',
  email: '',
  source: 'phone',
  interestedInTypeId: '',
  ownerId: '',
  nextFollowUp: '',
}

/**
 * Capturing an enquiry has to be faster than writing it on a notepad, or it
 * will be written on a notepad. Name and phone are the only requirements; the
 * follow-up date defaults to a week out so nothing enters the system without
 * a next action.
 */
export function NewLeadDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, branch, user, applyWith } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const { draft, setDraft, clear, restored } = useAutosave<Draft>('new-lead', EMPTY, open)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setDraft((current) => ({
      ...current,
      ownerId: current.ownerId || user.id,
      nextFollowUp: current.nextFollowUp || toISODate(addDays(new Date(), 7)),
    }))
  }, [open, user.id, setDraft])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const submit = () => {
    if (!draft.name.trim()) return setError('A name is required')
    if (!draft.phone.trim()) return setError('A phone number is required')

    const lead = applyWith((db) =>
      createLead(db, ctx, {
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim() || undefined,
        source: draft.source,
        interestedInTypeId: draft.interestedInTypeId || undefined,
        ownerId: draft.ownerId || user.id,
        branchId: branch.id,
        nextFollowUpAt: draft.nextFollowUp
          ? new Date(`${draft.nextFollowUp}T10:00:00`).toISOString()
          : undefined,
      }),
    )

    clear()
    onClose()
    toast.success(`Enquiry from ${lead.name} logged`, 'A follow-up task has been scheduled')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New enquiry"
      description={`${branch.name} · captured in under a minute`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Log enquiry
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

        {restored && (
          <p className="rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text">
            Restored an unsaved draft from earlier.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            {({ id }) => (
              <Input
                id={id}
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Who is enquiring?"
                autoComplete="off"
              />
            )}
          </Field>

          <Field label="Phone" required>
            {({ id }) => (
              <Input
                id={id}
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

          <Field label="Source">
            {({ id }) => (
              <Select id={id} value={draft.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
                {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Interested in">
            {({ id }) => (
              <Select
                id={id}
                value={draft.interestedInTypeId}
                onChange={(e) => set('interestedInTypeId', e.target.value)}
              >
                <option value="">Not sure yet</option>
                {db.treatmentTypes
                  .filter((t) => t.active)
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>

          <Field label="Owner">
            {({ id }) => (
              <Select id={id} value={draft.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
                {staffIn(db, branch.id).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.id === user.id ? ' (you)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field
          label="Next follow-up"
          hint="A weekly chase is created automatically until the enquiry is closed"
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="date"
              min={todayISO()}
              value={draft.nextFollowUp}
              onChange={(e) => set('nextFollowUp', e.target.value)}
            />
          )}
        </Field>
      </div>
    </Drawer>
  )
}
