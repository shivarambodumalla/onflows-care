/**
 * Part 24 — Conceptual data model.
 *
 * These types are the contract the whole prototype codes against. When the
 * real backend arrives they become the API contract: `LocalRepo` is replaced
 * by an `HttpRepo` returning these same shapes and nothing above the data
 * layer changes.
 *
 * Dates are ISO 8601 strings, never Date objects, so everything survives a
 * localStorage round-trip and later a JSON API without a serialisation layer.
 */

export type ID = string
/** ISO date-time, e.g. 2026-07-26T09:30:00.000Z */
export type ISODateTime = string
/** ISO calendar date, e.g. 2026-07-26 */
export type ISODate = string

/* -------------------------------------------------------------------------- */
/* Organisation                                                               */
/* -------------------------------------------------------------------------- */

export interface Branch {
  id: ID
  name: string
  code: string
  address: string
  phone: string
  /** Clinic opening hours, used by the calendar to shade non-working time. */
  opensAt: string // 'HH:mm'
  closesAt: string // 'HH:mm'
  /** 0 = Sunday. Days the branch is closed. */
  closedDays: number[]
  active: boolean
}

export type Role = 'owner' | 'admin' | 'doctor' | 'receptionist' | 'branch_manager'

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  branch_manager: 'Branch Manager',
}

export interface User {
  id: ID
  name: string
  email: string
  phone: string
  role: Role
  /** Branches this user can act in. Owners and admins see all. */
  branchIds: ID[]
  /** Doctors only. */
  specialisation?: string
  active: boolean
  lastActiveAt: ISODateTime
  createdAt: ISODateTime
}

export interface Session {
  id: ID
  userId: ID
  device: string
  ipAddress: string
  startedAt: ISODateTime
  lastSeenAt: ISODateTime
  current: boolean
}

/* -------------------------------------------------------------------------- */
/* Patients                                                                   */
/* -------------------------------------------------------------------------- */

export type Gender = 'male' | 'female' | 'other' | 'undisclosed'
export type PatientStatus = 'active' | 'archived'

export interface Patient {
  id: ID
  /** Human-facing patient number, e.g. OC-01042. Searchable. */
  code: string
  name: string
  phone: string
  email?: string
  dob?: ISODate
  gender: Gender
  address?: string
  branchId: ID
  primaryDoctorId?: ID
  status: PatientStatus
  tags: string[]
  allergies: string[]
  /** Free-text conditions and past history (Part 6 — Medical History). */
  conditions: string[]
  emergencyContactName?: string
  emergencyContactPhone?: string
  /** How the patient found the clinic. Feeds the conversions report. */
  source: LeadSource
  /** Set when the patient was converted from a lead. */
  convertedFromLeadId?: ID
  referredBy?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
  archivedAt?: ISODateTime
  archiveReason?: string
}

export interface Note {
  id: ID
  patientId: ID
  authorId: ID
  body: string
  pinned: boolean
  createdAt: ISODateTime
}

export type DocumentKind = 'report' | 'scan' | 'prescription' | 'consent' | 'invoice' | 'other'

export interface PatientDocument {
  id: ID
  patientId: ID
  name: string
  kind: DocumentKind
  sizeKb: number
  uploadedById: ID
  uploadedAt: ISODateTime
  /** Prototype only — documents are simulated, never really stored. */
  simulated: true
}

/* -------------------------------------------------------------------------- */
/* Treatments catalogue (Part 18 — configurable, domain-neutral)              */
/* -------------------------------------------------------------------------- */

export interface TreatmentType {
  id: ID
  name: string
  category: string
  /** Slot length in minutes — drives calendar block size. */
  durationMinutes: number
  price: number
  /** Days until the follow-up the rules engine should schedule. 0 = none. */
  defaultFollowUpDays: number
  /** Whether booking this requires a doctor rather than any staff member. */
  requiresDoctor: boolean
  colour: 'brand' | 'info' | 'accent' | 'success' | 'warning'
  active: boolean
}

/* -------------------------------------------------------------------------- */
/* Appointments                                                               */
/* -------------------------------------------------------------------------- */

export type AppointmentStatus =
  | 'scheduled'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled'

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  checked_in: 'Checked in',
  in_progress: 'In progress',
  completed: 'Completed',
  no_show: 'No show',
  cancelled: 'Cancelled',
}

export type BookingKind = 'scheduled' | 'walk_in'

export interface Appointment {
  id: ID
  patientId: ID
  doctorId: ID
  branchId: ID
  treatmentTypeId: ID
  startAt: ISODateTime
  endAt: ISODateTime
  status: AppointmentStatus
  kind: BookingKind
  reason?: string
  createdById: ID
  createdAt: ISODateTime
  checkedInAt?: ISODateTime
  startedAt?: ISODateTime
  completedAt?: ISODateTime
  cancelledAt?: ISODateTime
  cancelReason?: string
  /** Set on the new appointment when one is rescheduled. */
  rescheduledFromId?: ID
  /** Set on the old appointment, pointing at its replacement. */
  rescheduledToId?: ID
  /** Links to the visit record created when this was completed. */
  treatmentId?: ID
}

/* -------------------------------------------------------------------------- */
/* Treatments (visit records)                                                 */
/* -------------------------------------------------------------------------- */

export interface PrescriptionItem {
  id: ID
  medication: string
  dosage: string
  frequency: string
  durationDays: number
  instructions?: string
}

export interface Treatment {
  id: ID
  patientId: ID
  appointmentId?: ID
  doctorId: ID
  branchId: ID
  treatmentTypeId: ID
  performedAt: ISODateTime
  /** Clinical observations recorded during the visit. */
  observations?: string
  /** Part 8 — Adjustment: what was changed from the planned treatment. */
  adjustment?: string
  /** Doctor's private working notes. */
  doctorNotes?: string
  prescription: PrescriptionItem[]
  /** Days until the next visit should happen. Drives the follow-up engine. */
  nextVisitInDays?: number
  /** Set once a follow-up appointment has actually been booked. */
  nextVisitAppointmentId?: ID
  attachmentIds: ID[]
  createdAt: ISODateTime
}

/* -------------------------------------------------------------------------- */
/* Follow-up engine (Part 9)                                                  */
/* -------------------------------------------------------------------------- */

export type ReminderTrigger =
  | 'after_treatment'
  | 'before_appointment'
  | 'no_visit_since'
  | 'lead_follow_up'

export type Channel = 'in_app' | 'email' | 'sms' | 'whatsapp'

export interface ReminderRule {
  id: ID
  name: string
  trigger: ReminderTrigger
  /** Days relative to the trigger. Negative = before. */
  offsetDays: number
  channels: Channel[]
  /** Who picks up the generated task. */
  assigneeRole: Role
  /** Days after the due date before this escalates. 0 = never. */
  escalateAfterDays: number
  /** Empty = applies to every treatment type. */
  treatmentTypeIds: ID[]
  active: boolean
  createdAt: ISODateTime
}

export type ReminderStatus = 'pending' | 'sent' | 'completed' | 'snoozed' | 'cancelled'

export interface Reminder {
  id: ID
  ruleId: ID
  patientId?: ID
  leadId?: ID
  branchId: ID
  dueAt: ISODateTime
  status: ReminderStatus
  channels: Channel[]
  /** The record that caused this reminder to exist. */
  sourceType: 'treatment' | 'appointment' | 'lead' | 'manual'
  sourceId: ID
  snoozedUntil?: ISODateTime
  snoozeReason?: string
  completedAt?: ISODateTime
  /** The task this reminder generated, if any. */
  taskId?: ID
  escalated: boolean
  createdAt: ISODateTime
}

/* -------------------------------------------------------------------------- */
/* Tasks (Part 15)                                                            */
/* -------------------------------------------------------------------------- */

export type TaskStatus = 'open' | 'completed' | 'snoozed' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high'

export interface Task {
  id: ID
  title: string
  description?: string
  branchId: ID
  assigneeId?: ID
  patientId?: ID
  leadId?: ID
  dueAt: ISODateTime
  status: TaskStatus
  priority: TaskPriority
  /** Auto-generated tasks come from the follow-up engine. */
  origin: 'auto' | 'manual'
  reminderId?: ID
  /** True once the task passed its escalation threshold. */
  escalated: boolean
  createdById?: ID
  createdAt: ISODateTime
  completedAt?: ISODateTime
  completedById?: ID
  snoozedUntil?: ISODateTime
  outcome?: string
}

/* -------------------------------------------------------------------------- */
/* Leads (Part 10)                                                            */
/* -------------------------------------------------------------------------- */

export type LeadStage = 'enquiry' | 'interested' | 'booked' | 'converted' | 'lost'

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  enquiry: 'Enquiry',
  interested: 'Interested',
  booked: 'Booked',
  converted: 'Converted',
  lost: 'Lost',
}

export type LeadSource =
  | 'walk_in'
  | 'phone'
  | 'referral'
  | 'google'
  | 'instagram'
  | 'facebook'
  | 'camp'
  | 'other'

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: 'Walk-in',
  phone: 'Phone',
  referral: 'Referral',
  google: 'Google',
  instagram: 'Instagram',
  facebook: 'Facebook',
  camp: 'Health camp',
  other: 'Other',
}

export interface LeadNote {
  id: ID
  authorId: ID
  body: string
  createdAt: ISODateTime
}

export interface Lead {
  id: ID
  name: string
  phone: string
  email?: string
  source: LeadSource
  interestedInTypeId?: ID
  stage: LeadStage
  ownerId: ID
  branchId: ID
  notes: LeadNote[]
  nextFollowUpAt?: ISODateTime
  /** Set when stage moves to booked. */
  appointmentId?: ID
  /** Set when stage moves to converted. */
  patientId?: ID
  lostReason?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/* -------------------------------------------------------------------------- */
/* Universal timeline & audit (Part 11, Part 17)                              */
/* -------------------------------------------------------------------------- */

export type TimelineEntity =
  | 'patient'
  | 'appointment'
  | 'treatment'
  | 'reminder'
  | 'task'
  | 'lead'
  | 'note'
  | 'document'
  | 'user'
  | 'settings'

/**
 * Every mutating repository call emits one of these. The patient timeline,
 * the universal timeline and the audit log are all views over this one
 * stream — no feature has to remember to log itself.
 */
export interface TimelineEvent {
  id: ID
  at: ISODateTime
  actorId: ID
  branchId: ID
  entity: TimelineEntity
  entityId: ID
  /** Verb in past tense, e.g. 'created', 'checked_in', 'cancelled'. */
  action: string
  /** One-line human-readable summary shown in the feed. */
  summary: string
  /** Attaches the event to a patient's or lead's timeline. */
  patientId?: ID
  leadId?: ID
  /** Field-level before/after, shown in the audit trail. */
  changes?: { field: string; from?: string; to?: string }[]
  /** Audit-relevant events are the security-sensitive subset. */
  audit: boolean
}

/* -------------------------------------------------------------------------- */
/* Notifications (Part 13)                                                    */
/* -------------------------------------------------------------------------- */

export interface AppNotification {
  id: ID
  userId: ID
  title: string
  body: string
  /** Where clicking the notification takes you. */
  href?: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  read: boolean
  createdAt: ISODateTime
}

/* -------------------------------------------------------------------------- */
/* Calendar (Part 14)                                                         */
/* -------------------------------------------------------------------------- */

export type BlockKind = 'leave' | 'blocked' | 'holiday'

export interface CalendarBlock {
  id: ID
  /** Absent = the whole branch is blocked. */
  userId?: ID
  branchId: ID
  kind: BlockKind
  reason: string
  startAt: ISODateTime
  endAt: ISODateTime
  createdById: ID
  createdAt: ISODateTime
}

/* -------------------------------------------------------------------------- */
/* Clinic settings (Part 18)                                                  */
/* -------------------------------------------------------------------------- */

export interface ClinicSettings {
  name: string
  tagline: string
  supportEmail: string
  supportPhone: string
  /** Reception is warned when booking outside these hours. */
  appointmentSlotMinutes: number
  /** Feature toggles for the simulated channels. */
  channels: Record<Channel, boolean>
}

/* -------------------------------------------------------------------------- */
/* The whole database                                                         */
/* -------------------------------------------------------------------------- */

export interface Database {
  /** Bumped when the seed shape changes, to invalidate stale localStorage. */
  version: number
  seededAt: ISODateTime
  settings: ClinicSettings
  branches: Branch[]
  users: User[]
  sessions: Session[]
  patients: Patient[]
  notes: Note[]
  documents: PatientDocument[]
  treatmentTypes: TreatmentType[]
  appointments: Appointment[]
  treatments: Treatment[]
  reminderRules: ReminderRule[]
  reminders: Reminder[]
  tasks: Task[]
  leads: Lead[]
  events: TimelineEvent[]
  notifications: AppNotification[]
  blocks: CalendarBlock[]
}
