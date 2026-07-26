import type { Database } from './types'
import { buildSeed, SEED_VERSION } from './seed'

const KEY = 'onflows.db'
export const THEME_KEY = 'onflows.theme'
export const SESSION_KEY = 'onflows.session'

/**
 * The only module that touches localStorage for application data.
 *
 * Swapping in a real backend means replacing the two functions below with
 * HTTP calls; nothing above the data layer knows where the bytes live.
 */

export function loadDatabase(): Database {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seedAndSave()

    const parsed = JSON.parse(raw) as Database
    // A shape change invalidates old demo data rather than crashing on it.
    if (parsed.version !== SEED_VERSION) return seedAndSave()
    return parsed
  } catch {
    // Corrupt or unavailable storage (private mode, quota) — start clean.
    return seedAndSave()
  }
}

export function saveDatabase(db: Database): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Quota exceeded or storage disabled. The in-memory state stays correct
    // for this session; only persistence is lost, which a prototype survives.
    console.warn('[onflows] could not persist demo data — changes are session-only')
  }
}

export function resetDatabase(): Database {
  return seedAndSave()
}

function seedAndSave(): Database {
  const db = buildSeed()
  saveDatabase(db)
  return db
}
