import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Plus,
  Repeat,
  Smartphone,
  Zap,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  KpiTile,
  Menu,
  PageHeader,
  Switch,
  Tabs,
  useToast,
  type Column,
} from '@/design-system'
import { DueBadge } from '@/components/common'
import { useApp, useCtx } from '@/data/store'
import { leadById, patientById, scopedReminders } from '@/data/selectors'
import { completeReminder, snoozeReminder, toggleReminderRule } from '@/data/actions'
import type { Channel, Reminder, ReminderRule } from '@/data/types'
import { RuleDrawer } from './RuleDrawer'

type Tab = 'due' | 'upcoming' | 'snoozed' | 'history' | 'rules'

const CHANNEL_ICONS: Record<Channel, typeof Mail> = {
  in_app: Zap,
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageSquare,
}

const CHANNEL_LABELS: Record<Channel, string> = {
  in_app: 'In-app',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}

/**
 * Part 9 — Follow-up engine.
 *
 * Two halves: the rules that decide when a chase should happen, and the
 * reminders those rules have already produced. Showing them on one screen is
 * what makes the automation legible — you can see the rule and its output
 * side by side instead of wondering why a task appeared.
 */
export function FollowUpsPage() {
  const { db, branch, role, user, apply, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('due')
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null)
  const [creatingRule, setCreatingRule] = useState(false)

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )
  const reminders = useMemo(() => scopedReminders(db, scope), [db, scope])

  const buckets = useMemo(() => {
    const nowMs = Date.now()
    return {
      due: reminders.filter(
        (r) => (r.status === 'pending' || r.status === 'sent') && new Date(r.dueAt).getTime() <= nowMs,
      ),
      upcoming: reminders.filter(
        (r) => r.status === 'pending' && new Date(r.dueAt).getTime() > nowMs,
      ),
      snoozed: reminders.filter((r) => r.status === 'snoozed'),
      history: reminders.filter((r) => r.status === 'completed' || r.status === 'cancelled'),
    }
  }, [reminders])

  const escalated = buckets.due.filter((r) => r.escalated).length

  const subjectOf = (reminder: Reminder) => {
    if (reminder.patientId) return patientById(db, reminder.patientId)
    if (reminder.leadId) return leadById(db, reminder.leadId)
    return undefined
  }

  const columns = useMemo<Column<Reminder>[]>(
    () => [
      {
        key: 'subject',
        header: 'Who',
        sortBy: (r) => subjectOf(r)?.name ?? '',
        cell: (reminder) => {
          const subject = subjectOf(reminder)
          const isLead = Boolean(reminder.leadId)
          return (
            <div className="min-w-0">
              <p className="truncate font-medium text-text">{subject?.name ?? 'Unknown'}</p>
              <p className="truncate text-xs text-muted">
                {isLead ? 'Enquiry' : (subject as { code?: string })?.code ?? 'Patient'}
                {' · '}
                {subject?.phone}
              </p>
            </div>
          )
        },
      },
      {
        key: 'rule',
        header: 'Rule',
        hideOnMobile: true,
        sortBy: (r) => db.reminderRules.find((rule) => rule.id === r.ruleId)?.name ?? '',
        cell: (reminder) => {
          const rule = db.reminderRules.find((r) => r.id === reminder.ruleId)
          return <span className="text-muted">{rule?.name ?? '—'}</span>
        },
      },
      {
        key: 'channels',
        header: 'Channels',
        hideOnMobile: true,
        cell: (reminder) => (
          <div className="flex gap-1">
            {reminder.channels.map((channel) => {
              const Icon = CHANNEL_ICONS[channel]
              return (
                <span
                  key={channel}
                  title={CHANNEL_LABELS[channel]}
                  className="grid size-6 place-items-center rounded-md bg-surface-sunken text-subtle"
                >
                  <Icon aria-hidden className="size-3" />
                </span>
              )
            })}
          </div>
        ),
      },
      {
        key: 'due',
        header: 'Due',
        align: 'right',
        width: 'w-32',
        sortBy: (r) => r.dueAt,
        cell: (reminder) => (
          <div className="flex items-center justify-end gap-1.5">
            {reminder.escalated && (
              <Badge tone="danger" size="sm">
                Escalated
              </Badge>
            )}
            <DueBadge
              task={{
                dueAt: reminder.snoozedUntil ?? reminder.dueAt,
                status: reminder.status === 'snoozed' ? 'snoozed' : 'open',
              }}
              size="sm"
            />
          </div>
        ),
      },
    ],
    [db.reminderRules, db],
  )

  const ruleColumns = useMemo<Column<ReminderRule>[]>(
    () => [
      {
        key: 'name',
        header: 'Rule',
        sortBy: (r) => r.name,
        cell: (rule) => (
          <div>
            <p className="font-medium text-text">{rule.name}</p>
            <p className="text-xs text-muted">
              {rule.trigger === 'after_treatment'
                ? `${rule.offsetDays} days after a treatment`
                : rule.trigger === 'before_appointment'
                  ? `${Math.abs(rule.offsetDays)} days before an appointment`
                  : rule.trigger === 'no_visit_since'
                    ? `${rule.offsetDays} days without a visit`
                    : `Every ${rule.offsetDays} days while an enquiry is open`}
            </p>
          </div>
        ),
      },
      {
        key: 'applies',
        header: 'Applies to',
        hideOnMobile: true,
        cell: (rule) =>
          rule.treatmentTypeIds.length === 0 ? (
            <span className="text-muted">All treatments</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {rule.treatmentTypeIds.map((id) => (
                <Badge key={id} tone="neutral" size="sm">
                  {db.treatmentTypes.find((t) => t.id === id)?.name ?? id}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        key: 'assignee',
        header: 'Assigned to',
        hideOnMobile: true,
        cell: (rule) => <span className="text-muted capitalize">{rule.assigneeRole.replace('_', ' ')}</span>,
      },
      {
        key: 'escalation',
        header: 'Escalates',
        hideOnMobile: true,
        cell: (rule) =>
          rule.escalateAfterDays > 0 ? (
            <Badge tone="warning" size="sm">
              after {rule.escalateAfterDays}d
            </Badge>
          ) : (
            <span className="text-subtle">Never</span>
          ),
      },
      {
        key: 'generated',
        header: 'Generated',
        align: 'right',
        width: 'w-24',
        sortBy: (r) => reminders.filter((rem) => rem.ruleId === r.id).length,
        cell: (rule) => (
          <span className="tnum text-muted">
            {reminders.filter((r) => r.ruleId === rule.id).length}
          </span>
        ),
      },
      {
        key: 'active',
        header: 'Active',
        align: 'right',
        width: 'w-20',
        cell: (rule) => (
          <Switch
            checked={rule.active}
            disabled={!allows('followups.manageRules')}
            onChange={() => {
              apply((db) => toggleReminderRule(db, ctx, rule.id))
              toast.success(rule.active ? `“${rule.name}” disabled` : `“${rule.name}” enabled`)
            }}
            aria-label={`${rule.active ? 'Disable' : 'Enable'} ${rule.name}`}
          />
        ),
      },
    ],
    [db.treatmentTypes, reminders, allows, apply, ctx, toast],
  )

  const rows =
    tab === 'due'
      ? buckets.due
      : tab === 'upcoming'
        ? buckets.upcoming
        : tab === 'snoozed'
          ? buckets.snoozed
          : buckets.history

  const rowActions = (reminder: Reminder) => (
    <Menu
      label="Follow-up actions"
      items={[
        {
          label: 'Open record',
          onSelect: () =>
            navigate(reminder.patientId ? `/patients/${reminder.patientId}` : `/leads?lead=${reminder.leadId}`),
        },
        ...(allows('followups.snooze') && reminder.status !== 'completed' && reminder.status !== 'cancelled'
          ? [
              {
                label: 'Mark as done',
                icon: <CheckCircle2 />,
                separated: true,
                onSelect: () => {
                  apply((db) => completeReminder(db, ctx, reminder.id, 'Completed from follow-ups'))
                  toast.undoable('Follow-up completed', () => {})
                },
              },
              { label: 'Snooze 3 days', icon: <Clock />, onSelect: () => snooze(reminder, 3) },
              { label: 'Snooze 1 week', icon: <Clock />, onSelect: () => snooze(reminder, 7) },
              { label: 'Snooze 1 month', icon: <Clock />, onSelect: () => snooze(reminder, 30) },
            ]
          : []),
      ]}
      trigger={({ toggle, open }) => (
        <Button variant="ghost" size="icon" onClick={toggle} aria-expanded={open} aria-label="Follow-up actions">
          <Clock className="size-4" />
        </Button>
      )}
    />
  )

  const snooze = (reminder: Reminder, days: number) => {
    apply((db) => snoozeReminder(db, ctx, reminder.id, days))
    toast.undoable(`Snoozed for ${days} days`, () => {})
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Follow-ups"
        description="Rules generate reminders; reminders become tasks the moment they fall due"
        actions={
          allows('followups.manageRules') ? (
            <Button variant="primary" icon={<Plus />} onClick={() => setCreatingRule(true)}>
              New rule
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          label="Due now"
          value={buckets.due.length}
          icon={<Repeat />}
          tone={buckets.due.length > 0 ? 'warning' : 'neutral'}
        />
        <KpiTile
          label="Escalated"
          value={escalated}
          icon={<AlertTriangle />}
          tone={escalated > 0 ? 'danger' : 'neutral'}
        />
        <KpiTile label="Upcoming" value={buckets.upcoming.length} icon={<Clock />} />
        <KpiTile
          label="Active rules"
          value={db.reminderRules.filter((r) => r.active).length}
          hint={`${db.reminderRules.length} total`}
          icon={<Zap />}
        />
      </div>

      <Tabs
        ariaLabel="Follow-up views"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'due', label: 'Due now', count: buckets.due.length },
          { value: 'upcoming', label: 'Upcoming', count: buckets.upcoming.length },
          { value: 'snoozed', label: 'Snoozed', count: buckets.snoozed.length },
          { value: 'history', label: 'History', count: buckets.history.length },
          { value: 'rules', label: 'Rules', count: db.reminderRules.length },
        ]}
      />

      {tab === 'rules' ? (
        <>
          <DataTable
            rows={db.reminderRules}
            columns={ruleColumns}
            rowKey={(r) => r.id}
            onRowClick={allows('followups.manageRules') ? (r) => setEditingRule(r) : undefined}
            emptyState={{ title: 'No rules yet', description: 'Rules decide when follow-ups are created.' }}
          />
          <Card>
            <CardHeader
              title="How escalation works"
              description="A reminder becomes a task when it falls due. If that task is still open after the rule's escalation window, it is flagged and raised to high priority — visible, but never silently reassigned."
            />
          </Card>
        </>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          rowActions={tab === 'history' ? undefined : rowActions}
          onRowClick={(r) =>
            navigate(r.patientId ? `/patients/${r.patientId}` : `/leads?lead=${r.leadId}`)
          }
          initialSort={{ key: 'due', direction: 'asc' }}
          emptyState={{
            title:
              tab === 'due'
                ? 'Nothing due'
                : tab === 'upcoming'
                  ? 'Nothing upcoming'
                  : tab === 'snoozed'
                    ? 'Nothing snoozed'
                    : 'No history yet',
            description:
              tab === 'due'
                ? 'Every follow-up is handled. New ones appear here automatically as treatments are recorded.'
                : 'Follow-ups appear here as the rules generate them.',
            icon: tab === 'due' ? CheckCircle2 : Repeat,
          }}
        />
      )}

      <RuleDrawer
        open={creatingRule || Boolean(editingRule)}
        rule={editingRule}
        onClose={() => {
          setCreatingRule(false)
          setEditingRule(null)
        }}
      />
    </div>
  )
}
