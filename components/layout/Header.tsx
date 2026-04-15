'use client'
import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter }     from 'next/navigation'
import { Search, Plus, Bell, ChevronDown, CheckSquare, FolderOpen,
         Users2, LogOut, Settings, Clock, RefreshCw, Zap, X,
         CheckCheck, AlertCircle, Menu, User, MessageSquarePlus, Paperclip, Send } from 'lucide-react'
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
  const [createOpen,    setCreateOpen]    = useState(false)
  const [profileOpen,   setProfileOpen]   = useState(false)
  const [bellOpen,      setBellOpen]      = useState(false)
  const [reportOpen,    setReportOpen]    = useState(false)
  const [reportText,    setReportText]    = useState('')
  const [reportFiles,   setReportFiles]   = useState<File[]>([])
  const [reportSending, setReportSending] = useState(false)
  const [notifs,        setNotifs]        = useState<Notif[]>([])
  const [unread,        setUnread]        = useState(0)
  const [nLoading,      setNLoading]      = useState(false)
  const createRef   = useRef<HTMLDivElement>(null)
  const profileRef  = useRef<HTMLDivElement>(null)
  const bellRef     = useRef<HTMLDivElement>(null)
  const reportFileRef = useRef<HTMLInputElement>(null)

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

  const NOTIF_READ_KEY = 'planora_notif_read_ts'

  // Fetch notifications and compute real unread count using localStorage timestamp
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

      // Count items newer than last-read timestamp
      const lastRead = typeof window !== 'undefined'
        ? localStorage.getItem(NOTIF_READ_KEY)
        : null
      const newCount = formatted.filter(n =>
        !lastRead || new Date(n.created_at) > new Date(lastRead)
      ).length
      setUnread(newCount)
    } catch {}
    setNLoading(false)
  }

  function openBell() {
    const wasOpen = bellOpen
    setBellOpen(b => !b)
    setCreateOpen(false); setProfileOpen(false)
    if (!wasOpen) {
      // Mark all as read by saving current timestamp
      if (typeof window !== 'undefined') {
        localStorage.setItem(NOTIF_READ_KEY, new Date().toISOString())
      }
      setUnread(0)
      fetchNotifs()
    }
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

  async function submitReport() {
    if (!reportText.trim() && reportFiles.length === 0) return
    setReportSending(true)
    try {
      const fd = new FormData()
      fd.append('message', reportText.trim())
      fd.append('url', typeof window !== 'undefined' ? window.location.href : '')
      reportFiles.forEach(f => fd.append('files', f))
      await fetch('/api/report-issue', { method: 'POST', body: fd })
      setReportOpen(false); setReportText(''); setReportFiles([])
      // show a simple inline success (no external toast import needed)
    } catch {}
    setReportSending(false)
  }

  const CREATE_ITEMS = [
    { icon: CheckSquare, label: 'New task',    href: '/inbox?new=1' },
    { icon: FolderOpen,  label: 'New project', href: '/projects/new' },
    { icon: Users2,      label: 'New client',  href: '/clients/new' },
    { icon: Clock,       label: 'Log time',    href: '/time' },
    { icon: RefreshCw,   label: 'Repeat task', href: '/recurring?new=1' },
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
        style={{
          flex: 1, maxWidth: 300,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 8,
          border: '1.5px solid var(--border)', background: 'var(--surface-subtle)',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.background = 'var(--brand-light)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-subtle)' }}>
        <Search style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }}/>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: 'var(--text-muted)' }}>Search tasks, projects…</span>
        <kbd style={{ fontSize: 10, background: 'var(--surface)', border: '1px solid var(--border)',
          padding: '2px 5px', borderRadius: 4, color: 'var(--text-muted)', fontFamily: 'inherit' }}>Ctrl+K</kbd>
      </button>

      <div className="flex-1"/>

      {/* Create */}
      <div className="relative" ref={createRef}>
        <button onClick={() => { setCreateOpen(!createOpen); setProfileOpen(false); setBellOpen(false) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            background: 'var(--brand)', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500,
            boxShadow: '0 1px 3px rgba(13,148,136,0.3)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-dark)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(13,148,136,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(13,148,136,0.3)' }}>
          <Plus style={{ width: 15, height: 15 }}/> Create <ChevronDown style={{ width: 12, height: 12, opacity: 0.8 }}/>
        </button>
        {createOpen && (
          <div style={{position:'absolute',right:0,top:'100%',marginTop:6,borderRadius:12,boxShadow:'0 10px 40px rgba(0,0,0,0.15)',padding:'6px 0',zIndex:50,minWidth:200,background:'var(--surface)',border:'1px solid var(--border)'}}>
            {CREATE_ITEMS.map(({ icon: Icon, label, href }) => (
              <Link key={href} href={href} onClick={() => setCreateOpen(false)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px',
                  fontSize:13, color:'var(--text-primary)', textDecoration:'none',
                  transition:'background 0.1s', borderRadius:6, margin:'2px 4px' }}
                onMouseEnter={e=>(e.currentTarget.style.background='var(--brand-light)')}
                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                <div style={{ width:28, height:28, borderRadius:7, background:'var(--surface-subtle)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon style={{ width:14, height:14, color:'var(--brand)' }}/>
                </div>
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <ThemeToggle/>

      {/* Report issue */}
      <button onClick={() => { setReportOpen(true); setCreateOpen(false); setBellOpen(false); setProfileOpen(false) }}
        title="Report an issue"
        style={{ width:34, height:34, borderRadius:8, border:'none',
          background:'transparent', cursor:'pointer', display:'flex', alignItems:'center',
          justifyContent:'center', color:'var(--text-muted)', transition:'all 0.15s', flexShrink:0 }}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(234,179,8,0.1)';e.currentTarget.style.color='#d97706'}}
        onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-muted)'}}>
        <MessageSquarePlus style={{ width:16, height:16 }}/>
      </button>

      {/* Bell */}
      <div className="relative" ref={bellRef}>
        <button onClick={openBell}
          style={{ position:'relative', width:34, height:34, borderRadius:8, border:'none',
            background:'transparent', cursor:'pointer', display:'flex', alignItems:'center',
            justifyContent:'center', color:'var(--text-muted)', transition:'all 0.15s' }}
          onMouseEnter={e=>{e.currentTarget.style.background='var(--border-light)';e.currentTarget.style.color='var(--text-primary)'}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-muted)'}}>
          <Bell style={{ width:16, height:16 }}/>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full text-white font-bold"
              style={{ background: '#dc2626', fontSize: 9 }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </button>

        {bellOpen && (
          <div className="absolute right-0 top-full mt-1.5 rounded-xl shadow-xl z-50 w-80" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Activity</span>
              <button onClick={() => setBellOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <X className="h-4 w-4"/>
              </button>
            </div>

            {nLoading ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <CheckCheck style={{ width: 32, height: 32, color: 'var(--border)', margin: '0 auto 8px' }}/>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>All caught up!</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifs.map(n => (
                  <div key={n.id}
                    style={{ display:'flex', gap:10, padding:'10px 14px',
                      borderBottom:'1px solid var(--border-light)', cursor:'pointer',
                      transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--surface-subtle)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                    onClick={() => { if (n.task_id) { router.push(`/tasks`); setBellOpen(false) } }}>
                    <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: n.action.includes('reject') ? 'rgba(220,38,38,0.12)' : n.action.includes('approv') ? 'rgba(22,163,74,0.12)' : 'rgba(13,148,136,0.12)' }}>
                      {n.action.includes('reject') ? <AlertCircle className="h-3.5 w-3.5 text-red-500"/> :
                       n.action.includes('approv') ? <CheckCheck className="h-3.5 w-3.5 text-green-500"/> :
                       <Zap className="h-3.5 w-3.5 text-teal-500"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize:12, color:"var(--text-primary)", lineHeight:1.45 }}>{actionLabel(n.action, n.actor_name, n.task_title)}</p>
                      <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>{fmtDate(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <Link href="/tasks" onClick={() => setBellOpen(false)}
                style={{ fontSize:12, color:'var(--brand)', fontWeight:500, textDecoration:'none',
                  display:'flex', alignItems:'center', gap:4 }}>
                View all tasks <svg viewBox="0 0 10 10" fill="none" style={{width:10,height:10}}><path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative" ref={profileRef}>
        <button onClick={() => { setProfileOpen(!profileOpen); setCreateOpen(false); setBellOpen(false) }}
          style={{ width:32, height:32, borderRadius:'50%', border:'2px solid var(--border)',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer',
            background: session?.org.logo_color ?? 'var(--brand)',
            transition:'all 0.15s', flexShrink:0 }}
          onMouseEnter={e=>e.currentTarget.style.boxShadow='0 0 0 3px var(--brand-border)'}
          onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
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
            <div style={{ margin: '4px 8px', borderTop: '1px solid var(--border)' }}/>
            <Link href="/settings" onClick={() => setProfileOpen(false)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',fontSize:13,color:'var(--text-primary)',textDecoration:'none',transition:'background 0.1s'}} onMouseEnter={e=>(e.currentTarget.style.background='var(--border-light)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <Settings style={{width:14,height:14,color:'var(--text-muted)',flexShrink:0}}/>Settings
            </Link>
            <button onClick={handleLogout}
              style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',fontSize:13,color:'#dc2626',background:'transparent',border:'none',cursor:'pointer',width:'100%',textAlign:'left',transition:'background 0.1s'}}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(220,38,38,0.08)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <LogOut className="h-4 w-4"/>Sign out
            </button>
          </div>
        )}
      </div>
      {/* ── Report issue modal ── */}
      {reportOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setReportOpen(false); setReportText(''); setReportFiles([]) } }}>
          <div style={{ background:'var(--surface)', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
            padding:24, width:'100%', maxWidth:500, display:'flex', flexDirection:'column', gap:16 }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(234,179,8,0.1)',
                  border:'1px solid rgba(234,179,8,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <AlertCircle style={{ width:18, height:18, color:'#d97706' }}/>
                </div>
                <div>
                  <p style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Report an issue</p>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Describe the problem and attach a screenshot if needed</p>
                </div>
              </div>
              <button onClick={() => { setReportOpen(false); setReportText(''); setReportFiles([]) }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)',
                  display:'flex', alignItems:'center', padding:4, borderRadius:6 }}>
                <X style={{ width:16, height:16 }}/>
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={reportText}
              onChange={e => setReportText(e.target.value)}
              placeholder="Describe the issue… (what happened, steps to reproduce, what you expected)"
              rows={5}
              style={{ width:'100%', resize:'vertical', fontSize:13,
                border:'1.5px solid var(--border)', borderRadius:10,
                padding:'10px 12px', outline:'none', fontFamily:'inherit',
                background:'var(--surface-subtle)', color:'var(--text-primary)',
                boxSizing:'border-box', lineHeight:1.5 }}
              onFocus={e => { e.currentTarget.style.borderColor = '#d97706' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />

            {/* File upload */}
            <div>
              <input ref={reportFileRef} type="file" multiple accept="image/*,.pdf,.zip,.txt"
                style={{ display:'none' }} onChange={e => setReportFiles(Array.from(e.target.files ?? []))}/>
              <button onClick={() => reportFileRef.current?.click()}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8,
                  border:'1.5px dashed var(--border)', background:'var(--surface-subtle)',
                  color:'var(--text-muted)', fontSize:12, cursor:'pointer', fontFamily:'inherit',
                  width:'100%', justifyContent:'center', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#d97706'; e.currentTarget.style.color='#d97706' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-muted)' }}>
                <Paperclip style={{ width:13, height:13 }}/>
                {reportFiles.length > 0
                  ? `${reportFiles.length} file${reportFiles.length > 1 ? 's' : ''} attached — click to change`
                  : 'Attach screenshot or file (optional)'}
              </button>
              {reportFiles.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                  {reportFiles.map((f, i) => (
                    <span key={i} style={{ fontSize:11, padding:'2px 8px', borderRadius:99,
                      background:'rgba(234,179,8,0.1)', color:'#d97706', border:'1px solid rgba(234,179,8,0.25)' }}>
                      {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:4 }}>
              <button onClick={() => { setReportOpen(false); setReportText(''); setReportFiles([]) }}
                style={{ padding:'7px 16px', borderRadius:8, border:'1px solid var(--border)',
                  background:'transparent', color:'var(--text-secondary)',
                  fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
              <button onClick={submitReport}
                disabled={reportSending || (!reportText.trim() && reportFiles.length === 0)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 18px', borderRadius:8,
                  border:'none', background: reportText.trim() || reportFiles.length > 0 ? '#d97706' : 'var(--border)',
                  color: reportText.trim() || reportFiles.length > 0 ? '#fff' : 'var(--text-muted)',
                  fontSize:13, fontWeight:600, cursor: reportText.trim() || reportFiles.length > 0 ? 'pointer' : 'default',
                  fontFamily:'inherit', opacity: reportSending ? 0.7 : 1, transition:'all 0.15s' }}>
                <Send style={{ width:13, height:13 }}/>
                {reportSending ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}