import { useEffect, useState } from 'react'
import { Button, Checkbox, Drawer, Field, Input, Select, useToast } from '@/design-system'
import { saveReminderRule } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { ROLE_LABELS, type Channel, type ReminderRule, type ReminderTrigger, type Role } from '@/data/types'

const TRIGGERS: { value: ReminderTrigger; label: string; hint: string }[] = [
  { value: 'after_treatment', label: 'After a treatment', hint: 'Days after a visit is recorded' },
  { value: 'before_appointment', label: 'Before an appointment', hint: 'Days before the booked slot' },
  { value: 'no_visit_since', label: 'No visit since', hint: 'Days of inactivity before nudging' },
  { value: 'lead_follow_up', label: 'Open enquiry', hint: 'Days between enquiry follow-ups' },
]

const CHANNELS: { value: Channel; label: string; simulated: boolean }[] = [
  { value: 'in_app', label: 'In-app task', simulated: false },
  { value: 'email', label: 'Email', simulated: true },
  { value: 'sms', label: 'SMS', simulated: true },
  { value: 'whatsapp', label: 'WhatsApp', simulated: true },
]

export function RuleDrawer({
  open,
  rule,
  onClose,
}: {
  open: boolean
  rule: ReminderRule | null
  onClose: () => void
}) {
  const { db, apply } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<ReminderTrigger>('after_treatment')
  const [offsetDays, setOffsetDays] = useState(7)
  const [assigneeRole, setAssigneeRole] = useState<Role>('receptionist')
  const [escalateAfterDays, setEscalateAfterDays] = useState(3)
  const [channels, setChannels] = useState<Channel[]>(['in_app'])
  const [treatmentTypeIds, setTreatmentTypeIds] = useState<string[]>([])
  const [active, setActive] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(rule?.name ?? '')
    setTrigger(rule?.trigger ?? 'after_treatment')
    setOffsetDays(rule?.offsetDays ?? 7)
    setAssigneeRole(rule?.assigneeRole ?? 'receptionist')
    setEscalateAfterDays(rule?.escalateAfterDays ?? 3)
    setChannels(rule?.channels ?? ['in_app'])
    setTreatmentTypeIds(rule?.treatmentTypeIds ?? [])
    setActive(rule?.active ?? true)
    setError('')
  }, [open, rule])

  const toggleChannel = (channel: Channel) =>
    setChannels((current) =>
      current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    )

  const toggleType = (id: string) =>
    setTreatmentTypeIds((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    )

  const submit = () => {
    if (!name.trim()) return setError('Give the rule a name staff will recognise')
    if (channels.length === 0) return setError('Pick at least one channel')

    apply((db) =>
      saveReminderRule(db, ctx, {
        id: rule?.id,
        name: name.trim(),
        trigger,
        offsetDays: trigger === 'before_appointment' ? -Math.abs(offsetDays) : Math.abs(offsetDays),
        channels,
        assigneeRole,
        escalateAfterDays,
        treatmentTypeIds,
        active,
      }),
    )
    onClose()
    toast.success(rule ? 'Rule updated' : 'Rule created')
  }

  const selectedTrigger = TRIGGERS.find((t) => t.value === trigger)!

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={rule ? 'Edit rule' : 'New follow-up rule'}
      description="Rules turn clinical events into work someone will actually see"
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {rule ? 'Save rule' : 'Create rule'}
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

        <Field label="Rule name" required>
          {({ id }) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Post-treatment check-in"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trigger" required>
            {({ id }) => (
              <Select id={id} value={trigger} onChange={(e) => setTrigger(e.target.value as ReminderTrigger)}>
                {TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Days" hint={selectedTrigger.hint} required>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="number"
                min={0}
                value={offsetDays}
                onChange={(e) => setOffsetDays(Number(e.target.value))}
              />
            )}
          </Field>

          <Field label="Assign to">
            {({ id }) => (
              <Select id={id} value={assigneeRole} onChange={(e) => setAssigneeRole(e.target.value as Role)}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Escalate after" hint="0 means it never escalates">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="number"
                min={0}
                value={escalateAfterDays}
                onChange={(e) => setEscalateAfterDays(Number(e.target.value))}
              />
            )}
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Channels</p>
          <div className="flex flex-col gap-2 rounded-lg border border-default p-3">
            {CHANNELS.map((channel) => (
              <div key={channel.value} className="flex items-center justify-between">
                <Checkbox
                  label={channel.label}
                  checked={channels.includes(channel.value)}
                  onChange={() => toggleChannel(channel.value)}
                />
                {channel.simulated && (
                  <span className="text-2xs text-subtle">simulated in this prototype</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {trigger === 'after_treatment' && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">
              Applies to <span className="font-normal text-subtle">— none selected means all treatments</span>
            </p>
            <div className="flex flex-wrap gap-2 rounded-lg border border-default p-3">
              {db.treatmentTypes
                .filter((t) => t.active)
                .map((type) => (
                  <Checkbox
                    key={type.id}
                    label={type.name}
                    checked={treatmentTypeIds.includes(type.id)}
                    onChange={() => toggleType(type.id)}
                  />
                ))}
            </div>
          </div>
        )}

        <Checkbox label="Rule is active" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </div>
    </Drawer>
  )
}
