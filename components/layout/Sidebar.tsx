'use client'
import Link                       from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CheckSquare,
  Home, ListTodo, Users2, FolderOpen,
  RefreshCw, Users, BarChart2, Settings, Plus,
  ChevronDown, ChevronRight, Clock, Zap, X, Upload,
  Calendar, Shield, LogOut, FileCheck, ArrowRight, ClipboardList, Eye,
} from 'lucide-react'
import { cn }            from '@/lib/utils/cn'
import { createClient }  from '@/lib/supabase/client'
import { useAppStore }   from '@/store/appStore'
import { PlanBadge }     from '@/components/ui/Badge'
import { useOrgSettings } from '@/lib/hooks/useOrgSettings'

interface Project { id: string; name: string; color: string; status?: string }

let _projectCache: Project[] = []
let _cacheTime    = 0
const CACHE_TTL   = 60_000

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname    = usePathname()
  const router      = useRouter()
  const { session } = useAppStore()
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [projects, setProjects]         = useState<Project[]>(_projectCache)
  const [flyoutOpen,    setFlyoutOpen]    = useState(false)
  const [allProjects,   setAllProjects]   = useState<Project[]>([])
  const [flyoutLoading, setFlyoutLoading] = useState(false)
  const fetchRef  = useRef(false)
  const flyoutRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const now = Date.now()
    if (now - _cacheTime < CACHE_TTL && _projectCache.length > 0) {
      setProjects(_projectCache); return
    }
    if (fetchRef.current) return
    fetchRef.current = true
    fetch('/api/projects?limit=5')
      .then(r => r.json()).then(d => {
        if (Array.isArray(d.data)) { _projectCache = d.data; _cacheTime = Date.now(); setProjects(d.data) }
      }).catch(() => {}).finally(() => { fetchRef.current = false })
  }, [])

  useEffect(() => { if (pathname === '/projects') _cacheTime = 0 }, [pathname])

  // Close flyout on outside click
  useEffect(() => {
    if (!flyoutOpen) return
    function handler(e: MouseEvent) {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setFlyoutOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [flyoutOpen])

  const openFlyout = useCallback(async () => {
    setFlyoutOpen(true)
    if (allProjects.length > 0) return
    setFlyoutLoading(true)
    try {
      const r = await fetch('/api/projects?limit=100')
      const d = await r.json()
      if (Array.isArray(d.data)) setAllProjects(d.data)
    } catch {} finally { setFlyoutLoading(false) }
  }, [allProjects.length])

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const plan      = session?.org.plan_tier ?? 'free'
  const isPaid    = plan !== 'free'
  const role      = session?.role ?? ''
  const userName  = session?.user.name ?? session?.user.email?.split('@')[0] ?? ''
  const userInit  = userName[0]?.toUpperCase() ?? 'U'
  const canManage = ['owner','admin','manager'].includes(role)
  const { navFeatures } = useOrgSettings()
  const nav = navFeatures

  return (
    <>
    <aside style={{ width: 236, background: '#0f172a', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Brand ── */}
      <div style={{ padding: '13px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <div style={{ width: 27, height: 27, borderRadius: 7, background: session?.org.logo_color ?? '#0d9488',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          <Zap className="h-4 w-4 text-white"/>
        </div>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden',
          whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {session?.org.name ?? 'Planora'}
        </span>
        <PlanBadge plan={plan}/>
        {onClose && (
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <X className="h-4 w-4"/>
          </button>
        )}
      </div>

      {/* ── Scrollable nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px', scrollbarWidth: 'none' }}>

        {/* PERSONAL */}
        <GL>Personal</GL>
        <SI href="/dashboard" active={isActive('/dashboard', true)} icon={<Home        className="h-4 w-4"/>} label="Home"/>
        <SI href="/tasks"     active={isActive('/tasks',    true)}  icon={<CheckSquare className="h-4 w-4"/>} label="My tasks"/>
        {nav.calendar && <SI href="/calendar" active={isActive('/calendar')} icon={<Calendar className="h-4 w-4"/>} label="Calendar"/>}
        <Div/>

        {/* TASKS */}
        <GL>Tasks</GL>
        {nav.one_time_tasks && (
          <div className="group/nav" style={{ position:'relative', display:'flex', alignItems:'center', margin:'1px 4px' }}>
            <Link href="/inbox" prefetch={true}
              onClick={() => { if (!isActive('/inbox')) router.refresh() }}
              style={{
                flex:1, display:'flex', alignItems:'center', gap:9,
                padding:'7px 10px', borderRadius:7, fontSize:13,
                textDecoration:'none', transition:'all 0.12s',
                background: isActive('/inbox') ? 'rgba(255,255,255,0.14)' : 'transparent',
                color: isActive('/inbox') ? '#fff' : 'rgba(255,255,255,0.6)',
                fontWeight: isActive('/inbox') ? 500 : 400,
                borderLeft: isActive('/inbox') ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
              }}
              onMouseEnter={e => { if (!isActive('/inbox')) { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color='#fff' } }}
              onMouseLeave={e => { if (!isActive('/inbox')) { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.6)' } }}>
              <ListTodo className="h-4 w-4"/><span style={{ flex:1 }}>Quick tasks</span>
            </Link>
            <Link href="/inbox?new=1"
              className="opacity-0 group-hover/nav:opacity-100 transition-opacity"
              style={{ position:'absolute', right:6, display:'flex', alignItems:'center', justifyContent:'center',
                width:18, height:18, borderRadius:4, color:'rgba(255,255,255,0.4)', textDecoration:'none',
                background:'rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.background='rgba(13,148,136,0.3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)' }}
              title="Add quick task">
              <Plus className="h-3 w-3"/>
            </Link>
          </div>
        )}
        {nav.recurring_tasks && (
          <div className="group/nav" style={{ position:'relative', display:'flex', alignItems:'center', margin:'1px 4px' }}>
            <Link href="/recurring" prefetch={true}
              onClick={() => { if (!isActive('/recurring')) router.refresh() }}
              style={{
                flex:1, display:'flex', alignItems:'center', gap:9,
                padding:'7px 10px', borderRadius:7, fontSize:13,
                textDecoration:'none', transition:'all 0.12s',
                background: isActive('/recurring') ? 'rgba(255,255,255,0.14)' : 'transparent',
                color: isActive('/recurring') ? '#fff' : 'rgba(255,255,255,0.6)',
                fontWeight: isActive('/recurring') ? 500 : 400,
                borderLeft: isActive('/recurring') ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
              }}
              onMouseEnter={e => { if (!isActive('/recurring')) { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color='#fff' } }}
              onMouseLeave={e => { if (!isActive('/recurring')) { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.6)' } }}>
              <RefreshCw className="h-4 w-4"/><span style={{ flex:1 }}>Repeat tasks</span>
            </Link>
            <Link href="/recurring?new=1"
              className="opacity-0 group-hover/nav:opacity-100 transition-opacity"
              style={{ position:'absolute', right:6, display:'flex', alignItems:'center', justifyContent:'center',
                width:18, height:18, borderRadius:4, color:'rgba(255,255,255,0.4)', textDecoration:'none',
                background:'rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.background='rgba(13,148,136,0.3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)' }}
              title="Add repeat task">
              <Plus className="h-3 w-3"/>
            </Link>
          </div>
        )}
        <Div/>

        {/* WORK */}
        <GL>Work</GL>
        <div style={{ display: 'flex', alignItems: 'center', padding: '5px 10px 2px' }}>
          <button onClick={() => setProjectsOpen(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, background: 'none',
              border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
            {projectsOpen ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}
            Projects
          </button>
          <Link href="/projects/new" onClick={() => { _cacheTime = 0 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: 4, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}
            className="hover:bg-white/10 hover:text-white transition-colors"
            title="New project">
            <Plus className="h-3 w-3"/>
          </Link>
        </div>
        {projectsOpen && (
          <>
            {projects.slice(0, 4).map(p => (
              <Link key={p.id} href={`/projects/${p.id}`}
                className={cn('flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                  pathname.startsWith(`/projects/${p.id}`)
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/60 hover:bg-white/10 hover:text-white')}>
                <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: p.color }}/>
                <span className="truncate text-xs">{p.name}</span>
              </Link>
            ))}
            <button onClick={openFlyout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md w-full transition-colors text-white/40 hover:text-white/70 hover:bg-white/5"
              style={{ fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 10 }}>•••</span>
              <span>Show more</span>
            </button>
          </>
        )}
        {nav.clients && <SI href="/clients"    active={isActive('/clients')}    icon={<Users2    className="h-4 w-4"/>} label="Clients"/>}
        {nav.ca_compliance_mode && <SI href="/compliance" active={isActive('/compliance')} icon={<FileCheck className="h-4 w-4"/>} label="CA Compliance"/>}
        {nav.ca_compliance_mode && (
          <Link href="/compliance?tab=catasks"
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '5px 10px 5px 30px', borderRadius: 7, fontSize: 12,
              textDecoration: 'none', transition: 'all 0.12s', margin: '1px 4px',
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 400,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)' }}>
            <ClipboardList style={{ width: 13, height: 13, flexShrink: 0 }}/>
            <span>CA Tasks</span>
          </Link>
        )}
        <Div/>

        {/* ORGANISATION */}
        <GL>Organisation</GL>
        {nav.team && <SI href="/team"    active={isActive('/team')}    icon={<Users    className="h-4 w-4"/>} label="Team"/>}
        {canManage && <SI href="/approvals" active={isActive('/approvals')} icon={<CheckSquare className="h-4 w-4"/>} label="Approvals"/>}
        {nav.time_tracking && isPaid && <SI href="/time" active={isActive('/time')} icon={<Clock className="h-4 w-4"/>} label="Time tracking"/>}
        {nav.reports && isPaid && <SI href="/reports" active={isActive('/reports')} icon={<BarChart2 className="h-4 w-4"/>} label="Reports"/>}
        <SI href="/monitor" active={isActive('/monitor')} icon={<Eye className="h-4 w-4"/>} label="Monitor"/>
        <Div/>

        {/* TOOLS */}
        <GL>Tools</GL>
        {nav.import_data && <SI href="/import" active={isActive('/import')} icon={<Upload className="h-4 w-4"/>} label="Import data"/>}
        {canManage && (
          <SI href="/settings/permissions" active={isActive('/settings/permissions')} icon={<Shield className="h-4 w-4"/>} label="Permissions"/>
        )}
        {/* Settings scrolls with nav instead of being frozen */}
        <SI href="/settings" active={isActive('/settings')} icon={<Settings className="h-4 w-4"/>} label="Settings"/>

      </nav>

      {/* ── Trial banner ── */}
      {(() => {
        const trialEnd   = session?.org.trial_ends_at
        const isTrialing = session?.org.status === 'trialing' && trialEnd
        if (!isTrialing) return null
        const daysLeft = Math.max(0, Math.ceil((new Date(trialEnd!).getTime() - Date.now()) / 86_400_000))
        const urgent = daysLeft <= 3
        return (
          <Link href="/settings/billing" style={{
            display: 'block', margin: '0 8px 6px', padding: '10px 12px', borderRadius: 10,
            background: urgent
              ? 'linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.1))'
              : 'linear-gradient(135deg,rgba(13,148,136,0.25),rgba(124,58,237,0.2))',
            border: `1px solid ${urgent ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
            textDecoration: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: urgent ? '#f87171' : '#14b8a6' }}/>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                {daysLeft === 0 ? 'Trial ends today!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
              </span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>Upgrade to keep all features →</p>
          </Link>
        )
      })()}

      {/* ── Bottom fixed section — single line ── */}
      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8 }}>

          {/* Avatar with hover tooltip */}
          <div style={{ position: 'relative', flexShrink: 0 }} className="group">
            <Link href="/profile"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: '50%',
                background: session?.org.logo_color ?? '#0d9488',
                color: '#fff', fontSize: 12, fontWeight: 700,
                textDecoration: 'none', flexShrink: 0 }}>
              {userInit}
            </Link>

            {/* Tooltip card — appears on hover above avatar */}
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '10px 12px', minWidth: 200,
              pointerEvents: 'none', zIndex: 50,
              opacity: 0, transform: 'translateY(6px)',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
            }}
              className="group-hover:opacity-100 group-hover:!translate-y-0">
              {/* User row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%',
                  background: session?.org.logo_color ?? '#0d9488',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {userInit}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: '#fff', fontSize: 12, fontWeight: 600, margin: 0,
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {userName}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0,
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {session?.user.email}
                  </p>
                </div>
              </div>
              {/* Org + role row */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)',
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {session?.org.name}
                </span>
                {canManage
                  ? <Link href="/team" style={{ textDecoration: 'none', flexShrink: 0, pointerEvents: 'auto' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: role === 'owner' ? 'rgba(249,115,22,0.25)' : 'rgba(13,148,136,0.25)',
                        color: role === 'owner' ? '#fb923c' : '#2dd4bf',
                        textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
                        {role}
                      </span>
                    </Link>
                  : <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                      {role}
                    </span>
                }
              </div>
            </div>
          </div>

          {/* Name — truncated, links to profile */}
          <Link href="/profile"
            style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
            <p style={{ color: '#fff', fontSize: 12, fontWeight: 500, margin: 0,
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {userName}
            </p>
          </Link>

          {/* Sign out — icon only */}
          <LogoutIconButton />
        </div>
      </div>

    </aside>

    {/* ── Projects Flyout Panel ── */}
    {flyoutOpen && (
      <div ref={flyoutRef} style={{
        position: 'fixed', left: 236, top: 0, height: '100vh', width: 252,
        background: '#0f172a', borderRight: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '6px 0 28px rgba(0,0,0,0.45)', zIndex: 300,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '13px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <FolderOpen style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}/>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, flex: 1 }}>Projects</span>
          <button onClick={() => setFlyoutOpen(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
              cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            className="hover:text-white transition-colors">
            <X style={{ width: 15, height: 15 }}/>
          </button>
        </div>

        {/* Scrollable project list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', scrollbarWidth: 'none' }}>
          {flyoutLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '28px 0', gap: 8 }}>
              <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.15)',
                borderTopColor: '#14b8a6', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite' }}/>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Loading…</span>
            </div>
          )}
          {!flyoutLoading && allProjects.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
              No projects yet
            </p>
          )}
          {allProjects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`}
              onClick={() => setFlyoutOpen(false)}
              className={cn('flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors',
                pathname.startsWith(`/projects/${p.id}`)
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-white/55 hover:bg-white/10 hover:text-white')}
              style={{ textDecoration: 'none' }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color, flexShrink: 0, display: 'inline-block' }}/>
              <span style={{ fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
                {p.name}
              </span>
              {p.status && p.status !== 'active' && (
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: p.status === 'completed' ? '#2dd4bf' : p.status === 'on_hold' ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                  flexShrink: 0 }}>
                  {p.status.replace('_', ' ')}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Footer — show all link */}
        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <Link href="/projects" onClick={() => setFlyoutOpen(false)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 12px', borderRadius: 8,
              background: 'rgba(13,148,136,0.14)',
              border: '1px solid rgba(13,148,136,0.25)',
              color: '#2dd4bf', textDecoration: 'none',
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s' }}
            className="hover:bg-teal-500/20 transition-colors">
            <FolderOpen style={{ width: 13, height: 13 }}/>
            All projects
            <ArrowRight style={{ width: 12, height: 12, marginLeft: 2 }}/>
          </Link>
        </div>
      </div>
    )}
    </>
  )
}

function GL({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.3)', padding: '5px 10px 2px', userSelect: 'none' }}>
      {children}
    </p>
  )
}

function Div() {
  return <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '6px 0' }}/>
}

function SI({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
  const router = useRouter()
  return (
    <Link href={href} prefetch={true}
      onClick={() => { if (!active) router.refresh() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 10px', borderRadius: 7, fontSize: 13,
        textDecoration: 'none', transition: 'all 0.12s', margin: '1px 4px',
        background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
        color: active ? '#fff' : 'rgba(255,255,255,0.6)',
        fontWeight: active ? 500 : 400,
        borderLeft: active ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#fff' } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' } }}>
      {icon}{label}
    </Link>
  )
}

function LogoutIconButton() {
  const [signingOut, setSigningOut] = useState(false)
  async function logout() {
    if (signingOut) return
    setSigningOut(true)
    try {
      const sb = createClient()
      await Promise.race([
        sb.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ])
    } catch {}
    window.location.href = '/'
  }
  return (
    <button
      onClick={logout}
      disabled={signingOut}
      title={signingOut ? 'Signing out…' : 'Sign out'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 6,
        background: 'transparent', border: 'none',
        color: 'rgba(255,100,100,0.65)', cursor: 'pointer',
        flexShrink: 0, transition: 'all 0.12s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'
        ;(e.currentTarget as HTMLElement).style.color = '#f87171'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,100,100,0.65)'
      }}>
      <LogOut style={{ width: 15, height: 15 }}/>
    </button>
  )
}