import { useCallback, useEffect, useState } from 'react'
import { THEME_KEY } from '@/data/storage'

export type Theme = 'light' | 'dark'

/**
 * Theme lives on `document.documentElement.dataset.theme` and is applied
 * pre-paint by an inline script in index.html, so there is no flash of the
 * wrong theme on load. This hook only keeps React in sync with it.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) ?? 'light',
  )

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next
    localStorage.setItem(THEME_KEY, next)
    setThemeState(next)
  }, [])

  // Follow the OS only while the user has not made an explicit choice.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_KEY)) return
      setThemeState(e.matches ? 'dark' : 'light')
      document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return { theme, setTheme }
}
