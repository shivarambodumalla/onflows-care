import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { History, Search, ShieldCheck, X } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  Timeline,
  TimelineDivider,
  TimelineItem,
} from '@/design-system'
import { useApp } from '@/data/store'
import { scopedEvents, userById } from '@/data/selectors'
import { formatDate, formatRelativeTime, formatTime, isToday, toISODate } from '@/lib/dates'
import type { TimelineEntity } from '@/data/types'
import { ENTITY_LABELS, eventIcon, eventTone } from './eventPresentation'

type Mode = 'all' | 'audit'

/**
 * Part 11 — Universal timeline, and Part 17 — Audit trail.
 *
 * Both are views over the same event stream. "All activity" is the operational
 * feed; "Audit trail" filters to the security-sensitive subset and surfaces
 * field-level before/after. One stream means the two can never disagree.
 */
export function TimelinePage() {
  const { db, branch, role, user, allows } = useApp()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('all')
  const [entityFilter, setEntityFilter] = useState<TimelineEntity | ''>('')
  const [actorFilter, setActorFilter] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(60)

  const canAudit = allows('audit.view')

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )

  const events = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return scopedEvents(db, scope)
      .filter((event) => {
        if (mode === 'audit' && !event.audit) return false
        if (entityFilter && event.entity !== entityFilter) return false
        if (actorFilter && event.actorId !== actorFilter) return false
        if (!needle) return true
        return (
          event.summary.toLowerCase().includes(needle) ||
          event.action.toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => (a.at < b.at ? 1 : -1))
  }, [db, scope, mode, entityFilter, actorFilter, query])

  const visible = events.slice(0, limit)

  // Group into date sections so a long feed stays readable.
  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof visible }[] = []
    for (const event of visible) {
      const day = toISODate(event.at)
      const label = isToday(event.at) ? 'Today' : formatDate(event.at)
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.items.push(event)
      else groups.push({ label, items: [event] })
      void day
    }
    return groups
  }, [visible])

  const actors = useMemo(
    () => db.users.filter((u) => events.some((e) => e.actorId === u.id)),
    [db.users, events],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={mode === 'audit' ? 'Audit trail' : 'Activity timeline'}
        description={
          mode === 'audit'
            ? 'Security-sensitive changes with who made them and what changed'
            : `Everything that has happened in ${branch.name}`
        }
        actions={
          canAudit ? (
            <SegmentedControl
              ariaLabel="Timeline mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'all', label: 'All activity' },
                { value: 'audit', label: 'Audit trail' },
              ]}
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activity…"
            aria-label="Search the timeline"
            className="pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-subtle hover:bg-surface-hover hover:text-text"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value as TimelineEntity | '')}
          aria-label="Filter by record type"
          className="w-auto min-w-36"
        >
          <option value="">All record types</option>
          {Object.entries(ENTITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          aria-label="Filter by person"
          className="w-auto min-w-36"
        >
          <option value="">Everyone</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </Select>
      </div>

      {mode === 'audit' && (
        <p className="flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-text">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          The audit trail is immutable in production. Every entry records who acted, when, and which
          fields changed.
        </p>
      )}

      <Card>
        {visible.length === 0 ? (
          <EmptyState
            title="Nothing to show"
            description={
              query || entityFilter || actorFilter
                ? 'No activity matches these filters.'
                : 'Activity appears here as staff use the system.'
            }
            icon={History}
          />
        ) : (
          <>
            <Timeline>
              {grouped.map((group) => (
                <div key={group.label}>
                  <TimelineDivider label={group.label} />
                  {group.items.map((event, i) => (
                    <TimelineItem
                      key={event.id}
                      id={event.id}
                      icon={eventIcon(event)}
                      tone={eventTone(event)}
                      title={event.summary}
                      description={`${userById(db, event.actorId)?.name ?? 'System'} · ${ENTITY_LABELS[event.entity]}`}
                      timestamp={
                        isToday(event.at) ? formatRelativeTime(event.at) : formatTime(event.at)
                      }
                      isLast={i === group.items.length - 1}
                      onClick={
                        event.patientId
                          ? () => navigate(`/patients/${event.patientId}`)
                          : event.leadId
                            ? () => navigate(`/leads?lead=${event.leadId}`)
                            : undefined
                      }
                      meta={
                        <>
                          {event.audit && (
                            <Badge tone="info" size="sm">
                              Audited
                            </Badge>
                          )}
                          {event.changes?.map((change) => (
                            <span
                              key={change.field}
                              className="rounded bg-surface-sunken px-1.5 py-0.5 text-2xs text-muted"
                            >
                              <span className="font-medium">{change.field}</span>:{' '}
                              <span className="line-through opacity-70">{change.from ?? '—'}</span> →{' '}
                              {change.to ?? '—'}
                            </span>
                          ))}
                        </>
                      }
                    />
                  ))}
                </div>
              ))}
            </Timeline>

            {events.length > visible.length && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={() => setLimit((l) => l + 60)}>
                  Load older activity ({events.length - visible.length} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
