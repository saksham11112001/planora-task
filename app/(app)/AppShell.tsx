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
  org:         { id: string; name: string; slug: string; plan_tier: any; logo_color: string }
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
        <main className="app-content">
          <Suspense fallback={<PageFallback/>}>
            {children}
          </Suspense>
        </main>
      </div>

      <Suspense fallback={null}><RouteLoader/></Suspense>
      <AppLoader/>
      <SearchModal/>
      <ToastContainer/>
    </div>
  )
}

function PageFallback() {
  return (
    <div style={{ flex: 1, padding: 24 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 80, borderRadius: 10, background:'var(--surface)',
          border:'1px solid var(--border)', marginBottom: 12,
          animation: 'pulse 1.5s ease-in-out infinite', opacity: 1 - i * 0.2 }}/>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
