import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from './cn'

export interface MenuItemDef {
  label: ReactNode
  onSelect?: () => void
  icon?: ReactNode
  /** Renders in the danger tone — for destructive actions. */
  destructive?: boolean
  disabled?: boolean
  selected?: boolean
  /** Renders a divider above this item. */
  separated?: boolean
  shortcut?: string
}

/**
 * Dropdown menu. Closes on outside click, Escape, or selection; arrow keys
 * move between items.
 */
export function Menu({
  trigger,
  items,
  align = 'end',
  className,
  menuClassName,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode
  items: MenuItemDef[]
  align?: 'start' | 'end'
  className?: string
  menuClassName?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const options = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
      )
      if (options.length === 0) return
      const current = options.indexOf(document.activeElement as HTMLElement)
      const next =
        e.key === 'ArrowDown'
          ? (current + 1) % options.length
          : (current - 1 + options.length) % options.length
      options[next]?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v), id })}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={cn(
            'animate-slide-up absolute z-40 mt-1 min-w-52 overflow-hidden rounded-lg border border-default',
            'bg-surface-raised p-1 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.separated && <div role="separator" className="my-1 h-px bg-[var(--border)]" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return
                  setOpen(false)
                  item.onSelect?.()
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm',
                  'transition-colors duration-(--duration-fast)',
                  'disabled:pointer-events-none disabled:opacity-40',
                  item.destructive
                    ? 'text-danger hover:bg-danger-bg'
                    : 'text-text hover:bg-surface-hover',
                )}
              >
                {item.icon && (
                  <span aria-hidden className="shrink-0 text-subtle [&_svg]:size-4">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1 truncate">{item.label}</span>
                {item.shortcut && <kbd className="text-2xs text-subtle">{item.shortcut}</kbd>}
                {item.selected && <Check aria-hidden className="size-3.5 shrink-0 text-brand" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
