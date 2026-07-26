import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar, Badge, cn, type Tone } from '@/design-system'
import {
  APPOINTMENT_STATUS_LABELS,
  LEAD_STAGE_LABELS,
  type AppointmentStatus,
  type LeadStage,
  type Patient,
  type Task,
  type TreatmentType,
} from '@/data/types'
import { calculateAge, daysOverdue, formatRelativeDay } from '@/lib/dates'

/* --- Status badges — one mapping, used everywhere -------------------------- */

const APPOINTMENT_TONES: Record<AppointmentStatus, Tone> = {
  scheduled: 'info',
  checked_in: 'brand',
  in_progress: 'warning',
  completed: 'success',
  no_show: 'danger',
  cancelled: 'neutral',
}

export function AppointmentStatusBadge({
  status,
  size = 'md',
}: {
  status: AppointmentStatus
  size?: 'sm' | 'md'
}) {
  return (
    <Badge tone={APPOINTMENT_TONES[status]} dot size={size}>
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  )
}

const LEAD_TONES: Record<LeadStage, Tone> = {
  enquiry: 'neutral',
  interested: 'info',
  booked: 'brand',
  converted: 'success',
  lost: 'danger',
}

export function LeadStageBadge({ stage, size = 'md' }: { stage: LeadStage; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={LEAD_TONES[stage]} dot size={size}>
      {LEAD_STAGE_LABELS[stage]}
    </Badge>
  )
}

/** Due-date badge that turns red once a task is actually late. */
export function DueBadge({ task, size = 'md' }: { task: Pick<Task, 'dueAt' | 'status'>; size?: 'sm' | 'md' }) {
  if (task.status === 'completed') {
    return (
      <Badge tone="success" size={size}>
        Done
      </Badge>
    )
  }
  if (task.status === 'snoozed') {
    return (
      <Badge tone="neutral" size={size}>
        Snoozed
      </Badge>
    )
  }
  if (task.status === 'cancelled') {
    return (
      <Badge tone="neutral" size={size}>
        Cancelled
      </Badge>
    )
  }

  const late = daysOverdue(task.dueAt)
  return (
    <Badge tone={late > 0 ? 'danger' : late === 0 ? 'warning' : 'neutral'} size={size}>
      {late > 0 ? `${late}d overdue` : formatRelativeDay(task.dueAt)}
    </Badge>
  )
}

export function TreatmentTypeBadge({ type, size = 'md' }: { type?: TreatmentType; size?: 'sm' | 'md' }) {
  if (!type) return null
  return (
    <Badge tone={type.colour} size={size}>
      {type.name}
    </Badge>
  )
}

/* --- Patient identity ------------------------------------------------------ */

/**
 * The canonical way to show a patient in a list. Always links to the record —
 * a name that is not a route to the single patient timeline is a dead end.
 */
export function PatientCell({
  patient,
  secondary,
  showAvatar = true,
}: {
  patient: Patient
  secondary?: ReactNode
  showAvatar?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {showAvatar && <Avatar name={patient.name} size="md" />}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-text">{patient.name}</span>
          {patient.status === 'archived' && (
            <Badge tone="neutral" size="sm">
              Archived
            </Badge>
          )}
        </div>
        <div className="truncate text-xs text-muted">
          {secondary ?? (
            <>
              <span className="tnum">{patient.code}</span>
              {patient.dob && <> · {calculateAge(patient.dob)}y</>}
              {' · '}
              <span className="tnum">{patient.phone}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function PatientLink({ patient, className }: { patient: Patient; className?: string }) {
  return (
    <Link
      to={`/patients/${patient.id}`}
      className={cn('font-medium text-brand hover:underline', className)}
    >
      {patient.name}
    </Link>
  )
}

/* --- Small helpers --------------------------------------------------------- */

/** Label/value row used across detail panels. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-text">{children || '—'}</dd>
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3 className="text-xs font-semibold tracking-wider text-subtle uppercase">{children}</h3>
      {action}
    </div>
  )
}

/** Marks features that look real but are not connected to anything. */
export function SimulatedNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-surface-sunken px-2.5 py-1.5 text-2xs text-subtle">
      <span aria-hidden>ⓘ</span>
      <span>{children}</span>
    </p>
  )
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
