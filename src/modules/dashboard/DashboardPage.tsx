import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  ClipboardList,
  Clock,
  ListChecks,
  LogIn,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  KpiTile,
  PageHeader,
  useToast,
} from '@/design-system'
import {
  AppointmentStatusBadge,
  DueBadge,
  PatientCell,
  SectionTitle,
} from '@/components/common'
import { useApp, useCtx } from '@/data/store'
import {
  appointmentsOn,
  dashboardKpis,
  dueTodayTasks,
  myTasks,
  overdueTasks,
  patientById,
  scopedAppointments,
  scopedLeads,
  scopedTasks,
  treatmentTypeById,
  userById,
  waitingNow,
} from '@/data/selectors'
import { checkInAppointment } from '@/data/actions'
import { addDays, formatFullDate, formatRelativeTime, formatTime } from '@/lib/dates'
import { NewPatientDrawer } from '@/modules/patients/NewPatientDrawer'
import { BookAppointmentDrawer } from '@/modules/appointments/BookAppointmentDrawer'
import { NewLeadDrawer } from '@/modules/leads/NewLeadDrawer'

/**
 * Part 5 — Dashboard.
 *
 * Answers one question on open: what needs me today? KPIs sit above three
 * work queues — the waiting room, the day's schedule, and overdue follow-ups
 * — because those are the three ways a clinic loses a patient.
 */
export function DashboardPage() {
  const { db, user, role, branch, apply, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const navigate = useNavigate()

  const [newPatientOpen, setNewPatientOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [newLeadOpen, setNewLeadOpen] = useState(false)

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )

  const kpis = useMemo(() => dashboardKpis(db, scope), [db, scope])
  const appointments = useMemo(() => scopedAppointments(db, scope), [db, scope])
  const today = useMemo(() => appointmentsOn(appointments, new Date()), [appointments])
  const waiting = useMemo(() => waitingNow(today), [today])
  const tasks = useMemo(() => scopedTasks(db, scope), [db, scope])
  const mine = useMemo(() => myTasks(tasks, user.id), [tasks, user.id])
  // Kept separate rather than falling back from one to the other: a panel that
  // silently switches scope is what made "nothing overdue" sit next to a KPI
  // reading 76.
  const overdue = useMemo(() => overdueTasks(mine), [mine])
  const dueToday = useMemo(() => dueTodayTasks(mine), [mine])
  const branchOverdue = useMemo(() => overdueTasks(tasks), [tasks])
  const leads = useMemo(() => scopedLeads(db, scope), [db, scope])

  const remainingToday = today.filter((a) => a.status === 'scheduled')
  // Once the clinic day is done, reception's question becomes "what's tomorrow?"
  const tomorrow = useMemo(
    () => appointmentsOn(appointments, addDays(new Date(), 1)).filter((a) => a.status === 'scheduled'),
    [appointments],
  )
  const showingTomorrow = remainingToday.length === 0 && tomorrow.length > 0
  const upNext = (showingTomorrow ? tomorrow : remainingToday).slice(0, 6)

  const firstName = user.name.replace(/^Dr\.?\s+/, '').split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Good ${greeting()}, ${firstName}`}
        description={`${formatFullDate(new Date())} · ${branch.name}`}
        actions={
          <>
            {allows('patients.create') && (
              <Button variant="secondary" icon={<UserPlus />} onClick={() => setNewPatientOpen(true)}>
                New patient
              </Button>
            )}
            {allows('leads.create') && (
              <Button variant="secondary" icon={<ClipboardList />} onClick={() => setNewLeadOpen(true)}>
                New enquiry
              </Button>
            )}
            {allows('appointments.create') && (
              <Button variant="primary" icon={<CalendarPlus />} onClick={() => setBookOpen(true)}>
                Book appointment
              </Button>
            )}
          </>
        }
      />

      {/* --- KPIs ---------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          label="Today's appointments"
          value={kpis.todayTotal}
          delta={{ value: kpis.appointmentsDelta, goodWhen: 'up', label: 'vs. last week' }}
          icon={<Clock />}
          to="/appointments"
        />
        <KpiTile
          label="In the clinic now"
          value={kpis.todayWaiting}
          hint={`${kpis.todayCompleted} completed`}
          icon={<Users />}
          to="/appointments"
        />
        <KpiTile
          label="Overdue follow-ups"
          value={kpis.overdueFollowUps}
          hint={`${kpis.dueTodayFollowUps} due today`}
          icon={<AlertTriangle />}
          tone={kpis.overdueFollowUps > 0 ? 'danger' : 'neutral'}
          to="/tasks"
        />
        <KpiTile
          label="Open enquiries"
          value={kpis.openLeads}
          icon={<ClipboardList />}
          to="/leads"
        />
        <KpiTile
          label="New patients this week"
          value={kpis.newPatientsThisWeek}
          delta={{ value: kpis.noShowRate, goodWhen: 'down', label: `${kpis.noShowRate}% no-show rate` }}
          icon={<UserRound />}
          to="/patients"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Waiting room ------------------------------------------------ */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="In the clinic now"
            description="Checked in and waiting to be seen"
            action={
              <Button variant="ghost" size="sm" iconRight={<ArrowRight />} onClick={() => navigate('/appointments')}>
                All appointments
              </Button>
            }
          />

          <div className="mt-3">
            {waiting.length === 0 ? (
              <EmptyState
                title="Nobody is waiting"
                description="Patients appear here the moment reception checks them in."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {waiting.map((appointment) => {
                  const patient = patientById(db, appointment.patientId)
                  const type = treatmentTypeById(db, appointment.treatmentTypeId)
                  const doctor = userById(db, appointment.doctorId)
                  if (!patient) return null

                  return (
                    <li key={appointment.id} className="flex items-center gap-3 py-2.5">
                      <Link to={`/patients/${patient.id}`} className="min-w-0 flex-1">
                        <PatientCell
                          patient={patient}
                          secondary={`${type?.name ?? ''} · ${doctor?.name ?? 'Unassigned'}`}
                        />
                      </Link>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="tnum text-sm font-medium">{formatTime(appointment.startAt)}</p>
                        {appointment.checkedInAt && (
                          <p className="text-2xs text-subtle">
                            in {formatRelativeTime(appointment.checkedInAt)}
                          </p>
                        )}
                      </div>
                      <AppointmentStatusBadge status={appointment.status} size="sm" />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* --- My work ----------------------------------------------------- */}
        <Card>
          <CardHeader
            title="Needs you"
            description={
              overdue.length > 0 ? `${overdue.length} overdue` : 'Assigned to you'
            }
            action={
              <Button variant="ghost" size="sm" iconRight={<ArrowRight />} onClick={() => navigate('/tasks')}>
                Tasks
              </Button>
            }
          />

          <div className="mt-3 flex flex-col gap-4">
            <div>
              <SectionTitle>Overdue</SectionTitle>
              {overdue.length === 0 ? (
                <p className="py-3 text-sm text-subtle">
                  Nothing overdue is assigned to you.
                  {branchOverdue.length > 0 && (
                    <>
                      {' '}
                      <Link to="/tasks" className="font-medium text-brand hover:underline">
                        {branchOverdue.length} overdue across {branch.name}
                      </Link>
                    </>
                  )}
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {overdue.slice(0, 5).map((task) => (
                    <li key={task.id}>
                      <Link
                        to="/tasks"
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-hover"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{task.title}</span>
                          {task.escalated && (
                            <Badge tone="danger" size="sm" className="mt-0.5">
                              Escalated
                            </Badge>
                          )}
                        </span>
                        <DueBadge task={task} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <SectionTitle>Due today</SectionTitle>
              {dueToday.length === 0 ? (
                <p className="py-3 text-sm text-subtle">Nothing of yours is due today.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {dueToday.slice(0, 4).map((task) => (
                    <li key={task.id}>
                      <Link
                        to="/tasks"
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-hover"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                        <DueBadge task={task} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Up next ----------------------------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={showingTomorrow ? 'Up next — tomorrow' : 'Up next today'}
            description={
              showingTomorrow
                ? `Today is finished. ${tomorrow.length} booked tomorrow.`
                : `${remainingToday.length} still to arrive`
            }
          />

          <div className="mt-3">
            {upNext.length === 0 ? (
              <EmptyState
                title="The day is done"
                description="Nothing left today and nothing booked tomorrow yet."
                action={
                  allows('appointments.create') ? (
                    <Button size="sm" icon={<CalendarPlus />} onClick={() => setBookOpen(true)}>
                      Book appointment
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {upNext.map((appointment) => {
                  const patient = patientById(db, appointment.patientId)
                  const type = treatmentTypeById(db, appointment.treatmentTypeId)
                  if (!patient) return null

                  return (
                    <li key={appointment.id} className="flex items-center gap-3 py-2.5">
                      <span className="tnum w-16 shrink-0 text-sm font-medium text-muted">
                        {formatTime(appointment.startAt)}
                      </span>
                      <Link to={`/patients/${patient.id}`} className="min-w-0 flex-1">
                        <PatientCell
                          patient={patient}
                          showAvatar={false}
                          secondary={type?.name}
                        />
                      </Link>
                      {/* Check-in only makes sense for someone arriving today. */}
                      {allows('appointments.edit') && !showingTomorrow && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<LogIn />}
                          onClick={() => {
                            apply((db) => checkInAppointment(db, ctx, appointment.id))
                            toast.success(`${patient.name} checked in`)
                          }}
                        >
                          Check in
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* --- Enquiries needing chase -------------------------------------- */}
        <Card>
          <CardHeader
            title="Enquiries to chase"
            action={
              <Button variant="ghost" size="sm" iconRight={<ArrowRight />} onClick={() => navigate('/leads')}>
                Leads
              </Button>
            }
          />
          <div className="mt-3">
            {(() => {
              const chase = leads
                .filter((l) => l.stage !== 'converted' && l.stage !== 'lost' && l.nextFollowUpAt)
                .sort((a, b) => (a.nextFollowUpAt! < b.nextFollowUpAt! ? -1 : 1))
                .slice(0, 6)

              if (chase.length === 0) {
                return (
                  <EmptyState
                    title="No enquiries waiting"
                    description="New enquiries appear here with a follow-up date."
                    icon={ListChecks}
                  />
                )
              }

              return (
                <ul className="flex flex-col gap-1">
                  {chase.map((lead) => (
                    <li key={lead.id}>
                      <Link
                        to={`/leads?lead=${lead.id}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-hover"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{lead.name}</span>
                          <span className="block truncate text-xs text-muted">{lead.phone}</span>
                        </span>
                        <DueBadge
                          task={{ dueAt: lead.nextFollowUpAt!, status: 'open' }}
                          size="sm"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </div>
        </Card>
      </div>

      <NewPatientDrawer open={newPatientOpen} onClose={() => setNewPatientOpen(false)} />
      <BookAppointmentDrawer open={bookOpen} onClose={() => setBookOpen(false)} />
      <NewLeadDrawer open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
    </div>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}
