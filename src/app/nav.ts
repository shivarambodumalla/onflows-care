import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Cog,
  FileText,
  History,
  LayoutDashboard,
  ListChecks,
  Palette,
  Repeat,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/data/permissions'

/**
 * Part 3 — Information architecture.
 *
 * One declaration drives the sidebar, the breadcrumb roots and the command
 * palette's "go to" entries, so the navigation cannot disagree with itself.
 */

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Hidden unless the current role holds this permission. */
  permission?: Permission
  /** Which live count to badge the item with, if any. */
  badge?: 'overdueTasks' | 'todayAppointments' | 'openLeads'
  /** Matches child routes for the active state, e.g. /patients/:id. */
  matchPrefix?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV: NavSection[] = [
  {
    label: 'Today',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
      {
        label: 'Appointments',
        to: '/appointments',
        icon: CalendarDays,
        permission: 'appointments.view',
        badge: 'todayAppointments',
        matchPrefix: true,
      },
      {
        label: 'Tasks',
        to: '/tasks',
        icon: ListChecks,
        permission: 'tasks.view',
        badge: 'overdueTasks',
      },
    ],
  },
  {
    label: 'Clinic',
    items: [
      {
        label: 'Patients',
        to: '/patients',
        icon: UserRound,
        permission: 'patients.view',
        matchPrefix: true,
      },
      {
        label: 'Treatments',
        to: '/treatments',
        icon: Stethoscope,
        permission: 'treatments.view',
        matchPrefix: true,
      },
      {
        label: 'Follow-ups',
        to: '/follow-ups',
        icon: Repeat,
        permission: 'followups.view',
      },
      {
        label: 'Calendar',
        to: '/calendar',
        icon: CalendarDays,
        permission: 'calendar.view',
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      {
        label: 'Leads',
        to: '/leads',
        icon: ClipboardList,
        permission: 'leads.view',
        badge: 'openLeads',
      },
      { label: 'Reports', to: '/reports', icon: BarChart3, permission: 'reports.view' },
    ],
  },
  {
    label: 'Records',
    items: [
      { label: 'Timeline', to: '/timeline', icon: History, permission: 'timeline.view' },
      { label: 'Users', to: '/users', icon: Users, permission: 'users.view' },
      { label: 'Settings', to: '/settings', icon: Cog, permission: 'settings.view' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Design system', to: '/design-system', icon: Palette },
      { label: 'Product docs', to: '/docs', icon: FileText, matchPrefix: true },
    ],
  },
]

/** Flat list, for the command palette and breadcrumb lookups. */
export const NAV_ITEMS: NavItem[] = NAV.flatMap((section) => section.items)

/** Human label for a route, used as the breadcrumb root. */
export function labelForPath(pathname: string): string {
  const match = NAV_ITEMS.filter((item) => item.to !== '/')
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  return match?.label ?? 'Dashboard'
}
