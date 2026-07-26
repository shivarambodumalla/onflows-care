import type { ISODate, ISODateTime } from '@/data/types'

/**
 * Date helpers. Everything the app shows is derived from `now()` so a demo
 * opened at any future date still shows a busy today, overdue follow-ups and
 * upcoming appointments.
 */

export function now(): ISODateTime {
  return new Date().toISOString()
}

export function toISODate(date: Date | ISODateTime): ISODate {
  const d = typeof date === 'string' ? new Date(date) : date
  // Local calendar date, not UTC — a 9pm IST appointment belongs to that day.
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function startOfDay(date: Date | string): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date | string): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function addDays(date: Date | string, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMinutes(date: Date | string, minutes: number): Date {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() + minutes)
  return d
}

export function startOfWeek(date: Date | string): Date {
  const d = startOfDay(date)
  // Week starts Monday — clinics think in working weeks.
  const day = (d.getDay() + 6) % 7
  return addDays(d, -day)
}

export function startOfMonth(date: Date | string): Date {
  const d = startOfDay(date)
  d.setDate(1)
  return d
}

export function endOfMonth(date: Date | string): Date {
  const d = startOfMonth(date)
  d.setMonth(d.getMonth() + 1)
  return addDays(d, -1)
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return toISODate(new Date(a).toISOString()) === toISODate(new Date(b).toISOString())
}

export function isToday(date: Date | string): boolean {
  return isSameDay(date, new Date())
}

export function isPast(date: Date | string): boolean {
  return new Date(date).getTime() < Date.now()
}

export function daysBetween(from: Date | string, to: Date | string): number {
  const a = startOfDay(from).getTime()
  const b = startOfDay(to).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** Days a record is overdue. 0 or negative means not overdue. */
export function daysOverdue(dueAt: Date | string): number {
  return -daysBetween(new Date(), dueAt)
}

/* --- Formatting ----------------------------------------------------------- */

const TIME_FMT = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
const DATE_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const DATE_SHORT_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const WEEKDAY_FMT = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })
const MONTH_FMT = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
const FULL_FMT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export const formatTime = (d: Date | string) => TIME_FMT.format(new Date(d))
export const formatDate = (d: Date | string) => DATE_FMT.format(new Date(d))
export const formatDateShort = (d: Date | string) => DATE_SHORT_FMT.format(new Date(d))
export const formatWeekday = (d: Date | string) => WEEKDAY_FMT.format(new Date(d))
export const formatMonth = (d: Date | string) => MONTH_FMT.format(new Date(d))
export const formatFullDate = (d: Date | string) => FULL_FMT.format(new Date(d))
export const formatDateTime = (d: Date | string) => `${formatDate(d)}, ${formatTime(d)}`

/** '2:30 PM – 3:00 PM' */
export function formatTimeRange(start: Date | string, end: Date | string) {
  return `${formatTime(start)} – ${formatTime(end)}`
}

/**
 * Relative day label, preferring the words staff actually use.
 * 'Today', 'Tomorrow', 'Yesterday', '3 days ago', 'in 5 days', else a date.
 */
export function formatRelativeDay(date: Date | string): string {
  const diff = daysBetween(new Date(), date)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff <= 7) return `in ${diff} days`
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} days ago`
  return formatDate(date)
}

/** Compact 'just now / 5m / 3h / 2d / date' for feeds and audit rows. */
export function formatRelativeTime(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days <= 7) return `${days}d ago`
  return formatDate(date)
}

export function calculateAge(dob: ISODate): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/** '09:30' from an ISO datetime — for time inputs. */
export function toTimeInput(date: Date | string): string {
  const d = new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Combines a date input value and a time input value into an ISO string. */
export function fromDateAndTime(date: ISODate, time: string): ISODateTime {
  const [hours, minutes] = time.split(':').map(Number)
  const d = new Date(`${date}T00:00:00`)
  d.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return d.toISOString()
}

/** Half-hour slots between two 'HH:mm' bounds — for calendar grids. */
export function timeSlots(opensAt: string, closesAt: string, stepMinutes = 30): string[] {
  const [oh, om] = opensAt.split(':').map(Number)
  const [ch, cm] = closesAt.split(':').map(Number)
  const start = (oh ?? 9) * 60 + (om ?? 0)
  const end = (ch ?? 18) * 60 + (cm ?? 0)
  const slots: string[] = []
  for (let m = start; m < end; m += stepMinutes) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return slots
}

/** Formats an 'HH:mm' string for display. */
export function formatSlot(slot: string): string {
  const [h, m] = slot.split(':').map(Number)
  const d = new Date()
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  return formatTime(d)
}
