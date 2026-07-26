import { addDays, daysOverdue, now } from '@/lib/dates'
import { uid } from '@/lib/id'
import type {
  Database,
  ID,
  ISODateTime,
  Lead,
  Reminder,
  ReminderRule,
  Task,
  Treatment,
  TreatmentType,
} from './types'

/**
 * Part 9 — Follow-up engine.
 *
 * Pure, side-effect free. Given the current state and a clock, it returns the
 * reminders and tasks that *should* exist. Nothing here touches storage, the
 * DOM, or the network, so the same code lifts to a server-side cron job when
 * the product goes to full scale.
 *
 * This is the "automation over memory" principle made concrete: staff never
 * have to remember to chase a patient, because completing a treatment is
 * what creates the chase.
 */

/* -------------------------------------------------------------------------- */
/* Generation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reminders owed by a treatment that was just recorded.
 *
 * `nextVisitInDays` on the treatment always wins over the rule's offset —
 * the doctor's explicit instruction beats the clinic default.
 */
export function remindersForTreatment(
  treatment: Treatment,
  rules: ReminderRule[],
  treatmentType: TreatmentType | undefined,
): Reminder[] {
  const applicable = rules.filter(
    (rule) =>
      rule.active &&
      rule.trigger === 'after_treatment' &&
      (rule.treatmentTypeIds.length === 0 ||
        rule.treatmentTypeIds.includes(treatment.treatmentTypeId)),
  )

  return applicable.map((rule) => {
    const offset =
      treatment.nextVisitInDays ??
      (treatmentType?.defaultFollowUpDays || 0) ??
      rule.offsetDays
    const days = offset > 0 ? offset : rule.offsetDays

    return {
      id: uid('rem'),
      ruleId: rule.id,
      patientId: treatment.patientId,
      branchId: treatment.branchId,
      dueAt: addDays(treatment.performedAt, days).toISOString(),
      status: 'pending',
      channels: rule.channels,
      sourceType: 'treatment',
      sourceId: treatment.id,
      escalated: false,
      createdAt: now(),
    }
  })
}

/** Reminders owed by a lead that needs chasing (Part 10 — weekly follow-ups). */
export function remindersForLead(lead: Lead, rules: ReminderRule[]): Reminder[] {
  if (lead.stage === 'converted' || lead.stage === 'lost') return []

  return rules
    .filter((rule) => rule.active && rule.trigger === 'lead_follow_up')
    .map((rule) => ({
      id: uid('rem'),
      ruleId: rule.id,
      leadId: lead.id,
      branchId: lead.branchId,
      dueAt: lead.nextFollowUpAt ?? addDays(lead.updatedAt, rule.offsetDays).toISOString(),
      status: 'pending' as const,
      channels: rule.channels,
      sourceType: 'lead' as const,
      sourceId: lead.id,
      escalated: false,
      createdAt: now(),
    }))
}

/* -------------------------------------------------------------------------- */
/* Reminder -> Task                                                           */
/* -------------------------------------------------------------------------- */

export interface TaskContext {
  patientName?: string
  leadName?: string
  ruleName: string
  /** Who should pick this up, resolved from the rule's assigneeRole. */
  assigneeId?: ID
}

/**
 * A reminder becomes a task the moment it falls due — that is what makes it
 * appear in someone's inbox rather than sitting in a table nobody opens.
 */
export function taskForReminder(reminder: Reminder, ctx: TaskContext): Task {
  const subject = ctx.patientName ?? ctx.leadName ?? 'contact'
  const isLead = Boolean(reminder.leadId)

  return {
    id: uid('task'),
    title: isLead ? `Follow up with ${subject}` : `Follow up: ${subject}`,
    description: ctx.ruleName,
    branchId: reminder.branchId,
    assigneeId: ctx.assigneeId,
    patientId: reminder.patientId,
    leadId: reminder.leadId,
    dueAt: reminder.dueAt,
    status: 'open',
    priority: 'normal',
    origin: 'auto',
    reminderId: reminder.id,
    escalated: false,
    createdAt: now(),
  }
}

/* -------------------------------------------------------------------------- */
/* The catch-up pass                                                          */
/* -------------------------------------------------------------------------- */

export interface EngineResult {
  reminders: Reminder[]
  tasks: Task[]
  /** Counts for the "engine ran" toast and the follow-ups screen. */
  stats: { materialised: number; escalated: number; awakened: number }
}

/**
 * Brings reminders and tasks up to date with the clock. Runs on every write
 * and once on app boot, which is what makes a demo opened after a two-week
 * gap show a realistic pile of overdue work instead of a frozen snapshot.
 *
 * Three things happen here:
 *   1. snoozed items whose snooze has expired wake up
 *   2. pending reminders that have fallen due materialise into tasks
 *   3. open tasks past their rule's escalation threshold get escalated
 */
export function runFollowUpEngine(db: Database, at: ISODateTime = now()): EngineResult {
  const rulesById = new Map(db.reminderRules.map((r) => [r.id, r]))
  const patientsById = new Map(db.patients.map((p) => [p.id, p]))
  const leadsById = new Map(db.leads.map((l) => [l.id, l]))
  const nowMs = new Date(at).getTime()

  const stats = { materialised: 0, escalated: 0, awakened: 0 }

  /* 1 & 2 — wake snoozed reminders, then materialise the due ones. */
  const newTasks: Task[] = []
  const reminders = db.reminders.map((reminder): Reminder => {
    let next = reminder

    if (
      next.status === 'snoozed' &&
      next.snoozedUntil &&
      new Date(next.snoozedUntil).getTime() <= nowMs
    ) {
      stats.awakened++
      next = { ...next, status: 'pending', snoozedUntil: undefined, dueAt: next.snoozedUntil }
    }

    const due = new Date(next.dueAt).getTime() <= nowMs
    if (next.status !== 'pending' || !due || next.taskId) return next

    const rule = rulesById.get(next.ruleId)
    const assignee = rule
      ? db.users.find(
          (u) =>
            u.active &&
            u.role === rule.assigneeRole &&
            (u.branchIds.includes(next.branchId) || u.role === 'owner' || u.role === 'admin'),
        )
      : undefined

    const task = taskForReminder(next, {
      patientName: next.patientId ? patientsById.get(next.patientId)?.name : undefined,
      leadName: next.leadId ? leadsById.get(next.leadId)?.name : undefined,
      ruleName: rule?.name ?? 'Follow-up',
      assigneeId: assignee?.id,
    })

    newTasks.push(task)
    stats.materialised++
    return { ...next, status: 'sent', taskId: task.id }
  })

  /* 3 — wake snoozed tasks, then escalate the ones left too long. */
  const tasks = [...db.tasks, ...newTasks].map((task): Task => {
    let next = task

    if (
      next.status === 'snoozed' &&
      next.snoozedUntil &&
      new Date(next.snoozedUntil).getTime() <= nowMs
    ) {
      stats.awakened++
      next = { ...next, status: 'open', dueAt: next.snoozedUntil, snoozedUntil: undefined }
    }

    if (next.status !== 'open' || next.escalated) return next

    const reminder = next.reminderId ? reminders.find((r) => r.id === next.reminderId) : undefined
    const rule = reminder ? rulesById.get(reminder.ruleId) : undefined
    const threshold = rule?.escalateAfterDays ?? 0
    if (threshold <= 0) return next

    if (daysOverdue(next.dueAt) >= threshold) {
      stats.escalated++
      // Escalation raises priority and flags it; reassignment to a manager is
      // deliberately left to a human, so nothing silently changes hands.
      return { ...next, escalated: true, priority: 'high' }
    }
    return next
  })

  const escalatedIds = new Set(
    tasks.filter((t) => t.escalated).map((t) => t.reminderId).filter(Boolean) as ID[],
  )

  return {
    reminders: reminders.map((r) => (escalatedIds.has(r.id) ? { ...r, escalated: true } : r)),
    tasks,
    stats,
  }
}

/* -------------------------------------------------------------------------- */
/* Derived views                                                              */
/* -------------------------------------------------------------------------- */

export function isOverdue(task: Pick<Task, 'status' | 'dueAt'>): boolean {
  return task.status === 'open' && daysOverdue(task.dueAt) > 0
}

export function isDueToday(task: Pick<Task, 'status' | 'dueAt'>): boolean {
  return task.status === 'open' && daysOverdue(task.dueAt) === 0
}
