import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CloudOff,
  Inbox,
  Loader2,
  Lock,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { Button } from './Button'
import { cn } from './cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden
      className={cn('size-4 animate-spin text-subtle', className)}
    />
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-shimmer rounded-md', className)} />
}

/** Table-shaped skeleton so loading keeps the page's real rhythm. */
export function SkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-px" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn('h-3.5', c === 0 ? 'w-40' : c === cols - 1 ? 'w-16' : 'w-24')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Part 22 — Screen states. Every list and detail view routes its non-happy    */
/* paths through here, so the five states look and behave identically          */
/* across all 20+ modules.                                                     */
/* -------------------------------------------------------------------------- */

export type StateKind = 'loading' | 'empty' | 'error' | 'offline' | 'denied'

const PRESETS: Record<
  Exclude<StateKind, 'loading'>,
  { icon: LucideIcon; title: string; description: string; tone: string }
> = {
  empty: {
    icon: Inbox,
    title: 'Nothing here yet',
    description: 'When there is something to show, it will appear here.',
    tone: 'text-subtle',
  },
  error: {
    icon: AlertTriangle,
    title: 'Something went wrong',
    description: 'We could not load this. Try again, and if it persists, contact support.',
    tone: 'text-danger',
  },
  offline: {
    icon: CloudOff,
    title: "You're offline",
    description: 'Showing the last data loaded on this device. Changes will not be saved.',
    tone: 'text-warning',
  },
  denied: {
    icon: Lock,
    title: 'You do not have access',
    description: 'Your role cannot view this. Ask an administrator if you need access.',
    tone: 'text-muted',
  },
}

export interface StateViewProps {
  kind: StateKind
  title?: string
  description?: ReactNode
  /** Primary call to action — omit for `denied`, which is intentionally a dead end. */
  action?: ReactNode
  onRetry?: () => void
  icon?: LucideIcon
  className?: string
  /** `inline` sits inside a card; `page` centres in the full content area. */
  size?: 'inline' | 'page'
}

export function StateView({
  kind,
  title,
  description,
  action,
  onRetry,
  icon,
  className,
  size = 'inline',
}: StateViewProps) {
  if (kind === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex flex-col items-center justify-center gap-3 text-center',
          size === 'page' ? 'min-h-[60vh]' : 'py-14',
          className,
        )}
      >
        <Spinner className="size-5" />
        <p className="text-sm text-muted">{title ?? 'Loading…'}</p>
      </div>
    )
  }

  const preset = PRESETS[kind]
  const Icon = icon ?? preset.icon

  return (
    <div
      role={kind === 'error' ? 'alert' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-6 text-center',
        size === 'page' ? 'min-h-[60vh]' : 'py-14',
        className,
      )}
    >
      <span
        className={cn(
          'mb-2 grid size-11 place-items-center rounded-full bg-surface-sunken',
          preset.tone,
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <h3 className="text-sm font-semibold text-text">{title ?? preset.title}</h3>
      <p className="max-w-sm text-sm text-muted">{description ?? preset.description}</p>
      {(action || onRetry) && (
        <div className="mt-4 flex items-center gap-2">
          {action}
          {onRetry && (
            <Button variant="secondary" size="sm" icon={<RefreshCw />} onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Convenience wrapper for the most common case. */
export function EmptyState(props: Omit<StateViewProps, 'kind'>) {
  return <StateView kind="empty" {...props} />
}
