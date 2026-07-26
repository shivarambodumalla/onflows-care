import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from './cn'

/* --- Card ----------------------------------------------------------------- */

export function Card({
  className,
  children,
  padded = true,
}: {
  className?: string
  children: ReactNode
  padded?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-default bg-surface shadow-sm',
        padded && 'p-4',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

/* --- Page header ---------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/* --- Breadcrumbs (Part 3) ------------------------------------------------- */

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex items-center gap-1 text-xs text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {item.to && !last ? (
                <Link
                  to={item.to}
                  className="truncate rounded px-1 py-0.5 hover:bg-surface-hover hover:text-text"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cn('truncate px-1 py-0.5', last && 'font-medium text-text')}
                >
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className="size-3 shrink-0 text-subtle" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* --- KPI tile (Part 5) ---------------------------------------------------- */

export function KpiTile({
  label,
  value,
  delta,
  hint,
  icon,
  to,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  /** Percentage change vs. the comparison period. Positive is not always good. */
  delta?: { value: number; goodWhen: 'up' | 'down'; label?: string }
  hint?: ReactNode
  icon?: ReactNode
  to?: string
  tone?: 'neutral' | 'warning' | 'danger'
}) {
  const good = delta ? (delta.goodWhen === 'up' ? delta.value >= 0 : delta.value <= 0) : true
  const Trend = delta && delta.value >= 0 ? TrendingUp : TrendingDown

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && (
          <span aria-hidden className="text-subtle [&_svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          'tnum mt-2 text-2xl font-semibold tracking-tight',
          tone === 'danger' && 'text-danger',
          tone === 'warning' && 'text-warning-text',
        )}
      >
        {value}
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {delta && (
          <span
            className={cn(
              'tnum inline-flex items-center gap-0.5 font-medium',
              good ? 'text-success' : 'text-danger',
            )}
          >
            <Trend aria-hidden className="size-3" />
            {delta.value >= 0 ? '+' : ''}
            {delta.value}%
          </span>
        )}
        {(delta?.label || hint) && <span className="truncate text-subtle">{delta?.label ?? hint}</span>}
      </div>
    </>
  )

  const classes = cn(
    'block rounded-xl border border-default bg-surface p-4 text-left shadow-sm',
    to && 'cursor-pointer transition-colors duration-(--duration-fast) hover:border-strong hover:bg-surface-hover',
  )

  return to ? (
    <Link to={to} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  )
}

/* --- Tabs ----------------------------------------------------------------- */

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  count?: number
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('scrollbar-thin flex gap-1 overflow-x-auto border-b border-default', className)}
    >
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative cursor-pointer px-3 py-2 text-sm font-medium whitespace-nowrap',
              'transition-colors duration-(--duration-fast)',
              selected ? 'text-brand' : 'text-muted hover:text-text',
            )}
          >
            <span className="flex items-center gap-1.5">
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className="tnum rounded-full bg-surface-active px-1.5 text-2xs text-muted">
                  {item.count}
                </span>
              )}
            </span>
            {selected && (
              <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* --- Avatar --------------------------------------------------------------- */

const AVATAR_TONES = [
  'bg-brand-bg text-brand-text',
  'bg-info-bg text-info-text',
  'bg-accent-bg text-accent-text',
  'bg-success-bg text-success-text',
  'bg-warning-bg text-warning-text',
]

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  // Stable colour per name so the same person looks the same everywhere.
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length]

  const sizes = {
    xs: 'size-5 text-2xs',
    sm: 'size-6 text-2xs',
    md: 'size-8 text-xs',
    lg: 'size-11 text-sm',
  }

  return (
    <span
      title={name}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold select-none',
        sizes[size],
        tone,
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
