import { addDays, addMinutes, now, toISODate } from '@/lib/dates'
import { uid } from '@/lib/id'
import { remindersForTreatment, runFollowUpEngine } from './followUpEngine'
import type {
  Appointment,
  Branch,
  CalendarBlock,
  ClinicSettings,
  Database,
  ID,
  ISODateTime,
  Lead,
  LeadStage,
  Note,
  Patient,
  PatientDocument,
  PrescriptionItem,
  Reminder,
  ReminderRule,
  Task,
  TimelineEvent,
  Treatment,
  TreatmentType,
  User,
} from './types'

/**
 * Every mutation the prototype can perform, as pure `(db, …) => Database`
 * functions.
 *
 * Two invariants hold across all of them:
 *   1. They never mutate the database passed in — a new object is returned,
 *      which is what makes the undo stack in the store a one-liner.
 *   2. They emit a TimelineEvent. That is why Part 11's universal timeline and
 *      Part 17's audit trail need no per-feature work: they are views over the
 *      event stream, and no feature can forget to log itself.
 */

export interface Ctx {
  actorId: ID
  branchId: ID
}

/* -------------------------------------------------------------------------- */
/* Internals                                                                  */
/* -------------------------------------------------------------------------- */

type EventInput = Omit<TimelineEvent, 'id' | 'at' | 'actorId' | 'branchId'> &
  Partial<Pick<TimelineEvent, 'at' | 'actorId' | 'branchId'>>

function emit(db: Database, ctx: Ctx, input: EventInput): Database {
  const event: TimelineEvent = {
    id: uid('evt'),
    at: input.at ?? now(),
    actorId: input.actorId ?? ctx.actorId,
    branchId: input.branchId ?? ctx.branchId,
    ...input,
  }
  return { ...db, events: [event, ...db.events] }
}

function replace<T extends { id: ID }>(items: T[], id: ID, patch: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

/** Re-runs the follow-up engine so reminders, tasks and escalations stay true. */
function reconcile(db: Database): Database {
  const result = runFollowUpEngine(db)
  return { ...db, reminders: result.reminders, tasks: result.tasks }
}

/** Field-level diff for the audit trail. */
function diff<T extends object>(before: T, after: Partial<T>, fields: (keyof T)[]) {
  return fields
    .filter((field) => field in after && before[field] !== after[field])
    .map((field) => ({
      field: String(field),
      from: before[field] == null ? undefined : String(before[field]),
      to: after[field] == null ? undefined : String(after[field]),
    }))
}

const nameOf = (db: Database, patientId?: ID) =>
  db.patients.find((p) => p.id === patientId)?.name ?? 'the patient'

const typeNameOf = (db: Database, id: ID) =>
  db.treatmentTypes.find((t) => t.id === id)?.name ?? 'Appointment'

/** Next patient code in sequence, e.g. OC-1124. */
function nextPatientCode(db: Database): string {
  const highest = db.patients.reduce((max, patient) => {
    const n = Number(patient.code.replace(/\D/g, ''))
    return Number.isFinite(n) && n > max ? n : max
  }, 1000)
  return `OC-${highest + 1}`
}

/* -------------------------------------------------------------------------- */
/* Patients (Part 6)                                                          */
/* -------------------------------------------------------------------------- */

export type NewPatient = Pick<Patient, 'name' | 'phone' | 'gender' | 'branchId' | 'source'> &
  Partial<Pick<Patient, 'email' | 'dob' | 'address' | 'primaryDoctorId' | 'tags' | 'allergies' | 'conditions' | 'emergencyContactName' | 'emergencyContactPhone' | 'referredBy' | 'convertedFromLeadId'>>

export function createPatient(db: Database, ctx: Ctx, input: NewPatient): [Database, Patient] {
  const timestamp = now()
  const patient: Patient = {
    id: uid('pat'),
    code: nextPatientCode(db),
    status: 'active',
    tags: [],
    allergies: [],
    conditions: [],
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  let next: Database = { ...db, patients: [patient, ...db.patients] }
  next = emit(next, ctx, {
    entity: 'patient',
    entityId: patient.id,
    action: 'created',
    summary: `Registered ${patient.name} (${patient.code})`,
    patientId: patient.id,
    branchId: patient.branchId,
    audit: false,
  })
  return [next, patient]
}

export function updatePatient(
  db: Database,
  ctx: Ctx,
  id: ID,
  patch: Partial<Patient>,
): Database {
  const before = db.patients.find((p) => p.id === id)
  if (!before) return db

  const changes = diff(before, patch, [
    'name', 'phone', 'email', 'address', 'primaryDoctorId', 'branchId', 'gender', 'dob',
  ])

  let next: Database = {
    ...db,
    patients: replace(db.patients, id, { ...patch, updatedAt: now() }),
  }
  next = emit(next, ctx, {
    entity: 'patient',
    entityId: id,
    action: 'updated',
    summary: `Updated ${before.name}'s details`,
    patientId: id,
    changes: changes.length > 0 ? changes : undefined,
    audit: true,
  })
  return next
}

export function archivePatient(db: Database, ctx: Ctx, id: ID, reason: string): Database {
  const patient = db.patients.find((p) => p.id === id)
  if (!patient) return db

  let next: Database = {
    ...db,
    patients: replace(db.patients, id, {
      status: 'archived',
      archivedAt: now(),
      archiveReason: reason,
      updatedAt: now(),
    }),
    // Archiving pulls the patient out of the future schedule and stops the
    // follow-up engine chasing someone who is no longer a patient.
    appointments: db.appointments.map((a) =>
      a.patientId === id && a.status === 'scheduled' && new Date(a.startAt) > new Date()
        ? { ...a, status: 'cancelled', cancelledAt: now(), cancelReason: 'Patient archived' }
        : a,
    ),
    reminders: db.reminders.map((r) =>
      r.patientId === id && (r.status === 'pending' || r.status === 'snoozed')
        ? { ...r, status: 'cancelled' }
        : r,
    ),
    tasks: db.tasks.map((t) =>
      t.patientId === id && t.status === 'open' ? { ...t, status: 'cancelled' } : t,
    ),
  }

  next = emit(next, ctx, {
    entity: 'patient',
    entityId: id,
    action: 'archived',
    summary: `Archived ${patient.name} — ${reason}`,
    patientId: id,
    audit: true,
  })
  return next
}

export function restorePatient(db: Database, ctx: Ctx, id: ID): Database {
  const patient = db.patients.find((p) => p.id === id)
  if (!patient) return db

  let next: Database = {
    ...db,
    patients: replace(db.patients, id, {
      status: 'active',
      archivedAt: undefined,
      archiveReason: undefined,
      updatedAt: now(),
    }),
  }
  next = emit(next, ctx, {
    entity: 'patient',
    entityId: id,
    action: 'restored',
    summary: `Restored ${patient.name} from the archive`,
    patientId: id,
    audit: true,
  })
  return next
}

export function addNote(db: Database, ctx: Ctx, patientId: ID, body: string): Database {
  const note: Note = {
    id: uid('note'),
    patientId,
    authorId: ctx.actorId,
    body,
    pinned: false,
    createdAt: now(),
  }
  let next: Database = { ...db, notes: [note, ...db.notes] }
  next = emit(next, ctx, {
    entity: 'note',
    entityId: note.id,
    action: 'added',
    summary: `Added a note to ${nameOf(db, patientId)}'s record`,
    patientId,
    audit: false,
  })
  return next
}

export function toggleNotePin(db: Database, ctx: Ctx, noteId: ID): Database {
  const note = db.notes.find((n) => n.id === noteId)
  if (!note) return db
  let next: Database = { ...db, notes: replace(db.notes, noteId, { pinned: !note.pinned }) }
  next = emit(next, ctx, {
    entity: 'note',
    entityId: noteId,
    action: note.pinned ? 'unpinned' : 'pinned',
    summary: `${note.pinned ? 'Unpinned' : 'Pinned'} a note on ${nameOf(db, note.patientId)}'s record`,
    patientId: note.patientId,
    audit: false,
  })
  return next
}

export function deleteNote(db: Database, ctx: Ctx, noteId: ID): Database {
  const note = db.notes.find((n) => n.id === noteId)
  if (!note) return db
  let next: Database = { ...db, notes: db.notes.filter((n) => n.id !== noteId) }
  next = emit(next, ctx, {
    entity: 'note',
    entityId: noteId,
    action: 'deleted',
    summary: `Deleted a note from ${nameOf(db, note.patientId)}'s record`,
    patientId: note.patientId,
    audit: true,
  })
  return next
}

export function addDocument(
  db: Database,
  ctx: Ctx,
  patientId: ID,
  input: Pick<PatientDocument, 'name' | 'kind' | 'sizeKb'>,
): Database {
  const document: PatientDocument = {
    id: uid('doc'),
    patientId,
    uploadedById: ctx.actorId,
    uploadedAt: now(),
    simulated: true,
    ...input,
  }
  let next: Database = { ...db, documents: [document, ...db.documents] }
  next = emit(next, ctx, {
    entity: 'document',
    entityId: document.id,
    action: 'uploaded',
    summary: `Uploaded “${document.name}” to ${nameOf(db, patientId)}'s record`,
    patientId,
    audit: false,
  })
  return next
}

export function deleteDocument(db: Database, ctx: Ctx, documentId: ID): Database {
  const document = db.documents.find((d) => d.id === documentId)
  if (!document) return db
  let next: Database = { ...db, documents: db.documents.filter((d) => d.id !== documentId) }
  next = emit(next, ctx, {
    entity: 'document',
    entityId: documentId,
    action: 'deleted',
    summary: `Deleted “${document.name}” from ${nameOf(db, document.patientId)}'s record`,
    patientId: document.patientId,
    audit: true,
  })
  return next
}

/* -------------------------------------------------------------------------- */
/* Appointments (Part 7)                                                      */
/* -------------------------------------------------------------------------- */

export interface NewAppointment {
  patientId: ID
  doctorId: ID
  branchId: ID
  treatmentTypeId: ID
  startAt: ISODateTime
  kind?: Appointment['kind']
  reason?: string
}

export function bookAppointment(
  db: Database,
  ctx: Ctx,
  input: NewAppointment,
): [Database, Appointment] {
  const type = db.treatmentTypes.find((t) => t.id === input.treatmentTypeId)
  const duration = type?.durationMinutes ?? db.settings.appointmentSlotMinutes

  const appointment: Appointment = {
    id: uid('apt'),
    kind: 'scheduled',
    ...input,
    endAt: addMinutes(input.startAt, duration).toISOString(),
    status: input.kind === 'walk_in' ? 'checked_in' : 'scheduled',
    checkedInAt: input.kind === 'walk_in' ? now() : undefined,
    createdById: ctx.actorId,
    createdAt: now(),
  }

  let next: Database = { ...db, appointments: [appointment, ...db.appointments] }
  next = emit(next, ctx, {
    entity: 'appointment',
    entityId: appointment.id,
    action: appointment.kind === 'walk_in' ? 'walk_in_registered' : 'booked',
    summary:
      appointment.kind === 'walk_in'
        ? `Walk-in registered for ${nameOf(db, input.patientId)}`
        : `Booked ${typeNameOf(db, input.treatmentTypeId)} for ${nameOf(db, input.patientId)}`,
    patientId: input.patientId,
    branchId: input.branchId,
    audit: false,
  })
  return [next, appointment]
}

export function checkInAppointment(db: Database, ctx: Ctx, id: ID): Database {
  const appointment = db.appointments.find((a) => a.id === id)
  if (!appointment) return db

  let next: Database = {
    ...db,
    appointments: replace(db.appointments, id, { status: 'checked_in', checkedInAt: now() }),
  }
  next = emit(next, ctx, {
    entity: 'appointment',
    entityId: id,
    action: 'checked_in',
    summary: `${nameOf(db, appointment.patientId)} checked in`,
    patientId: appointment.patientId,
    branchId: appointment.branchId,
    audit: false,
  })
  return next
}

export function startAppointment(db: Database, ctx: Ctx, id: ID): Database {
  const appointment = db.appointments.find((a) => a.id === id)
  if (!appointment) return db

  let next: Database = {
    ...db,
    appointments: replace(db.appointments, id, { status: 'in_progress', startedAt: now() }),
  }
  next = emit(next, ctx, {
    entity: 'appointment',
    entityId: id,
    action: 'started',
    summary: `Started ${typeNameOf(db, appointment.treatmentTypeId)} with ${nameOf(db, appointment.patientId)}`,
    patientId: appointment.patientId,
    branchId: appointment.branchId,
    audit: false,
  })
  return next
}

export function cancelAppointment(db: Database, ctx: Ctx, id: ID, reason: string): Database {
  const appointment = db.appointments.find((a) => a.id === id)
  if (!appointment) return db

  let next: Database = {
    ...db,
    appointments: replace(db.appointments, id, {
      status: 'cancelled',
      cancelledAt: now(),
      cancelReason: reason,
    }),
  }
  next = emit(next, ctx, {
    entity: 'appointment',
    entityId: id,
    action: 'cancelled',
    summary: `Cancelled ${typeNameOf(db, appointment.treatmentTypeId)} for ${nameOf(db, appointment.patientId)} — ${reason}`,
    patientId: appointment.patientId,
    branchId: appointment.branchId,
    audit: false,
  })
  return next
}

export function markNoShow(db: Database, ctx: Ctx, id: ID): Database {
  const appointment = db.appointments.find((a) => a.id === id)
  if (!appointment) return db

  let next: Database = { ...db, appointments: replace(db.appointments, id, { status: 'no_show' }) }
  next = emit(next, ctx, {
    entity: 'appointment',
    entityId: id,
    action: 'no_show',
    summary: `${nameOf(db, appointment.patientId)} did not attend`,
    patientId: appointment.patientId,
    branchId: appointment.branchId,
    audit: false,
  })
  return next
}

export function rescheduleAppointment(
  db: Database,
  ctx: Ctx,
  id: ID,
  startAt: ISODateTime,
  reason?: string,
): [Database, Appointment | null] {
  const original = db.appointments.find((a) => a.id === id)
  if (!original) return [db, null]

  const type = db.treatmentTypes.find((t) => t.id === original.treatmentTypeId)
  const replacement: Appointment = {
    ...original,
    id: uid('apt'),
    startAt,
    endAt: addMinutes(startAt, type?.durationMinutes ?? 30).toISOString(),
    status: 'scheduled',
    checkedInAt: undefined,
    startedAt: undefined,
    completedAt: undefined,
    cancelledAt: undefined,
    cancelReason: undefined,
    treatmentId: undefined,
    rescheduledFromId: original.id,
    rescheduledToId: undefined,
    createdById: ctx.actorId,
    createdAt: now(),
  }

  let next: Database = {
    ...db,
    appointments: [
      replacement,
      ...db.appointments.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'cancelled' as const,
              cancelledAt: now(),
              cancelReason: reason ?? 'Rescheduled',
              rescheduledToId: replacement.id,
            }
          : a,
      ),
    ],
  }

  next = emit(next, ctx, {
    entity: 'appointment',
    entityId: replacement.id,
    action: 'rescheduled',
    summary: `Rescheduled ${nameOf(db, original.patientId)}'s ${typeNameOf(db, original.treatmentTypeId)}`,
    patientId: original.patientId,
    branchId: original.branchId,
    audit: false,
  })
  return [next, replacement]
}

/* -------------------------------------------------------------------------- */
/* Treatments (Part 8) — where the follow-up engine fires                     */
/* -------------------------------------------------------------------------- */

export interface NewTreatment {
  patientId: ID
  appointmentId?: ID
  doctorId: ID
  branchId: ID
  treatmentTypeId: ID
  observations?: string
  adjustment?: string
  doctorNotes?: string
  prescription: PrescriptionItem[]
  nextVisitInDays?: number
}

/**
 * Recording a treatment is the single most consequential write in the product:
 * it closes the appointment, writes the clinical record, and — via the
 * follow-up engine — creates the reminder that will later become someone's
 * task. Staff never have to remember to schedule the chase.
 */
export function recordTreatment(
  db: Database,
  ctx: Ctx,
  input: NewTreatment,
): [Database, Treatment] {
  const timestamp = now()
  const treatment: Treatment = {
    id: uid('trt'),
    ...input,
    performedAt: timestamp,
    attachmentIds: [],
    createdAt: timestamp,
  }

  let next: Database = {
    ...db,
    treatments: [treatment, ...db.treatments],
    appointments: input.appointmentId
      ? replace(db.appointments, input.appointmentId, {
          status: 'completed',
          completedAt: timestamp,
          treatmentId: treatment.id,
        })
      : db.appointments,
  }

  const type = db.treatmentTypes.find((t) => t.id === input.treatmentTypeId)
  const generated = remindersForTreatment(treatment, db.reminderRules, type)
  next = { ...next, reminders: [...generated, ...next.reminders] }

  next = emit(next, ctx, {
    entity: 'treatment',
    entityId: treatment.id,
    action: 'recorded',
    summary: `${typeNameOf(db, input.treatmentTypeId)} recorded for ${nameOf(db, input.patientId)}`,
    patientId: input.patientId,
    branchId: input.branchId,
    audit: false,
  })

  if (generated.length > 0) {
    next = emit(next, ctx, {
      entity: 'reminder',
      entityId: generated[0]!.id,
      action: 'scheduled',
      summary: `Follow-up scheduled for ${nameOf(db, input.patientId)}`,
      patientId: input.patientId,
      branchId: input.branchId,
      audit: false,
    })
  }

  return [reconcile(next), treatment]
}

/**
 * Appends medications to an existing visit record.
 *
 * Prescribing is the doctor's highest-frequency action, and forcing it back
 * through the full visit drawer is the single biggest source of friction in
 * their day. This is the quick path: same clinical record, same audit trail,
 * one field.
 */
export function addPrescription(
  db: Database,
  ctx: Ctx,
  treatmentId: ID,
  items: PrescriptionItem[],
): Database {
  const treatment = db.treatments.find((t) => t.id === treatmentId)
  if (!treatment || items.length === 0) return db

  let next: Database = {
    ...db,
    treatments: replace(db.treatments, treatmentId, {
      prescription: [...treatment.prescription, ...items],
    }),
  }
  next = emit(next, ctx, {
    entity: 'treatment',
    entityId: treatmentId,
    action: 'prescribed',
    summary: `Prescribed ${items.map((i) => i.medication).join(', ')} for ${nameOf(db, treatment.patientId)}`,
    patientId: treatment.patientId,
    branchId: treatment.branchId,
    // Adding medication to a clinical record is an amendment, so it is audited.
    audit: true,
  })
  return next
}

/** Records that a prescription was printed and handed over. */
export function markPrescriptionIssued(db: Database, ctx: Ctx, treatmentId: ID): Database {
  const treatment = db.treatments.find((t) => t.id === treatmentId)
  if (!treatment) return db

  return emit(db, ctx, {
    entity: 'treatment',
    entityId: treatmentId,
    action: 'prescription_issued',
    summary: `Prescription printed for ${nameOf(db, treatment.patientId)}`,
    patientId: treatment.patientId,
    branchId: treatment.branchId,
    audit: false,
  })
}

export function updateTreatment(
  db: Database,
  ctx: Ctx,
  id: ID,
  patch: Partial<Treatment>,
): Database {
  const treatment = db.treatments.find((t) => t.id === id)
  if (!treatment) return db

  let next: Database = { ...db, treatments: replace(db.treatments, id, patch) }
  next = emit(next, ctx, {
    entity: 'treatment',
    entityId: id,
    action: 'amended',
    summary: `Amended the visit record for ${nameOf(db, treatment.patientId)}`,
    patientId: treatment.patientId,
    branchId: treatment.branchId,
    changes: diff(treatment, patch, ['observations', 'adjustment', 'doctorNotes', 'nextVisitInDays']),
    audit: true,
  })
  return next
}

/* -------------------------------------------------------------------------- */
/* Follow-ups (Part 9)                                                        */
/* -------------------------------------------------------------------------- */

export function snoozeReminder(
  db: Database,
  ctx: Ctx,
  id: ID,
  days: number,
  reason?: string,
): Database {
  const reminder = db.reminders.find((r) => r.id === id)
  if (!reminder) return db

  const until = addDays(new Date(), days).toISOString()
  let next: Database = {
    ...db,
    reminders: replace(db.reminders, id, {
      status: 'snoozed',
      snoozedUntil: until,
      snoozeReason: reason,
    }),
    // The task snoozes with its reminder, or it would keep nagging.
    tasks: reminder.taskId
      ? replace(db.tasks, reminder.taskId, { status: 'snoozed', snoozedUntil: until })
      : db.tasks,
  }
  next = emit(next, ctx, {
    entity: 'reminder',
    entityId: id,
    action: 'snoozed',
    summary: `Snoozed a follow-up for ${nameOf(db, reminder.patientId)} by ${days} day${days === 1 ? '' : 's'}`,
    patientId: reminder.patientId,
    leadId: reminder.leadId,
    branchId: reminder.branchId,
    audit: false,
  })
  return next
}

export function completeReminder(db: Database, ctx: Ctx, id: ID, outcome?: string): Database {
  const reminder = db.reminders.find((r) => r.id === id)
  if (!reminder) return db

  let next: Database = {
    ...db,
    reminders: replace(db.reminders, id, { status: 'completed', completedAt: now() }),
    tasks: reminder.taskId
      ? replace(db.tasks, reminder.taskId, {
          status: 'completed',
          completedAt: now(),
          completedById: ctx.actorId,
          outcome,
        })
      : db.tasks,
  }
  next = emit(next, ctx, {
    entity: 'reminder',
    entityId: id,
    action: 'completed',
    summary: `Completed a follow-up for ${nameOf(db, reminder.patientId)}`,
    patientId: reminder.patientId,
    leadId: reminder.leadId,
    branchId: reminder.branchId,
    audit: false,
  })
  return next
}

export function cancelReminder(db: Database, ctx: Ctx, id: ID): Database {
  const reminder = db.reminders.find((r) => r.id === id)
  if (!reminder) return db

  let next: Database = {
    ...db,
    reminders: replace(db.reminders, id, { status: 'cancelled' }),
    tasks: reminder.taskId
      ? replace(db.tasks, reminder.taskId, { status: 'cancelled' })
      : db.tasks,
  }
  next = emit(next, ctx, {
    entity: 'reminder',
    entityId: id,
    action: 'cancelled',
    summary: `Cancelled a follow-up for ${nameOf(db, reminder.patientId)}`,
    patientId: reminder.patientId,
    branchId: reminder.branchId,
    audit: false,
  })
  return next
}

export function saveReminderRule(
  db: Database,
  ctx: Ctx,
  rule: Omit<ReminderRule, 'id' | 'createdAt'> & { id?: ID },
): Database {
  const existing = rule.id ? db.reminderRules.find((r) => r.id === rule.id) : undefined

  const saved: ReminderRule = existing
    ? { ...existing, ...rule, id: existing.id }
    : { ...rule, id: uid('rr'), createdAt: now() }

  let next: Database = {
    ...db,
    reminderRules: existing
      ? replace(db.reminderRules, existing.id, saved)
      : [saved, ...db.reminderRules],
  }
  next = emit(next, ctx, {
    entity: 'settings',
    entityId: saved.id,
    action: existing ? 'rule_updated' : 'rule_created',
    summary: `${existing ? 'Updated' : 'Created'} reminder rule “${saved.name}”`,
    audit: true,
  })
  return reconcile(next)
}

export function toggleReminderRule(db: Database, ctx: Ctx, id: ID): Database {
  const rule = db.reminderRules.find((r) => r.id === id)
  if (!rule) return db

  let next: Database = {
    ...db,
    reminderRules: replace(db.reminderRules, id, { active: !rule.active }),
  }
  next = emit(next, ctx, {
    entity: 'settings',
    entityId: id,
    action: rule.active ? 'rule_disabled' : 'rule_enabled',
    summary: `${rule.active ? 'Disabled' : 'Enabled'} reminder rule “${rule.name}”`,
    audit: true,
  })
  return next
}

/* -------------------------------------------------------------------------- */
/* Tasks (Part 15)                                                            */
/* -------------------------------------------------------------------------- */

export type NewTask = Pick<Task, 'title' | 'dueAt' | 'branchId'> &
  Partial<Pick<Task, 'description' | 'assigneeId' | 'patientId' | 'leadId' | 'priority'>>

export function createTask(db: Database, ctx: Ctx, input: NewTask): Database {
  const task: Task = {
    id: uid('task'),
    status: 'open',
    priority: 'normal',
    origin: 'manual',
    escalated: false,
    createdById: ctx.actorId,
    createdAt: now(),
    ...input,
  }

  let next: Database = { ...db, tasks: [task, ...db.tasks] }
  next = emit(next, ctx, {
    entity: 'task',
    entityId: task.id,
    action: 'created',
    summary: `Created task “${task.title}”`,
    patientId: task.patientId,
    leadId: task.leadId,
    branchId: task.branchId,
    audit: false,
  })
  return next
}

export function completeTask(db: Database, ctx: Ctx, id: ID, outcome?: string): Database {
  const task = db.tasks.find((t) => t.id === id)
  if (!task) return db

  let next: Database = {
    ...db,
    tasks: replace(db.tasks, id, {
      status: 'completed',
      completedAt: now(),
      completedById: ctx.actorId,
      outcome,
    }),
    // Completing the task closes the reminder behind it — one action, not two.
    reminders: task.reminderId
      ? replace(db.reminders, task.reminderId, { status: 'completed', completedAt: now() })
      : db.reminders,
  }
  next = emit(next, ctx, {
    entity: 'task',
    entityId: id,
    action: 'completed',
    summary: `Completed task “${task.title}”`,
    patientId: task.patientId,
    leadId: task.leadId,
    branchId: task.branchId,
    audit: false,
  })
  return next
}

export function reopenTask(db: Database, ctx: Ctx, id: ID): Database {
  const task = db.tasks.find((t) => t.id === id)
  if (!task) return db

  let next: Database = {
    ...db,
    tasks: replace(db.tasks, id, {
      status: 'open',
      completedAt: undefined,
      completedById: undefined,
      outcome: undefined,
    }),
  }
  next = emit(next, ctx, {
    entity: 'task',
    entityId: id,
    action: 'reopened',
    summary: `Reopened task “${task.title}”`,
    patientId: task.patientId,
    branchId: task.branchId,
    audit: false,
  })
  return next
}

export function snoozeTask(db: Database, ctx: Ctx, id: ID, days: number): Database {
  const task = db.tasks.find((t) => t.id === id)
  if (!task) return db

  const until = addDays(new Date(), days).toISOString()
  let next: Database = {
    ...db,
    tasks: replace(db.tasks, id, { status: 'snoozed', snoozedUntil: until }),
    reminders: task.reminderId
      ? replace(db.reminders, task.reminderId, { status: 'snoozed', snoozedUntil: until })
      : db.reminders,
  }
  next = emit(next, ctx, {
    entity: 'task',
    entityId: id,
    action: 'snoozed',
    summary: `Snoozed task “${task.title}” by ${days} day${days === 1 ? '' : 's'}`,
    patientId: task.patientId,
    branchId: task.branchId,
    audit: false,
  })
  return next
}

export function assignTask(db: Database, ctx: Ctx, id: ID, assigneeId: ID | undefined): Database {
  const task = db.tasks.find((t) => t.id === id)
  if (!task) return db

  const assignee = db.users.find((u) => u.id === assigneeId)
  let next: Database = { ...db, tasks: replace(db.tasks, id, { assigneeId }) }
  next = emit(next, ctx, {
    entity: 'task',
    entityId: id,
    action: 'assigned',
    summary: assignee
      ? `Assigned “${task.title}” to ${assignee.name}`
      : `Unassigned “${task.title}”`,
    patientId: task.patientId,
    branchId: task.branchId,
    audit: true,
  })
  return next
}

/* -------------------------------------------------------------------------- */
/* Leads (Part 10)                                                            */
/* -------------------------------------------------------------------------- */

export type NewLead = Pick<Lead, 'name' | 'phone' | 'source' | 'branchId' | 'ownerId'> &
  Partial<Pick<Lead, 'email' | 'interestedInTypeId' | 'nextFollowUpAt'>>

export function createLead(db: Database, ctx: Ctx, input: NewLead): [Database, Lead] {
  const timestamp = now()
  const lead: Lead = {
    id: uid('lead'),
    stage: 'enquiry',
    notes: [],
    // Default to chasing in a week if reception did not pick a date.
    nextFollowUpAt: addDays(timestamp, 7).toISOString(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  let next: Database = { ...db, leads: [lead, ...db.leads] }
  next = emit(next, ctx, {
    entity: 'lead',
    entityId: lead.id,
    action: 'created',
    summary: `New enquiry from ${lead.name}`,
    leadId: lead.id,
    branchId: lead.branchId,
    audit: false,
  })
  return [reconcile(next), lead]
}

export function updateLead(db: Database, ctx: Ctx, id: ID, patch: Partial<Lead>): Database {
  const lead = db.leads.find((l) => l.id === id)
  if (!lead) return db

  let next: Database = { ...db, leads: replace(db.leads, id, { ...patch, updatedAt: now() }) }
  next = emit(next, ctx, {
    entity: 'lead',
    entityId: id,
    action: 'updated',
    summary: `Updated enquiry from ${lead.name}`,
    leadId: id,
    branchId: lead.branchId,
    changes: diff(lead, patch, ['stage', 'ownerId', 'nextFollowUpAt', 'phone', 'email']),
    audit: false,
  })
  return next
}

export function moveLeadStage(
  db: Database,
  ctx: Ctx,
  id: ID,
  stage: LeadStage,
  lostReason?: string,
): Database {
  const lead = db.leads.find((l) => l.id === id)
  if (!lead) return db

  const closing = stage === 'lost' || stage === 'converted'
  let next: Database = {
    ...db,
    leads: replace(db.leads, id, {
      stage,
      lostReason: stage === 'lost' ? lostReason : undefined,
      // A closed lead stops generating follow-ups.
      nextFollowUpAt: closing ? undefined : lead.nextFollowUpAt,
      updatedAt: now(),
    }),
    reminders: closing
      ? db.reminders.map((r) =>
          r.leadId === id && (r.status === 'pending' || r.status === 'snoozed')
            ? { ...r, status: 'cancelled' as const }
            : r,
        )
      : db.reminders,
    tasks: closing
      ? db.tasks.map((t) => (t.leadId === id && t.status === 'open' ? { ...t, status: 'cancelled' as const } : t))
      : db.tasks,
  }

  next = emit(next, ctx, {
    entity: 'lead',
    entityId: id,
    action: `moved_to_${stage}`,
    summary:
      stage === 'lost'
        ? `Marked ${lead.name} as lost — ${lostReason ?? 'no reason given'}`
        : `Moved ${lead.name} to ${stage}`,
    leadId: id,
    branchId: lead.branchId,
    changes: [{ field: 'stage', from: lead.stage, to: stage }],
    audit: false,
  })
  return next
}

export function addLeadNote(db: Database, ctx: Ctx, id: ID, body: string): Database {
  const lead = db.leads.find((l) => l.id === id)
  if (!lead) return db

  let next: Database = {
    ...db,
    leads: replace(db.leads, id, {
      notes: [
        ...lead.notes,
        { id: uid('lnote'), authorId: ctx.actorId, body, createdAt: now() },
      ],
      updatedAt: now(),
    }),
  }
  next = emit(next, ctx, {
    entity: 'lead',
    entityId: id,
    action: 'note_added',
    summary: `Logged a call with ${lead.name}`,
    leadId: id,
    branchId: lead.branchId,
    audit: false,
  })
  return next
}

/**
 * Converts a lead into a patient, carrying the enquiry across so the new
 * patient's timeline starts with where they came from rather than at zero.
 */
export function convertLead(db: Database, ctx: Ctx, id: ID): [Database, Patient | null] {
  const lead = db.leads.find((l) => l.id === id)
  if (!lead) return [db, null]
  if (lead.patientId) {
    return [db, db.patients.find((p) => p.id === lead.patientId) ?? null]
  }

  const [withPatient, patient] = createPatient(db, ctx, {
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    gender: 'undisclosed',
    branchId: lead.branchId,
    source: lead.source,
    convertedFromLeadId: lead.id,
  })

  let next: Database = {
    ...withPatient,
    leads: replace(withPatient.leads, id, {
      stage: 'converted',
      patientId: patient.id,
      nextFollowUpAt: undefined,
      updatedAt: now(),
    }),
    reminders: withPatient.reminders.map((r) =>
      r.leadId === id && (r.status === 'pending' || r.status === 'snoozed')
        ? { ...r, status: 'cancelled' as const }
        : r,
    ),
    tasks: withPatient.tasks.map((t) =>
      t.leadId === id && t.status === 'open' ? { ...t, status: 'completed' as const, completedAt: now(), completedById: ctx.actorId, outcome: 'Converted to patient' } : t,
    ),
  }

  next = emit(next, ctx, {
    entity: 'lead',
    entityId: id,
    action: 'converted',
    summary: `${lead.name} converted to a patient (${patient.code})`,
    leadId: id,
    patientId: patient.id,
    branchId: lead.branchId,
    audit: false,
  })

  return [next, patient]
}

/* -------------------------------------------------------------------------- */
/* Calendar (Part 14)                                                         */
/* -------------------------------------------------------------------------- */

export function createBlock(
  db: Database,
  ctx: Ctx,
  input: Omit<CalendarBlock, 'id' | 'createdById' | 'createdAt'>,
): Database {
  const block: CalendarBlock = {
    id: uid('blk'),
    createdById: ctx.actorId,
    createdAt: now(),
    ...input,
  }
  const who = block.userId ? db.users.find((u) => u.id === block.userId)?.name : 'the branch'

  let next: Database = { ...db, blocks: [block, ...db.blocks] }
  next = emit(next, ctx, {
    entity: 'settings',
    entityId: block.id,
    action: 'time_blocked',
    summary: `Blocked ${toISODate(block.startAt)} for ${who} — ${block.reason}`,
    branchId: block.branchId,
    audit: true,
  })
  return next
}

export function deleteBlock(db: Database, ctx: Ctx, id: ID): Database {
  const block = db.blocks.find((b) => b.id === id)
  if (!block) return db

  let next: Database = { ...db, blocks: db.blocks.filter((b) => b.id !== id) }
  next = emit(next, ctx, {
    entity: 'settings',
    entityId: id,
    action: 'time_unblocked',
    summary: `Removed the block on ${toISODate(block.startAt)} — ${block.reason}`,
    branchId: block.branchId,
    audit: true,
  })
  return next
}

/* -------------------------------------------------------------------------- */
/* Users & settings (Parts 17, 18)                                            */
/* -------------------------------------------------------------------------- */

export type NewUser = Pick<User, 'name' | 'email' | 'phone' | 'role' | 'branchIds'> &
  Partial<Pick<User, 'specialisation'>>

export function saveUser(db: Database, ctx: Ctx, input: NewUser & { id?: ID }): Database {
  const existing = input.id ? db.users.find((u) => u.id === input.id) : undefined

  const saved: User = existing
    ? { ...existing, ...input, id: existing.id }
    : {
        ...input,
        id: uid('usr'),
        active: true,
        lastActiveAt: now(),
        createdAt: now(),
      }

  let next: Database = {
    ...db,
    users: existing ? replace(db.users, existing.id, saved) : [saved, ...db.users],
  }
  next = emit(next, ctx, {
    entity: 'user',
    entityId: saved.id,
    action: existing ? 'updated' : 'created',
    summary: `${existing ? 'Updated' : 'Added'} user ${saved.name}`,
    changes: existing ? diff(existing, input, ['role', 'email', 'phone', 'name']) : undefined,
    audit: true,
  })
  return next
}

export function setUserActive(db: Database, ctx: Ctx, id: ID, active: boolean): Database {
  const user = db.users.find((u) => u.id === id)
  if (!user) return db

  let next: Database = {
    ...db,
    users: replace(db.users, id, { active }),
    // Deactivating revokes the sessions too — otherwise the account stays live.
    sessions: active ? db.sessions : db.sessions.filter((s) => s.userId !== id),
  }
  next = emit(next, ctx, {
    entity: 'user',
    entityId: id,
    action: active ? 'activated' : 'deactivated',
    summary: `${active ? 'Reactivated' : 'Deactivated'} ${user.name}`,
    audit: true,
  })
  return next
}

export function endSession(db: Database, ctx: Ctx, id: ID): Database {
  const session = db.sessions.find((s) => s.id === id)
  if (!session) return db

  const user = db.users.find((u) => u.id === session.userId)
  let next: Database = { ...db, sessions: db.sessions.filter((s) => s.id !== id) }
  next = emit(next, ctx, {
    entity: 'user',
    entityId: session.userId,
    action: 'session_ended',
    summary: `Ended a session for ${user?.name ?? 'a user'} (${session.device})`,
    audit: true,
  })
  return next
}

export function updateClinicSettings(
  db: Database,
  ctx: Ctx,
  patch: Partial<ClinicSettings>,
): Database {
  let next: Database = { ...db, settings: { ...db.settings, ...patch } }
  next = emit(next, ctx, {
    entity: 'settings',
    entityId: 'clinic',
    action: 'updated',
    summary: 'Updated clinic settings',
    changes: diff(db.settings, patch, ['name', 'tagline', 'supportEmail', 'supportPhone']),
    audit: true,
  })
  return next
}

export function saveTreatmentType(
  db: Database,
  ctx: Ctx,
  input: Omit<TreatmentType, 'id'> & { id?: ID },
): Database {
  const existing = input.id ? db.treatmentTypes.find((t) => t.id === input.id) : undefined
  const saved: TreatmentType = existing
    ? { ...existing, ...input, id: existing.id }
    : { ...input, id: uid('tt') }

  let next: Database = {
    ...db,
    treatmentTypes: existing
      ? replace(db.treatmentTypes, existing.id, saved)
      : [...db.treatmentTypes, saved],
  }
  next = emit(next, ctx, {
    entity: 'settings',
    entityId: saved.id,
    action: existing ? 'treatment_updated' : 'treatment_created',
    summary: `${existing ? 'Updated' : 'Added'} treatment “${saved.name}”`,
    audit: true,
  })
  return next
}

export function saveBranch(
  db: Database,
  ctx: Ctx,
  input: Omit<Branch, 'id'> & { id?: ID },
): Database {
  const existing = input.id ? db.branches.find((b) => b.id === input.id) : undefined
  const saved: Branch = existing
    ? { ...existing, ...input, id: existing.id }
    : { ...input, id: uid('br') }

  let next: Database = {
    ...db,
    branches: existing ? replace(db.branches, existing.id, saved) : [...db.branches, saved],
  }
  next = emit(next, ctx, {
    entity: 'settings',
    entityId: saved.id,
    action: existing ? 'branch_updated' : 'branch_created',
    summary: `${existing ? 'Updated' : 'Added'} branch “${saved.name}”`,
    audit: true,
  })
  return next
}

/* -------------------------------------------------------------------------- */
/* Notifications (Part 13)                                                    */
/* -------------------------------------------------------------------------- */

export function markNotificationRead(db: Database, id: ID): Database {
  return { ...db, notifications: replace(db.notifications, id, { read: true }) }
}

export function markAllNotificationsRead(db: Database, userId: ID): Database {
  return {
    ...db,
    notifications: db.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
  }
}

/** Re-runs the engine — used on app boot and after the clock has moved on. */
export function reconcileFollowUps(db: Database): Database {
  return reconcile(db)
}

export type { Reminder }
