import type { ReactNode } from 'react'
import {
  Archive,
  Ban,
  CalendarPlus,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  LogIn,
  Pencil,
  Pin,
  RotateCcw,
  Settings2,
  Sparkles,
  Stethoscope,
  StickyNote,
  Trash2,
  Trophy,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react'
import type { Tone } from '@/design-system'
import type { TimelineEvent } from '@/data/types'

/**
 * One mapping from event to icon and tone, shared by the patient timeline,
 * the universal timeline and the audit trail — so the same event never looks
 * like two different things depending on where you read it.
 */

const ICONS: Record<string, ReactNode> = {
  created: <UserPlus />,
  updated: <Pencil />,
  archived: <Archive />,
  restored: <RotateCcw />,
  booked: <CalendarPlus />,
  walk_in_registered: <LogIn />,
  checked_in: <LogIn />,
  started: <Clock />,
  recorded: <Stethoscope />,
  amended: <Pencil />,
  cancelled: <CalendarX />,
  no_show: <Ban />,
  rescheduled: <CalendarPlus />,
  scheduled: <Sparkles />,
  snoozed: <Clock />,
  completed: <CheckCircle2 />,
  assigned: <Users />,
  reopened: <RotateCcw />,
  added: <StickyNote />,
  pinned: <Pin />,
  unpinned: <Pin />,
  deleted: <Trash2 />,
  uploaded: <FileText />,
  note_added: <StickyNote />,
  converted: <Trophy />,
  session_ended: <Users />,
  activated: <UserRound />,
  deactivated: <UserRound />,
  time_blocked: <CalendarX />,
  time_unblocked: <CalendarPlus />,
}

const ENTITY_FALLBACK: Record<TimelineEvent['entity'], ReactNode> = {
  patient: <UserRound />,
  appointment: <CalendarPlus />,
  treatment: <Stethoscope />,
  reminder: <Clock />,
  task: <ClipboardList />,
  lead: <ClipboardList />,
  note: <StickyNote />,
  document: <FileText />,
  user: <Users />,
  settings: <Settings2 />,
}

export function eventIcon(event: TimelineEvent): ReactNode {
  return ICONS[event.action] ?? ENTITY_FALLBACK[event.entity] ?? <Clock />
}

export function eventTone(event: TimelineEvent): Tone {
  if (event.action.startsWith('moved_to_')) {
    return event.action === 'moved_to_lost' ? 'danger' : 'info'
  }

  switch (event.action) {
    case 'created':
    case 'recorded':
    case 'completed':
    case 'converted':
      return 'success'
    case 'cancelled':
    case 'no_show':
    case 'archived':
    case 'deleted':
    case 'deactivated':
      return 'danger'
    case 'snoozed':
    case 'amended':
    case 'time_blocked':
      return 'warning'
    case 'booked':
    case 'checked_in':
    case 'walk_in_registered':
    case 'rescheduled':
    case 'scheduled':
      return 'brand'
    case 'updated':
    case 'assigned':
      return 'info'
    default:
      return 'neutral'
  }
}

export const ENTITY_LABELS: Record<TimelineEvent['entity'], string> = {
  patient: 'Patients',
  appointment: 'Appointments',
  treatment: 'Treatments',
  reminder: 'Follow-ups',
  task: 'Tasks',
  lead: 'Leads',
  note: 'Notes',
  document: 'Documents',
  user: 'Users',
  settings: 'Settings',
}
