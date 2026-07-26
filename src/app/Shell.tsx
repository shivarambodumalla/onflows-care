import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CloudOff,
  Menu as MenuIcon,
  Moon,
  Search,
  Sun,
  Undo2,
  UserCog,
  X,
} from 'lucide-react'
import { Avatar, Badge, Button, Count, Menu, cn } from '@/design-system'
import { markAllNotificationsRead, markNotificationRead } from '@/data/actions'
import { ROLE_LABELS, type Role } from '@/data/types'
import { useApp } from '@/data/store'
import { dashboardKpis } from '@/data/selectors'
import { formatRelativeTime } from '@/lib/dates'
import { NAV } from './nav'
import { CommandPalette } from './CommandPalette'
import { useTheme } from './useTheme'

/**
 * The application shell — persistent left navigation, a top bar carrying the
 * demo controls (branch, acting-as role), global search and notifications.
 *
 * The role switcher is deliberately front-and-centre: Part 4's permission
 * matrix is only credible if you can watch the interface change as you move
 * between roles.
 */
export function Shell() {
  const { db, user, role, branch, branches, setBranch, setUser, online, undo, canUndo, allows } =
    useApp()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Close the mobile nav on navigation — otherwise it covers the destination.
  useEffect(() => setNavOpen(false), [location.pathname])

  /* Part 21 — keyboard. ⌘K opens search, ⌘Z undoes the last write. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement
        // Never steal undo from a field the user is typing in.
        const typing = ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable
        if (typing) return
        e.preventDefault()
        undo()
      }
      if (e.key === '/' && !paletteOpen) {
        const target = e.target as HTMLElement
        if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [undo, paletteOpen])

  const scope = useMemo(
    () => ({ branchId: branch.id, role, userId: user.id }),
    [branch.id, role, user.id],
  )
  const kpis = useMemo(() => dashboardKpis(db, scope), [db, scope])

  const badges = {
    overdueTasks: kpis.overdueFollowUps,
    todayAppointments: kpis.todayTotal,
    openLeads: kpis.openLeads,
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {!online && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-warning-bg px-4 py-1.5 text-xs font-medium text-warning-text"
        >
          <CloudOff aria-hidden className="size-3.5" />
          You are offline. Changes are saved on this device only.
        </div>
      )}

      <div className="flex flex-1">
        {/* --- Sidebar ---------------------------------------------------- */}
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} badges={badges} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* --- Top bar -------------------------------------------------- */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-default bg-surface/90 px-3 backdrop-blur-md sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
            >
              <MenuIcon className="size-4" />
            </Button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className={cn(
                'group flex h-9 max-w-md flex-1 cursor-pointer items-center gap-2 rounded-lg border border-default',
                'bg-surface-sunken px-3 text-sm text-subtle transition-colors hover:border-strong hover:bg-surface-hover',
              )}
            >
              <Search aria-hidden className="size-4 shrink-0" />
              <span className="truncate">Search patients, appointments, leads…</span>
              <kbd className="ml-auto hidden shrink-0 rounded border border-default bg-surface px-1.5 py-0.5 text-2xs text-muted sm:block">
                ⌘K
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-1">
              {canUndo && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Undo2 />}
                  onClick={undo}
                  className="hidden sm:inline-flex"
                  title="Undo the last change (⌘Z)"
                >
                  Undo
                </Button>
              )}

              <BranchSwitcher
                branches={branches}
                current={branch.id}
                onChange={setBranch}
                canSeeMultiple={branches.length > 1}
              />

              <NotificationTray />
              <ThemeToggle />
              <RoleSwitcher current={user.id} role={role} onChange={setUser} canManage={allows('users.view')} />
            </div>
          </header>

          {/* --- Page ----------------------------------------------------- */}
          <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">
            <Outlet />
          </main>

          <footer className="border-t border-default px-4 py-3 text-center text-2xs text-subtle sm:px-6">
            ONFLOWS CARE — interactive prototype on simulated data. Messaging, payments and
            document storage are not connected.
          </footer>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Sidebar({
  open,
  onClose,
  badges,
}: {
  open: boolean
  onClose: () => void
  badges: Record<string, number>
}) {
  const { allows, db } = useApp()

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink-950/40 lg:hidden"
        />
      )}

      <nav
        aria-label="Main"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-default bg-surface',
          'transition-transform duration-(--duration-base) ease-(--ease-out-soft) lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-default px-4">
          <Link to="/" className="flex items-baseline gap-1.5 rounded">
            <span className="text-sm font-bold tracking-[0.18em] text-brand uppercase">Onflows</span>
            <span className="text-sm font-semibold tracking-[0.18em] text-muted uppercase">
              Care
            </span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Close navigation">
            <X className="size-4" />
          </Button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((section) => {
            const items = section.items.filter((item) => !item.permission || allows(item.permission))
            if (items.length === 0) return null

            return (
              <div key={section.label} className="mb-5 last:mb-0">
                <p className="mb-1.5 px-2 text-2xs font-semibold tracking-wider text-subtle uppercase">
                  {section.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const count = item.badge ? badges[item.badge] : undefined
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={!item.matchPrefix}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium',
                              'transition-colors duration-(--duration-fast)',
                              isActive
                                ? 'bg-brand-bg text-brand-text'
                                : 'text-muted hover:bg-surface-hover hover:text-text',
                            )
                          }
                        >
                          <item.icon aria-hidden className="size-4 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {count !== undefined && (
                            <Count
                              value={count}
                              tone={item.badge === 'overdueTasks' ? 'danger' : 'neutral'}
                            />
                          )}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="border-t border-default px-4 py-3">
          <p className="text-2xs text-subtle">
            {db.patients.filter((p) => p.status === 'active').length} active patients ·{' '}
            {db.branches.length} branches
          </p>
        </div>
      </nav>
    </>
  )
}

/* -------------------------------------------------------------------------- */

function BranchSwitcher({
  branches,
  current,
  onChange,
  canSeeMultiple,
}: {
  branches: { id: string; name: string; code: string }[]
  current: string
  onChange: (id: string) => void
  canSeeMultiple: boolean
}) {
  const branch = branches.find((b) => b.id === current)

  if (!canSeeMultiple) {
    return (
      <span className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted sm:inline-flex">
        <Building2 aria-hidden className="size-3.5" />
        {branch?.name}
      </span>
    )
  }

  return (
    <Menu
      label="Switch branch"
      items={branches.map((b) => ({
        label: b.name,
        selected: b.id === current,
        icon: <Building2 />,
        onSelect: () => onChange(b.id),
      }))}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:bg-surface-hover hover:text-text"
        >
          <Building2 aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">{branch?.name ?? 'Branch'}</span>
          <ChevronDown aria-hidden className="size-3" />
        </button>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */

function RoleSwitcher({
  current,
  role,
  onChange,
  canManage,
}: {
  current: string
  role: Role
  onChange: (id: string) => void
  canManage: boolean
}) {
  const { db } = useApp()
  const user = db.users.find((u) => u.id === current)

  // One representative per role keeps the demo switcher short and predictable.
  const demoUsers = useMemo(() => {
    const order: Role[] = ['owner', 'admin', 'branch_manager', 'doctor', 'receptionist']
    return order
      .map((r) => db.users.find((u) => u.active && u.role === r))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
  }, [db.users])

  return (
    <Menu
      label="Switch demo user"
      menuClassName="min-w-64"
      items={[
        ...demoUsers.map((u) => ({
          label: (
            <span className="flex flex-col">
              <span className="font-medium">{ROLE_LABELS[u.role]}</span>
              <span className="text-xs text-muted">{u.name}</span>
            </span>
          ),
          selected: u.id === current,
          onSelect: () => onChange(u.id),
        })),
        ...(canManage
          ? [
              {
                label: 'Manage users',
                icon: <UserCog />,
                separated: true,
                onSelect: () => {
                  window.location.hash = '#/users'
                },
              },
            ]
          : []),
      ]}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={`Acting as ${ROLE_LABELS[role]}. Change demo user.`}
          className="ml-1 inline-flex cursor-pointer items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 hover:bg-surface-hover"
        >
          <Avatar name={user?.name ?? '?'} size="sm" />
          <span className="hidden text-left sm:block">
            <span className="block text-2xs leading-tight text-subtle">Acting as</span>
            <span className="block text-xs leading-tight font-medium text-text">
              {ROLE_LABELS[role]}
            </span>
          </span>
          <ChevronDown aria-hidden className="size-3 text-subtle" />
        </button>
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */

function NotificationTray() {
  const { db, user, apply } = useApp()
  const [open, setOpen] = useState(false)

  const mine = useMemo(
    () => db.notifications.filter((n) => n.userId === user.id).slice(0, 20),
    [db.notifications, user.id],
  )
  const unread = mine.filter((n) => !n.read).length

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <span className="relative">
          <Bell className="size-4" />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 size-2 rounded-full bg-danger ring-2 ring-[var(--surface)]"
            />
          )}
        </span>
      </Button>

      {open && (
        <>
          <div aria-hidden className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="animate-slide-up absolute right-0 z-40 mt-1 w-80 overflow-hidden rounded-xl border border-default bg-surface-raised shadow-lg">
            <div className="flex items-center justify-between border-b border-default px-3 py-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => apply((db) => markAllNotificationsRead(db, user.id))}
                  className="cursor-pointer text-xs font-medium text-brand hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="scrollbar-thin max-h-96 overflow-y-auto">
              {mine.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-subtle">
                  You are all caught up.
                </p>
              ) : (
                mine.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      apply((db) => markNotificationRead(db, n.id))
                      if (n.href) window.location.hash = `#${n.href}`
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full cursor-pointer gap-2.5 border-b border-default/60 px-3 py-2.5 text-left last:border-0',
                      'hover:bg-surface-hover',
                      !n.read && 'bg-brand-bg/40',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        n.read ? 'bg-transparent' : 'bg-brand',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-text">{n.title}</span>
                      <span className="block truncate text-xs text-muted">{n.body}</span>
                      <span className="mt-0.5 block text-2xs text-subtle">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center gap-1.5 border-t border-default bg-surface-sunken px-3 py-2">
              <Badge tone="neutral" size="sm">
                <Check aria-hidden className="size-2.5" /> In-app
              </Badge>
              <span className="text-2xs text-subtle">
                Email and WhatsApp are simulated in this prototype.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
