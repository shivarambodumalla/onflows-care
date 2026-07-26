import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  ArrowRight,
  CalendarPlus,
  ClipboardList,
  MessageSquarePlus,
  Plus,
  Trophy,
  XCircle,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  Field,
  KpiTile,
  PageHeader,
  SegmentedControl,
  Select,
  Textarea,
  cn,
  useToast,
  type Column,
} from '@/design-system'
import { DueBadge, LeadStageBadge } from '@/components/common'
import { useApp, useCtx } from '@/data/store'
import { conversionRate, leadFunnel, scopedLeads, treatmentTypeById, userById } from '@/data/selectors'
import { addLeadNote, convertLead, moveLeadStage } from '@/data/actions'
import { formatRelativeDay, formatRelativeTime } from '@/lib/dates'
import { LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS, type Lead, type LeadStage } from '@/data/types'
import { NewLeadDrawer } from './NewLeadDrawer'
import { BookAppointmentDrawer } from '@/modules/appointments/BookAppointmentDrawer'

type View = 'board' | 'list'

const PIPELINE: LeadStage[] = ['enquiry', 'interested', 'booked', 'converted', 'lost']

const LOST_REASONS = [
  'Chose a clinic closer to home',
  'Cost concerns',
  'No response after repeated follow-ups',
  'Went ahead with a different treatment',
  'Relocated out of the city',
  'Other',
]

/**
 * Part 10 — Leads.
 *
 * An enquiry that nobody chases is a patient the clinic never had. The board
 * makes the pipeline visible; the weekly follow-up rule makes sure something
 * happens even when nobody remembers to look at it.
 */
export function LeadsPage() {
  const { db, branch, role, user, apply, applyWith, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [view, setView] = useState<View>('board')
  const [creating, setCreating] = useState(false)
  const [noting, setNoting] = useState<Lead | null>(null)
  const [losing, setLosing] = useState<Lead | null>(null)
  const [booking, setBooking] = useState<Lead | null>(null)

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )
  const leads = useMemo(() => scopedLeads(db, scope), [db, scope])

  const funnel = useMemo(() => leadFunnel(leads), [leads])
  const rate = useMemo(() => conversionRate(leads), [leads])
  const open = leads.filter((l) => l.stage !== 'converted' && l.stage !== 'lost')
  const overdueChases = open.filter(
    (l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < Date.now(),
  )

  const selectedId = params.get('lead')
  const selected = leads.find((l) => l.id === selectedId) ?? null

  const openLead = (lead: Lead | null) => {
    const next = new URLSearchParams(params)
    if (lead) next.set('lead', lead.id)
    else next.delete('lead')
    setParams(next, { replace: true })
  }

  const convert = (lead: Lead) => {
    const patient = applyWith((db) => convertLead(db, ctx, lead.id))
    if (!patient) return
    openLead(null)
    toast.success(`${lead.name} is now a patient`, patient.code)
    navigate(`/patients/${patient.id}`)
  }

  const move = (lead: Lead, stage: LeadStage) => {
    if (stage === 'converted') return convert(lead)
    if (stage === 'lost') return setLosing(lead)
    apply((db) => moveLeadStage(db, ctx, lead.id, stage))
    toast.undoable(`${lead.name} moved to ${LEAD_STAGE_LABELS[stage]}`, () => {})
  }

  const columns = useMemo<Column<Lead>[]>(
    () => [
      {
        key: 'name',
        header: 'Enquiry',
        sortBy: (l) => l.name,
        cell: (lead) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-text">{lead.name}</p>
            <p className="tnum truncate text-xs text-muted">
              {lead.phone} · {LEAD_SOURCE_LABELS[lead.source]}
            </p>
          </div>
        ),
      },
      {
        key: 'interest',
        header: 'Interested in',
        hideOnMobile: true,
        cell: (lead) => {
          const type = treatmentTypeById(db, lead.interestedInTypeId)
          return type ? (
            <Badge tone={type.colour} size="sm">
              {type.name}
            </Badge>
          ) : (
            <span className="text-subtle">—</span>
          )
        },
      },
      {
        key: 'owner',
        header: 'Owner',
        hideOnMobile: true,
        sortBy: (l) => userById(db, l.ownerId)?.name ?? '',
        cell: (lead) => <span className="text-muted">{userById(db, lead.ownerId)?.name}</span>,
      },
      {
        key: 'stage',
        header: 'Stage',
        width: 'w-28',
        sortBy: (l) => PIPELINE.indexOf(l.stage),
        cell: (lead) => <LeadStageBadge stage={lead.stage} size="sm" />,
      },
      {
        key: 'followUp',
        header: 'Next follow-up',
        align: 'right',
        width: 'w-32',
        sortBy: (l) => l.nextFollowUpAt ?? 'zzz',
        cell: (lead) =>
          lead.nextFollowUpAt ? (
            <DueBadge task={{ dueAt: lead.nextFollowUpAt, status: 'open' }} size="sm" />
          ) : (
            <span className="text-subtle">—</span>
          ),
      },
    ],
    [db],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leads"
        description={`${open.length} open enquiries · ${rate}% conversion`}
        actions={
          allows('leads.create') ? (
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
              New enquiry
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Open enquiries" value={open.length} icon={<ClipboardList />} />
        <KpiTile
          label="Needs chasing"
          value={overdueChases.length}
          icon={<ArrowRight />}
          tone={overdueChases.length > 0 ? 'warning' : 'neutral'}
        />
        <KpiTile
          label="Converted"
          value={leads.filter((l) => l.stage === 'converted').length}
          icon={<Trophy />}
        />
        <KpiTile
          label="Conversion rate"
          value={`${rate}%`}
          hint="of closed enquiries"
          icon={<Trophy />}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          ariaLabel="Lead view"
          value={view}
          onChange={setView}
          options={[
            { value: 'board', label: 'Pipeline' },
            { value: 'list', label: 'List' },
          ]}
        />
      </div>

      {view === 'board' ? (
        <div className="scrollbar-thin grid gap-3 overflow-x-auto lg:grid-cols-5">
          {PIPELINE.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage)
            const count = funnel.find((f) => f.stage === stage)?.count ?? 0

            return (
              <div key={stage} className="flex min-w-56 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <LeadStageBadge stage={stage} size="sm" />
                  </div>
                  <span className="tnum text-xs font-medium text-muted">{count}</span>
                </div>

                <div className="flex flex-1 flex-col gap-2 rounded-xl bg-surface-sunken p-2">
                  {stageLeads.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-subtle">Nothing here</p>
                  ) : (
                    stageLeads.slice(0, 12).map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => openLead(lead)}
                        className={cn(
                          'w-full cursor-pointer rounded-lg border border-default bg-surface p-2.5 text-left shadow-sm',
                          'transition-colors hover:border-strong hover:bg-surface-hover',
                        )}
                      >
                        <p className="truncate text-sm font-medium">{lead.name}</p>
                        <p className="tnum truncate text-xs text-muted">{lead.phone}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <Badge tone="neutral" size="sm">
                            {LEAD_SOURCE_LABELS[lead.source]}
                          </Badge>
                          {lead.nextFollowUpAt && (
                            <DueBadge task={{ dueAt: lead.nextFollowUpAt, status: 'open' }} size="sm" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                  {stageLeads.length > 12 && (
                    <p className="px-2 text-center text-2xs text-subtle">
                      +{stageLeads.length - 12} more — switch to list view
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <DataTable
          rows={leads}
          columns={columns}
          rowKey={(l) => l.id}
          onRowClick={openLead}
          initialSort={{ key: 'followUp', direction: 'asc' }}
          emptyState={{
            title: 'No enquiries yet',
            description: 'Log the first enquiry to start tracking conversions.',
            icon: ClipboardList,
            action: allows('leads.create') ? (
              <Button size="sm" icon={<Plus />} onClick={() => setCreating(true)}>
                New enquiry
              </Button>
            ) : undefined,
          }}
        />
      )}

      {/* --- Lead detail drawer -------------------------------------------- */}
      {selected && (
        <Drawer
          open
          onClose={() => openLead(null)}
          title={selected.name}
          description={`${LEAD_SOURCE_LABELS[selected.source]} · ${userById(db, selected.ownerId)?.name}`}
          width="lg"
          footer={
            selected.stage === 'converted' ? (
              <Button variant="secondary" onClick={() => navigate(`/patients/${selected.patientId}`)}>
                Open patient record
              </Button>
            ) : (
              <>
                {allows('leads.edit') && (
                  <Button variant="ghost" onClick={() => setLosing(selected)}>
                    Mark as lost
                  </Button>
                )}
                {allows('appointments.create') && (
                  <Button variant="secondary" icon={<CalendarPlus />} onClick={() => setBooking(selected)}>
                    Book
                  </Button>
                )}
                {allows('leads.convert') && (
                  <Button variant="primary" icon={<Trophy />} onClick={() => convert(selected)}>
                    Convert to patient
                  </Button>
                )}
              </>
            )
          }
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <Detail label="Phone" value={selected.phone} />
              <Detail label="Email" value={selected.email ?? '—'} />
              <Detail
                label="Interested in"
                value={treatmentTypeById(db, selected.interestedInTypeId)?.name ?? '—'}
              />
              <Detail
                label="Next follow-up"
                value={selected.nextFollowUpAt ? formatRelativeDay(selected.nextFollowUpAt) : '—'}
              />
            </div>

            {/* Stage stepper */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Pipeline stage</p>
              <div className="flex flex-wrap gap-1.5">
                {PIPELINE.map((stage) => (
                  <Button
                    key={stage}
                    size="sm"
                    variant={selected.stage === stage ? 'primary' : 'secondary'}
                    disabled={!allows('leads.edit') || selected.stage === 'converted'}
                    onClick={() => move(selected, stage)}
                  >
                    {LEAD_STAGE_LABELS[stage]}
                  </Button>
                ))}
              </div>
            </div>

            {selected.lostReason && (
              <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">
                Lost — {selected.lostReason}
              </p>
            )}

            {/* Notes */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted">Call log</p>
                {allows('leads.edit') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<MessageSquarePlus />}
                    onClick={() => setNoting(selected)}
                  >
                    Log a call
                  </Button>
                )}
              </div>

              {selected.notes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-default px-3 py-4 text-center text-sm text-subtle">
                  No contact logged yet
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {[...selected.notes].reverse().map((note) => (
                    <li key={note.id} className="rounded-lg border border-default bg-surface-sunken px-3 py-2">
                      <p className="text-sm">{note.body}</p>
                      <p className="mt-1 text-2xs text-subtle">
                        {userById(db, note.authorId)?.name} · {formatRelativeTime(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Drawer>
      )}

      {/* --- Log a call ---------------------------------------------------- */}
      {noting && <LogCallDialog lead={noting} onClose={() => setNoting(null)} />}

      {/* --- Mark lost ----------------------------------------------------- */}
      {losing && (
        <MarkLostDialog
          lead={losing}
          onClose={() => setLosing(null)}
          onConfirm={(reason) => {
            apply((db) => moveLeadStage(db, ctx, losing.id, 'lost', reason))
            setLosing(null)
            openLead(null)
            toast.undoable(`${losing.name} marked as lost`, () => {})
          }}
        />
      )}

      <NewLeadDrawer open={creating} onClose={() => setCreating(false)} />

      {booking && (
        <BookAppointmentDrawer
          open
          onClose={() => setBooking(null)}
          walkIn={false}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs tracking-wide text-subtle uppercase">{label}</p>
      <p className="mt-0.5 text-sm text-text">{value}</p>
    </div>
  )
}

function LogCallDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { apply } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const [body, setBody] = useState('')

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Log a call with ${lead.name}`}
      description="What was said, and what happens next"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!body.trim()}
            onClick={() => {
              apply((db) => addLeadNote(db, ctx, lead.id, body.trim()))
              onClose()
              toast.success('Call logged')
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <Field label="Notes" required>
        {({ id }) => (
          <Textarea
            id={id}
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Explained the treatment plan. Asked for time to decide, call back next week."
            autoFocus
          />
        )}
      </Field>
    </Drawer>
  )
}

function MarkLostDialog({
  lead,
  onClose,
  onConfirm,
}: {
  lead: Lead
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState(LOST_REASONS[0]!)
  const [detail, setDetail] = useState('')

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Mark ${lead.name} as lost?`}
      description="Open follow-ups for this enquiry will be cancelled"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon={<XCircle />}
            onClick={() => onConfirm(reason === 'Other' && detail.trim() ? detail.trim() : reason)}
          >
            Mark as lost
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Reason" required>
          {({ id }) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {reason === 'Other' && (
          <Field label="Details">
            {({ id }) => (
              <Textarea id={id} rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
            )}
          </Field>
        )}

        <Card>
          <p className="text-xs text-muted">
            Lost enquiries stay searchable and count towards the conversion report, so the reasons
            you record here are what tells you why enquiries are not converting.
          </p>
        </Card>
      </div>
    </Drawer>
  )
}
