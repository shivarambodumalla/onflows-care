import { useMemo, useState } from 'react'
import { Download, TrendingUp } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  KpiTile,
  PageHeader,
  SegmentedControl,
  Select,
  Tabs,
  cn,
  useToast,
  type Column,
} from '@/design-system'
import { SimulatedNote, formatMoney } from '@/components/common'
import { useApp } from '@/data/store'
import {
  conversionRate,
  countBy,
  leadFunnel,
  revenueOf,
  treatmentTypeById,
  userById,
} from '@/data/selectors'
import { daysOverdue } from '@/lib/dates'
import {
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_LABELS,
  type Appointment,
  type Treatment,
} from '@/data/types'

type Tab = 'patients' | 'doctors' | 'appointments' | 'followups' | 'conversions'
type Range = '30' | '90' | '365'

/**
 * Part 16 — Reports.
 *
 * Tables rather than charts at this stage, deliberately: the first pass is
 * about agreeing which numbers matter. Charts are cheap to add once the
 * columns are settled, and expensive to redo if they are not.
 */
export function ReportsPage() {
  const { db, branch, allows } = useApp()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('patients')
  const [range, setRange] = useState<Range>('90')
  const [allBranches, setAllBranches] = useState(false)

  const canSeeAll = allows('reports.viewAllBranches')
  const canSeeMoney = allows('reports.viewFinancial')
  const scopeBranches = allBranches && canSeeAll ? db.branches.map((b) => b.id) : [branch.id]

  const cutoff = useMemo(() => Date.now() - Number(range) * 86_400_000, [range])

  const treatments = useMemo(
    () =>
      db.treatments.filter(
        (t) => scopeBranches.includes(t.branchId) && new Date(t.performedAt).getTime() >= cutoff,
      ),
    [db.treatments, scopeBranches, cutoff],
  )

  const appointments = useMemo(
    () =>
      db.appointments.filter(
        (a) => scopeBranches.includes(a.branchId) && new Date(a.startAt).getTime() >= cutoff,
      ),
    [db.appointments, scopeBranches, cutoff],
  )

  const patients = useMemo(
    () => db.patients.filter((p) => scopeBranches.includes(p.branchId)),
    [db.patients, scopeBranches],
  )

  const newPatients = useMemo(
    () => patients.filter((p) => new Date(p.createdAt).getTime() >= cutoff),
    [patients, cutoff],
  )

  const leads = useMemo(
    () =>
      db.leads.filter(
        (l) => scopeBranches.includes(l.branchId) && new Date(l.createdAt).getTime() >= cutoff,
      ),
    [db.leads, scopeBranches, cutoff],
  )

  const tasks = useMemo(
    () => db.tasks.filter((t) => scopeBranches.includes(t.branchId)),
    [db.tasks, scopeBranches],
  )

  const revenue = useMemo(() => revenueOf(db, treatments), [db, treatments])
  const noShows = appointments.filter((a) => a.status === 'no_show').length
  const completed = appointments.filter((a) => a.status === 'completed').length
  const cancelled = appointments.filter((a) => a.status === 'cancelled').length

  const exportNote = () =>
    toast.info('Export is simulated', 'CSV and PDF export are not connected in this prototype.')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reports"
        description={`${allBranches && canSeeAll ? 'All branches' : branch.name} · last ${range} days`}
        actions={
          allows('reports.export') ? (
            <Button variant="secondary" icon={<Download />} onClick={exportNote}>
              Export
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          ariaLabel="Time range"
          value={range}
          onChange={setRange}
          options={[
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
            { value: '365', label: '12 months' },
          ]}
        />

        {canSeeAll && (
          <Select
            value={allBranches ? 'all' : 'one'}
            onChange={(e) => setAllBranches(e.target.value === 'all')}
            aria-label="Branch scope"
            className="w-auto"
          >
            <option value="one">{branch.name} only</option>
            <option value="all">All branches</option>
          </Select>
        )}
      </div>

      {/* --- Headline KPIs -------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="New patients" value={newPatients.length} icon={<TrendingUp />} />
        <KpiTile label="Visits recorded" value={treatments.length} />
        <KpiTile
          label="No-show rate"
          value={`${appointments.length > 0 ? Math.round((noShows / appointments.length) * 100) : 0}%`}
          hint={`${noShows} of ${appointments.length}`}
          tone={noShows / Math.max(appointments.length, 1) > 0.1 ? 'warning' : 'neutral'}
        />
        <KpiTile label="Conversion rate" value={`${conversionRate(leads)}%`} hint={`${leads.length} enquiries`} />
        {canSeeMoney ? (
          <KpiTile label="Revenue" value={formatMoney(revenue)} hint="from recorded visits" />
        ) : (
          <KpiTile label="Cancelled" value={cancelled} />
        )}
      </div>

      <Tabs
        ariaLabel="Report sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'patients', label: 'Patients' },
          { value: 'doctors', label: 'Doctors' },
          { value: 'appointments', label: 'Appointments' },
          { value: 'followups', label: 'Follow-ups' },
          { value: 'conversions', label: 'Conversions' },
        ]}
      />

      {tab === 'patients' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownCard
            title="New patients by source"
            description="Where the clinic's growth is actually coming from"
            rows={countBy(newPatients, (p) => LEAD_SOURCE_LABELS[p.source])}
            total={newPatients.length}
          />
          <BreakdownCard
            title="Patients by primary doctor"
            rows={countBy(
              patients.filter((p) => p.status === 'active'),
              (p) => userById(db, p.primaryDoctorId)?.name ?? 'Unassigned',
            )}
            total={patients.filter((p) => p.status === 'active').length}
          />
          <BreakdownCard
            title="Most common conditions"
            rows={countBy(
              patients.flatMap((p) => p.conditions),
              (c) => c,
            ).slice(0, 8)}
            total={patients.flatMap((p) => p.conditions).length}
          />
          <Card>
            <CardHeader title="Retention" description="Patients with more than one recorded visit" />
            <div className="mt-3">
              {(() => {
                const counts = new Map<string, number>()
                for (const t of db.treatments) {
                  counts.set(t.patientId, (counts.get(t.patientId) ?? 0) + 1)
                }
                const returning = [...counts.values()].filter((n) => n > 1).length
                const single = [...counts.values()].filter((n) => n === 1).length
                const rate = counts.size > 0 ? Math.round((returning / counts.size) * 100) : 0
                return (
                  <>
                    <p className="tnum text-3xl font-semibold">{rate}%</p>
                    <p className="mt-1 text-sm text-muted">
                      {returning} returning · {single} one-visit only
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-active">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${rate}%` }} />
                    </div>
                  </>
                )
              })()}
            </div>
          </Card>
        </div>
      )}

      {tab === 'doctors' && <DoctorTable treatments={treatments} appointments={appointments} canSeeMoney={canSeeMoney} />}

      {tab === 'appointments' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownCard
            title="Outcomes"
            description="How booked appointments actually ended"
            rows={[
              { label: 'Completed', value: completed },
              { label: 'No show', value: noShows },
              { label: 'Cancelled', value: cancelled },
              {
                label: 'Still scheduled',
                value: appointments.filter((a) => a.status === 'scheduled').length,
              },
            ]}
            total={appointments.length}
          />
          <BreakdownCard
            title="By treatment type"
            rows={countBy(appointments, (a) => treatmentTypeById(db, a.treatmentTypeId)?.name ?? '—')}
            total={appointments.length}
          />
          <BreakdownCard
            title="Booking channel"
            rows={countBy(appointments, (a) => (a.kind === 'walk_in' ? 'Walk-in' : 'Booked ahead'))}
            total={appointments.length}
          />
          <BreakdownCard
            title="Busiest days"
            rows={countBy(appointments, (a) =>
              new Date(a.startAt).toLocaleDateString('en-IN', { weekday: 'long' }),
            )}
            total={appointments.length}
          />
        </div>
      )}

      {tab === 'followups' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownCard
            title="Follow-up outcomes"
            description="Whether the automation is actually being acted on"
            rows={[
              { label: 'Completed', value: tasks.filter((t) => t.status === 'completed').length },
              {
                label: 'Open',
                value: tasks.filter((t) => t.status === 'open' && daysOverdue(t.dueAt) <= 0).length,
              },
              { label: 'Overdue', value: tasks.filter((t) => t.status === 'open' && daysOverdue(t.dueAt) > 0).length },
              { label: 'Snoozed', value: tasks.filter((t) => t.status === 'snoozed').length },
            ]}
            total={tasks.length}
          />
          <BreakdownCard
            title="By rule"
            description="Which rules generate the most work"
            rows={countBy(
              db.reminders.filter((r) => scopeBranches.includes(r.branchId)),
              (r) => db.reminderRules.find((rule) => rule.id === r.ruleId)?.name ?? 'Unknown',
            )}
            total={db.reminders.filter((r) => scopeBranches.includes(r.branchId)).length}
          />
          <Card>
            <CardHeader
              title="Escalations"
              description="Follow-ups that sat too long and were flagged"
            />
            <p className="tnum mt-3 text-3xl font-semibold text-danger">
              {tasks.filter((t) => t.escalated).length}
            </p>
            <p className="mt-1 text-sm text-muted">
              out of {tasks.filter((t) => t.origin === 'auto').length} auto-generated tasks
            </p>
          </Card>
          <BreakdownCard
            title="Completed by"
            rows={countBy(
              tasks.filter((t) => t.status === 'completed' && t.completedById),
              (t) => userById(db, t.completedById)?.name ?? 'Unknown',
            )}
            total={tasks.filter((t) => t.status === 'completed').length}
          />
        </div>
      )}

      {tab === 'conversions' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Enquiry funnel" description={`${leads.length} enquiries in this period`} />
            <div className="mt-3 flex flex-col gap-2">
              {leadFunnel(leads).map((step) => {
                const pct = leads.length > 0 ? Math.round((step.count / leads.length) * 100) : 0
                return (
                  <div key={step.stage}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{LEAD_STAGE_LABELS[step.stage]}</span>
                      <span className="tnum text-muted">
                        {step.count} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-active">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          step.stage === 'converted'
                            ? 'bg-success'
                            : step.stage === 'lost'
                              ? 'bg-danger'
                              : 'bg-brand',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <BreakdownCard
            title="Conversion by source"
            description="Which channels bring patients, not just enquiries"
            rows={countBy(
              leads.filter((l) => l.stage === 'converted'),
              (l) => LEAD_SOURCE_LABELS[l.source],
            )}
            total={leads.filter((l) => l.stage === 'converted').length}
          />

          <BreakdownCard
            title="Why enquiries are lost"
            rows={countBy(
              leads.filter((l) => l.stage === 'lost' && l.lostReason),
              (l) => l.lostReason!,
            )}
            total={leads.filter((l) => l.stage === 'lost').length}
          />

          <BreakdownCard
            title="Conversion by owner"
            rows={countBy(
              leads.filter((l) => l.stage === 'converted'),
              (l) => userById(db, l.ownerId)?.name ?? 'Unknown',
            )}
            total={leads.filter((l) => l.stage === 'converted').length}
          />
        </div>
      )}

      <SimulatedNote>
        Figures are computed live from the prototype's demo data. Export and scheduled reports are
        not connected.
      </SimulatedNote>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function BreakdownCard({
  title,
  description,
  rows,
  total,
}: {
  title: string
  description?: string
  rows: { label: string; value: number }[]
  total: number
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="mt-3 flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-subtle">No data in this period</p>
        ) : (
          rows.map((row) => {
            const pct = total > 0 ? Math.round((row.value / total) * 100) : 0
            return (
              <div key={row.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{row.label}</span>
                  <span className="tnum shrink-0 text-muted">
                    {row.value} · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-active">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

function DoctorTable({
  treatments,
  appointments,
  canSeeMoney,
}: {
  treatments: Treatment[]
  appointments: Appointment[]
  canSeeMoney: boolean
}) {
  const { db } = useApp()

  const rows = useMemo(() => {
    return db.users
      .filter((u) => u.role === 'doctor')
      .map((doctor) => {
        const theirTreatments = treatments.filter((t) => t.doctorId === doctor.id)
        const theirAppointments = appointments.filter((a) => a.doctorId === doctor.id)
        const noShows = theirAppointments.filter((a) => a.status === 'no_show').length
        return {
          doctor,
          visits: theirTreatments.length,
          booked: theirAppointments.length,
          noShows,
          noShowRate:
            theirAppointments.length > 0 ? Math.round((noShows / theirAppointments.length) * 100) : 0,
          patients: new Set(theirTreatments.map((t) => t.patientId)).size,
          revenue: revenueOf(db, theirTreatments),
        }
      })
      .filter((row) => row.booked > 0 || row.visits > 0)
  }, [db, treatments, appointments])

  type Row = (typeof rows)[number]

  const columns: Column<Row>[] = [
    {
      key: 'doctor',
      header: 'Doctor',
      sortBy: (r) => r.doctor.name,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.doctor.name}</p>
          <p className="text-xs text-muted">{row.doctor.specialisation}</p>
        </div>
      ),
    },
    {
      key: 'booked',
      header: 'Booked',
      align: 'right',
      sortBy: (r) => r.booked,
      cell: (row) => <span className="tnum">{row.booked}</span>,
    },
    {
      key: 'visits',
      header: 'Visits done',
      align: 'right',
      sortBy: (r) => r.visits,
      cell: (row) => <span className="tnum">{row.visits}</span>,
    },
    {
      key: 'patients',
      header: 'Unique patients',
      align: 'right',
      hideOnMobile: true,
      sortBy: (r) => r.patients,
      cell: (row) => <span className="tnum">{row.patients}</span>,
    },
    {
      key: 'noShow',
      header: 'No-show rate',
      align: 'right',
      sortBy: (r) => r.noShowRate,
      cell: (row) => (
        <Badge tone={row.noShowRate > 12 ? 'danger' : row.noShowRate > 6 ? 'warning' : 'success'} size="sm">
          {row.noShowRate}%
        </Badge>
      ),
    },
    ...(canSeeMoney
      ? [
          {
            key: 'revenue',
            header: 'Revenue',
            align: 'right' as const,
            sortBy: (r: Row) => r.revenue,
            cell: (row: Row) => <span className="tnum font-medium">{formatMoney(row.revenue)}</span>,
          },
        ]
      : []),
  ]

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.doctor.id}
      initialSort={{ key: 'visits', direction: 'desc' }}
      emptyState={{ title: 'No doctor activity', description: 'No visits recorded in this period.' }}
    />
  )
}
