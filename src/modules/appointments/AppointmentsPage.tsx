import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  Ban,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  MoreHorizontal,
  Play,
  Stethoscope,
  UserPlus,
} from 'lucide-react'
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  EmptyState,
  Menu,
  PageHeader,
  SegmentedControl,
  Select,
  cn,
  useToast,
} from '@/design-system'
import { AppointmentStatusBadge, PatientCell } from '@/components/common'
import { useApp, useCtx } from '@/data/store'
import {
  appointmentsBetween,
  appointmentsOn,
  doctorsIn,
  patientById,
  scopedAppointments,
  treatmentTypeById,
  userById,
} from '@/data/selectors'
import { checkInAppointment, markNoShow, startAppointment } from '@/data/actions'
import {
  addDays,
  endOfMonth,
  formatDate,
  formatFullDate,
  formatMonth,
  formatTime,
  formatWeekday,
  isToday,
  startOfMonth,
  startOfWeek,
  toISODate,
  todayISO,
} from '@/lib/dates'
import type { Appointment, AppointmentStatus } from '@/data/types'
import { BookAppointmentDrawer } from './BookAppointmentDrawer'
import { CancelAppointmentDialog } from './CancelAppointmentDialog'
import { RescheduleDrawer } from './RescheduleDrawer'
import { RecordTreatmentDrawer } from '@/modules/treatments/RecordTreatmentDrawer'

type View = 'day' | 'week' | 'month'

/**
 * Part 7 — Appointments.
 *
 * Day view is the default because it is the one reception actually works from;
 * week and month exist for planning. Every status transition in the lifecycle
 * (scheduled → checked in → in progress → completed, plus no-show, cancel and
 * reschedule) is reachable from the row without leaving the list.
 */
export function AppointmentsPage() {
  const { db, branch, role, user, apply, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [view, setView] = useState<View>('day')
  const [anchor, setAnchor] = useState(() => todayISO())
  const [doctorFilter, setDoctorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('')
  const [booking, setBooking] = useState(false)
  const [walkIn, setWalkIn] = useState(false)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null)
  const [recordingFor, setRecordingFor] = useState<Appointment | null>(null)

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )
  const all = useMemo(() => scopedAppointments(db, scope), [db, scope])

  const range = useMemo(() => {
    const date = new Date(`${anchor}T12:00:00`)
    if (view === 'day') return { from: date, to: date }
    if (view === 'week') return { from: startOfWeek(date), to: addDays(startOfWeek(date), 6) }
    return { from: startOfMonth(date), to: endOfMonth(date) }
  }, [anchor, view])

  const visible = useMemo(() => {
    let rows = appointmentsBetween(all, range.from, range.to)
    if (doctorFilter) rows = rows.filter((a) => a.doctorId === doctorFilter)
    if (statusFilter) rows = rows.filter((a) => a.status === statusFilter)
    return rows
  }, [all, range, doctorFilter, statusFilter])

  const step = (direction: 1 | -1) => {
    const date = new Date(`${anchor}T12:00:00`)
    const days = view === 'day' ? 1 : view === 'week' ? 7 : 0
    if (view === 'month') {
      date.setMonth(date.getMonth() + direction)
      setAnchor(toISODate(date))
    } else {
      setAnchor(toISODate(addDays(date, direction * days)))
    }
  }

  const rangeLabel =
    view === 'day'
      ? isToday(range.from)
        ? `Today · ${formatFullDate(range.from)}`
        : formatFullDate(range.from)
      : view === 'week'
        ? `${formatDate(range.from)} — ${formatDate(range.to)}`
        : formatMonth(range.from)

  // Deep link from search: ?appointment=<id> jumps to that day.
  const focused = params.get('appointment')
  useMemo(() => {
    if (!focused) return
    const target = db.appointments.find((a) => a.id === focused)
    if (target) {
      setAnchor(toISODate(target.startAt))
      setView('day')
      const next = new URLSearchParams(params)
      next.delete('appointment')
      setParams(next, { replace: true })
    }
  }, [focused, db.appointments, params, setParams])

  const counts = useMemo(
    () => ({
      total: visible.filter((a) => a.status !== 'cancelled').length,
      completed: visible.filter((a) => a.status === 'completed').length,
      waiting: visible.filter((a) => a.status === 'checked_in' || a.status === 'in_progress').length,
      noShow: visible.filter((a) => a.status === 'no_show').length,
    }),
    [visible],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Appointments"
        description={`${counts.total} booked · ${counts.completed} completed · ${counts.waiting} in clinic${counts.noShow > 0 ? ` · ${counts.noShow} no-show` : ''}`}
        actions={
          allows('appointments.create') ? (
            <>
              <Button
                variant="secondary"
                icon={<UserPlus />}
                onClick={() => {
                  setWalkIn(true)
                  setBooking(true)
                }}
              >
                Walk-in
              </Button>
              <Button
                variant="primary"
                icon={<CalendarPlus />}
                onClick={() => {
                  setWalkIn(false)
                  setBooking(true)
                }}
              >
                Book appointment
              </Button>
            </>
          ) : undefined
        }
      />

      {/* --- Controls ------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2">
        <ButtonGroup>
          <Button variant="secondary" size="icon" onClick={() => step(-1)} aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" onClick={() => setAnchor(todayISO())}>
            Today
          </Button>
          <Button variant="secondary" size="icon" onClick={() => step(1)} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
        </ButtonGroup>

        <p className="text-sm font-medium">{rangeLabel}</p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            aria-label="Filter by doctor"
            className="w-auto min-w-36"
          >
            <option value="">All doctors</option>
            {doctorsIn(db, branch.id).map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | '')}
            aria-label="Filter by status"
            className="w-auto min-w-32"
          >
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="checked_in">Checked in</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="no_show">No show</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          <SegmentedControl
            ariaLabel="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        </div>
      </div>

      {/* --- Views --------------------------------------------------------- */}
      {view === 'month' ? (
        <MonthGrid
          anchor={range.from}
          appointments={visible}
          onPickDay={(date) => {
            setAnchor(date)
            setView('day')
          }}
        />
      ) : view === 'week' ? (
        <WeekGrid
          from={range.from}
          appointments={visible}
          onPickDay={(date) => {
            setAnchor(date)
            setView('day')
          }}
        />
      ) : (
        <Card padded={false}>
          {visible.length === 0 ? (
            <EmptyState
              title="Nothing booked"
              description={
                doctorFilter || statusFilter
                  ? 'No appointments match these filters on this day.'
                  : 'This day has no appointments yet.'
              }
              action={
                allows('appointments.create') ? (
                  <Button
                    size="sm"
                    icon={<CalendarPlus />}
                    onClick={() => {
                      setWalkIn(false)
                      setBooking(true)
                    }}
                  >
                    Book appointment
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {visible.map((appointment) => {
                const patient = patientById(db, appointment.patientId)
                const type = treatmentTypeById(db, appointment.treatmentTypeId)
                const doctor = userById(db, appointment.doctorId)
                if (!patient) return null

                return (
                  <li
                    key={appointment.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3 px-4 py-3',
                      appointment.status === 'cancelled' && 'opacity-55',
                    )}
                  >
                    <div className="w-20 shrink-0">
                      <p className="tnum text-sm font-semibold">{formatTime(appointment.startAt)}</p>
                      <p className="tnum text-2xs text-subtle">{type?.durationMinutes} min</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <PatientCell
                        patient={patient}
                        secondary={`${type?.name ?? ''} · ${doctor?.name ?? 'Unassigned'}${appointment.reason ? ` · ${appointment.reason}` : ''}`}
                      />
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      {appointment.kind === 'walk_in' && (
                        <Badge tone="accent" size="sm">
                          Walk-in
                        </Badge>
                      )}
                      <AppointmentStatusBadge status={appointment.status} size="sm" />
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {appointment.status === 'scheduled' && allows('appointments.edit') && (
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

                      {appointment.status === 'checked_in' && allows('appointments.edit') && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Play />}
                          onClick={() => {
                            apply((db) => startAppointment(db, ctx, appointment.id))
                            toast.success(`Started with ${patient.name}`)
                          }}
                        >
                          Start
                        </Button>
                      )}

                      {(appointment.status === 'in_progress' || appointment.status === 'checked_in') &&
                        allows('treatments.create') && (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<Stethoscope />}
                            onClick={() => setRecordingFor(appointment)}
                          >
                            Record visit
                          </Button>
                        )}

                      {appointment.status === 'completed' && appointment.treatmentId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/patients/${patient.id}?tab=treatments`)}
                        >
                          View record
                        </Button>
                      )}

                      <Menu
                        label={`Actions for ${patient.name}`}
                        items={[
                          {
                            label: 'Open patient record',
                            onSelect: () => navigate(`/patients/${patient.id}`),
                          },
                          ...(allows('appointments.edit') &&
                          appointment.status !== 'cancelled' &&
                          appointment.status !== 'completed'
                            ? [
                                {
                                  label: 'Reschedule',
                                  icon: <Clock />,
                                  separated: true,
                                  onSelect: () => setRescheduling(appointment),
                                },
                                {
                                  label: 'Mark as no-show',
                                  icon: <Ban />,
                                  onSelect: () => {
                                    apply((db) => markNoShow(db, ctx, appointment.id))
                                    toast.undoable(`${patient.name} marked as no-show`, () => {
                                      apply((db) => checkInAppointment(db, ctx, appointment.id))
                                    })
                                  },
                                },
                              ]
                            : []),
                          ...(allows('appointments.cancel') &&
                          appointment.status !== 'cancelled' &&
                          appointment.status !== 'completed'
                            ? [
                                {
                                  label: 'Cancel appointment',
                                  destructive: true,
                                  onSelect: () => setCancelling(appointment),
                                },
                              ]
                            : []),
                        ]}
                        trigger={({ toggle, open }) => (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggle}
                            aria-expanded={open}
                            aria-label={`More actions for ${patient.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        )}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      <BookAppointmentDrawer
        open={booking}
        onClose={() => setBooking(false)}
        presetDate={anchor}
        walkIn={walkIn}
      />
      <CancelAppointmentDialog appointment={cancelling} onClose={() => setCancelling(null)} />
      <RescheduleDrawer appointment={rescheduling} onClose={() => setRescheduling(null)} />
      <RecordTreatmentDrawer
        open={Boolean(recordingFor)}
        onClose={() => setRecordingFor(null)}
        patientId={recordingFor?.patientId ?? ''}
        appointment={recordingFor ?? undefined}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function WeekGrid({
  from,
  appointments,
  onPickDay,
}: {
  from: Date
  appointments: Appointment[]
  onPickDay: (date: string) => void
}) {
  const { db } = useApp()
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))

  return (
    <div className="grid gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const iso = toISODate(day)
        const dayAppointments = appointmentsOn(appointments, day)
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onPickDay(iso)}
            className={cn(
              'flex min-h-32 cursor-pointer flex-col rounded-xl border border-default bg-surface p-2 text-left',
              'transition-colors hover:border-strong hover:bg-surface-hover',
              isToday(day) && 'border-brand ring-1 ring-brand/30',
            )}
          >
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-2xs font-semibold tracking-wide text-subtle uppercase">
                {formatWeekday(day)}
              </span>
              <span className={cn('tnum text-sm font-semibold', isToday(day) && 'text-brand')}>
                {day.getDate()}
              </span>
            </div>

            {dayAppointments.length === 0 ? (
              <p className="text-2xs text-subtle">—</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {dayAppointments.slice(0, 4).map((appointment) => {
                  const patient = patientById(db, appointment.patientId)
                  const type = treatmentTypeById(db, appointment.treatmentTypeId)
                  return (
                    <li
                      key={appointment.id}
                      className={cn(
                        'truncate rounded px-1.5 py-0.5 text-2xs',
                        appointment.status === 'cancelled'
                          ? 'bg-surface-sunken text-subtle line-through'
                          : `bg-${type?.colour ?? 'brand'}-bg text-${type?.colour ?? 'brand'}-text`,
                      )}
                      style={
                        type
                          ? {
                              backgroundColor: `var(--${type.colour}-bg)`,
                              color: `var(--${type.colour}-text)`,
                            }
                          : undefined
                      }
                    >
                      <span className="tnum">{formatTime(appointment.startAt)}</span>{' '}
                      {patient?.name.split(' ')[0]}
                    </li>
                  )
                })}
                {dayAppointments.length > 4 && (
                  <li className="px-1.5 text-2xs font-medium text-muted">
                    +{dayAppointments.length - 4} more
                  </li>
                )}
              </ul>
            )}
          </button>
        )
      })}
    </div>
  )
}

function MonthGrid({
  anchor,
  appointments,
  onPickDay,
}: {
  anchor: Date
  appointments: Appointment[]
  onPickDay: (date: string) => void
}) {
  const first = startOfMonth(anchor)
  const gridStart = startOfWeek(first)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-default bg-surface-sunken">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <div key={label} className="px-2 py-1.5 text-center text-2xs font-semibold text-muted">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const iso = toISODate(day)
          const outside = day.getMonth() !== anchor.getMonth()
          const dayAppointments = appointmentsOn(appointments, day)
          const completed = dayAppointments.filter((a) => a.status === 'completed').length

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDay(iso)}
              className={cn(
                'flex min-h-20 cursor-pointer flex-col items-start gap-1 border-r border-b border-default p-1.5 text-left',
                'transition-colors hover:bg-surface-hover',
                outside && 'bg-surface-sunken/50 text-subtle',
                isToday(day) && 'bg-brand-bg/40',
              )}
            >
              <span
                className={cn(
                  'tnum text-xs font-medium',
                  isToday(day) && 'grid size-5 place-items-center rounded-full bg-brand text-brand-fg',
                )}
              >
                {day.getDate()}
              </span>

              {dayAppointments.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  <Badge tone="brand" size="sm">
                    {dayAppointments.length}
                  </Badge>
                  {completed > 0 && (
                    <Badge tone="success" size="sm">
                      {completed} done
                    </Badge>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
