import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Archive, MoreHorizontal, Search, UserPlus, X } from 'lucide-react'
import {
  Badge,
  Button,
  DataTable,
  Input,
  Menu,
  PageHeader,
  SegmentedControl,
  Select,
  Tabs,
  useToast,
  type Column,
} from '@/design-system'
import { PatientCell } from '@/components/common'
import { useApp, useCtx } from '@/data/store'
import {
  doctorsIn,
  lastVisit,
  nextAppointment,
  scopedPatients,
  userById,
} from '@/data/selectors'
import { archivePatient, restorePatient } from '@/data/actions'
import { calculateAge, formatRelativeDay } from '@/lib/dates'
import type { Patient } from '@/data/types'
import { NewPatientDrawer } from './NewPatientDrawer'
import { ArchivePatientDialog } from './ArchivePatientDialog'

type StatusTab = 'active' | 'archived' | 'all'

/**
 * Part 6 — Patient list.
 *
 * The primary way staff reach a record. Search is the first control on the
 * page and matches name, patient code and phone, because those are the three
 * things a caller can give you.
 */
export function PatientsPage() {
  const { db, branch, role, user, apply, allows } = useApp()
  const ctx = useCtx()
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [tab, setTab] = useState<StatusTab>('active')
  const [doctorFilter, setDoctorFilter] = useState('')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [newOpen, setNewOpen] = useState(false)
  const [archiving, setArchiving] = useState<Patient | null>(null)

  const query = params.get('q') ?? ''
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )

  const all = useMemo(() => scopedPatients(db, scope), [db, scope])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return all.filter((patient) => {
      if (tab === 'active' && patient.status !== 'active') return false
      if (tab === 'archived' && patient.status !== 'archived') return false
      if (doctorFilter && patient.primaryDoctorId !== doctorFilter) return false
      if (!needle) return true
      return (
        patient.name.toLowerCase().includes(needle) ||
        patient.code.toLowerCase().includes(needle) ||
        patient.phone.replace(/\s/g, '').includes(needle.replace(/\s/g, '')) ||
        (patient.email?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [all, query, tab, doctorFilter])

  const counts = useMemo(
    () => ({
      active: all.filter((p) => p.status === 'active').length,
      archived: all.filter((p) => p.status === 'archived').length,
      all: all.length,
    }),
    [all],
  )

  const columns = useMemo<Column<Patient>[]>(
    () => [
      {
        key: 'name',
        header: 'Patient',
        sortBy: (p) => p.name,
        cell: (patient) => (
          <PatientCell
            patient={patient}
            showAvatar={density === 'comfortable'}
            secondary={
              density === 'compact'
                ? `${patient.code} · ${patient.phone}`
                : undefined
            }
          />
        ),
      },
      {
        key: 'age',
        header: 'Age',
        align: 'right',
        width: 'w-16',
        hideOnMobile: true,
        sortBy: (p) => (p.dob ? calculateAge(p.dob) : 0),
        cell: (patient) => (
          <span className="tnum text-muted">{patient.dob ? calculateAge(patient.dob) : '—'}</span>
        ),
      },
      {
        key: 'doctor',
        header: 'Primary doctor',
        hideOnMobile: true,
        sortBy: (p) => userById(db, p.primaryDoctorId)?.name ?? 'zz',
        cell: (patient) => (
          <span className="text-muted">
            {userById(db, patient.primaryDoctorId)?.name ?? '—'}
          </span>
        ),
      },
      {
        key: 'lastVisit',
        header: 'Last visit',
        hideOnMobile: true,
        sortBy: (p) => lastVisit(db, p.id)?.performedAt ?? '',
        cell: (patient) => {
          const visit = lastVisit(db, patient.id)
          return (
            <span className="text-muted">
              {visit ? formatRelativeDay(visit.performedAt) : 'Never'}
            </span>
          )
        },
      },
      {
        key: 'next',
        header: 'Next appointment',
        sortBy: (p) => nextAppointment(db, p.id)?.startAt ?? 'zz',
        cell: (patient) => {
          const next = nextAppointment(db, patient.id)
          if (!next) return <span className="text-subtle">—</span>
          return (
            <Badge tone="info" size="sm">
              {formatRelativeDay(next.startAt)}
            </Badge>
          )
        },
      },
      {
        key: 'tags',
        header: 'Tags',
        hideOnMobile: true,
        cell: (patient) =>
          patient.tags.length === 0 ? (
            <span className="text-subtle">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {patient.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} tone="neutral" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          ),
      },
    ],
    [db, density],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Patients"
        description={`${counts.active} active in ${branch.name}`}
        actions={
          allows('patients.create') ? (
            <Button variant="primary" icon={<UserPlus />} onClick={() => setNewOpen(true)}>
              New patient
            </Button>
          ) : undefined
        }
      />

      {/* --- Filters ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, code or phone…"
            aria-label="Search patients"
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
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          aria-label="Filter by doctor"
          className="w-auto min-w-40"
        >
          <option value="">All doctors</option>
          {doctorsIn(db, branch.id).map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name}
            </option>
          ))}
        </Select>

        <SegmentedControl
          ariaLabel="Row density"
          value={density}
          onChange={setDensity}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
          className="ml-auto hidden sm:inline-flex"
        />
      </div>

      <Tabs
        ariaLabel="Patient status"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'active', label: 'Active', count: counts.active },
          { value: 'archived', label: 'Archived', count: counts.archived },
          { value: 'all', label: 'All', count: counts.all },
        ]}
      />

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(p) => p.id}
        onRowClick={(p) => navigate(`/patients/${p.id}`)}
        initialSort={{ key: 'name', direction: 'asc' }}
        emptyState={{
          title: query ? `No patients match “${query}”` : 'No patients yet',
          description: query
            ? 'Try a partial name, the patient code, or the last few digits of a phone number.'
            : 'Register the first patient to get started.',
          action: allows('patients.create') ? (
            <Button size="sm" icon={<UserPlus />} onClick={() => setNewOpen(true)}>
              New patient
            </Button>
          ) : undefined,
        }}
        rowActions={(patient) => (
          <Menu
            label={`Actions for ${patient.name}`}
            items={[
              { label: 'Open record', onSelect: () => navigate(`/patients/${patient.id}`) },
              ...(allows('patients.archive')
                ? patient.status === 'active'
                  ? [
                      {
                        label: 'Archive patient',
                        icon: <Archive />,
                        destructive: true,
                        separated: true,
                        onSelect: () => setArchiving(patient),
                      },
                    ]
                  : [
                      {
                        label: 'Restore patient',
                        separated: true,
                        onSelect: () => {
                          apply((db) => restorePatient(db, ctx, patient.id))
                          toast.undoable(`${patient.name} restored`, () => {
                            apply((db) => archivePatient(db, ctx, patient.id, 'Undo restore'))
                          })
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
                aria-label={`Actions for ${patient.name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            )}
          />
        )}
      />

      <NewPatientDrawer open={newOpen} onClose={() => setNewOpen(false)} />
      <ArchivePatientDialog patient={archiving} onClose={() => setArchiving(null)} />
    </div>
  )
}
