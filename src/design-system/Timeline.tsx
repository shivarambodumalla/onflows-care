import type { ReactNode } from 'react'
import { cn } from './cn'
import type { Tone } from './Badge'

export interface TimelineItemProps {
  id: string
  icon: ReactNode
  tone?: Tone
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  /** Right-aligned timestamp. */
  timestamp: ReactNode
  /** Extra detail rendered under the description (e.g. a note body). */
  body?: ReactNode
  onClick?: () => void
}

const TONE_RING: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-subtle',
  brand: 'bg-brand-bg text-brand',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  accent: 'bg-accent-bg text-accent',
}

/**
 * Vertical activity feed — the shared rendering for the patient timeline,
 * the universal timeline, and the audit trail (Parts 6, 11, 17).
 */
export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn('relative flex flex-col', className)}>{children}</ol>
}

export function TimelineItem({
  icon,
  tone = 'neutral',
  title,
  description,
  meta,
  timestamp,
  body,
  onClick,
  isLast = false,
}: TimelineItemProps & { isLast?: boolean }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* Connector: stops at the last item so the rail doesn't dangle. */}
      {!isLast && (
        <span
          aria-hidden
          className="absolute top-8 left-[15px] h-[calc(100%-1.5rem)] w-px bg-[var(--border)]"
        />
      )}

      <span
        aria-hidden
        className={cn(
          'z-10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-[var(--surface)]',
          '[&_svg]:size-3.5',
          TONE_RING[tone],
        )}
      >
        {icon}
      </span>

      <div
        onClick={onClick}
        className={cn(
          'min-w-0 flex-1 rounded-lg px-2 py-1.5 -my-0.5',
          onClick && 'cursor-pointer transition-colors hover:bg-surface-hover',
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-medium text-text">{title}</p>
          <time className="tnum shrink-0 text-xs text-subtle">{timestamp}</time>
        </div>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        {body && (
          <div className="mt-2 rounded-lg border border-default bg-surface-sunken px-3 py-2 text-sm text-muted">
            {body}
          </div>
        )}
        {meta && <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">{meta}</div>}
      </div>
    </li>
  )
}

/** Date separator between groups of timeline items. */
export function TimelineDivider({ label }: { label: string }) {
  return (
    <li className="relative flex items-center gap-3 py-2">
      <span className="z-10 rounded-full bg-surface-sunken px-2 py-0.5 text-2xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-[var(--border)]" />
    </li>
  )
}
