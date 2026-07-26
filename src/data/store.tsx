import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { reconcileFollowUps } from './actions'
import { can, seesAllBranches, type Permission } from './permissions'
import { loadDatabase, resetDatabase, saveDatabase, SESSION_KEY } from './storage'
import type { Branch, Database, ID, Role, User } from './types'

/**
 * The single source of truth for the running prototype.
 *
 * Reads are synchronous selectors over an in-memory `Database`; writes go
 * through `apply`, which snapshots the previous state for undo, persists, and
 * hands back a new object. When a real backend lands, `apply` becomes an
 * optimistic mutation with a request behind it — components do not change.
 */

interface AppState {
  db: Database
  /** Boot phase — genuinely async because seeding runs the follow-up engine. */
  booting: boolean
  /** The signed-in user, switchable from the top bar for demos. */
  user: User
  role: Role
  branch: Branch
  branches: Branch[]
  /** Branches this user may act in. */
  visibleBranchIds: ID[]
  online: boolean

  setUser: (userId: ID) => void
  setBranch: (branchId: ID) => void

  /** Applies a pure mutation, persists it, and makes it undoable. */
  apply: (mutate: (db: Database) => Database) => void
  /** Same, but returns whatever the mutation produced alongside the new db. */
  applyWith: <T,>(mutate: (db: Database) => [Database, T]) => T
  undo: () => void
  canUndo: boolean

  resetDemoData: () => void
  /** Permission check for the *current* role. */
  allows: (permission: Permission) => boolean
}

const AppContext = createContext<AppState | null>(null)

const UNDO_LIMIT = 25

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null)
  const [userId, setUserId] = useState<ID | null>(null)
  const [branchId, setBranchId] = useState<ID | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const undoStack = useRef<Database[]>([])
  const [canUndo, setCanUndo] = useState(false)

  /* --- Boot ------------------------------------------------------------- */

  useEffect(() => {
    // Deferred a frame so the loading state actually paints — the boot work is
    // real (seed + engine catch-up), and hiding it would be dishonest.
    const timer = setTimeout(() => {
      const loaded = reconcileFollowUps(loadDatabase())
      saveDatabase(loaded)

      const stored = localStorage.getItem(SESSION_KEY)
      const parsed = stored ? (JSON.parse(stored) as { userId: ID; branchId: ID }) : null
      const user =
        loaded.users.find((u) => u.id === parsed?.userId && u.active) ??
        loaded.users.find((u) => u.role === 'owner')!

      setDb(loaded)
      setUserId(user.id)
      setBranchId(
        loaded.branches.find((b) => b.id === parsed?.branchId)?.id ??
          user.branchIds[0] ??
          loaded.branches[0]!.id,
      )
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  /* --- Connectivity (Part 22 — offline state) --------------------------- */

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  /* --- Persistence ------------------------------------------------------ */

  useEffect(() => {
    if (!userId || !branchId) return
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, branchId }))
  }, [userId, branchId])

  /* --- Mutation --------------------------------------------------------- */

  const commit = useCallback((current: Database, next: Database) => {
    undoStack.current = [current, ...undoStack.current].slice(0, UNDO_LIMIT)
    setCanUndo(true)
    saveDatabase(next)
    return next
  }, [])

  const apply = useCallback(
    (mutate: (db: Database) => Database) => {
      setDb((current) => {
        if (!current) return current
        const next = mutate(current)
        if (next === current) return current
        return commit(current, next)
      })
    },
    [commit],
  )

  /**
   * For mutations that create something the caller needs (a new patient to
   * navigate to, an appointment to open). The mutation still runs inside the
   * state updater, so it sees the freshest database.
   */
  const applyWith = useCallback(
    <T,>(mutate: (db: Database) => [Database, T]): T => {
      let produced!: T
      setDb((current) => {
        if (!current) return current
        const [next, value] = mutate(current)
        produced = value
        if (next === current) return current
        return commit(current, next)
      })
      return produced
    },
    [commit],
  )

  const undo = useCallback(() => {
    const [previous, ...rest] = undoStack.current
    if (!previous) return
    undoStack.current = rest
    setCanUndo(rest.length > 0)
    saveDatabase(previous)
    setDb(previous)
  }, [])

  const resetDemoData = useCallback(() => {
    const fresh = reconcileFollowUps(resetDatabase())
    saveDatabase(fresh)
    undoStack.current = []
    setCanUndo(false)
    setDb(fresh)
    const owner = fresh.users.find((u) => u.role === 'owner')!
    setUserId(owner.id)
    setBranchId(fresh.branches[0]!.id)
  }, [])

  /* --- Derived ---------------------------------------------------------- */

  const value = useMemo<AppState | null>(() => {
    if (!db || !userId || !branchId) return null

    const user = db.users.find((u) => u.id === userId) ?? db.users[0]!
    const visibleBranchIds = seesAllBranches(user.role)
      ? db.branches.map((b) => b.id)
      : user.branchIds
    const branch =
      db.branches.find((b) => b.id === branchId && visibleBranchIds.includes(b.id)) ??
      db.branches.find((b) => visibleBranchIds.includes(b.id)) ??
      db.branches[0]!

    return {
      db,
      booting: false,
      user,
      role: user.role,
      branch,
      branches: db.branches.filter((b) => visibleBranchIds.includes(b.id)),
      visibleBranchIds,
      online,
      setUser: setUserId,
      setBranch: setBranchId,
      apply,
      applyWith,
      undo,
      canUndo,
      resetDemoData,
      allows: (permission: Permission) => can(user.role, permission),
    }
  }, [db, userId, branchId, online, apply, applyWith, undo, canUndo, resetDemoData])

  if (!value) return <BootScreen />

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xs font-semibold tracking-[0.25em] text-brand uppercase">
            Onflows
          </span>
          <span className="text-2xs font-semibold tracking-[0.25em] text-muted uppercase">
            Care
          </span>
        </div>
        <div className="h-0.5 w-32 overflow-hidden rounded-full bg-surface-active">
          <div className="h-full w-1/3 animate-shimmer rounded-full bg-brand" />
        </div>
        <p className="text-xs text-subtle">Preparing your clinic…</p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within <AppProvider>')
  return ctx
}

export function useDb(): Database {
  return useApp().db
}

/** Current actor context for mutations. */
export function useCtx() {
  const { user, branch } = useApp()
  return useMemo(() => ({ actorId: user.id, branchId: branch.id }), [user.id, branch.id])
}

export function usePermission(permission: Permission): boolean {
  return useApp().allows(permission)
}

/** Renders children only if the current role holds the permission. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>
}
