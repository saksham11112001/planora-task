'use client'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const options: { value: 'light' | 'dark' | 'system'; icon: React.ReactNode; label: string }[] = [
    { value: 'light',  icon: <Sun     className="h-3.5 w-3.5"/>, label: 'Light'  },
    { value: 'dark',   icon: <Moon    className="h-3.5 w-3.5"/>, label: 'Dark'   },
    { value: 'system', icon: <Monitor className="h-3.5 w-3.5"/>, label: 'System' },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, padding: '3px',
      background: 'var(--border-light)', borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 5, padding: '5px 8px', borderRadius: 6, border: 'none',
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
            transition: 'all 0.15s',
            background: theme === opt.value ? 'var(--surface)' : 'transparent',
            color: theme === opt.value ? 'var(--brand)' : 'var(--text-muted)',
            boxShadow: theme === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
