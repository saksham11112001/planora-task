'use client'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const Icon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun
  const title = `Current: ${theme} → click for ${next}`

  return (
    <button onClick={() => setTheme(next)} title={title}
      style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s',
        color: 'var(--text-secondary)', position: 'relative' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--brand)'; el.style.color = 'var(--brand)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text-secondary)' }}>
      <Icon style={{ width: 15, height: 15 }}/>
    </button>
  )
}
