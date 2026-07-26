import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Search, UserPlus } from 'lucide-react'
import {
  Badge,
  Button,
  Drawer,
  Field,
  Input,
  Select,
  Textarea,
  cn,
  useToast,
} from '@/design-system'
import { bookAppointment } from '@/data/actions'
import { useApp, useCtx } from '@/data/store'
import { appointmentsOn, doctorsIn, scopedAppointments } from '@/data/selectors'
import {
  addMinutes,
  formatSlot,
  fromDateAndTime,
  timeSlots,
  todayISO,
  toISODate,
} from '@/lib/dates'
import { NewPatientDrawer } from '@/modules/patients/NewPatientDrawer'

/**
 * Part 7 — Booking.
 *
 * Reception's core loop. Patient first, then treatment, then a slot grid that
 * shows what is already taken — booking blind into a clashing slot is the
 * fastest way to lose the room's trust in the system.
 */
export function BookAppointmentDrawer({
  open,
  onClose,
  presetPatientId,
  presetDate,
  presetTime,
  presetDoctorId,
  walkIn = false,
}: {
  open: boolean
  onClose: () => void
  presetPatientId?: string
  presetDate?: string
  presetTime?: string
  presetDoctorId?: string
  walkIn?: boolean
}) {
  const { db, branch, role, user, applyWith, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [patientQuery, setPatientQuery] = useState('')
  const [patientId, setPatientId] = useState(presetPatientId ?? '')
  const [doctorId, setDoctorId] = useState(presetDoctorId ?? '')
  const [treatmentTypeId, setTreatmentTypeId] = useState('')
  const [date, setDate] = useState(presetDate ?? todayISO())
  const [time, setTime] = useState(presetTime ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [newPatientOpen, setNewPatientOpen] = useState(false)

  const doctors = useMemo(() => doctorsIn(db, branch.id), [db, branch.id])
  const types = useMemo(() => db.treatmentTypes.filter((t) => t.active), [db.treatmentTypes])

  useEffect(() => {
    if (!open) return
    setPatientId(presetPatientId ?? '')
    setPatientQuery('')
    setDoctorId(presetDoctorId ?? doctors[0]?.id ?? '')
    setTreatmentTypeId(types[0]?.id ?? '')
    setDate(presetDate ?? todayISO())
    setTime(presetTime ?? '')
    setReason('')
    setError('')
  }, [open, presetPatientId, presetDoctorId, presetDate, presetTime, doctors, types])

  const patient = db.patients.find((p) => p.id === patientId)
  const type = db.treatmentTypes.find((t) => t.id === treatmentTypeId)

  const matches = useMemo(() => {
    const needle = patientQuery.trim().toLowerCase()
    if (!needle) return []
    return db.patients
      .filter(
        (p) =>
          p.status === 'active' &&
          (p.name.toLowerCase().includes(needle) ||
            p.code.toLowerCase().includes(needle) ||
            p.phone.replace(/\s/g, '').includes(needle.replace(/\s/g, ''))),
      )
      .slice(0, 6)
  }, [db.patients, patientQuery])

  /* Slot availability for the chosen doctor and day. */
  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id, allBranches: false }),
    [branch.id, role, user.id],
  )
  const dayAppointments = useMemo(
    () =>
      appointmentsOn(scopedAppointments(db, scope), date).filter(
        (a) => a.doctorId === doctorId && a.status !== 'cancelled',
      ),
    [db, scope, date, doctorId],
  )

  const slots = useMemo(() => timeSlots(branch.opensAt, branch.closesAt, 30), [branch])

  const takenSlots = useMemo(() => {
    const taken = new Set<string>()
    for (const appointment of dayAppointments) {
      const start = new Date(appointment.startAt)
      const end = new Date(appointment.endAt)
      for (let t = new Date(start); t < end; t = addMinutes(t, 30)) {
        taken.add(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`)
      }
    }
    return taken
  }, [dayAppointments])

  const blocked = useMemo(
    () =>
      db.blocks.some(
        (block) =>
          (block.userId === doctorId || !block.userId) &&
          block.branchId === branch.id &&
          toISODate(block.startAt) <= date &&
          toISODate(block.endAt) >= date,
      ),
    [db.blocks, doctorId, branch.id, date],
  )

  const branchClosed = useMemo(
    () => branch.closedDays.includes(new Date(`${date}T12:00:00`).getDay()),
    [branch.closedDays, date],
  )

  const submit = () => {
    if (!patientId) return setError('Choose a patient first')
    if (!doctorId) return setError('Choose a doctor')
    if (!treatmentTypeId) return setError('Choose a treatment')
    if (!time) return setError('Pick a time slot')

    const appointment = applyWith((db) =>
      bookAppointment(db, ctx, {
        patientId,
        doctorId,
        branchId: branch.id,
        treatmentTypeId,
        startAt: fromDateAndTime(date, time),
        kind: walkIn ? 'walk_in' : 'scheduled',
        reason: reason.trim() || undefined,
      }),
    )

    onClose()
    toast.success(
      walkIn ? `${patient?.name} registered as a walk-in` : `Booked for ${patient?.name}`,
      `${type?.name} · ${formatSlot(time)}`,
    )
    void appointment
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={walkIn ? 'Register a walk-in' : 'Book an appointment'}
        description={branch.name}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit}>
              {walkIn ? 'Register walk-in' : 'Book appointment'}
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

          {/* --- Patient --------------------------------------------------- */}
          <div>
            <Field label="Patient" required>
              {({ id }) =>
                patient ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-default bg-surface-sunken px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{patient.name}</p>
                      <p className="tnum truncate text-xs text-muted">
                        {patient.code} · {patient.phone}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPatientId('')}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
                    />
                    <Input
                      id={id}
                      value={patientQuery}
                      onChange={(e) => setPatientQuery(e.target.value)}
                      placeholder="Search by name, code or phone…"
                      className="pl-9"
                      autoComplete="off"
                    />
                  </div>
                )
              }
            </Field>

            {!patient && patientQuery && (
              <div className="mt-1.5 overflow-hidden rounded-lg border border-default">
                {matches.length === 0 ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <p className="text-sm text-muted">No patient matches “{patientQuery}”.</p>
                    {allows('patients.create') && (
                      <Button size="sm" variant="secondary" icon={<UserPlus />} onClick={() => setNewPatientOpen(true)}>
                        Register
                      </Button>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {matches.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPatientId(match.id)
                            setPatientQuery('')
                          }}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-hover"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{match.name}</span>
                            <span className="tnum block truncate text-xs text-muted">
                              {match.code} · {match.phone}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* --- Treatment & doctor ---------------------------------------- */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Treatment" required>
              {({ id }) => (
                <Select id={id} value={treatmentTypeId} onChange={(e) => setTreatmentTypeId(e.target.value)}>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.durationMinutes} min
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Doctor" required>
              {({ id }) => (
                <Select id={id} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          {/* --- Date & slots ---------------------------------------------- */}
          <Field label="Date" required>
            {({ id }) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>

          {(branchClosed || blocked) && (
            <p className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {branchClosed
                ? `${branch.name} is normally closed on this day. You can still book, but confirm with the patient.`
                : 'This doctor has blocked time on this date. Booking will overlap their block.'}
            </p>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">
              Time slot <span className="text-danger">*</span>
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {slots.map((slot) => {
                const taken = takenSlots.has(slot)
                const selected = slot === time
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={taken}
                    onClick={() => setTime(slot)}
                    aria-pressed={selected}
                    className={cn(
                      'tnum cursor-pointer rounded-lg border px-1 py-1.5 text-xs font-medium transition-colors',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      selected
                        ? 'border-brand bg-brand text-brand-fg'
                        : taken
                          ? 'border-default bg-surface-sunken text-subtle line-through'
                          : 'border-default bg-surface text-text hover:border-brand hover:bg-brand-bg',
                    )}
                  >
                    {formatSlot(slot)}
                  </button>
                )
              })}
            </div>
            {type && time && (
              <p className="mt-1.5 text-xs text-subtle">
                {formatSlot(time)} — ends around{' '}
                {new Date(
                  addMinutes(fromDateAndTime(date, time), type.durationMinutes),
                ).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>

          <Field label="Reason for visit">
            {({ id }) => (
              <Textarea
                id={id}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="optional — what did the patient say when booking?"
              />
            )}
          </Field>

          {type && (
            <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2 text-sm">
              <span className="text-muted">Follow-up will be scheduled</span>
              <Badge tone="info" size="sm">
                {type.defaultFollowUpDays > 0
                  ? `${type.defaultFollowUpDays} days after the visit`
                  : 'No automatic follow-up'}
              </Badge>
            </div>
          )}
        </div>
      </Drawer>

      <NewPatientDrawer
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        onCreated={(id) => {
          setPatientId(id)
          setPatientQuery('')
          setNewPatientOpen(false)
        }}
      />
    </>
  )
}
