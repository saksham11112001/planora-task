import Link from 'next/link'

const TEAL = '#0d9488'
const DARK = '#0f172a'

export default function MsmeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top nav — MSME Tracker branding + Planora CTA ─────────────────── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 52, flexShrink: 0,
        background: DARK, borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        {/* Left — MSME brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: TEAL,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0,
          }}>M</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>MSME Tracker</span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: TEAL,
            background: 'rgba(13,148,136,0.15)', border: '1px solid rgba(13,148,136,0.3)',
            borderRadius: 20, padding: '2px 7px',
          }}>by SNG Advisors</span>
        </div>

        {/* Right — Try Planora button */}
        <a
          href="https://sng-adwisers.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
            padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            transition: 'all 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Try Planora
        </a>
      </nav>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>

    </div>
  )
}
