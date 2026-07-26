import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from './cn'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared overlay behaviour for Dialog and Drawer (Part 21 interaction spec):
 * Escape closes, focus moves in on open and back to the trigger on close,
 * Tab is trapped inside, and the page behind is scroll-locked.
 */
function useOverlayBehaviour(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreTo.current = document.activeElement as HTMLElement | null

    const node = ref.current
    // Prefer the first real control; fall back to the container itself.
    const first = node?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? node)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !node) return

      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    const { overflow, paddingRight } = document.body.style
    // Compensate for the scrollbar so the page doesn't jump on open.
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap > 0) document.body.style.paddingRight = `${gap}px`

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  return ref
}

function Scrim({ onClose }: { onClose: () => void }) {
  return (
    <div
      aria-hidden
      onClick={onClose}
      className="animate-fade-in fixed inset-0 bg-ink-950/40 backdrop-blur-[1px] dark:bg-ink-950/65"
    />
  )
}

/* --- Dialog --------------------------------------------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useOverlayBehaviour(open, onClose)
  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <Scrim onClose={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'animate-slide-up relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl',
          'border border-default bg-surface-raised shadow-overlay outline-none',
          widths[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-text">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="size-4" />
          </Button>
        </header>

        {children && <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-4">{children}</div>}

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-default bg-surface-sunken px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Destructive-action confirmation. Dialogs are reserved for exactly this. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

/* --- Drawer --------------------------------------------------------------- */

/**
 * Side panel for quick-create and quick-view. Preferred over Dialog for
 * anything with a form: it keeps the list behind visible, which is what
 * "minimal clicks" actually needs at a reception desk.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg' | 'xl'
}) {
  const ref = useOverlayBehaviour(open, onClose)
  if (!open) return null

  const widths = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <Scrim onClose={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'animate-slide-in-right absolute inset-y-0 right-0 flex w-full flex-col',
          'border-l border-default bg-surface shadow-overlay outline-none',
          widths[width],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-default px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-text">{title}</h2>
            {description && <p className="mt-0.5 truncate text-xs text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="size-4" />
          </Button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-default bg-surface-sunken px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
