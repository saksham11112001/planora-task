'use client'
import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, FolderOpen, CheckSquare, Clock, AlertTriangle, LayoutGrid, AlignJustify } from 'lucide-react'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import type { Task } from '@/types'

interface CalTask {
  id: string; title: string; status: string; priority: string
  due_date: string; is_recurring: boolean; project_id: string | null
  assignee_id: string | null; frequency: string | null; client_id?: string | null
  custom_fields?: Record<string, any> | null
  projects: { id: string; name: string; color: string } | null
  assignee: { id: string; name: string } | null
  client?: { id: string; name: string; color: string } | null
}
interface Props {
  tasks: CalTask[]
  clients?: { id: string; name: string; color: string }[]
  members?: { id: string; name: string }[]
  canViewAll: boolean
  currentUserId: string
  userRole?: string
  upcomingCATriggers?: UpcomingCATrigger[]
}
type Filter = 'all' | 'compliance' | 'project' | 'one-time' | 'recurring'
type ViewMode = 'month' | 'timeline'
interface UpcomingCATrigger {
  id: string; title: string; triggerDate: string; dueDate: string
  clientId: string | null; clientName: string | null; clientColor: string | null
  assigneeId: string | null; priority: string
}

const PRIORITY_COLORS: Record<string,string> = {
  urgent:'#dc2626', high:'#ea580c', medium:'#ca8a04', low:'#16a34a', none:'#94a3b8',
}
const PRIORITY_BG: Record<string,string> = {
  urgent:'rgba(220,38,38,0.12)', high:'rgba(234,88,12,0.12)', medium:'rgba(202,138,4,0.12)',
  low:'rgba(22,163,74,0.12)', none:'var(--surface-subtle)',
}
const STATUS_DOT: Record<string,string> = {
  todo:'#94a3b8', in_progress:'#0d9488', in_review:'#7c3aed', completed:'#16a34a',
}
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_HEAT = ['','rgba(13,148,136,0.08)','rgba(13,148,136,0.16)','rgba(13,148,136,0.24)','rgba(13,148,136,0.34)']

/* ── Type-based color coding (matches InboxView / MyTasksView) ── */
function taskTypeBorder(t: CalTask): string {
  if (t.custom_fields?._ca_compliance) return '#d97706'   // amber — compliance
  if (t.is_recurring)                  return '#0d9488'   // teal  — recurring
  if (t.project_id)                    return '#7c3aed'   // purple — project
  return '#0891b2'                                        // cyan  — one-time
}
function taskTypeBg(t: CalTask): string {
  if (t.custom_fields?._ca_compliance) return 'rgba(234,179,8,0.10)'
  if (t.is_recurring)                  return 'rgba(13,148,136,0.08)'
  if (t.project_id)                    return 'rgba(124,58,237,0.08)'
  return 'rgba(8,145,178,0.07)'
}
function taskTypeDot(t: CalTask): string {
  if (t.custom_fields?._ca_compliance) return '#d97706'
  if (t.is_recurring)                  return '#0d9488'
  if (t.project_id)                    return t.projects?.color ?? '#7c3aed'
  return '#0891b2'
}

export function CalendarView({ tasks, clients = [], members = [], canViewAll, currentUserId, userRole, upcomingCATriggers = [] }: Props) {
  const now = new Date()
  const [year,     setYear]     = useState(now.getFullYear())
  const [month,    setMonth]    = useState(now.getMonth())
  const [filter,   setFilter]   = useState<Filter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [selected, setSelected] = useState<string|null>(null)
  const [hovered,       setHovered]       = useState<string|null>(null)
  const [clientFilter,  setClientFilter]  = useState('')
  const [memberFilter,  setMemberFilter]  = useState('')
  const [panelTask, setPanelTask] = useState<Task | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)
  const timelineScrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll timeline to today when entering timeline view or changing month
  useEffect(() => {
    if (viewMode !== 'timeline') return
    const el = timelineScrollRef.current
    if (!el) return
    const CARD_W = 190, GAP = 10
    const viewingCurrentMonth =
      year === now.getFullYear() && month === now.getMonth()
    if (!viewingCurrentMonth) { el.scrollLeft = 0; return }
    const dayNum = now.getDate()
    // Centre today in the viewport; fall back to left-aligned if near start
    const scrollTo = Math.max(0, (dayNum - 1) * (CARD_W + GAP) - (el.clientWidth / 2 - CARD_W / 2))
    el.scrollLeft = scrollTo
  }, [viewMode, year, month])

  async function openTask(id: string) {
    setPanelLoading(true)
    try {
      const res  = await fetch(`/api/tasks/${id}`)
      const data = await res.json()
      if (data?.data) setPanelTask(data.data as Task)
    } finally { setPanelLoading(false) }
  }

  function prevMonth() { if (month===0){setYear(y=>y-1);setMonth(11)}else setMonth(m=>m-1) }
  function nextMonth() { if (month===11){setYear(y=>y+1);setMonth(0)}else setMonth(m=>m+1) }
  function goToday()   { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelected(null) }

  const filtered = tasks.filter(t => {
    if (filter==='compliance') return !!t.custom_fields?._ca_compliance
    if (filter==='project')    return !!t.project_id && !t.is_recurring
    if (filter==='one-time')   return !t.project_id && !t.is_recurring && !t.custom_fields?._ca_compliance
    if (filter==='recurring')  return t.is_recurring
    return true
  }).filter(t => {
    if (clientFilter && (t as any).client?.id !== clientFilter) return false
    if (memberFilter && t.assignee_id !== memberFilter) return false
    return true
  })

  const byDate: Record<string,CalTask[]> = {}
  filtered.forEach(t => {
    if (!t.due_date) return
    if (!byDate[t.due_date]) byDate[t.due_date] = []
    byDate[t.due_date].push(t)
  })

  // Upcoming CA triggers indexed by their triggerDate (the day they will be spawned)
  const byTriggerDate: Record<string, UpcomingCATrigger[]> = {}
  upcomingCATriggers.forEach(ct => {
    if (!byTriggerDate[ct.triggerDate]) byTriggerDate[ct.triggerDate] = []
    byTriggerDate[ct.triggerDate].push(ct)
  })

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const todayStr    = now.toISOString().split('T')[0]

  const cells: (number|null)[] = []
  for (let i=0; i<firstDay; i++) cells.push(null)
  for (let d=1; d<=daysInMonth; d++) cells.push(d)

  const selectedTasks = selected ? (byDate[selected]??[]) : []

  const FILTERS = [
    { v:'all'        as Filter, label:'All',         icon:CheckSquare, color:'#0d9488', bg:'rgba(13,148,136,0.12)' },
    { v:'compliance' as Filter, label:'Compliance',  icon:AlertTriangle, color:'#d97706', bg:'rgba(234,179,8,0.12)' },
    { v:'project'    as Filter, label:'Projects',    icon:FolderOpen,  color:'#7c3aed', bg:'rgba(124,58,237,0.12)' },
    { v:'one-time'   as Filter, label:'Quick',       icon:CheckSquare, color:'#0891b2', bg:'rgba(8,145,178,0.12)' },
    { v:'recurring'  as Filter, label:'Recurring',   icon:RefreshCw,   color:'#ea580c', bg:'rgba(234,88,12,0.12)' },
  ]

  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const monthTasks = filtered.filter(t => t.due_date?.startsWith(monthStr))
  const overdueCount   = monthTasks.filter(t => t.due_date < todayStr && t.status !== 'completed').length
  const completedCount = monthTasks.filter(t => t.status === 'completed').length
  const pendingCount   = monthTasks.filter(t => t.status !== 'completed').length

  /* ── Shared header/filter bar ── */
  const Header = (
    <>
      {(clients.length > 0 || (canViewAll && members.length > 0)) && (
        <div style={{ display:'flex', gap:12, alignItems:'center', padding:'8px 0 10px', flexWrap:'wrap' }}>
          {clients.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Client</span>
              <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
                style={{ padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', outline:'none',
                  border: clientFilter ? '1px solid var(--brand)' : '1px solid var(--border)',
                  background: clientFilter ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)',
                  color: clientFilter ? 'var(--brand)' : 'var(--text-secondary)',
                  fontWeight: clientFilter ? 600 : 400, fontFamily:'inherit', appearance:'none', paddingRight:20 }}>
                <option value=''>All clients</option>
                {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select>
              {clientFilter && <button onClick={() => setClientFilter('')} style={{ fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>✕</button>}
            </div>
          )}
          {canViewAll && members.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Member</span>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                <button onClick={() => setMemberFilter('')}
                  style={{ padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', border:'none',
                    background: !memberFilter ? 'var(--brand)' : 'var(--surface-subtle)',
                    color: !memberFilter ? '#fff' : 'var(--text-secondary)',
                    fontWeight: !memberFilter ? 600 : 400, fontFamily:'inherit', transition:'all 0.12s' }}>
                  All
                </button>
                {members.map(m => (
                  <button key={m.id} onClick={() => setMemberFilter(memberFilter === m.id ? '' : m.id)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
                      borderRadius:20, fontSize:12, cursor:'pointer', border:'none',
                      background: memberFilter === m.id ? 'var(--brand)' : 'var(--surface-subtle)',
                      color: memberFilter === m.id ? '#fff' : 'var(--text-secondary)',
                      fontWeight: memberFilter === m.id ? 600 : 400, fontFamily:'inherit', transition:'all 0.12s' }}>
                    <div style={{ width:18, height:18, borderRadius:'50%', flexShrink:0,
                      background: memberFilter === m.id ? 'rgba(255,255,255,0.3)' : 'var(--border)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:9, fontWeight:700,
                      color: memberFilter === m.id ? '#fff' : 'var(--text-muted)' }}>
                      {m.name[0]?.toUpperCase()}
                    </div>
                    {m.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={prevMonth} style={{ width:32,height:32,borderRadius:8,border:'1px solid var(--border)',
              background:'var(--surface)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.12s' }}
              onMouseEnter={e=>{(e.currentTarget as any).style.borderColor='var(--brand)';(e.currentTarget as any).style.color='var(--brand)'}}
              onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='var(--border)';(e.currentTarget as any).style.color=''}}>
              <ChevronLeft style={{ width:14,height:14 }}/>
            </button>
            <button onClick={goToday} style={{ padding:'5px 14px',borderRadius:8,border:'1px solid var(--border)',
              background:'var(--surface)',cursor:'pointer',fontSize:12,fontWeight:600,
              color:'var(--text-primary)',fontFamily:'inherit',transition:'all 0.12s' }}
              onMouseEnter={e=>{(e.currentTarget as any).style.borderColor='var(--brand)';(e.currentTarget as any).style.color='var(--brand)'}}
              onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='var(--border)';(e.currentTarget as any).style.color='var(--text-primary)'}}>
              Today
            </button>
            <button onClick={nextMonth} style={{ width:32,height:32,borderRadius:8,border:'1px solid var(--border)',
              background:'var(--surface)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.12s' }}
              onMouseEnter={e=>{(e.currentTarget as any).style.borderColor='var(--brand)';(e.currentTarget as any).style.color='var(--brand)'}}
              onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='var(--border)';(e.currentTarget as any).style.color=''}}>
              <ChevronRight style={{ width:14,height:14 }}/>
            </button>
          </div>
          <h2 style={{ fontSize:20,fontWeight:800,color:'var(--text-primary)',letterSpacing:'-0.3px' }}>
            {MONTH_NAMES[month]} <span style={{ color:'var(--text-muted)',fontWeight:400 }}>{year}</span>
          </h2>
        </div>

        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {/* View mode toggle */}
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginRight:6 }}>
            <button onClick={() => setViewMode('month')}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', border:'none', cursor:'pointer',
                background: viewMode==='month' ? 'var(--brand)' : 'var(--surface)',
                color: viewMode==='month' ? '#fff' : 'var(--text-muted)',
                fontSize:12, fontWeight:600, fontFamily:'inherit', transition:'all 0.12s' }}>
              <LayoutGrid style={{ width:11,height:11 }}/> Month
            </button>
            <button onClick={() => setViewMode('timeline')}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', border:'none', cursor:'pointer',
                background: viewMode==='timeline' ? 'var(--brand)' : 'var(--surface)',
                color: viewMode==='timeline' ? '#fff' : 'var(--text-muted)',
                borderLeft:'1px solid var(--border)',
                fontSize:12, fontWeight:600, fontFamily:'inherit', transition:'all 0.12s' }}>
              <AlignJustify style={{ width:11,height:11 }}/> Timeline
            </button>
          </div>
          {/* Filter pills */}
          {FILTERS.map(f => {
            const Icon = f.icon
            const active = filter === f.v
            return (
              <button key={f.v} onClick={() => setFilter(f.v)}
                style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:8,
                  border:`1.5px solid ${active?f.color:'var(--border)'}`,
                  background:active?f.bg:'var(--surface)',cursor:'pointer',
                  color:active?f.color:'var(--text-muted)',fontSize:12,fontWeight:active?600:400,
                  fontFamily:'inherit',transition:'all 0.12s' }}>
                <Icon style={{ width:11,height:11 }}/>{f.label}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )

  /* ── Month stats strip ── */
  const StatsStrip = (
    <div style={{ display:'flex', gap:10, marginBottom:14 }}>
      {[
        { label:'Tasks this month', value:monthTasks.length, color:'#0d9488', bg:'rgba(13,148,136,0.1)', border:'rgba(13,148,136,0.25)' },
        { label:'Completed',        value:completedCount,   color:'#16a34a', bg:'rgba(22,163,74,0.1)', border:'rgba(22,163,74,0.25)' },
        { label:'Pending',          value:pendingCount,     color:'#0891b2', bg:'rgba(8,145,178,0.1)', border:'rgba(8,145,178,0.25)' },
        { label:'Overdue',          value:overdueCount,     color: overdueCount>0?'#dc2626':'#94a3b8',
          bg: overdueCount>0?'rgba(220,38,38,0.1)':'var(--surface)', border: overdueCount>0?'rgba(220,38,38,0.25)':'var(--border)' },
      ].map(s => (
        <div key={s.label} style={{ flex:1,padding:'8px 12px',borderRadius:8,background:s.bg,border:`1px solid ${s.border}` }}>
          <p style={{ fontSize:18,fontWeight:800,color:s.color,lineHeight:1 }}>{s.value}</p>
          <p style={{ fontSize:10,color:'var(--text-muted)',marginTop:2 }}>{s.label}</p>
        </div>
      ))}
    </div>
  )

  /* ── Color legend ── */
  const Legend = (
    <div style={{ display:'flex',alignItems:'center',gap:16,marginTop:14,padding:'8px 0',fontSize:11,color:'var(--text-muted)',flexWrap:'wrap' }}>
      <span style={{ display:'flex',alignItems:'center',gap:4 }}>
        <span style={{ width:10,height:10,borderRadius:2,background:'rgba(13,148,136,0.25)',border:'1px solid rgba(13,148,136,0.3)',display:'inline-block' }}/>
        More tasks = deeper teal
      </span>
      <span style={{ display:'flex',alignItems:'center',gap:4 }}>
        <span style={{ width:8,height:8,borderRadius:2,background:'rgba(124,58,237,0.25)',border:'1px solid rgba(124,58,237,0.3)',display:'inline-block' }}/>
        Project
      </span>
      <span style={{ display:'flex',alignItems:'center',gap:4 }}>
        <span style={{ width:8,height:8,borderRadius:2,background:'rgba(234,179,8,0.25)',border:'1px solid rgba(234,179,8,0.3)',display:'inline-block' }}/>
        Compliance
      </span>
      <span style={{ display:'flex',alignItems:'center',gap:4 }}>
        <RefreshCw style={{ width:10,height:10,color:'#ea580c' }}/> Recurring
      </span>
      <span style={{ display:'flex',alignItems:'center',gap:4 }}>
        <AlertTriangle style={{ width:10,height:10,color:'#dc2626' }}/> Overdue
      </span>
    </div>
  )

  /* ────────────────────────────────────────────
     TIMELINE VIEW — horizontal scrollable days
  ──────────────────────────────────────────── */
  if (viewMode === 'timeline') {
    // Build all days of the month
    const days: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
    }

    return (<>
      <div className="page-container">
        {Header}
        {StatsStrip}
        {/* Horizontal scrollable day columns — today centred on load */}
        <div ref={timelineScrollRef} style={{ overflowX:'auto', paddingBottom:16, scrollBehavior:'smooth' }}>
          <div style={{ display:'flex', gap:10, minWidth:'max-content', alignItems:'flex-start' }}>
            {days.map(dateStr => {
              const d = parseInt(dateStr.split('-')[2])
              const dayIdx = new Date(dateStr + 'T00:00:00').getDay()
              const isToday   = dateStr === todayStr
              const isWeekend = dayIdx === 0 || dayIdx === 6
              const isPast    = dateStr < todayStr
              const dayTasks  = byDate[dateStr] ?? []

              return (
                <div key={dateStr}
                  style={{ width:190, flexShrink:0, borderRadius:10,
                    border: isToday ? '2px solid var(--brand)' : '1px solid var(--border)',
                    background: isToday ? 'rgba(13,148,136,0.05)' : isWeekend ? 'var(--surface-subtle)' : 'var(--surface)',
                    opacity: isPast && !isToday ? 0.75 : 1,
                    overflow:'hidden',
                  }}>
                  {/* Day header */}
                  <div style={{ padding:'7px 10px', borderBottom:'1px solid var(--border-light)',
                    background: isToday ? 'var(--brand)' : 'var(--surface-subtle)',
                    display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, fontWeight:800, color: isToday ? '#fff' : isWeekend ? '#f87171' : 'var(--text-primary)' }}>
                      {String(d).padStart(2,'0')} {DAY_NAMES[dayIdx]}
                    </span>
                    {dayTasks.length > 0 && (
                      <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99,
                        background: isToday ? 'rgba(255,255,255,0.25)' : 'var(--brand-light)',
                        color: isToday ? '#fff' : 'var(--brand)' }}>
                        {dayTasks.length}
                      </span>
                    )}
                  </div>
                  {/* Tasks */}
                  <div style={{ padding:'8px', minHeight:60, display:'flex', flexDirection:'column', gap:5 }}>
                    {dayTasks.length === 0 ? (
                      <div style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center', padding:'12px 0', opacity:0.5 }}>—</div>
                    ) : dayTasks.map(t => {
                      const borderClr = taskTypeBorder(t)
                      const bgClr     = taskTypeBg(t)
                      const isDone    = t.status === 'completed'
                      return (
                        <button key={t.id} onClick={() => openTask(t.id)}
                          style={{ display:'block', textAlign:'left', width:'100%', padding:'6px 8px',
                            borderRadius:6, cursor:'pointer', fontFamily:'inherit',
                            background: bgClr,
                            border:`1px solid ${borderClr}55`,
                            borderLeft:`3px solid ${borderClr}`,
                            opacity: isDone ? 0.72 : 1,
                            transition:'all 0.1s' }}
                          onMouseEnter={e => { (e.currentTarget as any).style.boxShadow='0 2px 8px rgba(0,0,0,0.1)' }}
                          onMouseLeave={e => { (e.currentTarget as any).style.boxShadow='' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:5, marginBottom:3 }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background: borderClr,
                              flexShrink:0, marginTop:3 }}/>
                            <span style={{ fontSize:11, fontWeight:500, lineHeight:1.3,
                              color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                              textDecoration: isDone ? 'line-through' : undefined,
                              overflow:'hidden', display:'-webkit-box',
                              WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                              {t.title}
                            </span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                            {t.projects && (
                              <span style={{ fontSize:9, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:2 }}>
                                <span style={{ width:5,height:5,borderRadius:1,background:t.projects.color,display:'inline-block' }}/>
                                {t.projects.name.length > 10 ? t.projects.name.slice(0,10)+'…' : t.projects.name}
                              </span>
                            )}
                            {t.is_recurring && <RefreshCw style={{ width:8,height:8,color:'#0d9488',flexShrink:0 }}/>}
                            {t.custom_fields?._ca_compliance && (
                              <span style={{ fontSize:9, fontWeight:700, color:'#d97706' }}>CA</span>
                            )}
                            <span style={{ marginLeft:'auto', fontSize:9, padding:'1px 5px', borderRadius:4,
                              background: isDone ? 'rgba(22,163,74,0.15)' : 'var(--surface-subtle)',
                              color: STATUS_DOT[t.status] ?? '#94a3b8', fontWeight:500 }}>
                              {t.status.replace('_',' ')}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                    {/* Upcoming CA trigger ghost cards */}
                    {(byTriggerDate[dateStr] ?? []).map(ct => (
                      <div key={ct.id} style={{ padding:'5px 7px', borderRadius:6,
                        background:'rgba(234,179,8,0.05)',
                        border:'1px dashed rgba(217,119,6,0.4)',
                        borderLeft:'3px dashed #d97706',
                        opacity:0.72 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'#d97706',
                            background:'rgba(234,179,8,0.18)', padding:'1px 5px', borderRadius:3 }}>CA ⏰</span>
                          {ct.clientName && <span style={{ fontSize:9, color:'#a16207',
                            overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ct.clientName}</span>}
                        </div>
                        <p style={{ fontSize:10, fontWeight:500, color:'#d97706', margin:'0 0 2px',
                          lineHeight:1.3, overflow:'hidden', display:'-webkit-box',
                          WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>
                          {ct.title}
                        </p>
                        <span style={{ fontSize:9, color:'#a16207' }}>Due {ct.dueDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {Legend}
      </div>

      {panelLoading && (
        <div style={{ position:'fixed',inset:0,zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.15)' }}>
          <div style={{ background:'var(--surface)',borderRadius:12,padding:'20px 28px',fontSize:13,color:'var(--text-muted)',boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
            Loading task…
          </div>
        </div>
      )}
      <TaskDetailPanel task={panelTask} members={members} clients={clients} currentUserId={currentUserId} userRole={userRole}
        onClose={() => setPanelTask(null)} onUpdated={() => setPanelTask(null)} />
    </>)
  }

  /* ────────────────────────────────────────────
     MONTH GRID VIEW — fits in one screen, no scroll
     Available height inside .page-container:
       100vh - 54px(header) - 64px(padding top+bottom) = 100vh - 118px
  ──────────────────────────────────────────── */
  return (<>
    {/* Override page-container scroll: fill exactly the available height */}
    <div style={{ height:'calc(100vh - 118px)', display:'flex', flexDirection:'column', overflow:'hidden', gap:0 }}>

      {/* ── Controls (month nav + filters) ── */}
      <div style={{ flexShrink:0 }}>
        {Header}
      </div>

      {/* ── Stats + legend on same row ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexShrink:0, flexWrap:'wrap' }}>
        {[
          { label:'This month', value:monthTasks.length, color:'#0d9488', bg:'rgba(13,148,136,0.1)', border:'rgba(13,148,136,0.25)' },
          { label:'Completed',  value:completedCount,   color:'#16a34a', bg:'rgba(22,163,74,0.1)',  border:'rgba(22,163,74,0.25)' },
          { label:'Pending',    value:pendingCount,     color:'#0891b2', bg:'rgba(8,145,178,0.1)',  border:'rgba(8,145,178,0.25)' },
          { label:'Overdue',    value:overdueCount,     color: overdueCount>0?'#dc2626':'#94a3b8',
            bg: overdueCount>0?'rgba(220,38,38,0.1)':'var(--surface)', border: overdueCount>0?'rgba(220,38,38,0.25)':'var(--border)' },
        ].map(s => (
          <div key={s.label} style={{ padding:'5px 10px', borderRadius:8, background:s.bg, border:`1px solid ${s.border}`, display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ fontSize:16, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</span>
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
        {/* Legend inline */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12, fontSize:10, color:'var(--text-muted)', flexWrap:'wrap' }}>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ width:8,height:8,borderRadius:2,background:'rgba(124,58,237,0.25)',border:'1px solid rgba(124,58,237,0.3)',display:'inline-block' }}/>Project
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ width:8,height:8,borderRadius:2,background:'rgba(8,145,178,0.25)',border:'1px solid rgba(8,145,178,0.3)',display:'inline-block' }}/>Quick
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ width:8,height:8,borderRadius:2,background:'rgba(234,179,8,0.25)',border:'1px solid rgba(234,179,8,0.3)',display:'inline-block' }}/>Compliance
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ width:8,height:8,borderRadius:2,background:'rgba(13,148,136,0.25)',border:'1px solid rgba(13,148,136,0.3)',display:'inline-block' }}/>
            <RefreshCw style={{ width:9,height:9,color:'#0d9488' }}/> Recurring
          </span>
        </div>
      </div>

      {/* ── Calendar + day panel side-by-side ── */}
      <div style={{ flex:1, display:'flex', gap:20, overflow:'hidden' }}>

        {/* Left: calendar grid */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3, flexShrink:0 }}>
            {DAY_NAMES.map((d,i) => (
              <div key={d} style={{ textAlign:'center', padding:'4px 0', fontSize:10, fontWeight:700,
                color: i===0||i===6 ? '#f87171' : 'var(--text-muted)',
                textTransform:'uppercase', letterSpacing:'0.05em' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid — fills remaining height */}
          <div style={{ flex:1, overflow:'hidden', display:'grid', gridTemplateColumns:'repeat(7,1fr)', gridAutoRows:'1fr', gap:3 }}>
            {cells.map((day,i) => {
            if (!day) return <div key={`e-${i}`}/>
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const dayTasks  = byDate[dateStr] ?? []
            const isToday   = dateStr === todayStr
            const isSelected= selected === dateStr
            const isHovered = hovered === dateStr
            const isPast    = dateStr < todayStr
            const isWeekend = (i % 7 === 0) || (i % 7 === 6)
            const overdueT  = dayTasks.filter(t => t.status !== 'completed')
            const heatIdx   = Math.min(dayTasks.length, DAY_HEAT.length-1)

            return (
              <div key={dateStr}
                onClick={() => setSelected(isSelected ? null : dateStr)}
                onMouseEnter={() => setHovered(dateStr)}
                onMouseLeave={() => setHovered(null)}
                style={{ overflow:'hidden', padding:'5px 4px', borderRadius:8,
                  border: isSelected ? '2px solid var(--brand)'
                    : isToday ? '2px solid var(--brand-border)'
                    : isHovered && dayTasks.length>0 ? '1px solid var(--brand-border)'
                    : '1px solid var(--border)',
                  background: isSelected ? 'var(--brand-light)'
                    : isToday ? 'rgba(13,148,136,0.08)'
                    : isWeekend ? 'var(--surface-subtle)'
                    : dayTasks.length>0 ? DAY_HEAT[heatIdx]
                    : 'var(--surface)',
                  cursor: dayTasks.length>0 ? 'pointer' : 'default',
                  transition:'all 0.1s',
                  opacity: isPast && !isToday ? 0.7 : 1,
                }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
                  <span style={{ fontSize:12,fontWeight:isToday?800:500,
                    width:22,height:22,borderRadius:'50%',
                    background:isToday?'var(--brand)':'transparent',
                    color:isToday?'#fff':isWeekend?'#f87171':'var(--text-primary)',
                    display:'flex',alignItems:'center',justifyContent:'center' }}>
                    {day}
                  </span>
                  {dayTasks.length>0 && (
                    <div style={{ display:'flex',alignItems:'center',gap:2 }}>
                      {overdueT.length>0&&isPast&&<AlertTriangle style={{width:9,height:9,color:'#dc2626'}}/>}
                      <span style={{ fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:99,
                        background: overdueT.length>0&&isPast?'rgba(220,38,38,0.12)':'var(--brand-light)',
                        color: overdueT.length>0&&isPast?'#dc2626':'var(--brand)' }}>
                        {dayTasks.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* Task pills — type-color coded */}
                {dayTasks.slice(0,3).map((t) => {
                  const dotClr = taskTypeDot(t)
                  const bgClr  = taskTypeBg(t)
                  const isDone = t.status==='completed'
                  return (
                    <div key={t.id} style={{ display:'flex',alignItems:'center',gap:3,
                      padding:'2px 5px',borderRadius:5,marginBottom:2,
                      background: bgClr,
                      border:`1px solid ${dotClr}44`,
                      borderLeft:`2px solid ${dotClr}`,
                      opacity: isDone ? 0.68 : 1,
                      overflow:'hidden' }}>
                      <span style={{ width:5,height:5,borderRadius:'50%',background:dotClr,flexShrink:0 }}/>
                      <span style={{ fontSize:9,fontWeight:500,
                        color:isDone?'#94a3b8':'var(--text-primary)',
                        overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',flex:1,
                        textDecoration:isDone?'line-through':undefined }}>
                        {t.title}
                      </span>
                      {t.is_recurring&&<RefreshCw style={{width:7,height:7,color:'#0d9488',flexShrink:0}}/>}
                      {t.custom_fields?._ca_compliance&&<span style={{fontSize:7,fontWeight:700,color:'#d97706',flexShrink:0}}>CA</span>}
                    </div>
                  )
                })}
                {dayTasks.length>3&&(
                  <div style={{ fontSize:9,color:'var(--brand)',fontWeight:600,paddingLeft:4,marginTop:1 }}>
                    +{dayTasks.length-3} more
                  </div>
                )}
                {/* Upcoming CA trigger ghost pills */}
                {(byTriggerDate[dateStr] ?? []).slice(0,2).map(ct => (
                  <div key={ct.id} style={{ display:'flex', alignItems:'center', gap:3,
                    padding:'2px 4px', borderRadius:4, marginBottom:1,
                    background:'rgba(234,179,8,0.05)',
                    border:'1px dashed rgba(217,119,6,0.45)',
                    opacity:0.75 }}>
                    <span style={{ fontSize:7, fontWeight:700, color:'#d97706', flexShrink:0 }}>⏰</span>
                    <span style={{ fontSize:8, fontWeight:500, color:'#d97706',
                      overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', flex:1 }}>
                      {ct.title}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
          </div>{/* end calendar grid */}
        </div>{/* end left flex col */}

        {/* ── Day panel (scrollable) ── */}
        <div style={{ width:280, flexShrink:0, overflowY:'auto', paddingRight:2 }}>
          {selected ? (
            <>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
                <div>
                  <h3 style={{ fontSize:15,fontWeight:700,color:'var(--text-primary)' }}>
                    {new Date(selected+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long'})}
                  </h3>
                  <p style={{ fontSize:12,color:'var(--text-muted)' }}>
                    {new Date(selected+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
                  </p>
                </div>
                <button onClick={()=>setSelected(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:18,padding:4,lineHeight:1 }}>✕</button>
              </div>

              {selectedTasks.length===0 ? (
                <div style={{ padding:'28px 16px',textAlign:'center',background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)' }}>
                  <Clock style={{ width:28,height:28,color:'var(--border)',margin:'0 auto 8px' }}/>
                  <p style={{ fontSize:13,color:'var(--text-muted)' }}>No tasks due this day</p>
                </div>
              ) : (
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {selectedTasks.map(t => {
                    const borderClr = taskTypeBorder(t)
                    const bgClr     = taskTypeBg(t)
                    const priClr    = PRIORITY_COLORS[t.priority]??'#94a3b8'
                    const priBg     = PRIORITY_BG[t.priority]??'#f8fafc'
                    return (
                      <button key={t.id} onClick={() => openTask(t.id)}
                        style={{ display:'block',textAlign:'left',width:'100%',padding:'12px 14px',
                          background: bgClr,
                          borderRadius:12,cursor:'pointer',
                          border:`1px solid ${borderClr}40`,
                          borderLeft:`3px solid ${borderClr}`,
                          fontFamily:'inherit',transition:'all 0.1s' }}
                        onMouseEnter={e=>{(e.currentTarget as any).style.boxShadow='0 2px 10px rgba(0,0,0,0.08)';(e.currentTarget as any).style.transform='translateY(-1px)'}}
                        onMouseLeave={e=>{(e.currentTarget as any).style.boxShadow='';(e.currentTarget as any).style.transform=''}}>
                        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6 }}>
                          <p style={{ fontSize:13,fontWeight:500,
                            color:t.status==='completed'?'var(--text-muted)':'var(--text-primary)',
                            textDecoration:t.status==='completed'?'line-through':undefined,flex:1,lineHeight:1.4,margin:0 }}>
                            {t.title}
                          </p>
                          <span style={{ fontSize:10,padding:'2px 7px',borderRadius:99,flexShrink:0,
                            background:priBg,color:priClr,fontWeight:600,border:`1px solid ${priClr}30` }}>
                            {t.priority}
                          </span>
                        </div>
                        <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
                          {t.projects&&(
                            <span style={{ display:'inline-flex',alignItems:'center',gap:3,fontSize:10,color:'var(--text-muted)' }}>
                              <span style={{ width:6,height:6,borderRadius:2,background:t.projects.color,display:'inline-block' }}/>
                              {t.projects.name}
                            </span>
                          )}
                          {t.custom_fields?._ca_compliance && (
                            <span style={{ fontSize:10, fontWeight:700, color:'#d97706',
                              background:'rgba(234,179,8,0.12)', padding:'1px 6px', borderRadius:4 }}>CA</span>
                          )}
                          <span style={{ display:'inline-flex',alignItems:'center',gap:3,fontSize:10,
                            padding:'1px 6px',borderRadius:4,
                            background:t.status==='completed'?'rgba(22,163,74,0.1)':t.status==='in_progress'?'rgba(13,148,136,0.1)':t.status==='in_review'?'rgba(124,58,237,0.1)':'var(--surface-subtle)',
                            color:STATUS_DOT[t.status]??'#94a3b8',fontWeight:500 }}>
                            <span style={{ width:5,height:5,borderRadius:'50%',background:STATUS_DOT[t.status]??'#94a3b8',display:'inline-block' }}/>
                            {t.status.replace('_',' ')}
                          </span>
                          {t.is_recurring&&(
                            <span style={{ display:'inline-flex',alignItems:'center',gap:3,fontSize:10,color:'#0d9488' }}>
                              <RefreshCw style={{ width:9,height:9 }}/> Recurring
                            </span>
                          )}
                          {t.assignee&&(
                            <span style={{ fontSize:10,color:'var(--text-muted)',marginLeft:'auto' }}>
                              → {t.assignee.name}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {/* Upcoming CA triggers for this day */}
              {(byTriggerDate[selected] ?? []).length > 0 && (
                <div style={{ marginTop:14 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'#d97706', textTransform:'uppercase',
                    letterSpacing:'0.06em', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                    <span>⏰</span> CA tasks triggering soon
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    {(byTriggerDate[selected] ?? []).map(ct => (
                      <div key={ct.id} style={{ padding:'10px 12px', borderRadius:10,
                        background:'rgba(234,179,8,0.06)',
                        border:'1px dashed rgba(217,119,6,0.4)',
                        borderLeft:'3px dashed #d97706',
                        opacity:0.85 }}>
                        <p style={{ fontSize:12, fontWeight:600, color:'#d97706', margin:'0 0 4px', lineHeight:1.4 }}>
                          {ct.title}
                        </p>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                          {ct.clientName && (
                            <span style={{ fontSize:10, color:'#a16207', display:'flex', alignItems:'center', gap:3 }}>
                              {ct.clientColor && <span style={{ width:6, height:6, borderRadius:2, background:ct.clientColor, display:'inline-block' }}/>}
                              {ct.clientName}
                            </span>
                          )}
                          <span style={{ fontSize:10, color:'#a16207', marginLeft:'auto' }}>
                            Due {ct.dueDate}
                          </span>
                        </div>
                        <p style={{ fontSize:10, color:'#a16207', margin:'4px 0 0', fontStyle:'italic' }}>
                          Not yet spawned — triggers today
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding:'28px 16px',textAlign:'center',background:'var(--surface)',borderRadius:12,border:'1px dashed var(--border)' }}>
              <div style={{ fontSize:28,marginBottom:8 }}>📅</div>
              <p style={{ fontSize:13,fontWeight:500,color:'var(--text-primary)',marginBottom:4 }}>
                Click any day to see tasks
              </p>
              <p style={{ fontSize:11,color:'var(--text-muted)' }}>
                Teal cells have tasks due that day
              </p>
            </div>
          )}
        </div>{/* end day panel */}

      </div>{/* end calendar + panel row */}
    </div>{/* end height wrapper */}

    {panelLoading && (
      <div style={{ position:'fixed',inset:0,zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.15)' }}>
        <div style={{ background:'var(--surface)',borderRadius:12,padding:'20px 28px',fontSize:13,color:'var(--text-muted)',boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
          Loading task…
        </div>
      </div>
    )}
    <TaskDetailPanel task={panelTask} members={members} clients={clients} currentUserId={currentUserId} userRole={userRole}
      onClose={() => setPanelTask(null)} onUpdated={() => setPanelTask(null)} />
  </>)
}
