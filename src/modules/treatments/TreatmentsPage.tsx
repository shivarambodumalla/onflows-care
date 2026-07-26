import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Pill, Printer, Search, Stethoscope, X } from 'lucide-react'
import {
  Badge,
  Button,
  DataTable,
  Input,
  PageHeader,
  Select,
  StateView,
  type Column,
} from '@/design-system'
import { PatientCell, formatMoney } from '@/components/common'
import { useApp, useCtx } from '@/data/store'
import { doctorsIn, patientById, treatmentTypeById, userById } from '@/data/selectors'
import { formatDate, formatRelativeDay } from '@/lib/dates'
import type { Treatment } from '@/data/types'
import { markPrescriptionIssued } from '@/data/actions'
import { PrescriptionSummaryLine } from './prescription'
import { PrescriptionPrint } from './PrescriptionPrint'

type Range = '7' | '30' | '90' | 'all'

/**
 * Part 8 — Treatment history across the clinic.
 *
 * The per-patient view lives on the patient record; this is the cross-patient
 * ledger a doctor or manager uses to review what was actually done.
 */
export function TreatmentsPage() {
  const { db, branch, role, user, allows, apply } = useApp()
  const ctx = useCtx()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [doctorFilter, setDoctorFilter] = useState(role === 'doctor' ? user.id : '')
  const [typeFilter, setTypeFilter] = useState('')
  const [range, setRange] = useState<Range>('30')
  const [printing, setPrinting] = useState<Treatment | null>(null)

  const canSeeClinical = allows('patients.viewClinical')

  const rows = useMemo(() => {
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86_400_000
    const needle = query.trim().toLowerCase()

    return db.treatments
      .filter((treatment) => {
        if (treatment.branchId !== branch.id) return false
        if (new Date(treatment.performedAt).getTime() < cutoff) return false
        if (doctorFilter && treatment.doctorId !== doctorFilter) return false
        if (typeFilter && treatment.treatmentTypeId !== typeFilter) return false
        if (!needle) return true

        const patient = patientById(db, treatment.patientId)
        return (
          patient?.name.toLowerCase().includes(needle) ||
          patient?.code.toLowerCase().includes(needle) ||
          treatment.observations?.toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => (a.performedAt < b.performedAt ? 1 : -1))
  }, [db, branch.id, range, query, doctorFilter, typeFilter])

  const revenue = useMemo(
    () => rows.reduce((sum, t) => sum + (treatmentTypeById(db, t.treatmentTypeId)?.price ?? 0), 0),
    [rows, db],
  )

  const columns = useMemo<Column<Treatment>[]>(
    () => [
      {
        key: 'date',
        header: 'Date',
        width: 'w-32',
        sortBy: (t) => t.performedAt,
        cell: (treatment) => (
          <div>
            <p className="tnum text-sm font-medium">{formatDate(treatment.performedAt)}</p>
            <p className="text-2xs text-subtle">{formatRelativeDay(treatment.performedAt)}</p>
          </div>
        ),
      },
      {
        key: 'patient',
        header: 'Patient',
        sortBy: (t) => patientById(db, t.patientId)?.name ?? '',
        cell: (treatment) => {
          const patient = patientById(db, treatment.patientId)
          return patient ? <PatientCell patient={patient} showAvatar={false} /> : '—'
        },
      },
      {
        key: 'type',
        header: 'Treatment',
        sortBy: (t) => treatmentTypeById(db, t.treatmentTypeId)?.name ?? '',
        cell: (treatment) => {
          const type = treatmentTypeById(db, treatment.treatmentTypeId)
          return type ? (
            <Badge tone={type.colour} size="sm">
              {type.name}
            </Badge>
          ) : (
            '—'
          )
        },
      },
      {
        key: 'doctor',
        header: 'Doctor',
        hideOnMobile: true,
        sortBy: (t) => userById(db, t.doctorId)?.name ?? '',
        cell: (treatment) => (
          <span className="text-muted">{userById(db, treatment.doctorId)?.name}</span>
        ),
      },
      {
        key: 'observations',
        header: 'Observations',
        hideOnMobile: true,
        cell: (treatment) =>
          canSeeClinical ? (
            <span className="line-clamp-1 max-w-md text-muted">{treatment.observations ?? '—'}</span>
          ) : (
            <span className="text-subtle">Restricted</span>
          ),
      },
      {
        key: 'rx',
        header: 'Prescription',
        width: 'w-56',
        // Shown in full rather than as a count: reviewing what was prescribed
        // is the reason a doctor opens this ledger, and a number sends them
        // into every row to find out.
        cell: (treatment) =>
          treatment.prescription.length === 0 ? (
            <span className="text-subtle">—</span>
          ) : canSeeClinical ? (
            <PrescriptionSummaryLine items={treatment.prescription} />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-subtle">
              <Pill aria-hidden className="size-3" />
              {treatment.prescription.length} medications
            </span>
          ),
      },
      {
        key: 'next',
        header: 'Next visit',
        align: 'right',
        width: 'w-28',
        sortBy: (t) => t.nextVisitInDays ?? 999,
        cell: (treatment) =>
          treatment.nextVisitInDays ? (
            <Badge tone="info" size="sm">
              {treatment.nextVisitInDays}d
            </Badge>
          ) : (
            <span className="text-subtle">—</span>
          ),
      },
    ],
    [db, canSeeClinical],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Treatments"
        description={`${rows.length} visits recorded${allows('reports.viewFinancial') ? ` · ${formatMoney(revenue)}` : ''}`}
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
            placeholder="Search patient or observations…"
            aria-label="Search treatments"
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
          className="w-auto min-w-36"
        >
          <option value="">All doctors</option>
          {doctorsIn(db, branch.id).map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name}
            </option>
          ))}
        </Select>

        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by treatment"
          className="w-auto min-w-36"
        >
          <option value="">All treatments</option>
          {db.treatmentTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </Select>

        <Select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          aria-label="Time range"
          className="w-auto"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </Select>
      </div>

      {!canSeeClinical && (
        <StateView
          kind="denied"
          title="Clinical detail is restricted for your role"
          description="You can see that visits happened and who performed them, but observations, notes and prescriptions are hidden."
        />
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(t) => t.id}
        onRowClick={(t) => navigate(`/patients/${t.patientId}?tab=treatments`)}
        initialSort={{ key: 'date', direction: 'desc' }}
        emptyState={{
          title: 'No treatments recorded',
          description:
            query || doctorFilter || typeFilter
              ? 'No visits match these filters. Try widening the time range.'
              : 'Visit records appear here once doctors complete appointments.',
          icon: Stethoscope,
          action: (
            <Button size="sm" variant="secondary" onClick={() => setRange('all')}>
              Show all time
            </Button>
          ),
        }}
        rowActions={(treatment) =>
          canSeeClinical && treatment.prescription.length > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Print prescription"
              title="Print prescription"
              onClick={() => setPrinting(treatment)}
            >
              <Printer className="size-4" />
            </Button>
          ) : null
        }
      />

      {printing && (
        <PrescriptionPrint
          treatment={printing}
          onDone={() => {
            apply((db) => markPrescriptionIssued(db, ctx, printing.id))
            setPrinting(null)
          }}
        />
      )}
    </div>
  )
}
