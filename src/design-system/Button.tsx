import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg hover:bg-brand-hover active:brightness-95 shadow-sm',
  secondary:
    'bg-surface text-text border border-default hover:bg-surface-hover active:bg-surface-active shadow-sm',
  ghost: 'text-muted hover:bg-surface-hover hover:text-text active:bg-surface-active',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95 shadow-sm',
  link: 'text-brand underline-offset-4 hover:underline p-0! h-auto!',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Rendered before the label. Hidden while `loading`. */
  icon?: ReactNode
  iconRight?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  className,
  children,
  disabled,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      // Guard against the classic double-submit: a loading button is inert.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap',
        'transition-[background-color,color,box-shadow,filter] duration-(--duration-fast)',
        'disabled:pointer-events-none disabled:opacity-50',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        icon && <span aria-hidden className="[&_svg]:size-4">{icon}</span>
      )}
      {children}
      {iconRight && !loading && (
        <span aria-hidden className="[&_svg]:size-4">
          {iconRight}
        </span>
      )}
    </button>
  )
}

/** Groups buttons into a single joined control (e.g. day / week / month). */
export function ButtonGroup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none',
        '[&>*:not(:first-child)]:-ml-px',
        className,
      )}
    >
      {children}
    </div>
  )
}
