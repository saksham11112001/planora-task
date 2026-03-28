'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'
interface ThemeCtxType { theme: Theme; resolved: 'light' | 'dark'; setTheme: (t: Theme) => void }

const ThemeCtx = createContext<ThemeCtxType>({ theme: 'system', resolved: 'light', setTheme: () => {} })

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const PUBLIC_PATHS = ['/', '/login', '/privacy', '/terms']

function isPublicPage(): boolean {
  if (typeof window === 'undefined') return false
  const p = window.location.pathname
  return PUBLIC_PATHS.some(pub => p === pub || p.startsWith(pub + '/'))
}

function applyResolved(resolved: 'light' | 'dark') {
  // Public pages (landing, login, privacy, terms) are always light
  if (isPublicPage()) {
    document.documentElement.classList.remove('dark')
    return
  }
  if (resolved === 'dark') document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,    setThemeState] = useState<Theme>('system')
  const [resolved, setResolved]   = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = (localStorage.getItem('planora-theme') as Theme) ?? 'system'
    setThemeState(saved)

    const r = saved === 'system' ? getSystemTheme() : saved
    setResolved(r)
    applyResolved(r)

    // Watch system preference changes (for system mode)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const current = (localStorage.getItem('planora-theme') as Theme) ?? 'system'
      if (current === 'system') {
        const r2 = e.matches ? 'dark' : 'light'
        setResolved(r2)
        applyResolved(r2)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Re-apply theme on client-side navigation (catches landing → app transitions)
  useEffect(() => {
    const saved = (localStorage.getItem('planora-theme') as Theme) ?? 'system'
    const r = saved === 'system' ? getSystemTheme() : saved
    applyResolved(r)
  })  // runs after every render = catches route changes

  function setTheme(t: Theme) {
    localStorage.setItem('planora-theme', t)
    setThemeState(t)
    const r = t === 'system' ? getSystemTheme() : t
    setResolved(r)
    applyResolved(r)
  }

  return (
    <ThemeCtx.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() { return useContext(ThemeCtx) }
