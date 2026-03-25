'use client'
import { createContext, useContext, useEffect } from 'react'

// Dark mode removed — app is light-mode only.
// ThemeProvider kept so existing imports don't break.
type Theme = 'light'
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'light', setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Always force light — clear any stored dark preference
    localStorage.removeItem('planora-theme')
    document.documentElement.classList.remove('dark')
  }, [])

  return (
    <ThemeCtx.Provider value={{ theme: 'light', setTheme: () => {} }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() { return useContext(ThemeCtx) }
