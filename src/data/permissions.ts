import type { Role } from './types'

/**
 * Part 4 — Roles & permissions.
 *
 * One matrix, one `can()`. UI gating (nav items, buttons, route guards) all
 * read from here, so the permission matrix in the PRD and the behaviour in
 * the prototype cannot drift apart.
 *
 * In production this mirrors to server-side authorisation — client checks are
 * UI affordance only and are never the security boundary.
 */

export type Permission =
  // Patients
  | 'patients.view'
  | 'patients.create'
  | 'patients.edit'
  | 'patients.archive'
  | 'patients.viewClinical'
  // Appointments
  | 'appointments.view'
  | 'appointments.create'
  | 'appointments.edit'
  | 'appointments.cancel'
  | 'appointments.complete'
  // Treatments
  | 'treatments.view'
  | 'treatments.create'
  | 'treatments.edit'
  | 'treatments.prescribe'
  // Follow-ups
  | 'followups.view'
  | 'followups.manageRules'
  | 'followups.snooze'
  // Leads
  | 'leads.view'
  | 'leads.create'
  | 'leads.edit'
  | 'leads.convert'
  // Tasks
  | 'tasks.view'
  | 'tasks.create'
  | 'tasks.assign'
  | 'tasks.complete'
  // Calendar
  | 'calendar.view'
  | 'calendar.manageBlocks'
  | 'calendar.manageOwnLeave'
  // Timeline & audit
  | 'timeline.view'
  | 'audit.view'
  // Reports
  | 'reports.view'
  | 'reports.viewFinancial'
  | 'reports.viewAllBranches'
  | 'reports.export'
  // Users
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.manageRoles'
  | 'users.endSessions'
  // Settings
  | 'settings.view'
  | 'settings.editClinic'
  | 'settings.editTreatments'
  | 'settings.editBranches'
  | 'settings.resetDemoData'

/** Permissions every signed-in role has. */
const BASE: Permission[] = [
  'patients.view',
  'appointments.view',
  'calendar.view',
  'calendar.manageOwnLeave',
  'tasks.view',
  'tasks.complete',
  'timeline.view',
]

const RECEPTIONIST: Permission[] = [
  ...BASE,
  'patients.create',
  'patients.edit',
  'appointments.create',
  'appointments.edit',
  'appointments.cancel',
  'treatments.view',
  'followups.view',
  'followups.snooze',
  'leads.view',
  'leads.create',
  'leads.edit',
  'leads.convert',
  'tasks.create',
]

const DOCTOR: Permission[] = [
  ...BASE,
  'patients.edit',
  'patients.viewClinical',
  'appointments.complete',
  'treatments.view',
  'treatments.create',
  'treatments.edit',
  'treatments.prescribe',
  'followups.view',
  'followups.snooze',
  'tasks.create',
  'reports.view',
]

const BRANCH_MANAGER: Permission[] = [
  ...RECEPTIONIST,
  'patients.archive',
  'patients.viewClinical',
  'appointments.complete',
  'calendar.manageBlocks',
  'tasks.assign',
  'reports.view',
  'reports.viewFinancial',
  'reports.export',
  'users.view',
  'settings.view',
]

const ADMIN: Permission[] = [
  ...BRANCH_MANAGER,
  'treatments.view',
  'followups.manageRules',
  'reports.viewAllBranches',
  'audit.view',
  'users.create',
  'users.edit',
  'users.endSessions',
  'settings.editClinic',
  'settings.editTreatments',
  'settings.editBranches',
  'settings.resetDemoData',
]

/**
 * The owner persona is a practising clinician who also runs the business, so
 * they hold the clinical permissions on top of everything an admin can do.
 * Admin is deliberately *not* clinical: system administration is not a licence
 * to prescribe.
 */
const OWNER: Permission[] = [
  ...ADMIN,
  'users.manageRoles',
  'treatments.create',
  'treatments.edit',
  'treatments.prescribe',
]

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(OWNER),
  admin: new Set(ADMIN),
  branch_manager: new Set(BRANCH_MANAGER),
  doctor: new Set(DOCTOR),
  receptionist: new Set(RECEPTIONIST),
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].has(permission)
}

export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p))
}

/** All permissions a role holds — powers the matrix table in Settings and the PRD. */
export function permissionsFor(role: Role): Permission[] {
  return [...MATRIX[role]].sort()
}

/**
 * Every permission in the system, for rendering the full matrix.
 *
 * Built from the union across *all* roles, not from the owner's set: a
 * permission held only by a non-owner role (clinical ones, before the owner
 * gained them) would otherwise vanish from the matrix entirely, quietly
 * under-reporting what the product can do.
 */
export const ALL_PERMISSIONS: Permission[] = [
  ...new Set(Object.values(MATRIX).flatMap((set) => [...set])),
].sort()

/**
 * Roles restricted to the branches on their user record. Owners and admins
 * see across every branch; everyone else is scoped to where they work.
 */
export function seesAllBranches(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

/** Doctors see their own patients and schedule by default. */
export function scopedToSelf(role: Role): boolean {
  return role === 'doctor'
}

export const PERMISSION_GROUPS: { label: string; prefix: string }[] = [
  { label: 'Patients', prefix: 'patients.' },
  { label: 'Appointments', prefix: 'appointments.' },
  { label: 'Treatments', prefix: 'treatments.' },
  { label: 'Follow-ups', prefix: 'followups.' },
  { label: 'Leads', prefix: 'leads.' },
  { label: 'Tasks', prefix: 'tasks.' },
  { label: 'Calendar', prefix: 'calendar.' },
  { label: 'Timeline & audit', prefix: 'timeline.' },
  { label: 'Reports', prefix: 'reports.' },
  { label: 'Users', prefix: 'users.' },
  { label: 'Settings', prefix: 'settings.' },
]
