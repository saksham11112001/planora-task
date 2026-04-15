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
      desc: 'Clean white interface',
      icon: Sun,
      preview: { bg: '#ffffff', sidebar: '#0f172a', card: '#f8fafc', accent: '#0d9488' },
    },
    {
      value: 'dark' as const,
      label: 'Dark',
      desc: 'Dark surfaces, easy on eyes',
      icon: Moon,
      preview: { bg: '#161b27', sidebar: '#0a0f1a', card: '#1e2433', accent: '#14b8a6' },
    },
    {
      value: 'system' as const,
      label: 'System',
      desc: 'Follows your device setting',
      icon: Monitor,
      preview: { bg: 'linear-gradient(135deg,#ffffff 50%,#161b27 50%)', sidebar: '#0f172a', card: '#f8fafc', accent: '#0d9488' },
    },
  ]

  return (
    <div className="page-container" style={{ maxWidth: 600 }}>
      <Link href="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft style={{ width: 13, height: 13 }}/> Settings
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Appearance</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
        Choose how Taska looks. Saved on this device.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {OPTIONS.map(opt => {
          const Icon    = opt.icon
          const isActive = theme === opt.value
          return (
            <button key={opt.value} onClick={() => setTheme(opt.value)}
              style={{ padding: 0, border: `2px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: 14, cursor: 'pointer', background: 'transparent',
                transition: 'all 0.2s', textAlign: 'left', overflow: 'hidden',
                boxShadow: isActive ? '0 0 0 3px var(--brand-light)' : 'none' }}>
              {/* Preview */}
              <div style={{ height: 70, background: opt.preview.bg, display: 'flex', gap: 4, padding: 8 }}>
                <div style={{ width: 20, background: opt.preview.sidebar, borderRadius: 4,
                  display: 'flex', flexDirection: 'column', gap: 3, padding: 4 }}>
                  {[opt.preview.accent, 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)'].map((c,i) => (
                    <div key={i} style={{ height: 3, borderRadius: 1, background: c }}/>
                  ))}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ height: 10, borderRadius: 3, background: opt.preview.card }}/>
                  <div style={{ height: 8, borderRadius: 3, background: opt.preview.card, width: '70%' }}/>
                  <div style={{ height: 14, borderRadius: 4, background: opt.preview.accent + '30', marginTop: 2 }}/>
                </div>
              </div>
              {/* Label */}
              <div style={{ padding: '8px 12px', background: 'var(--surface)', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon style={{ width: 13, height: 13, color: isActive ? 'var(--brand)' : 'var(--text-muted)', flexShrink: 0 }}/>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--brand)' : 'var(--text-primary)', margin: 0 }}>
                    {opt.label}{isActive ? ' ✓' : ''}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>{opt.desc}</p>
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
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>System mode</strong> automatically switches between light and dark based on your device's OS preference. You can also toggle with the sun/moon button in the header.
        </p>
      </div>
    </div>
  )
}
