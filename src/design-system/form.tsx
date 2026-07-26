import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from './cn'

const CONTROL = cn(
  'w-full rounded-lg border border-default bg-surface px-3 text-sm text-text',
  'placeholder:text-subtle',
  'transition-[border-color,box-shadow] duration-(--duration-fast)',
  'hover:border-strong',
  'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-subtle',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/25',
)

/* -------------------------------------------------------------------------- */
/* Field — the single owner of label / hint / error wiring.                    */
/* Every control below is meant to be wrapped in one, so a11y associations     */
/* are never hand-rolled per form.                                             */
/* -------------------------------------------------------------------------- */

export interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
  /** Receives the ids to wire onto the control. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
          {required && (
            <span aria-hidden className="ml-0.5 text-danger">
              *
            </span>
          )}
        </label>
      )}
      {children({ id, describedBy: describedBy || undefined, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export function Input({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(CONTROL, 'h-9', className)} {...props} />
}

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(CONTROL, 'min-h-20 py-2 leading-relaxed', className)} {...props} />
}

export function Select({
  className,
  children,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(CONTROL, 'h-9 cursor-pointer appearance-none pr-8', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-subtle"
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label
      className={cn(
        'group inline-flex cursor-pointer items-center gap-2 text-sm select-none',
        props.disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className="relative grid size-4 shrink-0 place-items-center">
        <input type="checkbox" className="peer sr-only" {...props} />
        <span
          aria-hidden
          className={cn(
            'size-4 rounded border border-strong bg-surface',
            'transition-colors duration-(--duration-fast)',
            'group-hover:border-brand',
            'peer-checked:border-brand peer-checked:bg-brand',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-focus-visible:ring-offset-1',
          )}
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute size-3 text-brand-fg opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label}
    </label>
  )
}

export function Switch({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label
      className={cn(
        'group inline-flex cursor-pointer items-center gap-2.5 text-sm select-none',
        props.disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className="relative inline-flex">
        <input type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span
          aria-hidden
          className={cn(
            'h-5 w-9 rounded-full bg-surface-active transition-colors duration-(--duration-base)',
            'peer-checked:bg-brand',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-focus-visible:ring-offset-1',
          )}
        />
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm',
            'transition-transform duration-(--duration-base) ease-(--ease-out-soft)',
            'peer-checked:translate-x-4',
          )}
        />
      </span>
      {label}
    </label>
  )
}

/* -------------------------------------------------------------------------- */

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

/** Compact view switcher — day/week/month, list/board. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-default bg-surface-sunken p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap',
              'transition-colors duration-(--duration-fast)',
              selected
                ? 'bg-surface text-text shadow-sm'
                : 'text-muted hover:text-text',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
