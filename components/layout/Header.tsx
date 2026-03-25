'use client'
import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter }     from 'next/navigation'
import { Search, Plus, Bell, ChevronDown, CheckSquare, FolderOpen,
         Users2, LogOut, Settings, Clock, RefreshCw, Zap, X,
         CheckCheck, AlertCircle, Menu, User } from 'lucide-react'
import Link              from 'next/link'
import { ThemeToggle }   from '@/components/theme/ThemeToggle'
import { createClient }  from '@/lib/supabase/client'
import { useAppStore }   from '@/store/appStore'
import { cn }            from '@/lib/utils/cn'
import { fmtDate }       from '@/lib/utils/format'

interface Notif {
  id: string; action: string; task_id?: string; task_title?: string
  actor_name?: string; created_at: string; read?: boolean
}

export function Header({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const router       = useRouter()
  const [,startT]    = useTransition()
  const { session, searchOpen, setSearchOpen } = useAppStore()
  const [createOpen,  setCreateOpen]  = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [bellOpen,    setBellOpen]    = useState(false)
  const [notifs,      setNotifs]      = useState<Notif[]>([])
  const [unread,      setUnread]      = useState(0)
  const [nLoading,    setNLoading]    = useState(false)
  const createRef  = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const bellRef    = useRef<HTMLDivElement>(null)

  const name = session?.user.name ?? session?.user.email?.split('@')[0] ?? 'U'

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (createRef.current  && !createRef.current.contains(e.target as Node))  setCreateOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (bellRef.current    && !bellRef.current.contains(e.target as Node))    setBellOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Keyboard shortcut
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [setSearchOpen])

  // Fetch notifications
  async function fetchNotifs() {
    if (nLoading || !session) return
    setNLoading(true)
    try {
      const sb = createClient()
      const { data } = await sb
        .from('task_activity')
        .select('id, action, task_id, old_value, new_value, created_at, actor:users!task_activity_actor_id_fkey(name), task:tasks!task_activity_task_id_fkey(title)')
        .eq('org_id', session.org.id)
        .order('created_at', { ascending: false })
        .limit(15)

      const formatted: Notif[] = (data ?? []).map((d: any) => ({
        id:         d.id,
        action:     d.action,
        task_id:    d.task_id,
        task_title: d.task?.title,
        actor_name: d.actor?.name,
        created_at: d.created_at,
      }))
      setNotifs(formatted)
      setUnread(formatted.length > 0 ? Math.min(formatted.length, 5) : 0)
    } catch {}
    setNLoading(false)
  }

  function openBell() {
    setBellOpen(b => !b)
    setCreateOpen(false); setProfileOpen(false)
    if (!bellOpen) { setUnread(0); fetchNotifs() }
  }

  function actionLabel(action: string, actor?: string, taskTitle?: string) {
    const who = actor ?? 'Someone'
    const task = taskTitle ? `"${taskTitle.slice(0,32)}"` : 'a task'
    const map: Record<string, string> = {
      'task_created':    `${who} created ${task}`,
      'task_assigned':   `${who} assigned ${task} to you`,
      'status_changed':  `${who} updated status of ${task}`,
      'comment_added':   `${who} commented on ${task}`,
      'task_approved':   `${who} approved ${task}`,
      'task_rejected':   `${who} rejected ${task}`,
      'task_submitted':  `${who} submitted ${task} for review`,
    }
    return map[action] ?? `${who} updated ${task}`
  }

  async function handleLogout() {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/login')
  }

  const CREATE_ITEMS = [
    { icon: CheckSquare, label: 'New task',      href: '/inbox' },
    { icon: FolderOpen,  label: 'New project',   href: '/projects/new' },
    { icon: Users2,      label: 'New client',     href: '/clients/new' },
    { icon: Clock,       label: 'Log time',       href: '/time' },
    { icon: RefreshCw,   label: 'Recurring task', href: '/recurring' },
  ]

  return (
    <header style={{
      height: 54, background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 10, flexShrink: 0, zIndex: 30,
    }}>

      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8, border: 'none',
          background: 'transparent', cursor: 'pointer', flexShrink: 0,
          color: 'var(--text-secondary)',
        }}
        className="mobile-menu-btn"
        aria-label="Open menu"
      >
        <Menu style={{ width: 20, height: 20 }}/>
      </button>

      {/* Search */}
      <button onClick={() => setSearchOpen(true)}
        className="flex-1 max-w-[280px] flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:bg-gray-50 transition-colors border"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-subtle)' }}>
        <Search className="h-3.5 w-3.5"/>
        <span className="flex-1 text-left">Search...</span>
        <kbd className="text-xs bg-white border px-1.5 py-0.5 rounded" style={{ borderColor: 'var(--border)' }}>⌘K</kbd>
      </button>

      <div className="flex-1"/>

      {/* Create */}
      <div className="relative" ref={createRef}>
        <button onClick={() => { setCreateOpen(!createOpen); setProfileOpen(false); setBellOpen(false) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--brand)' }}>
          <Plus className="h-4 w-4"/> Create <ChevronDown className="h-3 w-3"/>
        </button>
        {createOpen && (
          <div style={{position:'absolute',right:0,top:'100%',marginTop:6,borderRadius:12,boxShadow:'0 10px 40px rgba(0,0,0,0.15)',padding:'6px 0',zIndex:50,minWidth:200,background:'var(--surface)',border:'1px solid var(--border)'}}>
            {CREATE_ITEMS.map(({ icon: Icon, label, href }) => (
              <Link key={href} href={href} onClick={() => setCreateOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Icon className="h-4 w-4 text-gray-400"/>{label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Bell */}
      <div className="relative" ref={bellRef}>
        <button onClick={openBell}
          className="relative h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
          <Bell className="h-4 w-4"/>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full text-white font-bold"
              style={{ background: '#dc2626', fontSize: 9 }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </button>

        {bellOpen && (
          <div className="absolute right-0 top-full mt-1.5 rounded-xl shadow-xl z-50 w-80" style={{background:'var(--surface)',border:'1px solid var(--border)'}}
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-semibold text-gray-900">Activity</span>
              <button onClick={() => setBellOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4"/>
              </button>
            </div>

            {nLoading ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
            ) : notifs.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCheck className="h-8 w-8 text-gray-200 mx-auto mb-2"/>
                <p className="text-sm text-gray-400">All caught up!</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifs.map(n => (
                  <div key={n.id}
                    className={cn('flex gap-3 px-4 py-3 border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer',
                      'border-gray-50')}
                    onClick={() => { if (n.task_id) { router.push(`/tasks`); setBellOpen(false) } }}>
                    <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: n.action.includes('reject') ? '#fef2f2' : n.action.includes('approv') ? '#f0fdf4' : '#f0fdfa' }}>
                      {n.action.includes('reject') ? <AlertCircle className="h-3.5 w-3.5 text-red-500"/> :
                       n.action.includes('approv') ? <CheckCheck className="h-3.5 w-3.5 text-green-500"/> :
                       <Zap className="h-3.5 w-3.5 text-teal-500"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">{actionLabel(n.action, n.actor_name, n.task_title)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <Link href="/tasks" onClick={() => setBellOpen(false)}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium">View all tasks →</Link>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative" ref={profileRef}>
        <button onClick={() => { setProfileOpen(!profileOpen); setCreateOpen(false); setBellOpen(false) }}
          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: session?.org.logo_color ?? 'var(--brand)' }}>
          {name[0]?.toUpperCase()}
        </button>
        {profileOpen && (
          <div style={{position:'absolute',right:0,top:'100%',marginTop:6,borderRadius:12,boxShadow:'0 10px 40px rgba(0,0,0,0.15)',padding:'6px 0',zIndex:50,minWidth:200,background:'var(--surface)',border:'1px solid var(--border)'}}>
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <p style={{fontSize:12,fontWeight:600,color:'var(--text-primary)',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{name}</p>
              <p style={{fontSize:11,color:'var(--text-muted)',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{session?.user.email}</p>
            </div>
            <Link href="/profile" onClick={() => setProfileOpen(false)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',fontSize:13,color:'var(--text-primary)',textDecoration:'none',transition:'background 0.1s'}} onMouseEnter={e=>(e.currentTarget.style.background='var(--border-light)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <User style={{width:14,height:14,color:'var(--text-muted)',flexShrink:0}}/> My profile
            </Link>
            <div className="mx-2 my-1 border-t border-gray-100"/>
            <Link href="/settings" onClick={() => setProfileOpen(false)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',fontSize:13,color:'var(--text-primary)',textDecoration:'none',transition:'background 0.1s'}} onMouseEnter={e=>(e.currentTarget.style.background='var(--border-light)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <Settings style={{width:14,height:14,color:'var(--text-muted)',flexShrink:0}}/>Settings
            </Link>
            <button onClick={handleLogout}
              className="w-full" style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',fontSize:13,color:'#dc2626',background:'transparent',border:'none',cursor:'pointer',width:'100%',textAlign:'left',transition:'background 0.1s'}} onMouseEnter={e=>(e.currentTarget.style.background='#fef2f2')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <LogOut className="h-4 w-4"/>Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
