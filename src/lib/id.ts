/** Short, readable, collision-safe-enough ids for a prototype. */
export function uid(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8)
  const time = Date.now().toString(36).slice(-4)
  return `${prefix}_${time}${random}`
}

/**
 * Deterministic PRNG (mulberry32). The seed generator uses this so every
 * demo reset produces the identical dataset — screenshots, PRD examples and
 * acceptance criteria all stay valid.
 */
export function createRandom(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    /** Integer in [min, max]. */
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    /** True with probability `p`. */
    chance: (p: number) => next() < p,
    /** `count` distinct items, or all of them if the list is shorter. */
    sample: <T,>(items: readonly T[], count: number): T[] => {
      const pool = [...items]
      const out: T[] = []
      while (out.length < count && pool.length > 0) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]!)
      }
      return out
    },
  }
}

export type Random = ReturnType<typeof createRandom>
