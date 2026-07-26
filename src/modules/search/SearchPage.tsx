import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  Bookmark,
  BookmarkPlus,
  CalendarDays,
  ClipboardList,
  FileText,
  ListChecks,
  Search as SearchIcon,
  Trash2,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  cn,
  useToast,
} from '@/design-system'
import { useApp } from '@/data/store'
import {
  buildSearchIndex,
  loadSavedSearches,
  RESULT_KIND_LABELS,
  saveSavedSearches,
  search,
  type ResultKind,
  type SavedSearch,
} from '@/data/search'
import { uid } from '@/lib/id'

const KIND_ICONS: Record<ResultKind, LucideIcon> = {
  patient: UserRound,
  appointment: CalendarDays,
  lead: ClipboardList,
  task: ListChecks,
  document: FileText,
  user: Users,
}

const ALL_KINDS: ResultKind[] = ['patient', 'appointment', 'lead', 'task', 'document', 'user']

/**
 * Part 12 — Search results.
 *
 * The palette handles "I know what I want"; this page handles "show me
 * everything matching" — with kind filters and saved searches for the queries
 * staff run every week.
 */
export function SearchPage() {
  const { db, visibleBranchIds } = useApp()
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const query = params.get('q') ?? ''
  const [kinds, setKinds] = useState<ResultKind[]>([])
  const [saved, setSaved] = useState<SavedSearch[]>(() => loadSavedSearches())

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  const index = useMemo(() => buildSearchIndex(db), [db])

  const results = useMemo(
    () =>
      search(index, query, {
        kinds: kinds.length > 0 ? kinds : undefined,
        branchIds: visibleBranchIds,
        limit: 100,
      }),
    [index, query, kinds, visibleBranchIds],
  )

  // Counts per kind, computed without the kind filter so the chips stay useful.
  const counts = useMemo(() => {
    const unfiltered = search(index, query, { branchIds: visibleBranchIds, limit: 500 })
    const map = new Map<ResultKind, number>()
    for (const result of unfiltered) map.set(result.kind, (map.get(result.kind) ?? 0) + 1)
    return map
  }, [index, query, visibleBranchIds])

  useEffect(() => saveSavedSearches(saved), [saved])

  const toggleKind = (kind: ResultKind) =>
    setKinds((current) =>
      current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind],
    )

  const saveCurrent = () => {
    if (!query.trim()) return
    const entry: SavedSearch = {
      id: uid('saved'),
      label: query.trim(),
      query: query.trim(),
      kinds: kinds.length > 0 ? kinds : undefined,
    }
    setSaved((current) => [entry, ...current.filter((s) => s.query !== entry.query)].slice(0, 12))
    toast.success('Search saved')
  }

  const grouped = useMemo(() => {
    const map = new Map<ResultKind, typeof results>()
    for (const result of results) {
      const list = map.get(result.kind) ?? []
      list.push(result)
      map.set(result.kind, list)
    }
    return [...map.entries()]
  }, [results])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Search"
        description={query ? `${results.length} results for “${query}”` : 'Search across every record'}
        actions={
          query ? (
            <Button variant="secondary" icon={<BookmarkPlus />} onClick={saveCurrent}>
              Save this search
            </Button>
          ) : undefined
        }
      />

      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patients, appointments, leads, tasks, documents…"
          aria-label="Search everything"
          className="h-11 pl-10 text-base"
          autoFocus
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded p-1 text-subtle hover:bg-surface-hover hover:text-text"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* --- Kind filters --------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-1.5">
        {ALL_KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind]
          const active = kinds.includes(kind)
          const count = counts.get(kind) ?? 0
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              aria-pressed={active}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-brand bg-brand text-brand-fg'
                  : 'border-default bg-surface text-muted hover:border-strong hover:text-text',
                count === 0 && !active && 'opacity-50',
              )}
            >
              <Icon aria-hidden className="size-3" />
              {RESULT_KIND_LABELS[kind]}
              {count > 0 && <span className="tnum opacity-70">{count}</span>}
            </button>
          )
        })}
        {kinds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setKinds([])}>
            Clear filters
          </Button>
        )}
      </div>

      {/* --- Saved searches ------------------------------------------------- */}
      {saved.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Bookmark aria-hidden className="size-3.5" />
              Saved
            </span>
            {saved.map((entry) => (
              <span key={entry.id} className="group inline-flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setQuery(entry.query)
                    setKinds(entry.kinds ?? [])
                  }}
                  className="cursor-pointer rounded-l-full border border-default bg-surface px-2.5 py-1 text-xs hover:bg-surface-hover"
                >
                  {entry.label}
                </button>
                <button
                  type="button"
                  aria-label={`Remove saved search ${entry.label}`}
                  onClick={() => setSaved((current) => current.filter((s) => s.id !== entry.id))}
                  className="cursor-pointer rounded-r-full border border-l-0 border-default bg-surface px-1.5 py-1 text-subtle hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 aria-hidden className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* --- Results -------------------------------------------------------- */}
      {!query ? (
        <Card>
          <EmptyState
            title="Start typing to search"
            description="One index covers patients, appointments, leads, tasks, documents and staff. Try a phone number, a patient code, or part of a name."
            icon={SearchIcon}
          />
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <EmptyState
            title={`Nothing matches “${query}”`}
            description="Try fewer words, a partial name, or the last digits of a phone number."
            action={
              kinds.length > 0 ? (
                <Button size="sm" variant="secondary" onClick={() => setKinds([])}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([kind, items]) => {
            const Icon = KIND_ICONS[kind]
            return (
              <Card key={kind} padded={false}>
                <div className="flex items-center gap-2 border-b border-default px-4 py-2.5">
                  <Icon aria-hidden className="size-4 text-subtle" />
                  <h2 className="text-sm font-semibold">{RESULT_KIND_LABELS[kind]}</h2>
                  <Badge tone="neutral" size="sm">
                    {items.length}
                  </Badge>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {items.map((result) => (
                    <li key={`${result.kind}-${result.id}`}>
                      <button
                        type="button"
                        onClick={() => navigate(result.href)}
                        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hover"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-text">
                            {result.title}
                          </span>
                          <span className="block truncate text-xs text-muted">{result.subtitle}</span>
                        </span>
                        {result.detail && (
                          <span className="hidden shrink-0 text-xs text-subtle sm:block">
                            {result.detail}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
