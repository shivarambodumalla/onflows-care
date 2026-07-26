import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Part 21 — Autosave.
 *
 * Keeps a form draft in localStorage so closing a drawer by accident, or a
 * reload mid-entry, does not lose what was typed. Reception gets interrupted
 * constantly; a half-filled registration form surviving that is the point.
 */
export function useAutosave<T extends object>(
  key: string,
  initial: T,
  /** Only reads and writes while the form is actually open. */
  active = true,
) {
  const storageKey = `onflows.draft.${key}`
  const [draft, setDraft] = useState<T>(initial)
  const [restored, setRestored] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore on open.
  useEffect(() => {
    if (!active) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        setDraft({ ...initial, ...(JSON.parse(raw) as T) })
        setRestored(true)
        return
      }
    } catch {
      // Ignore malformed drafts and start fresh.
    }
    setDraft(initial)
    setRestored(false)
    // `initial` is a literal at every call site; re-running on identity churn
    // would clobber what the user has typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, storageKey])

  // Persist, debounced so we are not writing on every keystroke.
  useEffect(() => {
    if (!active) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft))
      } catch {
        // Storage full or unavailable — the in-memory draft still works.
      }
    }, 400)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [draft, active, storageKey])

  const clear = useCallback(() => {
    localStorage.removeItem(storageKey)
    setDraft(initial)
    setRestored(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  return { draft, setDraft, clear, restored }
}
