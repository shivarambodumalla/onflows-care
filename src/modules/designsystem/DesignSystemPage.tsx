import { useState } from 'react'
import { Calendar, Check, Download, Plus, Search, Trash2 } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Dialog,
  Drawer,
  Field,
  Input,
  KpiTile,
  Menu,
  PageHeader,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  StateView,
  Switch,
  Tabs,
  Textarea,
  Timeline,
  TimelineItem,
  useToast,
  type Tone,
} from '@/design-system'

const TONES: Tone[] = ['neutral', 'brand', 'success', 'warning', 'danger', 'info', 'accent']

const SEMANTIC_TOKENS = [
  { name: '--bg', usage: 'Page background' },
  { name: '--surface', usage: 'Cards, tables, panels' },
  { name: '--surface-sunken', usage: 'Table headers, insets' },
  { name: '--surface-hover', usage: 'Row and item hover' },
  { name: '--border', usage: 'Default hairlines' },
  { name: '--border-strong', usage: 'Emphasised edges, form hover' },
  { name: '--text', usage: 'Primary copy' },
  { name: '--text-muted', usage: 'Secondary copy' },
  { name: '--text-subtle', usage: 'Tertiary, placeholders' },
  { name: '--brand', usage: 'Primary actions, active nav' },
  { name: '--success', usage: 'Completed, healthy' },
  { name: '--warning', usage: 'Due soon, needs attention' },
  { name: '--danger', usage: 'Overdue, destructive' },
  { name: '--info', usage: 'Informational, scheduled' },
  { name: '--accent', usage: 'Walk-ins, secondary categories' },
]

/**
 * Part 19 & 20 — the design system, rendered live.
 *
 * A gallery rather than a screenshot: every component here is the same one the
 * product uses, so this page cannot go out of date. Switch the theme in the
 * top bar to check both palettes.
 */
export function DesignSystemPage() {
  const toast = useToast()
  const [tab, setTab] = useState<'foundations' | 'components' | 'states'>('foundations')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [segment, setSegment] = useState('day')
  const [checked, setChecked] = useState(true)
  const [switched, setSwitched] = useState(true)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Design system"
        description="Live component gallery — every element here is the one the product renders"
      />

      <Tabs
        ariaLabel="Design system sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'foundations', label: 'Foundations' },
          { value: 'components', label: 'Components' },
          { value: 'states', label: 'Screen states' },
        ]}
      />

      {tab === 'foundations' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Semantic colour roles"
              description="Components reference these, never raw ramps — which is what makes a rebrand a one-file change. Toggle the theme in the top bar to see both."
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SEMANTIC_TOKENS.map((token) => (
                <div
                  key={token.name}
                  className="flex items-center gap-3 rounded-lg border border-default p-2"
                >
                  <span
                    className="size-9 shrink-0 rounded-md border border-default"
                    style={{ background: `var(${token.name})` }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs">{token.name}</p>
                    <p className="truncate text-2xs text-muted">{token.usage}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Type scale" description="System font stack, tabular figures for anything countable" />
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-2xl font-semibold tracking-tight">Page title — 24px semibold</p>
              <p className="text-xl font-semibold tracking-tight">Section title — 20px semibold</p>
              <p className="text-base font-semibold">Card title — 16px semibold</p>
              <p className="text-sm">Body — 14px regular, the default across the product</p>
              <p className="text-xs text-muted">Secondary — 12px muted</p>
              <p className="text-2xs text-subtle uppercase tracking-wider">Label — 11px uppercase</p>
              <p className="tnum text-sm">Tabular figures: 0123456789 · ₹1,24,500 · 09:30 AM</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Elevation & radius" />
            <div className="mt-4 flex flex-wrap gap-4">
              {[
                { label: 'sm', shadow: 'var(--shadow-sm)' },
                { label: 'md', shadow: 'var(--shadow-md)' },
                { label: 'lg', shadow: 'var(--shadow-lg)' },
                { label: 'overlay', shadow: 'var(--shadow-overlay)' },
              ].map((level) => (
                <div key={level.label} className="text-center">
                  <div
                    className="size-20 rounded-xl border border-default bg-surface"
                    style={{ boxShadow: level.shadow }}
                  />
                  <p className="mt-1.5 font-mono text-2xs text-muted">{level.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'components' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Buttons" />
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="link">Link</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" aria-label="Icon button">
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button icon={<Plus />}>With icon</Button>
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
                <ButtonGroup>
                  <Button variant="secondary">Day</Button>
                  <Button variant="secondary">Week</Button>
                  <Button variant="secondary">Month</Button>
                </ButtonGroup>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Badges" description="Status is always tone plus text, never colour alone" />
            <div className="mt-4 flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <Badge key={tone} tone={tone} dot>
                  {tone}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Form controls" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Text input" hint="With a hint below">
                {({ id, describedBy }) => (
                  <Input id={id} aria-describedby={describedBy} placeholder="Type here…" />
                )}
              </Field>
              <Field label="With an error" error="This field is required">
                {({ id, describedBy, invalid }) => (
                  <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} />
                )}
              </Field>
              <Field label="Select">
                {({ id }) => (
                  <Select id={id}>
                    <option>First option</option>
                    <option>Second option</option>
                  </Select>
                )}
              </Field>
              <Field label="Disabled">
                {({ id }) => <Input id={id} disabled value="Not editable" readOnly />}
              </Field>
              <Field label="Textarea" className="sm:col-span-2">
                {({ id }) => <Textarea id={id} rows={2} placeholder="Longer text…" />}
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-6">
              <Checkbox label="Checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <Switch label="Switch" checked={switched} onChange={(e) => setSwitched(e.target.checked)} />
              <SegmentedControl
                ariaLabel="Demo segmented control"
                value={segment}
                onChange={setSegment}
                options={[
                  { value: 'day', label: 'Day' },
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="KPI tiles" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label="Appointments" value={14} delta={{ value: 12, goodWhen: 'up', label: 'vs. last week' }} icon={<Calendar />} />
              <KpiTile label="Overdue" value={3} tone="danger" hint="needs attention" />
              <KpiTile label="Revenue" value="₹1,24,500" />
              <KpiTile label="No-show rate" value="6%" delta={{ value: -2, goodWhen: 'down' }} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Avatars & menus" />
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {['Meera Krishnan', 'Anil Deshpande', 'Divya Suresh', 'Farhan Qureshi'].map((name) => (
                <Avatar key={name} name={name} size="lg" />
              ))}
              <Menu
                label="Demo menu"
                items={[
                  { label: 'Edit', icon: <Plus /> },
                  { label: 'Download', icon: <Download />, shortcut: '⌘D' },
                  { label: 'Delete', icon: <Trash2 />, destructive: true, separated: true },
                ]}
                trigger={({ toggle }) => (
                  <Button variant="secondary" onClick={toggle}>
                    Open menu
                  </Button>
                )}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Overlays & toasts" description="Drawers for forms, dialogs for confirmation" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                Open drawer
              </Button>
              <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                Open dialog
              </Button>
              <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
                Confirm dialog
              </Button>
              <Button variant="secondary" onClick={() => toast.success('Saved', 'Everything worked')}>
                Success toast
              </Button>
              <Button
                variant="secondary"
                onClick={() => toast.undoable('Item deleted', () => toast.info('Undone'))}
              >
                Undoable toast
              </Button>
              <Button variant="secondary" onClick={() => toast.error('Something failed', 'Try again')}>
                Error toast
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" description="Shared by the patient record, universal timeline and audit trail" />
            <div className="mt-4">
              <Timeline>
                <TimelineItem
                  id="1"
                  icon={<Plus />}
                  tone="success"
                  title="Registered Ananya Sharma (OC-1042)"
                  description="by Divya Suresh"
                  timestamp="2h ago"
                />
                <TimelineItem
                  id="2"
                  icon={<Calendar />}
                  tone="brand"
                  title="Booked Initial consultation"
                  description="by Divya Suresh"
                  timestamp="1h ago"
                />
                <TimelineItem
                  id="3"
                  icon={<Check />}
                  tone="success"
                  title="Therapy session recorded"
                  description="by Dr. Anil Deshpande"
                  timestamp="20m ago"
                  body="Pain down from 7/10 to 4/10. Range of motion improving."
                  isLast
                />
              </Timeline>
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-4 pt-4">
              <CardHeader title="Data table" description="Sortable, keyboard-navigable, with row actions on hover" />
            </div>
            <div className="mt-3">
              <DataTable
                rows={[
                  { id: '1', name: 'Ananya Sharma', code: 'OC-1042', status: 'Active' },
                  { id: '2', name: 'Rahul Verma', code: 'OC-1043', status: 'Active' },
                  { id: '3', name: 'Meera Nair', code: 'OC-1044', status: 'Archived' },
                ]}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'name', header: 'Name', sortBy: (r) => r.name, cell: (r) => r.name },
                  { key: 'code', header: 'Code', sortBy: (r) => r.code, cell: (r) => <span className="tnum">{r.code}</span> },
                  {
                    key: 'status',
                    header: 'Status',
                    align: 'right',
                    cell: (r) => (
                      <Badge tone={r.status === 'Active' ? 'success' : 'neutral'} size="sm">
                        {r.status}
                      </Badge>
                    ),
                  },
                ]}
                stickyHeader={false}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Loading placeholders" />
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Spinner />
                <span className="text-sm text-muted">Inline spinner</span>
              </div>
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-56" />
            </div>
          </Card>
        </div>
      )}

      {tab === 'states' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(['loading', 'empty', 'error', 'offline', 'denied'] as const).map((kind) => (
            <Card key={kind}>
              <CardHeader title={kind[0]!.toUpperCase() + kind.slice(1)} />
              <StateView
                kind={kind}
                onRetry={kind === 'error' ? () => toast.info('Retried') : undefined}
              />
            </Card>
          ))}
          <Card>
            <CardHeader title="Empty with an action" />
            <StateView
              kind="empty"
              title="No patients yet"
              description="Register the first patient to get started."
              icon={Search}
              action={<Button size="sm" icon={<Plus />}>New patient</Button>}
            />
          </Card>
        </div>
      )}

      {/* --- Overlay demos ------------------------------------------------- */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Example dialog"
        description="Dialogs are reserved for confirmation and destructive actions."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Escape closes it, focus is trapped inside, and focus returns to the trigger on close.
        </p>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          toast.undoable('Item deleted', () => toast.info('Restored'))
        }}
        title="Delete this item?"
        description="This cannot be undone from here, but the toast will offer an undo."
        confirmLabel="Delete"
        destructive
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Example drawer"
        description="Preferred over dialogs for anything with a form"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDrawerOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Drawers keep the list behind visible, which is what a busy reception desk actually needs.
          </p>
          <Field label="A field">{({ id }) => <Input id={id} placeholder="Type here…" />}</Field>
        </div>
      </Drawer>
    </div>
  )
}
