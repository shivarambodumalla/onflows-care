import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  Archive,
  CalendarPlus,
  FileText,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Phone,
  Pill,
  Pin,
  PlusCircle,
  Printer,
  Stethoscope,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Menu,
  StateView,
  Tabs,
  Textarea,
  Timeline,
  TimelineItem,
  useToast,
} from '@/design-system'
import {
  AppointmentStatusBadge,
  DetailRow,
  SectionTitle,
  SimulatedNote,
  formatMoney,
} from '@/components/common'
import { useApp, useCtx } from '@/data/store'
import {
  lastVisit,
  nextAppointment,
  patientAppointments,
  patientDocuments,
  patientEvents,
  patientNotes,
  patientReminders,
  patientTreatments,
  treatmentTypeById,
  userById,
} from '@/data/selectors'
import { addDocument, addNote, deleteDocument, deleteNote, restorePatient, toggleNotePin } from '@/data/actions'
import {
  calculateAge,
  formatDate,
  formatDateTime,
  formatRelativeDay,
  formatRelativeTime,
  formatTime,
} from '@/lib/dates'
import { LEAD_SOURCE_LABELS } from '@/data/types'
import { eventIcon, eventTone } from '@/modules/timeline/eventPresentation'
import { EventDetail, hasDetail } from '@/modules/timeline/EventDetail'
import {
  AddPrescriptionDrawer,
  PrescriptionSummaryLine,
  PrescriptionTable,
} from '@/modules/treatments/prescription'
import { PrescriptionPrint } from '@/modules/treatments/PrescriptionPrint'
import { markPrescriptionIssued } from '@/data/actions'
import type { Treatment } from '@/data/types'
import { ArchivePatientDialog } from './ArchivePatientDialog'
import { BookAppointmentDrawer } from '@/modules/appointments/BookAppointmentDrawer'
import { RecordTreatmentDrawer } from '@/modules/treatments/RecordTreatmentDrawer'
import { EditPatientDrawer } from './EditPatientDrawer'

type Tab = 'timeline' | 'treatments' | 'appointments' | 'documents' | 'notes'

/**
 * Part 6 — Patient detail.
 *
 * The "single patient timeline" principle in one screen: everything that ever
 * happened to this person, in one chronological feed, with the clinical detail
 * one tab away rather than in a separate system.
 */
export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { db, apply, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [archiving, setArchiving] = useState(false)
  const [booking, setBooking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [editing, setEditing] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [prescribing, setPrescribing] = useState<string | undefined>(undefined)
  const [prescribeOpen, setPrescribeOpen] = useState(false)
  const [printing, setPrinting] = useState<Treatment | null>(null)
  const [openEvents, setOpenEvents] = useState<Record<string, boolean>>({})

  const tab = (params.get('tab') as Tab) ?? 'timeline'
  const setTab = (next: Tab) => {
    const updated = new URLSearchParams(params)
    updated.set('tab', next)
    setParams(updated, { replace: true })
  }

  const patient = db.patients.find((p) => p.id === patientId)

  const events = useMemo(() => (patient ? patientEvents(db, patient.id) : []), [db, patient])
  const treatments = useMemo(() => (patient ? patientTreatments(db, patient.id) : []), [db, patient])
  const appointments = useMemo(
    () => (patient ? patientAppointments(db, patient.id) : []),
    [db, patient],
  )
  const notes = useMemo(() => (patient ? patientNotes(db, patient.id) : []), [db, patient])
  const documents = useMemo(() => (patient ? patientDocuments(db, patient.id) : []), [db, patient])
  const reminders = useMemo(() => (patient ? patientReminders(db, patient.id) : []), [db, patient])

  if (!patient) {
    return (
      <StateView
        kind="error"
        size="page"
        title="Patient not found"
        description="This record may have been removed, or the link is wrong."
        action={
          <Button variant="secondary" onClick={() => navigate('/patients')}>
            Back to patients
          </Button>
        }
      />
    )
  }

  const doctor = userById(db, patient.primaryDoctorId)
  const branch = db.branches.find((b) => b.id === patient.branchId)
  const next = nextAppointment(db, patient.id)
  const last = lastVisit(db, patient.id)
  const openFollowUps = reminders.filter((r) => r.status === 'pending' || r.status === 'snoozed')
  const canSeeClinical = allows('patients.viewClinical')
  const lastPrescribed = treatments.find((t) => t.prescription.length > 0)
  const lifetimeValue = treatments.reduce(
    (sum, t) => sum + (treatmentTypeById(db, t.treatmentTypeId)?.price ?? 0),
    0,
  )

  const submitNote = () => {
    if (!noteBody.trim()) return
    apply((db) => addNote(db, ctx, patient.id, noteBody.trim()))
    setNoteBody('')
    toast.success('Note added')
  }

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: 'Patients', to: '/patients' },
          { label: patient.name },
        ]}
      />

      {/* --- Identity header ----------------------------------------------- */}
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={patient.name} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{patient.name}</h1>
              {patient.status === 'archived' && <Badge tone="neutral">Archived</Badge>}
              {patient.tags.map((tag) => (
                <Badge key={tag} tone="brand" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="tnum font-medium">{patient.code}</span>
              {patient.dob && <span>{calculateAge(patient.dob)} years</span>}
              <span className="capitalize">{patient.gender.replace('_', ' ')}</span>
              <a href={`tel:${patient.phone}`} className="tnum flex items-center gap-1 hover:text-brand">
                <Phone aria-hidden className="size-3" />
                {patient.phone}
              </a>
              {branch && <span>{branch.name}</span>}
            </p>

            {patient.allergies.length > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-danger-bg px-2.5 py-1 text-xs font-medium text-danger-text">
                Allergies: {patient.allergies.join(', ')}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {allows('treatments.prescribe') && treatments.length > 0 && (
              <Button
                variant="secondary"
                icon={<Pill />}
                onClick={() => {
                  setPrescribing(undefined)
                  setPrescribeOpen(true)
                }}
              >
                Prescribe
              </Button>
            )}
            {allows('treatments.create') && patient.status === 'active' && (
              <Button variant="secondary" icon={<Stethoscope />} onClick={() => setRecording(true)}>
                Record visit
              </Button>
            )}
            {allows('appointments.create') && patient.status === 'active' && (
              <Button variant="primary" icon={<CalendarPlus />} onClick={() => setBooking(true)}>
                Book
              </Button>
            )}
            <Menu
              label={`Actions for ${patient.name}`}
              items={[
                ...(allows('patients.edit')
                  ? [{ label: 'Edit details', icon: <Pencil />, onSelect: () => setEditing(true) }]
                  : []),
                ...(allows('patients.archive')
                  ? patient.status === 'active'
                    ? [
                        {
                          label: 'Archive patient',
                          icon: <Archive />,
                          destructive: true,
                          separated: true,
                          onSelect: () => setArchiving(true),
                        },
                      ]
                    : [
                        {
                          label: 'Restore patient',
                          separated: true,
                          onSelect: () => {
                            apply((db) => restorePatient(db, ctx, patient.id))
                            toast.success(`${patient.name} restored`)
                          },
                        },
                      ]
                  : []),
              ]}
              trigger={({ toggle, open }) => (
                <Button variant="secondary" size="icon" onClick={toggle} aria-expanded={open} aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              )}
            />
          </div>
        </div>

        {/* --- At a glance -------------------------------------------------- */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-default pt-4 sm:grid-cols-4">
          <Glance label="Last visit" value={last ? formatRelativeDay(last.performedAt) : 'Never'} />
          <Glance
            label="Next appointment"
            value={next ? formatRelativeDay(next.startAt) : 'None booked'}
            tone={next ? 'brand' : 'muted'}
          />
          <Glance
            label="Open follow-ups"
            value={String(openFollowUps.length)}
            tone={openFollowUps.length > 0 ? 'warning' : 'muted'}
          />
          <Glance label="Total visits" value={String(treatments.length)} />
        </div>

        {/* The current prescription, readable without opening the record —
            the question a doctor asks most often about a returning patient. */}
        {canSeeClinical && lastPrescribed && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default bg-surface-sunken px-3 py-2">
            <div className="min-w-0">
              <p className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                Current prescription · {formatDate(lastPrescribed.performedAt)}
              </p>
              <PrescriptionSummaryLine items={lastPrescribed.prescription} max={3} className="mt-0.5" />
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                icon={<Printer />}
                onClick={() => setPrinting(lastPrescribed)}
              >
                Print
              </Button>
              {allows('treatments.prescribe') && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Pill />}
                  onClick={() => {
                    setPrescribing(lastPrescribed.id)
                    setPrescribeOpen(true)
                  }}
                >
                  Add
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* --- Tabs --------------------------------------------------------- */}
        <div className="min-w-0">
          <Tabs
            ariaLabel="Patient record sections"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'timeline', label: 'Timeline', count: events.length },
              { value: 'treatments', label: 'Treatments', count: treatments.length },
              { value: 'appointments', label: 'Appointments', count: appointments.length },
              { value: 'documents', label: 'Documents', count: documents.length },
              { value: 'notes', label: 'Notes', count: notes.length },
            ]}
          />

          <div className="mt-4">
            {tab === 'timeline' && (
              <Card>
                {events.length === 0 ? (
                  <EmptyState
                    title="Nothing has happened yet"
                    description="Bookings, visits, notes and follow-ups all appear here automatically."
                  />
                ) : (
                  <Timeline>
                    {events.map((event, i) => {
                      const detailed = hasDetail(event, db)
                      // Visits carry the substance of the record, so they open
                      // by default — a clinician scanning the history should
                      // not have to click to find out what was done.
                      const expanded =
                        openEvents[event.id] ?? (event.entity === 'treatment' && i < 3)
                      const treatment =
                        event.entity === 'treatment'
                          ? db.treatments.find((t) => t.id === event.entityId)
                          : undefined

                      return (
                        <TimelineItem
                          key={event.id}
                          id={event.id}
                          icon={eventIcon(event)}
                          tone={eventTone(event)}
                          title={event.summary}
                          description={`by ${userById(db, event.actorId)?.name ?? 'System'}`}
                          timestamp={formatRelativeTime(event.at)}
                          isLast={i === events.length - 1}
                          body={
                            detailed && expanded ? <EventDetail event={event} /> : undefined
                          }
                          meta={
                            <>
                              {detailed && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenEvents((current) => ({
                                      ...current,
                                      [event.id]: !expanded,
                                    }))
                                  }
                                  className="cursor-pointer rounded text-2xs font-medium text-brand hover:underline"
                                >
                                  {expanded ? 'Hide detail' : 'Show detail'}
                                </button>
                              )}

                              {treatment && treatment.prescription.length > 0 && (
                                <>
                                  {!expanded && (
                                    <PrescriptionSummaryLine items={treatment.prescription} />
                                  )}
                                  {canSeeClinical && (
                                    <button
                                      type="button"
                                      onClick={() => setPrinting(treatment)}
                                      className="inline-flex cursor-pointer items-center gap-1 rounded text-2xs font-medium text-brand hover:underline"
                                    >
                                      <Printer aria-hidden className="size-3" />
                                      Print prescription
                                    </button>
                                  )}
                                </>
                              )}

                              {event.changes && event.changes.length > 0 && (
                                <span className="text-2xs text-subtle">
                                  {event.changes
                                    .map((c) => `${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`)
                                    .join(' · ')}
                                </span>
                              )}
                            </>
                          }
                        />
                      )
                    })}
                  </Timeline>
                )}
              </Card>
            )}

            {tab === 'treatments' && (
              <div className="flex flex-col gap-3">
                {!canSeeClinical && (
                  <StateView
                    kind="denied"
                    title="Clinical detail is restricted"
                    description="Your role can see that visits happened, but not the clinical notes and prescriptions recorded during them."
                  />
                )}
                {treatments.length === 0 ? (
                  <Card>
                    <EmptyState
                      title="No visits recorded"
                      description="Visit records appear here once a doctor completes an appointment."
                      action={
                        allows('treatments.create') ? (
                          <Button size="sm" icon={<Stethoscope />} onClick={() => setRecording(true)}>
                            Record a visit
                          </Button>
                        ) : undefined
                      }
                    />
                  </Card>
                ) : (
                  treatments.map((treatment) => {
                    const type = treatmentTypeById(db, treatment.treatmentTypeId)
                    return (
                      <Card key={treatment.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold">{type?.name ?? 'Visit'}</h3>
                              {type && (
                                <Badge tone={type.colour} size="sm">
                                  {type.category}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                              {formatDateTime(treatment.performedAt)} ·{' '}
                              {userById(db, treatment.doctorId)?.name}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {treatment.nextVisitInDays && (
                              <Badge tone="info" size="sm">
                                Next visit in {treatment.nextVisitInDays}d
                              </Badge>
                            )}
                            {canSeeClinical && treatment.prescription.length > 0 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Printer />}
                                onClick={() => setPrinting(treatment)}
                              >
                                Print
                              </Button>
                            )}
                            {allows('treatments.prescribe') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<Pill />}
                                onClick={() => {
                                  setPrescribing(treatment.id)
                                  setPrescribeOpen(true)
                                }}
                              >
                                Prescribe
                              </Button>
                            )}
                          </div>
                        </div>

                        {canSeeClinical ? (
                          <div className="mt-3 flex flex-col gap-3 text-sm">
                            {treatment.observations && (
                              <div>
                                <SectionTitle>Observations</SectionTitle>
                                <p className="text-muted">{treatment.observations}</p>
                              </div>
                            )}
                            {treatment.adjustment && (
                              <div>
                                <SectionTitle>Adjustment</SectionTitle>
                                <p className="text-muted">{treatment.adjustment}</p>
                              </div>
                            )}
                            {treatment.prescription.length > 0 && (
                              <div>
                                <SectionTitle>Prescription</SectionTitle>
                                <PrescriptionTable items={treatment.prescription} />
                              </div>
                            )}
                            {treatment.doctorNotes && (
                              <div>
                                <SectionTitle>Doctor's notes</SectionTitle>
                                <p className="rounded-lg border border-default bg-surface-sunken px-3 py-2 text-muted">
                                  {treatment.doctorNotes}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-subtle">Clinical detail hidden.</p>
                        )}
                      </Card>
                    )
                  })
                )}
              </div>
            )}

            {tab === 'appointments' && (
              <Card padded={false}>
                {appointments.length === 0 ? (
                  <EmptyState title="No appointments" description="Nothing booked for this patient yet." />
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {appointments.map((appointment) => {
                      const type = treatmentTypeById(db, appointment.treatmentTypeId)
                      return (
                        <li key={appointment.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-24 shrink-0">
                            <p className="tnum text-sm font-medium">
                              {formatDate(appointment.startAt)}
                            </p>
                            <p className="tnum text-2xs text-subtle">
                              {formatTime(appointment.startAt)}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{type?.name}</p>
                            <p className="truncate text-xs text-muted">
                              {userById(db, appointment.doctorId)?.name}
                              {appointment.kind === 'walk_in' && ' · Walk-in'}
                              {appointment.cancelReason && ` · ${appointment.cancelReason}`}
                            </p>
                          </div>
                          <AppointmentStatusBadge status={appointment.status} size="sm" />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            )}

            {tab === 'documents' && (
              <Card>
                <CardHeader
                  title="Documents"
                  description="Reports, scans and forms attached to this record"
                  action={
                    allows('patients.edit') ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Upload />}
                        onClick={() => {
                          apply((db) =>
                            addDocument(db, ctx, patient.id, {
                              name: `Uploaded document ${new Date().toLocaleDateString('en-IN')}.pdf`,
                              kind: 'report',
                              sizeKb: 480,
                            }),
                          )
                          toast.success('Document attached', 'Simulated — no file was stored')
                        }}
                      >
                        Attach
                      </Button>
                    ) : undefined
                  }
                />
                <div className="mt-3">
                  {documents.length === 0 ? (
                    <EmptyState
                      title="No documents"
                      description="Attach reports, scans and consent forms here."
                      icon={Paperclip}
                    />
                  ) : (
                    <ul className="divide-y divide-[var(--border)]">
                      {documents.map((document) => (
                        <li key={document.id} className="flex items-center gap-3 py-2.5">
                          <FileText aria-hidden className="size-4 shrink-0 text-subtle" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{document.name}</p>
                            <p className="text-xs text-muted">
                              {document.kind} · {(document.sizeKb / 1024).toFixed(1)} MB ·{' '}
                              {formatRelativeDay(document.uploadedAt)} ·{' '}
                              {userById(db, document.uploadedById)?.name}
                            </p>
                          </div>
                          {allows('patients.edit') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${document.name}`}
                              onClick={() => {
                                apply((db) => deleteDocument(db, ctx, document.id))
                                toast.undoable('Document deleted', () => {
                                  apply((db) =>
                                    addDocument(db, ctx, patient.id, {
                                      name: document.name,
                                      kind: document.kind,
                                      sizeKb: document.sizeKb,
                                    }),
                                  )
                                })
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <SimulatedNote>
                    Document storage is simulated in this prototype — files are never uploaded.
                  </SimulatedNote>
                </div>
              </Card>
            )}

            {tab === 'notes' && (
              <div className="flex flex-col gap-3">
                {allows('patients.edit') && (
                  <Card>
                    <Textarea
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      placeholder="Add a note about this patient…"
                      rows={3}
                      aria-label="New note"
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitNote()
                      }}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-2xs text-subtle">⌘↵ to save</p>
                      <Button size="sm" variant="primary" icon={<PlusCircle />} onClick={submitNote} disabled={!noteBody.trim()}>
                        Add note
                      </Button>
                    </div>
                  </Card>
                )}

                {notes.length === 0 ? (
                  <Card>
                    <EmptyState title="No notes" description="Notes are visible to everyone with access to this record." />
                  </Card>
                ) : (
                  notes.map((note) => (
                    <Card key={note.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-text">{note.body}</p>
                          <p className="mt-1.5 text-xs text-subtle">
                            {userById(db, note.authorId)?.name} · {formatRelativeTime(note.createdAt)}
                          </p>
                        </div>
                        {allows('patients.edit') && (
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                              onClick={() => apply((db) => toggleNotePin(db, ctx, note.id))}
                            >
                              <Pin className={note.pinned ? 'size-4 fill-current text-brand' : 'size-4'} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete note"
                              onClick={() => {
                                apply((db) => deleteNote(db, ctx, note.id))
                                toast.undoable('Note deleted', () => {
                                  apply((db) => addNote(db, ctx, patient.id, note.body))
                                })
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* --- Sidebar ------------------------------------------------------ */}
        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Details" />
            <dl className="mt-2 divide-y divide-[var(--border)]">
              <DetailRow label="Patient code">
                <span className="tnum">{patient.code}</span>
              </DetailRow>
              <DetailRow label="Phone">
                <span className="tnum">{patient.phone}</span>
              </DetailRow>
              <DetailRow label="Email">{patient.email}</DetailRow>
              <DetailRow label="Date of birth">
                {patient.dob ? formatDate(patient.dob) : ''}
              </DetailRow>
              <DetailRow label="Primary doctor">{doctor?.name}</DetailRow>
              <DetailRow label="Branch">{branch?.name}</DetailRow>
              <DetailRow label="Source">{LEAD_SOURCE_LABELS[patient.source]}</DetailRow>
              <DetailRow label="Registered">{formatDate(patient.createdAt)}</DetailRow>
              {patient.referredBy && <DetailRow label="Referred by">{patient.referredBy}</DetailRow>}
              {patient.convertedFromLeadId && (
                <DetailRow label="Origin">
                  <Link to="/leads" className="text-brand hover:underline">
                    Converted from an enquiry
                  </Link>
                </DetailRow>
              )}
            </dl>
          </Card>

          {patient.address && (
            <Card>
              <CardHeader title="Address" />
              <p className="mt-2 text-sm text-muted">{patient.address}</p>
            </Card>
          )}

          {canSeeClinical && (patient.conditions.length > 0 || patient.allergies.length > 0) && (
            <Card>
              <CardHeader title="Medical history" />
              <div className="mt-2 flex flex-col gap-3">
                {patient.conditions.length > 0 && (
                  <div>
                    <SectionTitle>Conditions</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {patient.conditions.map((condition) => (
                        <Badge key={condition} tone="info" size="sm">
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {patient.allergies.length > 0 && (
                  <div>
                    <SectionTitle>Allergies</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {patient.allergies.map((allergy) => (
                        <Badge key={allergy} tone="danger" size="sm">
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {openFollowUps.length > 0 && (
            <Card>
              <CardHeader title="Open follow-ups" />
              <ul className="mt-2 flex flex-col gap-2">
                {openFollowUps.map((reminder) => {
                  const rule = db.reminderRules.find((r) => r.id === reminder.ruleId)
                  return (
                    <li key={reminder.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{rule?.name ?? 'Follow-up'}</p>
                        <p className="text-xs text-muted">{formatRelativeDay(reminder.dueAt)}</p>
                      </div>
                      <Badge tone={reminder.status === 'snoozed' ? 'neutral' : 'warning'} size="sm">
                        {reminder.status}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {patient.emergencyContactName && (
            <Card>
              <CardHeader title="Emergency contact" />
              <p className="mt-2 text-sm font-medium">{patient.emergencyContactName}</p>
              <p className="tnum text-sm text-muted">{patient.emergencyContactPhone}</p>
            </Card>
          )}

          {allows('reports.viewFinancial') && treatments.length > 0 && (
            <Card>
              <CardHeader title="Value" />
              <p className="tnum mt-2 text-2xl font-semibold">{formatMoney(lifetimeValue)}</p>
              <p className="text-xs text-muted">across {treatments.length} visits</p>
            </Card>
          )}
        </aside>
      </div>

      {archiving && <ArchivePatientDialog patient={patient} onClose={() => setArchiving(false)} />}
      <BookAppointmentDrawer
        open={booking}
        onClose={() => setBooking(false)}
        presetPatientId={patient.id}
      />
      <RecordTreatmentDrawer
        open={recording}
        onClose={() => setRecording(false)}
        patientId={patient.id}
      />
      <EditPatientDrawer open={editing} onClose={() => setEditing(false)} patient={patient} />

      <AddPrescriptionDrawer
        open={prescribeOpen}
        onClose={() => setPrescribeOpen(false)}
        patientId={patient.id}
        treatmentId={prescribing}
      />

      {printing && (
        <PrescriptionPrint
          treatment={printing}
          onDone={() => {
            // Printing is the moment the prescription is handed over, so it
            // belongs on the timeline.
            apply((db) => markPrescriptionIssued(db, ctx, printing.id))
            setPrinting(null)
          }}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Glance({
  label,
  value,
  tone = 'muted',
}: {
  label: string
  value: string
  tone?: 'muted' | 'brand' | 'warning'
}) {
  return (
    <div>
      <p className="text-2xs tracking-wide text-subtle uppercase">{label}</p>
      <p
        className={
          tone === 'brand'
            ? 'mt-0.5 text-sm font-semibold text-brand'
            : tone === 'warning'
              ? 'mt-0.5 text-sm font-semibold text-warning-text'
              : 'mt-0.5 text-sm font-semibold text-text'
        }
      >
        {value}
      </p>
    </div>
  )
}
