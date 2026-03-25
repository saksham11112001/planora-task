'use client'
import { Sun, Moon, Monitor, ArrowLeft } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import Link         from 'next/link'

const THEMES = [
  { value: 'light'  as const, icon: Sun,     label: 'Light',  desc: 'Clean white interface — default' },
  { value: 'dark'   as const, icon: Moon,    label: 'Dark',   desc: 'Easy on the eyes at night' },
  { value: 'system' as const, icon: Monitor, label: 'System', desc: 'Follows your OS preference automatically' },
]

export function AppearanceView() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="page-container">
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5"/> Settings
        </Link>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Appearance</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>Choose how Planora looks for you. Your preference is saved locally.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {THEMES.map(({ value, icon: Icon, label, desc }) => (
            <button key={value} onClick={() => setTheme(value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                borderRadius: 12, border: `2px solid ${theme === value ? 'var(--brand)' : 'var(--border)'}`,
                background: theme === value ? 'var(--brand-light)' : 'var(--surface)',
                cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%',
              }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: theme === value ? 'var(--brand)' : 'var(--border-light)',
                color: theme === value ? '#fff' : 'var(--text-muted)',
              }}>
                <Icon style={{ width: 20, height: 20 }}/>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 600,
                  color: theme === value ? 'var(--brand)' : 'var(--text-primary)', marginBottom: 2 }}>
                  {label}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{desc}</p>
              </div>
              {theme === value && (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 14 14" fill="none" style={{ width: 10, height: 10 }}>
                    <path d="M2 7l3.5 3.5L12 3.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Live preview card */}
        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 12 }}>
            Preview
          </p>
          <div className="card-elevated p-5">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#0d9488',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 14 }}>P</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Website Redesign</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Acme Corp · Due Apr 10</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
                background: 'var(--brand-light)', color: 'var(--brand)' }}>Active</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--border-light)', overflow: 'hidden' }}>
              <div style={{ height: 6, width: '67%', background: '#0d9488', borderRadius: 99 }}/>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>12/18 tasks · 67%</p>
          </div>
        </div>
      </div>
    </div>
  )
}
