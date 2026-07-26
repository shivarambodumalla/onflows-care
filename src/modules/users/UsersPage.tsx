import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Check, LogOut, Minus, Plus, ShieldCheck, UserCog, UserX } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  Field,
  Input,
  Menu,
  PageHeader,
  Select,
  Tabs,
  cn,
  useToast,
  type Column,
} from '@/design-system'
import { useApp, useCtx } from '@/data/store'
import { endSession, saveUser, setUserActive } from '@/data/actions'
import {
  ALL_PERMISSIONS,
  can,
  PERMISSION_GROUPS,
  type Permission,
} from '@/data/permissions'
import { formatDateTime, formatRelativeTime } from '@/lib/dates'
import { ROLE_LABELS, type Role, type Session, type User } from '@/data/types'

type Tab = 'users' | 'roles' | 'sessions'

const ROLES: Role[] = ['owner', 'admin', 'branch_manager', 'doctor', 'receptionist']

/**
 * Part 17 — User management.
 *
 * The permission matrix is rendered from the same `can()` the app enforces
 * with, so what an administrator reads here is exactly what the product does.
 */
export function UsersPage() {
  const { db, apply, allows, user: currentUser } = useApp()
  const ctx = useCtx()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [tab, setTab] = useState<Tab>('users')
  const [editing, setEditing] = useState<User | null>(null)
  const [creating, setCreating] = useState(false)

  const focused = params.get('user')
  useMemo(() => {
    if (!focused) return
    const target = db.users.find((u) => u.id === focused)
    if (target) setEditing(target)
    const next = new URLSearchParams(params)
    next.delete('user')
    setParams(next, { replace: true })
  }, [focused, db.users, params, setParams])

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        key: 'name',
        header: 'User',
        sortBy: (u) => u.name,
        cell: (user) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={user.name} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{user.name}</span>
                {user.id === currentUser.id && (
                  <Badge tone="brand" size="sm">
                    You
                  </Badge>
                )}
                {!user.active && (
                  <Badge tone="neutral" size="sm">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        width: 'w-36',
        sortBy: (u) => u.role,
        cell: (user) => <Badge tone="info" size="sm">{ROLE_LABELS[user.role]}</Badge>,
      },
      {
        key: 'branches',
        header: 'Branches',
        hideOnMobile: true,
        cell: (user) => (
          <span className="text-muted">
            {user.role === 'owner' || user.role === 'admin'
              ? 'All branches'
              : user.branchIds
                  .map((id) => db.branches.find((b) => b.id === id)?.name)
                  .filter(Boolean)
                  .join(', ') || '—'}
          </span>
        ),
      },
      {
        key: 'lastActive',
        header: 'Last active',
        align: 'right',
        hideOnMobile: true,
        sortBy: (u) => u.lastActiveAt,
        cell: (user) => (
          <span className="text-muted">{formatRelativeTime(user.lastActiveAt)}</span>
        ),
      },
    ],
    [db.branches, currentUser.id],
  )

  const sessionColumns = useMemo<Column<Session>[]>(
    () => [
      {
        key: 'user',
        header: 'User',
        sortBy: (s) => db.users.find((u) => u.id === s.userId)?.name ?? '',
        cell: (session) => {
          const user = db.users.find((u) => u.id === session.userId)
          return (
            <div className="flex items-center gap-2.5">
              <Avatar name={user?.name ?? '?'} size="sm" />
              <div>
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted">{ROLE_LABELS[user?.role ?? 'receptionist']}</p>
              </div>
            </div>
          )
        },
      },
      {
        key: 'device',
        header: 'Device',
        cell: (session) => (
          <div>
            <p className="text-sm">{session.device}</p>
            <p className="tnum text-xs text-muted">{session.ipAddress}</p>
          </div>
        ),
      },
      {
        key: 'started',
        header: 'Signed in',
        hideOnMobile: true,
        sortBy: (s) => s.startedAt,
        cell: (session) => (
          <span className="text-muted">{formatDateTime(session.startedAt)}</span>
        ),
      },
      {
        key: 'lastSeen',
        header: 'Last seen',
        align: 'right',
        sortBy: (s) => s.lastSeenAt,
        cell: (session) => (
          <div className="flex items-center justify-end gap-1.5">
            {session.current && (
              <Badge tone="success" size="sm">
                This device
              </Badge>
            )}
            <span className="text-muted">{formatRelativeTime(session.lastSeenAt)}</span>
          </div>
        ),
      },
    ],
    [db.users],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Users"
        description={`${db.users.filter((u) => u.active).length} active · ${db.sessions.length} live sessions`}
        actions={
          allows('users.create') ? (
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
              Add user
            </Button>
          ) : undefined
        }
      />

      <Tabs
        ariaLabel="User management sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'users', label: 'Users', count: db.users.length },
          { value: 'roles', label: 'Roles & permissions' },
          { value: 'sessions', label: 'Sessions', count: db.sessions.length },
        ]}
      />

      {tab === 'users' && (
        <DataTable
          rows={db.users}
          columns={columns}
          rowKey={(u) => u.id}
          onRowClick={allows('users.edit') ? setEditing : undefined}
          initialSort={{ key: 'name', direction: 'asc' }}
          emptyState={{ title: 'No users', description: 'Add the first staff member.' }}
          rowActions={(user) => (
            <Menu
              label={`Actions for ${user.name}`}
              items={[
                ...(allows('users.edit')
                  ? [{ label: 'Edit user', icon: <UserCog />, onSelect: () => setEditing(user) }]
                  : []),
                ...(allows('users.edit') && user.id !== currentUser.id
                  ? [
                      {
                        label: user.active ? 'Deactivate' : 'Reactivate',
                        icon: <UserX />,
                        destructive: user.active,
                        separated: true,
                        onSelect: () => {
                          apply((db) => setUserActive(db, ctx, user.id, !user.active))
                          toast.undoable(
                            user.active ? `${user.name} deactivated` : `${user.name} reactivated`,
                            () => {},
                          )
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
                  aria-label={`Actions for ${user.name}`}
                >
                  <UserCog className="size-4" />
                </Button>
              )}
            />
          )}
        />
      )}

      {tab === 'roles' && <PermissionMatrix />}

      {tab === 'sessions' && (
        <>
          <DataTable
            rows={db.sessions}
            columns={sessionColumns}
            rowKey={(s) => s.id}
            initialSort={{ key: 'lastSeen', direction: 'desc' }}
            emptyState={{ title: 'No active sessions', description: 'Nobody is signed in.' }}
            rowActions={(session) =>
              allows('users.endSessions') && !session.current ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="End session"
                  onClick={() => {
                    apply((db) => endSession(db, ctx, session.id))
                    toast.success('Session ended')
                  }}
                >
                  <LogOut className="size-4" />
                </Button>
              ) : null
            }
          />
          <p className="text-xs text-subtle">
            Ending a session signs that device out immediately. Deactivating a user revokes all of
            their sessions at once.
          </p>
        </>
      )}

      <UserDrawer
        open={creating || Boolean(editing)}
        user={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Part 4 — the permission matrix, rendered directly from `can()`. If the code
 * changes, this table changes with it; there is no second copy to fall stale.
 */
function PermissionMatrix() {
  const groups = useMemo(
    () =>
      PERMISSION_GROUPS.map((group) => ({
        ...group,
        permissions: ALL_PERMISSIONS.filter((p) =>
          group.prefix === 'timeline.' ? p.startsWith('timeline.') || p.startsWith('audit.') : p.startsWith(group.prefix),
        ),
      })).filter((group) => group.permissions.length > 0),
    [],
  )

  return (
    <Card padded={false}>
      <div className="border-b border-default px-4 py-3">
        <CardHeader
          title="Permission matrix"
          description="Rendered from the same check the application enforces with — this table cannot drift from the behaviour."
        />
      </div>

      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface-sunken">
            <tr>
              <th className="border-b border-default px-4 py-2.5 text-left text-xs font-medium text-muted">
                Permission
              </th>
              {ROLES.map((role) => (
                <th
                  key={role}
                  className="border-b border-l border-default px-3 py-2.5 text-center text-xs font-medium text-muted"
                >
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <>
                <tr key={group.label}>
                  <td
                    colSpan={ROLES.length + 1}
                    className="border-b border-default bg-surface-sunken/60 px-4 py-1.5 text-2xs font-semibold tracking-wider text-subtle uppercase"
                  >
                    {group.label}
                  </td>
                </tr>
                {group.permissions.map((permission) => (
                  <tr key={permission} className="border-b border-default/60">
                    <td className="px-4 py-2 font-mono text-xs text-muted">{permission}</td>
                    {ROLES.map((role) => {
                      const allowed = can(role, permission as Permission)
                      return (
                        <td key={role} className="border-l border-default px-3 py-2 text-center">
                          {allowed ? (
                            <Check
                              aria-label="Allowed"
                              className="mx-auto size-4 text-success"
                            />
                          ) : (
                            <Minus aria-label="Not allowed" className="mx-auto size-3.5 text-subtle" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function UserDrawer({
  open,
  user,
  onClose,
}: {
  open: boolean
  user: User | null
  onClose: () => void
}) {
  const { db, apply, allows } = useApp()
  const ctx = useCtx()
  const toast = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<Role>('receptionist')
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [specialisation, setSpecialisation] = useState('')
  const [error, setError] = useState('')

  useMemo(() => {
    if (!open) return
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
    setPhone(user?.phone ?? '')
    setRole(user?.role ?? 'receptionist')
    setBranchIds(user?.branchIds ?? [db.branches[0]!.id])
    setSpecialisation(user?.specialisation ?? '')
    setError('')
  }, [open, user, db.branches])

  const canManageRoles = allows('users.manageRoles')

  const submit = () => {
    if (!name.trim()) return setError('A name is required')
    if (!email.trim()) return setError('An email is required')
    if (branchIds.length === 0) return setError('Assign at least one branch')

    apply((db) =>
      saveUser(db, ctx, {
        id: user?.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        branchIds,
        specialisation: role === 'doctor' ? specialisation.trim() || undefined : undefined,
      }),
    )
    onClose()
    toast.success(user ? 'User updated' : 'User added')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={user ? `Edit ${user.name}` : 'Add a user'}
      description={user ? user.email : 'They will be able to sign in with this email'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {user ? 'Save changes' : 'Add user'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            {({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Email" required>
            {({ id }) => (
              <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Field label="Phone">
            {({ id }) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />}
          </Field>
          <Field
            label="Role"
            required
            hint={canManageRoles ? undefined : 'Only an owner can change roles'}
          >
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={role}
                disabled={!canManageRoles}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {role === 'doctor' && (
          <Field label="Specialisation">
            {({ id }) => (
              <Input
                id={id}
                value={specialisation}
                onChange={(e) => setSpecialisation(e.target.value)}
                placeholder="e.g. Pain management"
              />
            )}
          </Field>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">
            Branches <span className="text-danger">*</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {db.branches.map((branch) => {
              const selected = branchIds.includes(branch.id)
              return (
                <button
                  key={branch.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setBranchIds((current) =>
                      current.includes(branch.id)
                        ? current.filter((id) => id !== branch.id)
                        : [...current, branch.id],
                    )
                  }
                  className={cn(
                    'cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                    selected
                      ? 'border-brand bg-brand text-brand-fg'
                      : 'border-default bg-surface text-muted hover:border-strong',
                  )}
                >
                  {branch.name}
                </button>
              )
            })}
          </div>
          {(role === 'owner' || role === 'admin') && (
            <p className="mt-1.5 text-xs text-subtle">
              Owners and admins can see every branch regardless of this setting.
            </p>
          )}
        </div>

        <Card>
          <div className="flex items-start gap-2">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
            <div>
              <p className="text-sm font-medium">What {ROLE_LABELS[role]} can do</p>
              <p className="mt-1 text-xs text-muted">
                {role === 'owner'
                  ? 'Everything, including changing roles.'
                  : role === 'admin'
                    ? 'Everything except changing roles — full settings, users, audit and all-branch reports.'
                    : role === 'branch_manager'
                      ? 'Runs a branch: patients, scheduling, follow-ups, leads, reports and blocked time.'
                      : role === 'doctor'
                        ? 'Clinical work: their own schedule, patient records, treatments and prescriptions.'
                        : 'Front desk: registration, booking, check-in, follow-ups and enquiries. No clinical detail.'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Drawer>
  )
}
