import { useMemo, useState } from 'react'
import { CalendarOff, ChevronLeft, ChevronRight, Plane, Plus, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardHeader,
  Drawer,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  cn,
  useToast,
} from '@/design-system'
import { useApp, useCtx } from '@/data/store'
import {
  appointmentsOn,
  doctorsIn,
  patientById,
  scopedAppointments,
  staffIn,
  treatmentTypeById,
  userById,
} from '@/data/selectors'
import { createBlock, deleteBlock } from '@/data/actions'
import {
  addDays,
  formatDate,
  formatSlot,
  formatTime,
  isToday,
  startOfWeek,
  timeSlots,
  toISODate,
  todayISO,
} from '@/lib/dates'
import type { BlockKind } from '@/data/types'

type Lens = 'doctor' | 'reception' | 'branch'

/**
 * Part 14 — Calendar.
 *
 * Three lenses on the same week. The doctor lens is a per-column schedule,
 * the reception lens is the whole desk's day, and the branch lens shows
 * capacity, leave and blocked time together — because "who is actually here
 * next Tuesday" is a question reception asks constantly.
 */
export function CalendarPage() {
  const { db, branch, role, user, apply, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [lens, setLens] = useState<Lens>('doctor')
  const [anchor, setAnchor] = useState(() => todayISO())
  const [blocking, setBlocking] = useState(false)

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )
  const appointments = useMemo(() => scopedAppointments(db, scope), [db, scope])
  const doctors = useMemo(() => doctorsIn(db, branch.id), [db, branch.id])

  const weekStart = useMemo(() => startOfWeek(new Date(`${anchor}T12:00:00`)), [anchor])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const blocks = useMemo(
    () => db.blocks.filter((b) => b.branchId === branch.id),
    [db.blocks, branch.id],
  )

  const blocksOn = (day: Date, userId?: string) =>
    blocks.filter(
      (block) =>
        (userId ? block.userId === userId || !block.userId : true) &&
        toISODate(block.startAt) <= toISODate(day) &&
        toISODate(block.endAt) >= toISODate(day),
    )

  const step = (direction: 1 | -1) => setAnchor(toISODate(addDays(weekStart, direction * 7)))

  const slots = useMemo(
    () => timeSlots(branch.opensAt, branch.closesAt, 60),
    [branch.opensAt, branch.closesAt],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Calendar"
        description={`${branch.name} · ${formatDate(weekStart)} — ${formatDate(addDays(weekStart, 6))}`}
        actions={
          allows('calendar.manageBlocks') || allows('calendar.manageOwnLeave') ? (
            <Button variant="primary" icon={<Plus />} onClick={() => setBlocking(true)}>
              Block time
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ButtonGroup>
          <Button variant="secondary" size="icon" onClick={() => step(-1)} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" onClick={() => setAnchor(todayISO())}>
            This week
          </Button>
          <Button variant="secondary" size="icon" onClick={() => step(1)} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
        </ButtonGroup>

        <SegmentedControl
          ariaLabel="Calendar lens"
          value={lens}
          onChange={setLens}
          options={[
            { value: 'doctor', label: 'By doctor' },
            { value: 'reception', label: 'Reception' },
            { value: 'branch', label: 'Branch' },
          ]}
          className="ml-auto"
        />
      </div>

      {/* --- By doctor ----------------------------------------------------- */}
      {lens === 'doctor' && (
        <div className="flex flex-col gap-4">
          {doctors.length === 0 ? (
            <Card>
              <EmptyState title="No doctors at this branch" description="Add doctors in Settings." />
            </Card>
          ) : (
            doctors.map((doctor) => (
              <Card key={doctor.id} padded={false}>
                <div className="flex items-center justify-between border-b border-default px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{doctor.name}</p>
                    <p className="text-xs text-muted">{doctor.specialisation}</p>
                  </div>
                  <span className="tnum text-xs text-muted">
                    {
                      appointments.filter(
                        (a) =>
                          a.doctorId === doctor.id &&
                          a.status !== 'cancelled' &&
                          days.some((d) => toISODate(d) === toISODate(a.startAt)),
                      ).length
                    }{' '}
                    this week
                  </span>
                </div>

                <div className="grid grid-cols-7 divide-x divide-[var(--border)]">
                  {days.map((day) => {
                    const dayAppointments = appointmentsOn(appointments, day).filter(
                      (a) => a.doctorId === doctor.id && a.status !== 'cancelled',
                    )
                    const dayBlocks = blocksOn(day, doctor.id)

                    return (
                      <div
                        key={toISODate(day)}
                        className={cn('min-h-28 p-1.5', isToday(day) && 'bg-brand-bg/30')}
                      >
                        <p className="mb-1 text-2xs font-medium text-subtle">
                          {day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                        </p>

                        {dayBlocks.length > 0 ? (
                          dayBlocks.map((block) => (
                            <div
                              key={block.id}
                              className="mb-1 truncate rounded bg-warning-bg px-1.5 py-1 text-2xs text-warning-text"
                              title={block.reason}
                            >
                              {block.kind === 'leave' ? 'On leave' : block.reason}
                            </div>
                          ))
                        ) : dayAppointments.length === 0 ? (
                          <p className="text-2xs text-subtle">—</p>
                        ) : (
                          <ul className="flex flex-col gap-0.5">
                            {dayAppointments.slice(0, 3).map((appointment) => {
                              const patient = patientById(db, appointment.patientId)
                              return (
                                <li
                                  key={appointment.id}
                                  className="truncate rounded bg-brand-bg px-1.5 py-0.5 text-2xs text-brand-text"
                                >
                                  <span className="tnum">{formatTime(appointment.startAt)}</span>{' '}
                                  {patient?.name.split(' ')[0]}
                                </li>
                              )
                            })}
                            {dayAppointments.length > 3 && (
                              <li className="px-1.5 text-2xs text-muted">
                                +{dayAppointments.length - 3}
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* --- Reception ----------------------------------------------------- */}
      {lens === 'reception' && (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface-sunken">
              <tr>
                <th className="w-20 border-b border-default px-2 py-2 text-left text-xs font-medium text-muted">
                  Time
                </th>
                {days.map((day) => (
                  <th
                    key={toISODate(day)}
                    className={cn(
                      'border-b border-l border-default px-2 py-2 text-left text-xs font-medium',
                      isToday(day) ? 'text-brand' : 'text-muted',
                    )}
                  >
                    {day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot}>
                  <td className="tnum border-b border-default px-2 py-1.5 align-top text-2xs text-subtle">
                    {formatSlot(slot)}
                  </td>
                  {days.map((day) => {
                    const hour = Number(slot.split(':')[0])
                    const inSlot = appointmentsOn(appointments, day).filter((a) => {
                      const start = new Date(a.startAt)
                      return start.getHours() === hour && a.status !== 'cancelled'
                    })

                    return (
                      <td
                        key={toISODate(day)}
                        className={cn(
                          'border-b border-l border-default p-1 align-top',
                          isToday(day) && 'bg-brand-bg/20',
                        )}
                      >
                        {inSlot.map((appointment) => {
                          const patient = patientById(db, appointment.patientId)
                          const type = treatmentTypeById(db, appointment.treatmentTypeId)
                          return (
                            <div
                              key={appointment.id}
                              className="mb-0.5 truncate rounded px-1.5 py-0.5 text-2xs"
                              style={{
                                backgroundColor: `var(--${type?.colour ?? 'brand'}-bg)`,
                                color: `var(--${type?.colour ?? 'brand'}-text)`,
                              }}
                              title={`${patient?.name} · ${type?.name} · ${userById(db, appointment.doctorId)?.name}`}
                            >
                              {patient?.name.split(' ')[0]}
                            </div>
                          )
                        })}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* --- Branch -------------------------------------------------------- */}
      {lens === 'branch' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card padded={false}>
            <div className="grid grid-cols-7 divide-x divide-[var(--border)]">
              {days.map((day) => {
                const dayAppointments = appointmentsOn(appointments, day).filter(
                  (a) => a.status !== 'cancelled',
                )
                const closed = branch.closedDays.includes(day.getDay())
                const dayBlocks = blocksOn(day)
                const capacity = doctors.length * slots.length
                const load = capacity > 0 ? Math.round((dayAppointments.length / capacity) * 100) : 0

                return (
                  <div
                    key={toISODate(day)}
                    className={cn(
                      'min-h-40 p-2',
                      isToday(day) && 'bg-brand-bg/30',
                      closed && 'bg-surface-sunken',
                    )}
                  >
                    <p className="text-2xs font-semibold text-subtle uppercase">
                      {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </p>
                    <p className={cn('tnum text-lg font-semibold', isToday(day) && 'text-brand')}>
                      {day.getDate()}
                    </p>

                    {closed ? (
                      <Badge tone="neutral" size="sm">
                        Closed
                      </Badge>
                    ) : (
                      <>
                        <p className="tnum mt-1 text-xs text-muted">
                          {dayAppointments.length} booked
                        </p>
                        <div
                          className="mt-1 h-1 overflow-hidden rounded-full bg-surface-active"
                          title={`${load}% of capacity`}
                        >
                          <div
                            className={cn(
                              'h-full rounded-full',
                              load > 80 ? 'bg-danger' : load > 50 ? 'bg-warning' : 'bg-success',
                            )}
                            style={{ width: `${Math.min(load, 100)}%` }}
                          />
                        </div>
                      </>
                    )}

                    {dayBlocks.map((block) => (
                      <p
                        key={block.id}
                        className="mt-1 truncate rounded bg-warning-bg px-1 py-0.5 text-2xs text-warning-text"
                        title={block.reason}
                      >
                        {block.reason}
                      </p>
                    ))}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Leave & blocked time" description="Upcoming, across this branch" />
            <div className="mt-3">
              {blocks.length === 0 ? (
                <EmptyState
                  title="Nothing blocked"
                  description="Leave and blocked time appear here."
                  icon={CalendarOff}
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {[...blocks]
                    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
                    .map((block) => (
                      <li
                        key={block.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-default px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{block.reason}</p>
                          <p className="text-xs text-muted">
                            {block.userId ? userById(db, block.userId)?.name : 'Whole branch'} ·{' '}
                            {formatDate(block.startAt)}
                            {toISODate(block.startAt) !== toISODate(block.endAt) &&
                              ` — ${formatDate(block.endAt)}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge
                            tone={block.kind === 'leave' ? 'info' : block.kind === 'holiday' ? 'accent' : 'warning'}
                            size="sm"
                          >
                            {block.kind}
                          </Badge>
                          {allows('calendar.manageBlocks') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${block.reason}`}
                              onClick={() => {
                                apply((db) => deleteBlock(db, ctx, block.id))
                                toast.undoable('Block removed', () => {})
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}

      <BlockTimeDrawer open={blocking} onClose={() => setBlocking(false)} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function BlockTimeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, branch, user, apply, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const canBlockOthers = allows('calendar.manageBlocks')
  const [userId, setUserId] = useState(user.id)
  const [kind, setKind] = useState<BlockKind>('leave')
  const [reason, setReason] = useState('')
  const [start, setStart] = useState(todayISO())
  const [end, setEnd] = useState(todayISO())
  const [error, setError] = useState('')

  const submit = () => {
    if (!reason.trim()) return setError('Say what the time is for')
    if (end < start) return setError('The end date cannot be before the start date')

    apply((db) =>
      createBlock(db, ctx, {
        userId: kind === 'holiday' ? undefined : userId || undefined,
        branchId: branch.id,
        kind,
        reason: reason.trim(),
        startAt: new Date(`${start}T00:00:00`).toISOString(),
        endAt: new Date(`${end}T23:59:59`).toISOString(),
      }),
    )
    onClose()
    setReason('')
    setError('')
    toast.success('Time blocked')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Block time"
      description="Leave, holidays, or time that should not be bookable"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Block time
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

        <Field label="Type">
          {({ id }) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as BlockKind)}>
              <option value="leave">Leave</option>
              <option value="blocked">Blocked time</option>
              {canBlockOthers && <option value="holiday">Clinic holiday</option>}
            </Select>
          )}
        </Field>

        {kind !== 'holiday' && (
          <Field label="Who">
            {({ id }) => (
              <Select
                id={id}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={!canBlockOthers}
              >
                {(canBlockOthers ? staffIn(db, branch.id) : [user]).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.id === user.id ? ' (you)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Field label="Reason" required>
          {({ id }) => (
            <Input
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={kind === 'leave' ? 'e.g. Annual leave' : 'e.g. Conference'}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" required>
            {({ id }) => <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}
          </Field>
          <Field label="To" required>
            {({ id }) => <Input id={id} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />}
          </Field>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">
          <Plane aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Existing appointments in this range are not cancelled automatically — reception is warned
          when booking into blocked time, and you can reschedule affected patients from the
          appointments list.
        </p>
      </div>
    </Drawer>
  )
}
