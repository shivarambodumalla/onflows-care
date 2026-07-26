import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  CornerDownLeft,
  FileText,
  ListChecks,
  Search,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/design-system'
import { useApp } from '@/data/store'
import { buildSearchIndex, search, type ResultKind, type SearchResult } from '@/data/search'
import { NAV_ITEMS } from './nav'

const KIND_ICONS: Record<ResultKind, LucideIcon> = {
  patient: UserRound,
  appointment: CalendarDays,
  lead: ClipboardList,
  task: ListChecks,
  document: FileText,
  user: Users,
}

interface Command {
  id: string
  icon: LucideIcon
  title: string
  subtitle?: string
  group: string
  run: () => void
}

/**
 * Part 12 / Part 21 — global search and the keyboard path to everything.
 *
 * Opening with ⌘K and typing three characters of a patient's name should be
 * the fastest way to reach any record in the product; that is the whole point
 * of "everything searchable" and "minimal clicks".
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, visibleBranchIds, allows } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const index = useMemo(() => (open ? buildSearchIndex(db) : []), [db, open])

  const results = useMemo<SearchResult[]>(
    () => (query ? search(index, query, { branchIds: visibleBranchIds, limit: 12 }) : []),
    [index, query, visibleBranchIds],
  )

  const commands = useMemo<Command[]>(() => {
    const navCommands: Command[] = NAV_ITEMS.filter(
      (item) => !item.permission || allows(item.permission),
    )
      .filter((item) => !query || item.label.toLowerCase().includes(query.toLowerCase()))
      .map((item) => ({
        id: `nav:${item.to}`,
        icon: item.icon,
        title: item.label,
        group: 'Go to',
        run: () => navigate(item.to),
      }))

    const resultCommands: Command[] = results.map((result) => ({
      id: `res:${result.kind}:${result.id}`,
      icon: KIND_ICONS[result.kind],
      title: result.title,
      subtitle: result.subtitle,
      group: result.kind === 'patient' ? 'Patients' : 'Records',
      run: () => navigate(result.href),
    }))

    // Records first once the user has typed — they are what the query is for.
    const all = query ? [...resultCommands, ...navCommands.slice(0, 4)] : navCommands
    if (query.trim().length > 0) {
      all.push({
        id: 'search:all',
        icon: Search,
        title: `Search everywhere for “${query.trim()}”`,
        group: 'Search',
        run: () => navigate(`/search?q=${encodeURIComponent(query.trim())}`),
      })
    }
    return all
  }, [results, query, navigate, allows])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    // Focus after paint so the caret lands reliably.
    const timer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => setActive(0), [query])

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const choose = (command: Command) => {
    command.run()
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(commands.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + commands.length) % Math.max(commands.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const command = commands[active]
      if (command) choose(command)
    }
  }

  let lastGroup = ''

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[10vh]">
      <div
        aria-hidden
        onClick={onClose}
        className="animate-fade-in fixed inset-0 bg-ink-950/40 backdrop-blur-[2px] dark:bg-ink-950/70"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        onKeyDown={onKeyDown}
        className="animate-slide-up relative flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-default bg-surface-raised shadow-overlay"
      >
        <div className="flex items-center gap-3 border-b border-default px-4">
          <Search aria-hidden className="size-4 shrink-0 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients, appointments, leads, tasks…"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-sm text-text placeholder:text-subtle focus:outline-none"
          />
          <kbd className="hidden rounded border border-default bg-surface px-1.5 py-0.5 text-2xs text-subtle sm:block">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="scrollbar-thin max-h-80 overflow-y-auto p-1.5">
          {commands.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-subtle">
              {query ? `Nothing matches “${query}”.` : 'Start typing to search.'}
            </p>
          ) : (
            commands.map((command, i) => {
              const showGroup = command.group !== lastGroup
              lastGroup = command.group
              const Icon = command.icon

              return (
                <div key={command.id}>
                  {showGroup && (
                    <p className="px-2.5 pt-2 pb-1 text-2xs font-semibold tracking-wider text-subtle uppercase">
                      {command.group}
                    </p>
                  )}
                  <button
                    type="button"
                    data-active={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(command)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left',
                      i === active ? 'bg-brand-bg text-brand-text' : 'text-text hover:bg-surface-hover',
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn('size-4 shrink-0', i === active ? 'text-brand' : 'text-subtle')}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{command.title}</span>
                      {command.subtitle && (
                        <span className="block truncate text-xs text-muted">{command.subtitle}</span>
                      )}
                    </span>
                    {i === active && <CornerDownLeft aria-hidden className="size-3.5 shrink-0 text-brand" />}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-default bg-surface-sunken px-4 py-2 text-2xs text-subtle">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-default bg-surface px-1">↑</kbd>
            <kbd className="rounded border border-default bg-surface px-1">↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-default bg-surface px-1">↵</kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1">
            Search everywhere <ArrowRight aria-hidden className="size-3" />
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
