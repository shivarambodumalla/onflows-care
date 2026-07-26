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
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, Undo2, X, XCircle } from 'lucide-react'
import { cn } from './cn'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
  /** Milliseconds on screen. Toasts with an undo action get longer by default. */
  duration?: number
  /** Part 21 — undo. Shown as an inline action; dismisses the toast when used. */
  undo?: () => void
}

interface ToastRecord extends ToastOptions {
  id: number
}

interface ToastApi {
  toast: (options: ToastOptions) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  /** Confirms an action and offers to reverse it. */
  undoable: (title: string, undo: () => void, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const ICONS: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

const TONES: Record<ToastTone, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
  warning: 'text-warning',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++
      const duration = options.duration ?? (options.undo ? 8000 : 4000)
      setToasts((list) => [...list, { ...options, id }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
    },
    [dismiss],
  )

  // Clear pending timers if the provider unmounts mid-flight.
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error' }),
      info: (title, description) => toast({ title, description, tone: 'info' }),
      undoable: (title, undo, description) =>
        toast({ title, description, tone: 'success', undo }),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
        >
          {toasts.map((t) => {
            const tone = t.tone ?? 'info'
            const Icon = ICONS[tone]
            return (
              <div
                key={t.id}
                role={tone === 'error' ? 'alert' : 'status'}
                className={cn(
                  'animate-slide-up pointer-events-auto flex items-start gap-3 rounded-xl border border-default',
                  'bg-surface-raised px-3.5 py-3 shadow-lg',
                )}
              >
                <Icon aria-hidden className={cn('mt-px size-4 shrink-0', TONES[tone])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
                </div>
                {t.undo && (
                  <button
                    type="button"
                    onClick={() => {
                      t.undo?.()
                      dismiss(t.id)
                    }}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-bg"
                  >
                    <Undo2 aria-hidden className="size-3.5" />
                    Undo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="shrink-0 cursor-pointer rounded-md p-1 text-subtle hover:bg-surface-hover hover:text-text"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
