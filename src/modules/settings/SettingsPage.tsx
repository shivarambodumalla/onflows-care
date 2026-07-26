import { useMemo, useState } from 'react'
import { Building2, Plus, RotateCcw, Stethoscope } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  Drawer,
  Field,
  Input,
  PageHeader,
  Select,
  Switch,
  Tabs,
  Textarea,
  useToast,
  type Column,
} from '@/design-system'
import { SimulatedNote, formatMoney } from '@/components/common'
import { useApp, useCtx } from '@/data/store'
import { saveBranch, saveTreatmentType, updateClinicSettings } from '@/data/actions'
import type { Branch, Channel, TreatmentType } from '@/data/types'

type Tab = 'clinic' | 'treatments' | 'branches' | 'notifications' | 'data'

const CHANNEL_LABELS: Record<Channel, { label: string; note: string }> = {
  in_app: { label: 'In-app tasks', note: 'Live — creates tasks in the inbox' },
  email: { label: 'Email', note: 'Simulated — no email is sent' },
  sms: { label: 'SMS', note: 'Simulated — no message is sent' },
  whatsapp: { label: 'WhatsApp', note: 'Simulated — planned for a later phase' },
}

/**
 * Part 18 — Settings.
 *
 * The treatments catalogue is the important one: it is what makes the product
 * domain-neutral. A chiropractic clinic, a dental practice and a physio centre
 * all configure this table differently and the rest of the app follows.
 */
export function SettingsPage() {
  const { db, apply, allows, resetDemoData } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('clinic')
  const [editingType, setEditingType] = useState<TreatmentType | null>(null)
  const [creatingType, setCreatingType] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const canEditClinic = allows('settings.editClinic')
  const canEditTreatments = allows('settings.editTreatments')
  const canEditBranches = allows('settings.editBranches')

  const [clinic, setClinic] = useState(db.settings)

  const typeColumns = useMemo<Column<TreatmentType>[]>(
    () => [
      {
        key: 'name',
        header: 'Treatment',
        sortBy: (t) => t.name,
        cell: (type) => (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{type.name}</span>
              {!type.active && (
                <Badge tone="neutral" size="sm">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted">{type.category}</p>
          </div>
        ),
      },
      {
        key: 'duration',
        header: 'Duration',
        align: 'right',
        width: 'w-24',
        sortBy: (t) => t.durationMinutes,
        cell: (type) => <span className="tnum text-muted">{type.durationMinutes} min</span>,
      },
      {
        key: 'price',
        header: 'Price',
        align: 'right',
        width: 'w-28',
        sortBy: (t) => t.price,
        cell: (type) => <span className="tnum">{formatMoney(type.price)}</span>,
      },
      {
        key: 'followUp',
        header: 'Default follow-up',
        align: 'right',
        hideOnMobile: true,
        sortBy: (t) => t.defaultFollowUpDays,
        cell: (type) =>
          type.defaultFollowUpDays > 0 ? (
            <Badge tone="info" size="sm">
              {type.defaultFollowUpDays} days
            </Badge>
          ) : (
            <span className="text-subtle">None</span>
          ),
      },
      {
        key: 'doctor',
        header: 'Doctor required',
        align: 'center',
        hideOnMobile: true,
        width: 'w-32',
        cell: (type) => (type.requiresDoctor ? 'Yes' : 'No'),
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" description={db.settings.name} />

      <Tabs
        ariaLabel="Settings sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'clinic', label: 'Clinic' },
          { value: 'treatments', label: 'Treatments', count: db.treatmentTypes.length },
          { value: 'branches', label: 'Branches', count: db.branches.length },
          { value: 'notifications', label: 'Notifications' },
          { value: 'data', label: 'Demo data' },
        ]}
      />

      {tab === 'clinic' && (
        <Card>
          <CardHeader
            title="Clinic details"
            description="Shown across the product and on anything sent to patients"
            action={
              canEditClinic ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    apply((db) => updateClinicSettings(db, ctx, clinic))
                    toast.success('Clinic settings saved')
                  }}
                >
                  Save
                </Button>
              ) : undefined
            }
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Clinic name">
              {({ id }) => (
                <Input
                  id={id}
                  value={clinic.name}
                  disabled={!canEditClinic}
                  onChange={(e) => setClinic({ ...clinic, name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Tagline">
              {({ id }) => (
                <Input
                  id={id}
                  value={clinic.tagline}
                  disabled={!canEditClinic}
                  onChange={(e) => setClinic({ ...clinic, tagline: e.target.value })}
                />
              )}
            </Field>
            <Field label="Support email">
              {({ id }) => (
                <Input
                  id={id}
                  type="email"
                  value={clinic.supportEmail}
                  disabled={!canEditClinic}
                  onChange={(e) => setClinic({ ...clinic, supportEmail: e.target.value })}
                />
              )}
            </Field>
            <Field label="Support phone">
              {({ id }) => (
                <Input
                  id={id}
                  value={clinic.supportPhone}
                  disabled={!canEditClinic}
                  onChange={(e) => setClinic({ ...clinic, supportPhone: e.target.value })}
                />
              )}
            </Field>
            <Field label="Appointment slot length" hint="Minutes per slot in the calendar grid">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={String(clinic.appointmentSlotMinutes)}
                  disabled={!canEditClinic}
                  onChange={(e) =>
                    setClinic({ ...clinic, appointmentSlotMinutes: Number(e.target.value) })
                  }
                >
                  <option value="15">15 minutes</option>
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes</option>
                </Select>
              )}
            </Field>
          </div>
        </Card>
      )}

      {tab === 'treatments' && (
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader
              title="Treatment catalogue"
              description="This table is what makes the product domain-neutral — every clinic type configures it differently and the rest of the app follows."
              action={
                canEditTreatments ? (
                  <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setCreatingType(true)}>
                    Add treatment
                  </Button>
                ) : undefined
              }
            />
          </Card>

          <DataTable
            rows={db.treatmentTypes}
            columns={typeColumns}
            rowKey={(t) => t.id}
            onRowClick={canEditTreatments ? setEditingType : undefined}
            initialSort={{ key: 'name', direction: 'asc' }}
            emptyState={{
              title: 'No treatments configured',
              description: 'Add what this clinic actually does.',
              icon: Stethoscope,
            }}
          />
        </div>
      )}

      {tab === 'branches' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            {canEditBranches && (
              <Button variant="primary" icon={<Plus />} onClick={() => setCreatingBranch(true)}>
                Add branch
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {db.branches.map((branch) => (
              <Card key={branch.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Building2 aria-hidden className="size-4 text-subtle" />
                      {branch.name}
                      <Badge tone="neutral" size="sm">
                        {branch.code}
                      </Badge>
                    </span>
                  }
                  action={
                    canEditBranches ? (
                      <Button size="sm" variant="ghost" onClick={() => setEditingBranch(branch)}>
                        Edit
                      </Button>
                    ) : undefined
                  }
                />
                <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                  <p className="text-muted">{branch.address}</p>
                  <p className="tnum text-muted">{branch.phone}</p>
                  <p className="text-muted">
                    Open {branch.opensAt} — {branch.closesAt}
                  </p>
                  <p className="text-xs text-subtle">
                    {branch.closedDays.length > 0
                      ? `Closed ${branch.closedDays.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`
                      : 'Open every day'}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {db.users.filter((u) => u.active && u.branchIds.includes(branch.id)).length} staff ·{' '}
                    {db.patients.filter((p) => p.branchId === branch.id && p.status === 'active').length}{' '}
                    patients
                  </p>
                </dl>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <Card>
          <CardHeader
            title="Notification channels"
            description="Which channels follow-up rules are allowed to use"
          />
          <div className="mt-4 flex flex-col gap-3">
            {(Object.keys(CHANNEL_LABELS) as Channel[]).map((channel) => (
              <div
                key={channel}
                className="flex items-center justify-between gap-4 rounded-lg border border-default px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium">{CHANNEL_LABELS[channel].label}</p>
                  <p className="text-xs text-muted">{CHANNEL_LABELS[channel].note}</p>
                </div>
                <Switch
                  checked={db.settings.channels[channel]}
                  disabled={!canEditClinic}
                  aria-label={`Toggle ${CHANNEL_LABELS[channel].label}`}
                  onChange={(e) => {
                    apply((db) =>
                      updateClinicSettings(db, ctx, {
                        channels: { ...db.settings.channels, [channel]: e.target.checked },
                      }),
                    )
                  }}
                />
              </div>
            ))}
          </div>

          <SimulatedNote>
            Only in-app notifications are real in this prototype. Email, SMS and WhatsApp are shown
            so the flows can be reviewed, but nothing is ever sent.
          </SimulatedNote>
        </Card>
      )}

      {tab === 'data' && (
        <Card>
          <CardHeader
            title="Demo data"
            description="This prototype runs entirely in your browser. Nothing leaves this device."
          />

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Patients', value: db.patients.length },
              { label: 'Appointments', value: db.appointments.length },
              { label: 'Visits', value: db.treatments.length },
              { label: 'Enquiries', value: db.leads.length },
              { label: 'Follow-ups', value: db.reminders.length },
              { label: 'Tasks', value: db.tasks.length },
              { label: 'Timeline events', value: db.events.length },
              { label: 'Users', value: db.users.length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-default px-3 py-2">
                <p className="tnum text-lg font-semibold">{stat.value}</p>
                <p className="text-xs text-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          {allows('settings.resetDemoData') && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/25 bg-danger-bg px-3 py-3">
              <div>
                <p className="text-sm font-medium text-danger-text">Reset demo data</p>
                <p className="text-xs text-danger-text/80">
                  Rebuilds the whole dataset from the seed, dated relative to today. Anything you
                  have changed in this session is discarded.
                </p>
              </div>
              <Button variant="danger" icon={<RotateCcw />} onClick={() => setConfirmReset(true)}>
                Reset
              </Button>
            </div>
          )}
        </Card>
      )}

      <TreatmentTypeDrawer
        open={creatingType || Boolean(editingType)}
        type={editingType}
        onClose={() => {
          setCreatingType(false)
          setEditingType(null)
        }}
      />

      <BranchDrawer
        open={creatingBranch || Boolean(editingBranch)}
        branch={editingBranch}
        onClose={() => {
          setCreatingBranch(false)
          setEditingBranch(null)
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetDemoData()
          setConfirmReset(false)
          toast.success('Demo data reset', 'Everything is back to the seeded state')
        }}
        title="Reset all demo data?"
        description="Every change made in this session will be discarded and the dataset rebuilt from scratch. This cannot be undone."
        confirmLabel="Reset everything"
        destructive
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function TreatmentTypeDrawer({
  open,
  type,
  onClose,
}: {
  open: boolean
  type: TreatmentType | null
  onClose: () => void
}) {
  const { apply } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [form, setForm] = useState({
    name: '',
    category: '',
    durationMinutes: 30,
    price: 0,
    defaultFollowUpDays: 7,
    requiresDoctor: true,
    colour: 'brand' as TreatmentType['colour'],
    active: true,
  })
  const [error, setError] = useState('')

  useMemo(() => {
    if (!open) return
    setForm({
      name: type?.name ?? '',
      category: type?.category ?? 'Treatment',
      durationMinutes: type?.durationMinutes ?? 30,
      price: type?.price ?? 0,
      defaultFollowUpDays: type?.defaultFollowUpDays ?? 7,
      requiresDoctor: type?.requiresDoctor ?? true,
      colour: type?.colour ?? 'brand',
      active: type?.active ?? true,
    })
    setError('')
  }, [open, type])

  const submit = () => {
    if (!form.name.trim()) return setError('Give the treatment a name')
    apply((db) => saveTreatmentType(db, ctx, { ...form, id: type?.id, name: form.name.trim() }))
    onClose()
    toast.success(type ? 'Treatment updated' : 'Treatment added')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={type ? `Edit ${type.name}` : 'Add a treatment'}
      description="Duration drives calendar slots; the follow-up default drives the reminder engine"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {type ? 'Save' : 'Add treatment'}
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
          <Field label="Name" required>
            {({ id }) => (
              <Input
                id={id}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Therapy session"
              />
            )}
          </Field>
          <Field label="Category">
            {({ id }) => (
              <Input
                id={id}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Consultation"
              />
            )}
          </Field>
          <Field label="Duration (minutes)" required>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={5}
                step={5}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              />
            )}
          </Field>
          <Field label="Price">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            )}
          </Field>
          <Field label="Default follow-up" hint="Days after the visit. 0 means none.">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="number"
                min={0}
                value={form.defaultFollowUpDays}
                onChange={(e) => setForm({ ...form, defaultFollowUpDays: Number(e.target.value) })}
              />
            )}
          </Field>
          <Field label="Colour" hint="Used in the calendar">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={form.colour}
                onChange={(e) =>
                  setForm({ ...form, colour: e.target.value as TreatmentType['colour'] })
                }
              >
                <option value="brand">Teal</option>
                <option value="info">Blue</option>
                <option value="accent">Purple</option>
                <option value="success">Green</option>
                <option value="warning">Amber</option>
              </Select>
            )}
          </Field>
        </div>

        <Switch
          label="Requires a doctor"
          checked={form.requiresDoctor}
          onChange={(e) => setForm({ ...form, requiresDoctor: e.target.checked })}
        />
        <Switch
          label="Available for booking"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
      </div>
    </Drawer>
  )
}

function BranchDrawer({
  open,
  branch,
  onClose,
}: {
  open: boolean
  branch: Branch | null
  onClose: () => void
}) {
  const { apply } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    opensAt: '09:00',
    closesAt: '19:00',
    closedDays: [0] as number[],
    active: true,
  })
  const [error, setError] = useState('')

  useMemo(() => {
    if (!open) return
    setForm({
      name: branch?.name ?? '',
      code: branch?.code ?? '',
      address: branch?.address ?? '',
      phone: branch?.phone ?? '',
      opensAt: branch?.opensAt ?? '09:00',
      closesAt: branch?.closesAt ?? '19:00',
      closedDays: branch?.closedDays ?? [0],
      active: branch?.active ?? true,
    })
    setError('')
  }, [open, branch])

  const submit = () => {
    if (!form.name.trim()) return setError('Give the branch a name')
    if (!form.code.trim()) return setError('A short code is required')
    apply((db) => saveBranch(db, ctx, { ...form, id: branch?.id, name: form.name.trim() }))
    onClose()
    toast.success(branch ? 'Branch updated' : 'Branch added')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={branch ? `Edit ${branch.name}` : 'Add a branch'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {branch ? 'Save' : 'Add branch'}
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
          <Field label="Name" required>
            {({ id }) => (
              <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            )}
          </Field>
          <Field label="Code" required hint="Short prefix, e.g. IND">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                maxLength={5}
              />
            )}
          </Field>
          <Field label="Opens at">
            {({ id }) => (
              <Input
                id={id}
                type="time"
                value={form.opensAt}
                onChange={(e) => setForm({ ...form, opensAt: e.target.value })}
              />
            )}
          </Field>
          <Field label="Closes at">
            {({ id }) => (
              <Input
                id={id}
                type="time"
                value={form.closesAt}
                onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
              />
            )}
          </Field>
        </div>

        <Field label="Address">
          {({ id }) => (
            <Textarea
              id={id}
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          )}
        </Field>

        <Field label="Phone">
          {({ id }) => (
            <Input id={id} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Closed on</p>
          <div className="flex flex-wrap gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => {
              const selected = form.closedDays.includes(index)
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setForm({
                      ...form,
                      closedDays: selected
                        ? form.closedDays.filter((d) => d !== index)
                        : [...form.closedDays, index],
                    })
                  }
                  className={
                    selected
                      ? 'cursor-pointer rounded-lg border border-danger bg-danger-bg px-3 py-1.5 text-sm font-medium text-danger-text'
                      : 'cursor-pointer rounded-lg border border-default bg-surface px-3 py-1.5 text-sm text-muted hover:border-strong'
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Drawer>
  )
}
