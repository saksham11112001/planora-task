import { getSessionUser }         from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import MsmeFeedbackButton         from './MsmeFeedbackButton'
import MsmeLogoutButton           from './MsmeLogoutButton'

const TEAL  = '#0d9488'
const DARK  = '#0f172a'
const MUTED = '#64748b'
const BORDER = '#e2e8f0'

export default async function MsmeLayout({ children }: { children: React.ReactNode }) {
  let orgName   = ''
  let isLoggedIn = false
  try {
    const user = await getSessionUser()
    if (user) {
      isLoggedIn = true
      const mb = await getActiveOrgMembership(user.id)
      orgName = (mb as any)?.organisations?.name ?? ''
    }
  } catch {}

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', colorScheme: 'light' }}>
      <style>{`:root { color-scheme: light !important; } * { color-scheme: light !important; }`}</style>

      {/* Top nav — light */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 52, flexShrink: 0,
        background: '#ffffff', borderBottom: `1px solid ${BORDER}`,
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0 }}>M</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>MSME Tracker</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: TEAL, background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', borderRadius: 20, padding: '2px 7px' }}>by upFloat</span>
          {orgName && (
            <>
              <span style={{ color: BORDER, fontSize: 13 }}>·</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>{orgName}</span>
            </>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MsmeFeedbackButton />
          {isLoggedIn && <MsmeLogoutButton />}
          <a
            href="https://upfloat.co"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Try upFloat
          </a>
        </div>
      </nav>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>

    </div>
  )
}
