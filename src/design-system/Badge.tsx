import type { ReactNode } from 'react'
import { cn } from './cn'

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-muted border-default',
  brand: 'bg-brand-bg text-brand-text border-brand/20',
  success: 'bg-success-bg text-success-text border-success/20',
  warning: 'bg-warning-bg text-warning-text border-warning/25',
  danger: 'bg-danger-bg text-danger-text border-danger/20',
  info: 'bg-info-bg text-info-text border-info/20',
  accent: 'bg-accent-bg text-accent-text border-accent/20',
}

const DOTS: Record<Tone, string> = {
  neutral: 'bg-subtle',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
}

export function Badge({
  tone = 'neutral',
  dot = false,
  size = 'md',
  className,
  children,
}: {
  tone?: Tone
  /** Adds a status dot — use for lifecycle states, not for counts. */
  dot?: boolean
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0 text-2xs' : 'px-2 py-0.5 text-xs',
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  )
}

/** Small count pill for nav items and tabs. */
export function Count({
  value,
  tone = 'neutral',
  className,
}: {
  value: number
  tone?: Tone
  className?: string
}) {
  if (value <= 0) return null
  return (
    <span
      className={cn(
        'tnum inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-2xs font-semibold',
        tone === 'danger'
          ? 'bg-danger text-white'
          : tone === 'brand'
            ? 'bg-brand text-brand-fg'
            : 'bg-surface-active text-muted',
        className,
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}
