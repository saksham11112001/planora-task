'use client'
import { useEffect, Suspense, useState } from 'react'
import { usePathname }    from 'next/navigation'
import { Sidebar }        from '@/components/layout/Sidebar'
import { Header }         from '@/components/layout/Header'
import { ToastContainer } from '@/components/ui/Toast'
import { RouteLoader }   from '@/components/ui/RouteLoader'
import { AppLoader }     from '@/components/ui/AppLoader'
import { SearchModal }    from '@/components/search/SearchModal'
import { useAppStore }    from '@/store/appStore'

interface Props {
  user:        { id: string; name: string; email: string; avatar_url: string | null }
  org:         { id: string; name: string; slug: string; plan_tier: any; logo_color: string; status: string | null; trial_ends_at: string | null }
  role:        string
  workspaceId: string | null
  children:    React.ReactNode
}

export function AppShell({ user, org, role, workspaceId, children }: Props) {
  const setSession  = useAppStore(s => s.setSession)
  const pathname    = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Lock body scroll on iOS when sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.classList.add('sidebar-open')
    } else {
      document.body.classList.remove('sidebar-open')
    }
    return () => document.body.classList.remove('sidebar-open')
  }, [mobileOpen])

  useEffect(() => {
    setSession({ user, org, role, workspaceId })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, org.id, role, workspaceId, setSession])

  return (
    <div className="app-shell">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)}/>
      )}

      {/* Sidebar */}
      <div className={`sidebar-wrapper${mobileOpen ? ' open' : ''}`}>
        <Sidebar onClose={() => setMobileOpen(false)}/>
      </div>

      {/* Main content */}
      <div className="app-main">
        <Header onMenuClick={() => setMobileOpen(o => !o)}/>
        {/* Trial expired / payment failed banner */}
        {(() => {
          const isLocked = org.status === 'expired' || org.status === 'payment_failed' ||
            (org.status === 'trialing' && org.trial_ends_at && new Date(org.trial_ends_at) < new Date())
          if (!isLocked) return null
          return (
            <div style={{ padding:'10px 20px', background:'#7c3aed',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              fontSize:13, color:'#fff', flexShrink:0, zIndex:20, gap:12 }}>
              <span style={{ fontWeight:500 }}>
                {org.status === 'payment_failed' ? '⚠️ Payment failed — ' : '🔒 Trial ended — '}
                Your workspace is in read-only mode. Tasks are visible but cannot be edited.
              </span>
              <a href="/settings/billing" style={{ color:'#fff', fontWeight:700,
                textDecoration:'none', border:'1px solid rgba(255,255,255,0.5)',
                padding:'4px 12px', borderRadius:6, flexShrink:0 }}>
                Upgrade now
              </a>
            </div>
          )
        })()}
        <main className="app-content" style={{
          pointerEvents: (org.status === 'expired' || org.status === 'payment_failed' ||
            (org.status === 'trialing' && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()))
            ? 'none' : undefined,
          opacity: (org.status === 'expired' || org.status === 'payment_failed' ||
            (org.status === 'trialing' && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()))
            ? 0.6 : undefined,
        }}>
          <Suspense fallback={<PageFallback/>}>
            {children}
          </Suspense>
        </main>
      </div>

      <ToastContainer/>
      <SearchModal/>
      <RouteLoader/>
    </div>
  )
}

function PageFallback() {
  return <AppLoader/>
}
