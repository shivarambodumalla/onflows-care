import { formatDate } from '@/lib/dates'
import type { Database, ID } from './types'

/**
 * Part 12 — Global search.
 *
 * "Everything searchable" means one index over every entity a staff member
 * might reach for, not a per-module filter box. The index is rebuilt from the
 * database on demand and is small enough (a few thousand rows) that a linear
 * scan is instant — no search library needed at prototype scale.
 */

export type ResultKind = 'patient' | 'appointment' | 'lead' | 'task' | 'document' | 'user'

export interface SearchResult {
  id: ID
  kind: ResultKind
  title: string
  subtitle: string
  /** Extra line shown on the results page but not in the palette. */
  detail?: string
  href: string
  /** Higher sorts first. */
  score: number
  branchId?: ID
}

export interface SearchIndexEntry extends Omit<SearchResult, 'score'> {
  /** Pre-lowercased haystack. */
  haystack: string
  /** Fields matched with higher weight — name, code, phone. */
  primary: string
}

export function buildSearchIndex(db: Database): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = []

  for (const patient of db.patients) {
    const doctor = db.users.find((u) => u.id === patient.primaryDoctorId)
    entries.push({
      id: patient.id,
      kind: 'patient',
      title: patient.name,
      subtitle: `${patient.code} · ${patient.phone}`,
      detail: [doctor?.name, patient.status === 'archived' ? 'Archived' : null]
        .filter(Boolean)
        .join(' · '),
      href: `/patients/${patient.id}`,
      branchId: patient.branchId,
      primary: `${patient.name} ${patient.code} ${patient.phone}`.toLowerCase(),
      haystack: [
        patient.name,
        patient.code,
        patient.phone,
        patient.email,
        patient.address,
        ...patient.tags,
        ...patient.conditions,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })
  }

  for (const lead of db.leads) {
    entries.push({
      id: lead.id,
      kind: 'lead',
      title: lead.name,
      subtitle: `${lead.phone} · ${lead.stage}`,
      href: `/leads?lead=${lead.id}`,
      branchId: lead.branchId,
      primary: `${lead.name} ${lead.phone}`.toLowerCase(),
      haystack: [lead.name, lead.phone, lead.email, lead.stage, lead.source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })
  }

  // Only future and recent appointments — nobody searches for last year's slot.
  const cutoff = Date.now() - 60 * 86_400_000
  for (const appointment of db.appointments) {
    if (new Date(appointment.startAt).getTime() < cutoff) continue
    const patient = db.patients.find((p) => p.id === appointment.patientId)
    const type = db.treatmentTypes.find((t) => t.id === appointment.treatmentTypeId)
    if (!patient) continue
    entries.push({
      id: appointment.id,
      kind: 'appointment',
      title: `${type?.name ?? 'Appointment'} — ${patient.name}`,
      subtitle: `${formatDate(appointment.startAt)} · ${appointment.status.replace('_', ' ')}`,
      href: `/appointments?appointment=${appointment.id}`,
      branchId: appointment.branchId,
      primary: `${patient.name} ${type?.name ?? ''}`.toLowerCase(),
      haystack: [patient.name, patient.code, type?.name, appointment.reason, appointment.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })
  }

  for (const task of db.tasks) {
    if (task.status === 'completed' || task.status === 'cancelled') continue
    entries.push({
      id: task.id,
      kind: 'task',
      title: task.title,
      subtitle: `Due ${formatDate(task.dueAt)}`,
      href: `/tasks?task=${task.id}`,
      branchId: task.branchId,
      primary: task.title.toLowerCase(),
      haystack: [task.title, task.description].filter(Boolean).join(' ').toLowerCase(),
    })
  }

  for (const document of db.documents) {
    const patient = db.patients.find((p) => p.id === document.patientId)
    entries.push({
      id: document.id,
      kind: 'document',
      title: document.name,
      subtitle: patient ? `${patient.name} · ${document.kind}` : document.kind,
      href: `/patients/${document.patientId}?tab=documents`,
      branchId: patient?.branchId,
      primary: document.name.toLowerCase(),
      haystack: [document.name, document.kind, patient?.name].filter(Boolean).join(' ').toLowerCase(),
    })
  }

  for (const user of db.users) {
    entries.push({
      id: user.id,
      kind: 'user',
      title: user.name,
      subtitle: `${user.role.replace('_', ' ')} · ${user.email}`,
      href: `/users?user=${user.id}`,
      primary: user.name.toLowerCase(),
      haystack: [user.name, user.email, user.role, user.specialisation]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    })
  }

  return entries
}

/**
 * Ranked search. Exact and prefix matches on primary fields (name, code,
 * phone) outrank incidental matches deep in an address, which is what makes
 * typing a phone number land the right patient first.
 */
export function search(
  index: SearchIndexEntry[],
  rawQuery: string,
  options: { kinds?: ResultKind[]; branchIds?: ID[]; limit?: number } = {},
): SearchResult[] {
  const query = rawQuery.trim().toLowerCase()
  if (query.length === 0) return []

  const terms = query.split(/\s+/).filter(Boolean)
  const results: SearchResult[] = []

  for (const entry of index) {
    if (options.kinds && !options.kinds.includes(entry.kind)) continue
    if (options.branchIds && entry.branchId && !options.branchIds.includes(entry.branchId)) continue

    // Every term must appear somewhere, so multi-word queries narrow.
    if (!terms.every((term) => entry.haystack.includes(term))) continue

    let score = 0
    if (entry.primary === query) score += 100
    if (entry.primary.startsWith(query)) score += 50
    if (entry.primary.includes(query)) score += 25
    if (entry.haystack.includes(query)) score += 10
    score += terms.length

    // Patients are what staff look for most often; break ties their way.
    if (entry.kind === 'patient') score += 5

    results.push({ ...entry, score })
  }

  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, options.limit ?? 50)
}

export const RESULT_KIND_LABELS: Record<ResultKind, string> = {
  patient: 'Patients',
  appointment: 'Appointments',
  lead: 'Leads',
  task: 'Tasks',
  document: 'Documents',
  user: 'Users',
}

/* --- Saved searches (Part 12) --------------------------------------------- */

export interface SavedSearch {
  id: string
  label: string
  query: string
  kinds?: ResultKind[]
}

const SAVED_KEY = 'onflows.savedSearches'

export function loadSavedSearches(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as SavedSearch[]
  } catch {
    return []
  }
}

export function saveSavedSearches(items: SavedSearch[]): void {
  localStorage.setItem(SAVED_KEY, JSON.stringify(items))
}
