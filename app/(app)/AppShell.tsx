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
import { WalkthroughOverlay } from '@/components/walkthrough/WalkthroughOverlay'

interface Props {
  user:        { id: string; name: string; email: string; avatar_url: string | null; created_at: string; tour_completed_at?: string | null }
  org:         { id: string; name: string; slug: string; plan_tier: any; logo_color: string; status: string | null; trial_ends_at: string | null; trial_started_at?: string | null; trial_extension_days?: number; referral_code?: string | null; join_code?: string | null }
  role:        string
  workspaceId: string | null
  children:    React.ReactNode
}

export function AppShell({ user, org, role, workspaceId, children }: Props) {
  const setSession  = useAppStore(s => s.setSession)
  const pathname    = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isTrialExpired =
    org.status === 'trialing' && !!org.trial_ends_at && new Date(org.trial_ends_at) < new Date()

  const isLocked =
    org.status === 'expired' ||
    org.status === 'payment_failed'

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
        {/* Hard lock banner — expired / payment failed */}
        {(() => {
          if (!isLocked) return null
          return (
            <div style={{ padding:'10px 20px', background:'#dc2626',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              fontSize:13, color:'#fff', flexShrink:0, zIndex:20, gap:12 }}>
              <span style={{ fontWeight:500 }}>
                {org.status === 'payment_failed' ? '⚠️ Payment failed — update your payment method to restore access.' : '⚠️ Account expired — please renew to continue.'}
              </span>
              <a href="/settings/billing" style={{ color:'#fff', fontWeight:700,
                textDecoration:'none', border:'1px solid rgba(255,255,255,0.5)',
                padding:'4px 12px', borderRadius:6, flexShrink:0 }}>
                Fix now
              </a>
            </div>
          )
        })()}

        {/* Friendly trial-expired banner — free features still work */}
        {(() => {
          if (!isTrialExpired) return null
          return (
            <div style={{ padding:'10px 20px', background:'#fffbeb', borderBottom:'1px solid #fde68a',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              fontSize:13, color:'#92400e', flexShrink:0, zIndex:20, gap:12 }}>
              <span style={{ fontWeight:500 }}>
                🎉 Your 14-day free trial has ended. You&apos;re now on the <strong>Free plan</strong> — paid features are restricted. Upgrade anytime to restore full access.
              </span>
              <a href="/settings/billing" style={{ background:'#f59e0b', color:'#fff', fontWeight:700,
                textDecoration:'none', padding:'5px 14px', borderRadius:6, flexShrink:0, fontSize:12 }}>
                Upgrade now
              </a>
            </div>
          )
        })()}
        <main className="app-content" style={{
          pointerEvents: isLocked ? 'none' : undefined,
          opacity:       isLocked ? 0.55  : undefined,
        }}>
          <Suspense fallback={<PageFallback/>}>
            {children}
          </Suspense>
        </main>
      </div>

      <ToastContainer/>
      <SearchModal/>
      <Suspense fallback={null}>
        <RouteLoader/>
      </Suspense>
      <WalkthroughOverlay userId={user.id} userCreatedAt={user.created_at} tourCompletedAt={user.tour_completed_at ?? null}/>
    </div>
  )
}

function PageFallback() {
  return <AppLoader/>
}
