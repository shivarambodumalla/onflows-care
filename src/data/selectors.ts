import { daysOverdue, endOfDay, isSameDay, startOfDay } from '@/lib/dates'
import { isOverdue } from './followUpEngine'
import { scopedToSelf } from './permissions'
import type {
  Appointment,
  Database,
  ID,
  Lead,
  Patient,
  Reminder,
  Role,
  Task,
  TimelineEvent,
  Treatment,
  User,
} from './types'

/**
 * Derived reads. Pure functions over the database so they can be memoised in
 * components and reused by the reports module without duplicating logic.
 */

export interface Scope {
  branchId: ID
  role: Role
  userId: ID
  /** When true, ignore the branch filter (owner/admin viewing all branches). */
  allBranches?: boolean
}

/* -------------------------------------------------------------------------- */
/* Scoping — the one place role and branch visibility is decided               */
/* -------------------------------------------------------------------------- */

function inBranch<T extends { branchId: ID }>(items: T[], scope: Scope): T[] {
  return scope.allBranches ? items : items.filter((item) => item.branchId === scope.branchId)
}

/** Doctors see their own list by default; everyone else sees the branch's. */
export function scopedAppointments(db: Database, scope: Scope): Appointment[] {
  const branchScoped = inBranch(db.appointments, scope)
  return scopedToSelf(scope.role)
    ? branchScoped.filter((a) => a.doctorId === scope.userId)
    : branchScoped
}

export function scopedPatients(db: Database, scope: Scope): Patient[] {
  return inBranch(db.patients, scope)
}

export function scopedTasks(db: Database, scope: Scope): Task[] {
  return inBranch(db.tasks, scope)
}

export function scopedLeads(db: Database, scope: Scope): Lead[] {
  return inBranch(db.leads, scope)
}

export function scopedReminders(db: Database, scope: Scope): Reminder[] {
  return inBranch(db.reminders, scope)
}

export function scopedEvents(db: Database, scope: Scope): TimelineEvent[] {
  return inBranch(db.events, scope)
}

/* -------------------------------------------------------------------------- */
/* Lookups                                                                     */
/* -------------------------------------------------------------------------- */

export const patientById = (db: Database, id?: ID) =>
  id ? db.patients.find((p) => p.id === id) : undefined

export const userById = (db: Database, id?: ID) =>
  id ? db.users.find((u) => u.id === id) : undefined

export const treatmentTypeById = (db: Database, id?: ID) =>
  id ? db.treatmentTypes.find((t) => t.id === id) : undefined

export const branchById = (db: Database, id?: ID) =>
  id ? db.branches.find((b) => b.id === id) : undefined

export const appointmentById = (db: Database, id?: ID) =>
  id ? db.appointments.find((a) => a.id === id) : undefined

export const leadById = (db: Database, id?: ID) =>
  id ? db.leads.find((l) => l.id === id) : undefined

export const userName = (db: Database, id?: ID) => userById(db, id)?.name ?? 'Unknown'

export const doctorsIn = (db: Database, branchId: ID): User[] =>
  db.users.filter((u) => u.active && u.role === 'doctor' && u.branchIds.includes(branchId))

export const staffIn = (db: Database, branchId: ID): User[] =>
  db.users.filter((u) => u.active && u.branchIds.includes(branchId))

/* -------------------------------------------------------------------------- */
/* Per-patient views (Part 6)                                                  */
/* -------------------------------------------------------------------------- */

export function patientAppointments(db: Database, patientId: ID): Appointment[] {
  return db.appointments
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => (a.startAt < b.startAt ? 1 : -1))
}

export function patientTreatments(db: Database, patientId: ID): Treatment[] {
  return db.treatments
    .filter((t) => t.patientId === patientId)
    .sort((a, b) => (a.performedAt < b.performedAt ? 1 : -1))
}

export function patientNotes(db: Database, patientId: ID) {
  return db.notes
    .filter((n) => n.patientId === patientId)
    .sort((a, b) => {
      // Pinned notes float to the top, then newest first.
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.createdAt < b.createdAt ? 1 : -1
    })
}

export function patientDocuments(db: Database, patientId: ID) {
  return db.documents
    .filter((d) => d.patientId === patientId)
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
}

export function patientEvents(db: Database, patientId: ID): TimelineEvent[] {
  return db.events
    .filter((e) => e.patientId === patientId)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
}

export function patientReminders(db: Database, patientId: ID): Reminder[] {
  return db.reminders
    .filter((r) => r.patientId === patientId)
    .sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1))
}

export function lastVisit(db: Database, patientId: ID): Treatment | undefined {
  return patientTreatments(db, patientId)[0]
}

export function nextAppointment(db: Database, patientId: ID): Appointment | undefined {
  const nowMs = Date.now()
  return db.appointments
    .filter(
      (a) =>
        a.patientId === patientId &&
        new Date(a.startAt).getTime() >= nowMs &&
        (a.status === 'scheduled' || a.status === 'checked_in'),
    )
    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))[0]
}

/* -------------------------------------------------------------------------- */
/* Day views (Parts 5, 7)                                                      */
/* -------------------------------------------------------------------------- */

export function appointmentsOn(appointments: Appointment[], day: Date | string): Appointment[] {
  return appointments
    .filter((a) => isSameDay(a.startAt, day))
    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
}

export function appointmentsBetween(
  appointments: Appointment[],
  from: Date | string,
  to: Date | string,
): Appointment[] {
  const start = startOfDay(from).getTime()
  const end = endOfDay(to).getTime()
  return appointments
    .filter((a) => {
      const at = new Date(a.startAt).getTime()
      return at >= start && at <= end
    })
    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
}

/** The waiting room: checked in but not yet finished. */
export function waitingNow(appointments: Appointment[]): Appointment[] {
  return appointments
    .filter((a) => a.status === 'checked_in' || a.status === 'in_progress')
    .sort((a, b) => (a.checkedInAt ?? a.startAt) < (b.checkedInAt ?? b.startAt) ? -1 : 1)
}

/* -------------------------------------------------------------------------- */
/* Work queues (Parts 9, 15)                                                   */
/* -------------------------------------------------------------------------- */

export function myTasks(tasks: Task[], userId: ID): Task[] {
  return tasks.filter((t) => t.assigneeId === userId)
}

export function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === 'open')
}

export function overdueTasks(tasks: Task[]): Task[] {
  return tasks.filter(isOverdue).sort((a, b) => daysOverdue(b.dueAt) - daysOverdue(a.dueAt))
}

export function dueTodayTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === 'open' && isSameDay(t.dueAt, new Date()))
}

/* -------------------------------------------------------------------------- */
/* Dashboard KPIs (Part 5)                                                     */
/* -------------------------------------------------------------------------- */

export interface DashboardKpis {
  todayTotal: number
  todayCompleted: number
  todayWaiting: number
  todayUpcoming: number
  noShowsToday: number
  overdueFollowUps: number
  dueTodayFollowUps: number
  openLeads: number
  newPatientsThisWeek: number
  /** Percentage change in appointments vs. the same span last week. */
  appointmentsDelta: number
  noShowRate: number
}

export function dashboardKpis(db: Database, scope: Scope): DashboardKpis {
  const appointments = scopedAppointments(db, scope)
  const today = appointmentsOn(appointments, new Date())
  const tasks = scopedTasks(db, scope)
  const leads = scopedLeads(db, scope)
  const patients = scopedPatients(db, scope)

  const weekAgoStart = startOfDay(new Date()).getTime() - 7 * 86_400_000
  const lastWeekSameDay = appointments.filter((a) => {
    const at = new Date(a.startAt).getTime()
    return at >= weekAgoStart && at < weekAgoStart + 86_400_000
  })

  const recent = appointments.filter((a) => {
    const at = new Date(a.startAt).getTime()
    return at >= Date.now() - 30 * 86_400_000 && at <= Date.now()
  })
  const noShows = recent.filter((a) => a.status === 'no_show').length

  const delta =
    lastWeekSameDay.length === 0
      ? 0
      : Math.round(((today.length - lastWeekSameDay.length) / lastWeekSameDay.length) * 100)

  return {
    todayTotal: today.filter((a) => a.status !== 'cancelled').length,
    todayCompleted: today.filter((a) => a.status === 'completed').length,
    todayWaiting: today.filter((a) => a.status === 'checked_in' || a.status === 'in_progress').length,
    todayUpcoming: today.filter((a) => a.status === 'scheduled').length,
    noShowsToday: today.filter((a) => a.status === 'no_show').length,
    overdueFollowUps: overdueTasks(tasks).length,
    dueTodayFollowUps: dueTodayTasks(tasks).length,
    openLeads: leads.filter((l) => l.stage !== 'converted' && l.stage !== 'lost').length,
    newPatientsThisWeek: patients.filter(
      (p) => new Date(p.createdAt).getTime() >= Date.now() - 7 * 86_400_000,
    ).length,
    appointmentsDelta: delta,
    noShowRate: recent.length === 0 ? 0 : Math.round((noShows / recent.length) * 100),
  }
}

/* -------------------------------------------------------------------------- */
/* Reports (Part 16)                                                           */
/* -------------------------------------------------------------------------- */

export function countBy<T>(items: T[], key: (item: T) => string): { label: string; value: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export function revenueOf(db: Database, treatments: Treatment[]): number {
  return treatments.reduce(
    (sum, t) => sum + (treatmentTypeById(db, t.treatmentTypeId)?.price ?? 0),
    0,
  )
}

/** Lead funnel counts in pipeline order. */
export function leadFunnel(leads: Lead[]) {
  const stages = ['enquiry', 'interested', 'booked', 'converted', 'lost'] as const
  return stages.map((stage) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
  }))
}

export function conversionRate(leads: Lead[]): number {
  const closed = leads.filter((l) => l.stage === 'converted' || l.stage === 'lost')
  if (closed.length === 0) return 0
  return Math.round((leads.filter((l) => l.stage === 'converted').length / closed.length) * 100)
}
