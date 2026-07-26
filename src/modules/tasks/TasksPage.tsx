import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  ListChecks,
  Plus,
  RotateCcw,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import {
  Badge,
  Button,
  DataTable,
  KpiTile,
  Menu,
  PageHeader,
  SegmentedControl,
  Select,
  Tabs,
  useToast,
  type Column,
} from '@/design-system'
import { DueBadge } from '@/components/common'
import { useApp, useCtx } from '@/data/store'
import { leadById, overdueTasks, patientById, scopedTasks, staffIn, userById } from '@/data/selectors'
import { assignTask, completeTask, reopenTask, snoozeTask } from '@/data/actions'
import { formatRelativeTime } from '@/lib/dates'
import type { Task } from '@/data/types'
import { NewTaskDrawer } from './NewTaskDrawer'

type Tab = 'open' | 'overdue' | 'completed' | 'all'
type Owner = 'mine' | 'everyone'

/**
 * Part 15 — Task inbox.
 *
 * Where the follow-up engine's output lands. Defaults to *my* open work
 * because an inbox showing everyone's tasks is an inbox nobody owns.
 */
export function TasksPage() {
  const { db, branch, role, user, apply, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [tab, setTab] = useState<Tab>('open')
  const [owner, setOwner] = useState<Owner>('mine')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [creating, setCreating] = useState(false)

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )
  const all = useMemo(() => scopedTasks(db, scope), [db, scope])

  const scoped = useMemo(() => {
    let rows = owner === 'mine' ? all.filter((t) => t.assigneeId === user.id) : all
    if (assigneeFilter) rows = rows.filter((t) => t.assigneeId === assigneeFilter)
    return rows
  }, [all, owner, user.id, assigneeFilter])

  const buckets = useMemo(
    () => ({
      open: scoped.filter((t) => t.status === 'open' || t.status === 'snoozed'),
      overdue: overdueTasks(scoped),
      completed: scoped.filter((t) => t.status === 'completed'),
      all: scoped,
    }),
    [scoped],
  )

  // Deep link from search: ?task=<id>
  const focused = params.get('task')
  useMemo(() => {
    if (!focused) return
    setTab('all')
    setOwner('everyone')
    const next = new URLSearchParams(params)
    next.delete('task')
    setParams(next, { replace: true })
  }, [focused, params, setParams])

  const complete = (task: Task) => {
    apply((db) => completeTask(db, ctx, task.id, 'Completed from the task inbox'))
    toast.undoable(`“${task.title}” completed`, () => {
      apply((db) => reopenTask(db, ctx, task.id))
    })
  }

  const columns = useMemo<Column<Task>[]>(
    () => [
      {
        key: 'title',
        header: 'Task',
        sortBy: (t) => t.title,
        cell: (task) => {
          const patient = patientById(db, task.patientId)
          const lead = leadById(db, task.leadId)
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-text">{task.title}</span>
                {task.origin === 'auto' && (
                  <span title="Created automatically by a follow-up rule">
                    <Sparkles aria-hidden className="size-3 shrink-0 text-brand" />
                  </span>
                )}
                {task.escalated && (
                  <Badge tone="danger" size="sm">
                    Escalated
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted">
                {patient?.name ?? lead?.name ?? task.description ?? '—'}
              </p>
            </div>
          )
        },
      },
      {
        key: 'assignee',
        header: 'Assigned to',
        hideOnMobile: true,
        sortBy: (t) => userById(db, t.assigneeId)?.name ?? 'zz',
        cell: (task) => (
          <span className="text-muted">{userById(db, task.assigneeId)?.name ?? 'Unassigned'}</span>
        ),
      },
      {
        key: 'priority',
        header: 'Priority',
        hideOnMobile: true,
        width: 'w-24',
        sortBy: (t) => ({ high: 0, normal: 1, low: 2 })[t.priority],
        cell: (task) => (
          <Badge
            tone={task.priority === 'high' ? 'danger' : task.priority === 'low' ? 'neutral' : 'info'}
            size="sm"
          >
            {task.priority}
          </Badge>
        ),
      },
      {
        key: 'due',
        header: 'Due',
        align: 'right',
        width: 'w-32',
        sortBy: (t) => t.dueAt,
        cell: (task) => <DueBadge task={task} size="sm" />,
      },
    ],
    [db],
  )

  const rows = buckets[tab]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tasks"
        description={
          owner === 'mine' ? `Your work in ${branch.name}` : `All work in ${branch.name}`
        }
        actions={
          allows('tasks.create') ? (
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
              New task
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Open" value={buckets.open.length} icon={<Inbox />} />
        <KpiTile
          label="Overdue"
          value={buckets.overdue.length}
          icon={<AlertTriangle />}
          tone={buckets.overdue.length > 0 ? 'danger' : 'neutral'}
        />
        <KpiTile
          label="Escalated"
          value={scoped.filter((t) => t.escalated && t.status === 'open').length}
          icon={<AlertTriangle />}
        />
        <KpiTile
          label="Auto-generated"
          value={scoped.filter((t) => t.origin === 'auto').length}
          hint="by follow-up rules"
          icon={<Sparkles />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          ariaLabel="Task ownership"
          value={owner}
          onChange={setOwner}
          options={[
            { value: 'mine', label: 'Assigned to me' },
            { value: 'everyone', label: 'Everyone' },
          ]}
        />

        {owner === 'everyone' && allows('tasks.assign') && (
          <Select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label="Filter by assignee"
            className="w-auto min-w-40"
          >
            <option value="">All staff</option>
            {staffIn(db, branch.id).map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Tabs
        ariaLabel="Task status"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'open', label: 'Open', count: buckets.open.length },
          { value: 'overdue', label: 'Overdue', count: buckets.overdue.length },
          { value: 'completed', label: 'Completed', count: buckets.completed.length },
          { value: 'all', label: 'All', count: buckets.all.length },
        ]}
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(t) => t.id}
        initialSort={{ key: 'due', direction: 'asc' }}
        onRowClick={(task) => {
          if (task.patientId) navigate(`/patients/${task.patientId}`)
          else if (task.leadId) navigate(`/leads?lead=${task.leadId}`)
        }}
        emptyState={{
          title:
            tab === 'overdue'
              ? 'Nothing overdue'
              : tab === 'open'
                ? 'Inbox zero'
                : tab === 'completed'
                  ? 'Nothing completed yet'
                  : 'No tasks',
          description:
            tab === 'overdue'
              ? 'Every task is on time.'
              : owner === 'mine'
                ? 'Nothing is assigned to you right now. Switch to Everyone to see the branch’s work.'
                : 'Tasks appear here when follow-up rules fire, or when someone creates one.',
          icon: tab === 'overdue' ? CheckCircle2 : ListChecks,
          action:
            owner === 'mine' ? (
              <Button size="sm" variant="secondary" onClick={() => setOwner('everyone')}>
                Show everyone’s tasks
              </Button>
            ) : undefined,
        }}
        rowActions={(task) => (
          <Menu
            label={`Actions for ${task.title}`}
            items={[
              ...(task.status === 'open' || task.status === 'snoozed'
                ? [
                    {
                      label: 'Mark as done',
                      icon: <CheckCircle2 />,
                      onSelect: () => complete(task),
                    },
                    {
                      label: 'Snooze 3 days',
                      icon: <Clock />,
                      onSelect: () => {
                        apply((db) => snoozeTask(db, ctx, task.id, 3))
                        toast.undoable('Task snoozed for 3 days', () => {})
                      },
                    },
                    {
                      label: 'Snooze 1 week',
                      icon: <Clock />,
                      onSelect: () => {
                        apply((db) => snoozeTask(db, ctx, task.id, 7))
                        toast.undoable('Task snoozed for a week', () => {})
                      },
                    },
                  ]
                : [
                    {
                      label: 'Reopen',
                      icon: <RotateCcw />,
                      onSelect: () => {
                        apply((db) => reopenTask(db, ctx, task.id))
                        toast.success('Task reopened')
                      },
                    },
                  ]),
              ...(allows('tasks.assign')
                ? [
                    {
                      label: 'Assign to me',
                      icon: <UserCheck />,
                      separated: true,
                      onSelect: () => {
                        apply((db) => assignTask(db, ctx, task.id, user.id))
                        toast.success(`“${task.title}” assigned to you`)
                      },
                    },
                  ]
                : []),
            ]}
            trigger={({ toggle, open }) => (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-expanded={open}
                aria-label={`Actions for ${task.title}`}
              >
                <ListChecks className="size-4" />
              </Button>
            )}
          />
        )}
      />

      {rows.length > 0 && tab === 'completed' && (
        <p className="text-xs text-subtle">
          Showing {rows.length} completed tasks. Completion is recorded on the patient timeline with
          who closed it and when — {formatRelativeTime(rows[0]!.completedAt ?? rows[0]!.createdAt)}{' '}
          for the most recent.
        </p>
      )}

      <NewTaskDrawer open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
