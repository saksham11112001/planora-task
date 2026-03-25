'use client'
import Link                       from 'next/link'
import { usePathname }            from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import {
  Home, CheckSquare, ListTodo, Users2, FolderOpen,
  RefreshCw, Users, BarChart2, Settings, Plus,
  ChevronDown, ChevronRight, Clock, Zap, X,
} from 'lucide-react'
import { cn }            from '@/lib/utils/cn'
import { useAppStore }   from '@/store/appStore'
import { PlanBadge }     from '@/components/ui/Badge'

interface Project { id: string; name: string; color: string }

let _projectCache: Project[] = []
let _cacheTime    = 0
const CACHE_TTL   = 30_000

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname  = usePathname()
  const { session } = useAppStore()
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [projects, setProjects]         = useState<Project[]>(_projectCache)
  const fetchRef  = useRef(false)

  useEffect(() => {
    const now = Date.now()
    if (now - _cacheTime < CACHE_TTL && _projectCache.length > 0) {
      setProjects(_projectCache); return
    }
    if (fetchRef.current) return
    fetchRef.current = true
    fetch('/api/projects?limit=8')
      .then(r => r.json()).then(d => {
        if (Array.isArray(d.data)) { _projectCache = d.data; _cacheTime = Date.now(); setProjects(d.data) }
      }).catch(() => {}).finally(() => { fetchRef.current = false })
  }, [])

  useEffect(() => { if (pathname === '/projects') _cacheTime = 0 }, [pathname])

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const plan = session?.org.plan_tier ?? 'free'
  const userName = session?.user.name ?? session?.user.email?.split('@')[0] ?? ''
  const userInitial = userName[0]?.toUpperCase() ?? 'U'

  return (
    <aside style={{ width: 236, background: '#0f172a', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
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
        {/* Close button — mobile only */}
        {onClose && (
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <X className="h-4 w-4"/>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', scrollbarWidth: 'none' }}>
        <GL>Personal</GL>
        <SI href="/dashboard"  active={isActive('/dashboard', true)} icon={<Home       className="h-4 w-4"/>} label="Home"/>
        <SI href="/tasks"      active={isActive('/tasks',    true)}  icon={<CheckSquare className="h-4 w-4"/>} label="My tasks"/>
        <SI href="/inbox"      active={isActive('/inbox')}           icon={<ListTodo   className="h-4 w-4"/>} label="One-time tasks"/>
        <Div/>
        <GL>Work</GL>
        <SI href="/clients"    active={isActive('/clients')}         icon={<Users2     className="h-4 w-4"/>} label="Clients"/>

        {/* Projects section */}
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
              width: 20, height: 20, borderRadius: 4, color: 'rgba(255,255,255,0.3)',
              textDecoration: 'none' }}
            className="hover:bg-white/10 hover:text-white transition-colors"
            title="New project">
            <Plus className="h-3 w-3"/>
          </Link>
        </div>

        {projectsOpen && (
          <>
            <SI href="/projects" active={pathname === '/projects'} icon={<FolderOpen className="h-3.5 w-3.5"/>} label="All projects"/>
            {projects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`}
                className={cn('flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                  pathname.startsWith(`/projects/${p.id}`)
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/60 hover:bg-white/10 hover:text-white')}>
                <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: p.color }}/>
                <span className="truncate text-xs">{p.name}</span>
              </Link>
            ))}
          </>
        )}

        <Div/>
        <GL>Organisation</GL>
        <SI href="/team"      active={isActive('/team')}      icon={<Users    className="h-4 w-4"/>} label="Team"/>
        <SI href="/time"      active={isActive('/time')}      icon={<Clock    className="h-4 w-4"/>} label="Time tracking"/>
        <SI href="/recurring" active={isActive('/recurring')} icon={<RefreshCw className="h-4 w-4"/>} label="Recurring tasks"/>
        <SI href="/reports"   active={isActive('/reports')}   icon={<BarChart2 className="h-4 w-4"/>} label="Reports"/>
      </nav>

      {/* Bottom: user + settings */}
      {/* Trial banner */}
      {plan === 'free' && (session?.org as any)?.status === 'trialing' && (
        <Link href="/settings/billing" style={{
          display: 'block', margin: '0 8px 6px', padding: '10px 12px', borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(13,148,136,0.25), rgba(124,58,237,0.2))',
          border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#14b8a6', animation: 'pulse 1.5s ease-in-out infinite' }}/>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Free trial active</span>
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
            Upgrade to keep all features after trial ends
          </p>
        </Link>
      )}

      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <SI href="/settings" active={isActive('/settings')} icon={<Settings className="h-4 w-4"/>} label="Settings"/>

        {/* User profile row */}
        <Link href="/profile"
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8,
            textDecoration: 'none', marginTop: 2 }}
          className="hover:bg-white/10 transition-colors group">
          <div style={{ width: 28, height: 28, borderRadius: '50%',
            background: session?.org.logo_color ?? '#0d9488',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#fff', fontSize: 12, fontWeight: 500, overflow: 'hidden',
              whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{userName}</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, overflow: 'hidden',
              whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{session?.user.email}</p>
          </div>
        </Link>
      </div>
    </aside>
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
function Div() { return <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '6px 0' }}/> }
function SI({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} prefetch={true}
      className={cn('flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
        active ? 'bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/10 hover:text-white')}>
      {icon}{label}
    </Link>
  )
}
