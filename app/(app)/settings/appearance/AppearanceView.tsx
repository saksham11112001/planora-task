'use client'
import { Sun, Moon, Monitor, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from '@/components/theme/ThemeProvider'

export function AppearanceView() {
  const { theme, setTheme } = useTheme()

  const OPTIONS = [
    {
      value: 'light' as const,
      label: 'Light',
      desc: 'Clean white interface — easy on the eyes in daylight',
      icon: Sun,
      preview: { bg: '#ffffff', sidebar: '#0f172a', card: '#f8fafc', text: '#0f172a', accent: '#0d9488' },
    },
    {
      value: 'dark' as const,
      label: 'Dark',
      desc: 'Dark surfaces — reduces eye strain in low light',
      icon: Moon,
      preview: { bg: '#161b27', sidebar: '#0a0f1a', card: '#1e2433', text: '#f1f5f9', accent: '#14b8a6' },
    },
  ]

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      <Link href="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft style={{ width: 13, height: 13 }}/> Settings
      </Link>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Appearance</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
        Choose how Planora looks. Your preference is saved locally on this device.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {OPTIONS.map(opt => {
          const Icon = opt.icon
          const isActive = theme === opt.value
          const p = opt.preview
          return (
            <button key={opt.value} onClick={() => setTheme(opt.value)}
              style={{
                padding: 0, border: `2px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: 14, cursor: 'pointer', background: 'transparent',
                transition: 'all 0.2s', textAlign: 'left', overflow: 'hidden',
                boxShadow: isActive ? '0 0 0 3px var(--brand-light)' : 'none',
              }}>
              {/* Mini UI preview */}
              <div style={{ background: p.bg, padding: 10, display: 'flex', gap: 6, height: 90 }}>
                {/* Mini sidebar */}
                <div style={{ width: 28, background: p.sidebar, borderRadius: 6, flexShrink: 0,
                  display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 4px' }}>
                  {[p.accent, 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.2)'].map((c, i) => (
                    <div key={i} style={{ height: 4, borderRadius: 2, background: c }}/>
                  ))}
                </div>
                {/* Mini content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ height: 14, borderRadius: 4, background: p.card, border: `1px solid ${p.sidebar}20` }}/>
                  <div style={{ height: 10, borderRadius: 3, background: p.card, width: '80%', border: `1px solid ${p.sidebar}20` }}/>
                  <div style={{ height: 10, borderRadius: 3, background: p.accent + '30', width: '60%' }}/>
                  <div style={{ marginTop: 2, height: 20, borderRadius: 5, background: p.card,
                    border: `1px solid ${p.accent}40`, display: 'flex', alignItems: 'center',
                    padding: '0 6px', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.accent }}/>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: p.sidebar + '30' }}/>
                  </div>
                </div>
              </div>

              {/* Label row */}
              <div style={{ padding: '10px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: isActive ? 'var(--brand)' : 'var(--surface-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: 13, height: 13, color: isActive ? '#fff' : 'var(--text-muted)' }}/>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--brand)' : 'var(--text-primary)', marginBottom: 1 }}>
                    {opt.label} {isActive && '✓'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 8,
        background: 'var(--surface-subtle)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <Monitor style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }}/>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          You can also toggle theme instantly using the <strong style={{ color: 'var(--text-secondary)' }}>sun/moon button</strong> in the top navigation bar.
        </p>
      </div>
    </div>
  )
}
