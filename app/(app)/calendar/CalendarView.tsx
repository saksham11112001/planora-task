'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, RefreshCw, FolderOpen, CheckSquare } from 'lucide-react'

interface CalTask {
  id: string; title: string; status: string; priority: string
  due_date: string; is_recurring: boolean; project_id: string | null
  assignee_id: string | null; frequency: string | null
  projects: { id: string; name: string; color: string } | null
  assignee: { id: string; name: string } | null
}

interface Props {
  tasks: CalTask[]
  canViewAll: boolean
  currentUserId: string
}

type Filter = 'all' | 'project' | 'one-time' | 'recurring'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a', none: '#94a3b8',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  todo:        { bg: '#f1f5f9', color: '#64748b' },
  in_progress: { bg: '#f0fdfa', color: '#0d9488' },
  in_review:   { bg: '#f5f3ff', color: '#7c3aed' },
  completed:   { bg: '#f0fdf4', color: '#16a34a' },
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function CalendarView({ tasks, canViewAll, currentUserId }: Props) {
  const now = new Date()
  const [year,   setYear]   = useState(now.getFullYear())
  const [month,  setMonth]  = useState(now.getMonth())
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string | null>(null)

  function prevMonth() { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1) }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0)  } else setMonth(m => m+1) }
  function goToday()   { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  // Filter tasks
  const filtered = tasks.filter(t => {
    if (filter === 'project')  return !!t.project_id && !t.is_recurring
    if (filter === 'one-time') return !t.project_id && !t.is_recurring
    if (filter === 'recurring') return t.is_recurring
    return true
  })

  // Group by date string
  const byDate: Record<string, CalTask[]> = {}
  filtered.forEach(t => {
    if (!t.due_date) return
    if (!byDate[t.due_date]) byDate[t.due_date] = []
    byDate[t.due_date].push(t)
  })

  // Build calendar grid
  const firstDay  = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr  = now.toISOString().split('T')[0]

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedTasks = selected ? (byDate[selected] ?? []) : []

  const FILTERS: { v: Filter; label: string; icon: any; color: string }[] = [
    { v: 'all',       label: 'All tasks',       icon: CheckSquare, color: 'var(--brand)'  },
    { v: 'project',   label: 'Project tasks',   icon: FolderOpen,  color: '#7c3aed'       },
    { v: 'one-time',  label: 'One-time tasks',  icon: CheckSquare, color: '#0891b2'       },
    { v: 'recurring', label: 'Recurring tasks', icon: RefreshCw,   color: '#ea580c'       },
  ]

  return (
    <div className="page-container" style={{ display:'flex', gap:20 }}>
      {/* Main calendar */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>Calendar</h1>
            <span style={{ fontSize:18, fontWeight:600, color:'var(--text-secondary)' }}>
              {MONTH_NAMES[month]} {year}
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Filter tabs */}
            <div style={{ display:'flex', gap:2, background:'var(--surface-subtle)', padding:3, borderRadius:8, border:'1px solid var(--border)' }}>
              {FILTERS.map(f => {
                const Icon = f.icon
                return (
                  <button key={f.v} onClick={() => setFilter(f.v)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:6, border:'none',
                      cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'inherit',
                      background: filter===f.v ? '#fff' : 'transparent',
                      color: filter===f.v ? f.color : 'var(--text-muted)',
                      boxShadow: filter===f.v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      transition:'all 0.12s' }}>
                    <Icon style={{ width:11, height:11 }}/>{f.label}
                  </button>
                )
              })}
            </div>
            {/* Nav */}
            <button onClick={prevMonth} style={{ width:30,height:30,borderRadius:7,border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <ChevronLeft style={{ width:14, height:14, color:'var(--text-secondary)' }}/>
            </button>
            <button onClick={goToday} style={{ padding:'5px 12px',borderRadius:7,border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:12,color:'var(--text-primary)',fontFamily:'inherit',fontWeight:500 }}>Today</button>
            <button onClick={nextMonth} style={{ width:30,height:30,borderRadius:7,border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <ChevronRight style={{ width:14, height:14, color:'var(--text-secondary)' }}/>
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:2 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign:'center', padding:'6px 0', fontSize:11, fontWeight:700,
              color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} style={{ minHeight:90, background:'transparent' }}/>
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const dayTasks = byDate[dateStr] ?? []
            const isToday  = dateStr === todayStr
            const isSelected = selected === dateStr
            const isPast   = dateStr < todayStr
            const hasOverdue = dayTasks.some(t => t.status !== 'completed')

            return (
              <div key={dateStr}
                onClick={() => setSelected(isSelected ? null : dateStr)}
                style={{ minHeight:90, padding:'6px', borderRadius:8,
                  border: isSelected ? '2px solid var(--brand)' : isToday ? '2px solid var(--brand-border)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--brand-light)' : isToday ? '#f0fdfa' : 'var(--surface)',
                  cursor: dayTasks.length > 0 ? 'pointer' : 'default',
                  opacity: isPast && !isToday ? 0.75 : 1,
                  transition:'all 0.1s',
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight: isToday?700:500,
                    color: isToday?'var(--brand)':isPast?'var(--text-muted)':'var(--text-primary)',
                    width:20, height:20, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    background: isToday?'var(--brand)':'transparent', color: isToday?'#fff':undefined }}>{day}</span>
                  {dayTasks.length > 0 && (
                    <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:99,
                      background: hasOverdue&&isPast ? '#fef2f2' : 'var(--brand-light)',
                      color: hasOverdue&&isPast ? '#dc2626' : 'var(--brand)' }}>
                      {dayTasks.length}
                    </span>
                  )}
                </div>
                {dayTasks.slice(0, 3).map(t => {
                  const isRec = t.is_recurring
                  const isProjTask = !!t.project_id && !isRec
                  const dotColor = t.projects?.color ?? (isRec ? '#ea580c' : 'var(--brand)')
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:4,
                      padding:'2px 4px', borderRadius:4, marginBottom:2,
                      background: t.status==='completed' ? '#f0fdf4' : 'var(--surface-subtle)',
                      border:'1px solid var(--border-light)', overflow:'hidden' }}>
                      <span style={{ width:5,height:5,borderRadius:'50%',
                        background:dotColor,flexShrink:0 }}/>
                      <span style={{ fontSize:10, color: t.status==='completed'?'var(--text-muted)':'var(--text-primary)',
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                        textDecoration: t.status==='completed'?'line-through':undefined, flex:1 }}>
                        {t.title}
                      </span>
                      {isRec && <RefreshCw style={{ width:7,height:7,color:'#ea580c',flexShrink:0 }}/>}
                      {isProjTask && <FolderOpen style={{ width:7,height:7,color:'#7c3aed',flexShrink:0 }}/>}
                    </div>
                  )
                })}
                {dayTasks.length > 3 && (
                  <div style={{ fontSize:9, color:'var(--text-muted)', paddingLeft:4 }}>+{dayTasks.length-3} more</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day panel */}
      {selected && (
        <div style={{ width:280, flexShrink:0 }}>
          <div style={{ position:'sticky', top:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>
                {new Date(selected+'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })}
              </h3>
              <button onClick={() => setSelected(null)}
                style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',
                  fontSize:16,padding:2,lineHeight:1 }}>✕</button>
            </div>
            {selectedTasks.length === 0 ? (
              <div style={{ padding:'24px 12px', textAlign:'center', color:'var(--text-muted)',
                background:'var(--surface)', borderRadius:10, border:'1px solid var(--border)', fontSize:13 }}>
                No tasks due
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {selectedTasks.map(t => {
                  const ss = STATUS_STYLE[t.status] ?? STATUS_STYLE.todo
                  return (
                    <Link key={t.id} href={t.project_id ? `/projects/${t.project_id}` : '/inbox'}
                      style={{ display:'block', textDecoration:'none', padding:'12px 14px',
                        background:'var(--surface)', border:'1px solid var(--border)',
                        borderRadius:10, borderLeft:`3px solid ${t.projects?.color ?? 'var(--brand)'}`,
                        transition:'all 0.1s' }}
                      onMouseEnter={e=>(e.currentTarget as any).style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'}
                      onMouseLeave={e=>(e.currentTarget as any).style.boxShadow='none'}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                        <p style={{ fontSize:13, fontWeight:500, color: t.status==='completed'?'var(--text-muted)':'var(--text-primary)',
                          textDecoration: t.status==='completed'?'line-through':undefined, flex:1 }}>
                          {t.title}
                        </p>
                        <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, flexShrink:0,
                          background:ss.bg, color:ss.color, fontWeight:500 }}>
                          {t.status.replace('_',' ')}
                        </span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        {t.projects && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:'var(--text-muted)' }}>
                            <span style={{ width:6,height:6,borderRadius:2,background:t.projects.color,display:'inline-block' }}/>
                            {t.projects.name}
                          </span>
                        )}
                        {t.is_recurring && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:'#ea580c' }}>
                            <RefreshCw style={{ width:9,height:9 }}/> Recurring
                          </span>
                        )}
                        <span style={{ fontSize:10, fontWeight:600, color:PRIORITY_COLORS[t.priority]??'#94a3b8', marginLeft:'auto' }}>
                          {t.priority}
                        </span>
                      </div>
                      {t.assignee && (
                        <p style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>→ {t.assignee.name}</p>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
