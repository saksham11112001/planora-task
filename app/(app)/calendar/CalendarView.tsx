'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, RefreshCw, FolderOpen, CheckSquare, Clock, AlertTriangle } from 'lucide-react'

interface CalTask {
  id: string; title: string; status: string; priority: string
  due_date: string; is_recurring: boolean; project_id: string | null
  assignee_id: string | null; frequency: string | null; client_id?: string | null
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
}
type Filter = 'all' | 'project' | 'one-time' | 'recurring'

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

// Color palette for day cells based on task count / status
const DAY_HEAT = ['','rgba(13,148,136,0.08)','rgba(13,148,136,0.16)','rgba(13,148,136,0.24)','rgba(13,148,136,0.34)']

export function CalendarView({ tasks, clients = [], members = [], canViewAll, currentUserId }: Props) {
  const now = new Date()
  const [year,     setYear]     = useState(now.getFullYear())
  const [month,    setMonth]    = useState(now.getMonth())
  const [filter,   setFilter]   = useState<Filter>('all')
  const [selected, setSelected] = useState<string|null>(null)
  const [hovered,       setHovered]       = useState<string|null>(null)
  const [clientFilter,  setClientFilter]  = useState('')
  const [memberFilter,  setMemberFilter]  = useState('')

  function prevMonth() { if (month===0){setYear(y=>y-1);setMonth(11)}else setMonth(m=>m-1) }
  function nextMonth() { if (month===11){setYear(y=>y+1);setMonth(0)}else setMonth(m=>m+1) }
  function goToday()   { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelected(null) }

  const filtered = tasks.filter(t => {
    if (filter==='project')   return !!t.project_id && !t.is_recurring
    if (filter==='one-time')  return !t.project_id && !t.is_recurring
    if (filter==='recurring') return t.is_recurring
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

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const todayStr    = now.toISOString().split('T')[0]

  const cells: (number|null)[] = []
  for (let i=0; i<firstDay; i++) cells.push(null)
  for (let d=1; d<=daysInMonth; d++) cells.push(d)

  const selectedTasks = selected ? (byDate[selected]??[]) : []

  const FILTERS = [
    { v:'all'       as Filter, label:'All',        icon:CheckSquare, color:'#0d9488', bg:'rgba(13,148,136,0.12)' },
    { v:'project'   as Filter, label:'Projects',   icon:FolderOpen,  color:'#7c3aed', bg:'rgba(124,58,237,0.12)' },
    { v:'one-time'  as Filter, label:'One-time',   icon:CheckSquare, color:'#0891b2', bg:'rgba(8,145,178,0.12)' },
    { v:'recurring' as Filter, label:'Recurring',  icon:RefreshCw,   color:'#ea580c', bg:'rgba(234,88,12,0.12)' },
  ]

  // Month-level stats
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const monthTasks = filtered.filter(t => t.due_date?.startsWith(monthStr))
  const overdueCount   = monthTasks.filter(t => t.due_date < todayStr && t.status !== 'completed').length
  const completedCount = monthTasks.filter(t => t.status === 'completed').length
  const pendingCount   = monthTasks.filter(t => t.status !== 'completed').length

  return (
    <div className="page-container" style={{ display:'flex', gap:20, minHeight:'calc(100vh - 120px)' }}>

      {/* ── Main calendar ─────────────────────────────────────── */}
      <div style={{ flex:1, minWidth:0 }}>

        {/* Filter bar — client + member (manager/admin only) */}
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
                  {/* "All" pill */}
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
                background:'var(--surface)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                transition:'all 0.12s' }}
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
                background:'var(--surface)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                transition:'all 0.12s' }}
                onMouseEnter={e=>{(e.currentTarget as any).style.borderColor='var(--brand)';(e.currentTarget as any).style.color='var(--brand)'}}
                onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='var(--border)';(e.currentTarget as any).style.color=''}}>
                <ChevronRight style={{ width:14,height:14 }}/>
              </button>
            </div>
            <h2 style={{ fontSize:20,fontWeight:800,color:'var(--text-primary)',letterSpacing:'-0.3px' }}>
              {MONTH_NAMES[month]} <span style={{ color:'var(--text-muted)',fontWeight:400 }}>{year}</span>
            </h2>
          </div>

          {/* Filter pills */}
          <div style={{ display:'flex', gap:6 }}>
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

        {/* Month stats strip */}
        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          {[
            { label:'Tasks this month', value:monthTasks.length, color:'#0d9488', bg:'rgba(13,148,136,0.1)', border:'rgba(13,148,136,0.25)' },
            { label:'Completed',        value:completedCount,   color:'#16a34a', bg:'rgba(22,163,74,0.1)', border:'rgba(22,163,74,0.25)' },
            { label:'Pending',          value:pendingCount,     color:'#0891b2', bg:'rgba(8,145,178,0.1)', border:'rgba(8,145,178,0.25)' },
            { label:'Overdue',          value:overdueCount,     color: overdueCount>0?'#dc2626':'#94a3b8',
              bg: overdueCount>0?'rgba(220,38,38,0.1)':'var(--surface)', border: overdueCount>0?'rgba(220,38,38,0.25)':'var(--border)' },
          ].map(s => (
            <div key={s.label} style={{ flex:1,padding:'8px 12px',borderRadius:8,
              background:s.bg,border:`1px solid ${s.border}` }}>
              <p style={{ fontSize:18,fontWeight:800,color:s.color,lineHeight:1 }}>{s.value}</p>
              <p style={{ fontSize:10,color:'var(--text-muted)',marginTop:2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Day headers */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:3 }}>
          {DAY_NAMES.map((d,i) => (
            <div key={d} style={{ textAlign:'center',padding:'6px 0',fontSize:11,fontWeight:700,
              color: i===0||i===6 ? '#f87171' : 'var(--text-muted)',
              textTransform:'uppercase',letterSpacing:'0.05em' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3 }}>
          {cells.map((day,i) => {
            if (!day) return <div key={`e-${i}`} style={{ minHeight:100 }}/>
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const dayTasks  = byDate[dateStr] ?? []
            const isToday   = dateStr === todayStr
            const isSelected= selected === dateStr
            const isHovered = hovered === dateStr
            const isPast    = dateStr < todayStr
            const isWeekend = (i % 7 === 0) || (i % 7 === 6)
            const overdueT  = dayTasks.filter(t => t.status !== 'completed')
            const doneT     = dayTasks.filter(t => t.status === 'completed')
            const heatIdx   = Math.min(dayTasks.length, DAY_HEAT.length-1)

            return (
              <div key={dateStr}
                onClick={() => setSelected(isSelected ? null : dateStr)}
                onMouseEnter={() => setHovered(dateStr)}
                onMouseLeave={() => setHovered(null)}
                style={{ minHeight:100, padding:'6px 5px', borderRadius:10,
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
                {/* Day number */}
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

                {/* Task pills */}
                {dayTasks.slice(0,3).map((t,ti) => {
                  const proj   = t.projects
                  const dotClr = proj?.color ?? (t.is_recurring?'#ea580c':STATUS_DOT[t.status]??'var(--brand)')
                  const isDone = t.status==='completed'
                  return (
                    <div key={t.id} style={{ display:'flex',alignItems:'center',gap:3,
                      padding:'2px 5px',borderRadius:5,marginBottom:2,
                      background: isDone?'rgba(22,163,74,0.1)':`${dotClr}15`,
                      border:`1px solid ${dotClr}30`,
                      overflow:'hidden' }}>
                      <span style={{ width:5,height:5,borderRadius:'50%',
                        background:dotClr,flexShrink:0 }}/>
                      <span style={{ fontSize:9,fontWeight:500,
                        color:isDone?'#94a3b8':'var(--text-primary)',
                        overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',flex:1,
                        textDecoration:isDone?'line-through':undefined }}>
                        {t.title}
                      </span>
                      {t.is_recurring&&<RefreshCw style={{width:7,height:7,color:'#ea580c',flexShrink:0}}/>}
                    </div>
                  )
                })}
                {dayTasks.length>3&&(
                  <div style={{ fontSize:9,color:'var(--brand)',fontWeight:600,paddingLeft:4,marginTop:1 }}>
                    +{dayTasks.length-3} more
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display:'flex',alignItems:'center',gap:16,marginTop:14,padding:'8px 0',
          fontSize:11,color:'var(--text-muted)' }}>
          <span style={{ display:'flex',alignItems:'center',gap:4 }}>
            <span style={{ width:10,height:10,borderRadius:2,background:'rgba(13,148,136,0.25)',border:'1px solid rgba(13,148,136,0.3)',display:'inline-block' }}/>
            More tasks = deeper teal
          </span>
          <span style={{ display:'flex',alignItems:'center',gap:4 }}>
            <AlertTriangle style={{ width:10,height:10,color:'#dc2626' }}/> Overdue
          </span>
          <span style={{ display:'flex',alignItems:'center',gap:4 }}>
            <RefreshCw style={{ width:10,height:10,color:'#ea580c' }}/> Recurring
          </span>
        </div>
      </div>

      {/* ── Day panel ─────────────────────────────────────────── */}
      <div style={{ width:300,flexShrink:0 }}>
        <div style={{ position:'sticky',top:16 }}>
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
                <button onClick={()=>setSelected(null)} style={{ background:'none',border:'none',
                  cursor:'pointer',color:'var(--text-muted)',fontSize:18,padding:4,lineHeight:1 }}>✕</button>
              </div>

              {selectedTasks.length===0 ? (
                <div style={{ padding:'28px 16px',textAlign:'center',
                  background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)' }}>
                  <Clock style={{ width:28,height:28,color:'var(--border)',margin:'0 auto 8px' }}/>
                  <p style={{ fontSize:13,color:'var(--text-muted)' }}>No tasks due this day</p>
                </div>
              ) : (
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {selectedTasks.map(t => {
                    const dotClr = t.projects?.color??STATUS_DOT[t.status]??'var(--brand)'
                    const priClr = PRIORITY_COLORS[t.priority]??'#94a3b8'
                    const priBg  = PRIORITY_BG[t.priority]??'#f8fafc'
                    return (
                      <Link key={t.id} href={t.project_id?`/projects/${t.project_id}`:'/inbox'}
                        style={{ display:'block',textDecoration:'none',padding:'12px 14px',
                          background:'var(--surface)',borderRadius:12,
                          borderLeft:`3px solid ${dotClr}`,
                          border:`1px solid var(--border)`,
                          borderLeftColor:dotClr,
                          transition:'all 0.1s' }}
                        onMouseEnter={e=>{(e.currentTarget as any).style.boxShadow='0 2px 10px rgba(0,0,0,0.08)';(e.currentTarget as any).style.transform='translateY(-1px)'}}
                        onMouseLeave={e=>{(e.currentTarget as any).style.boxShadow='';(e.currentTarget as any).style.transform=''}}>
                        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6 }}>
                          <p style={{ fontSize:13,fontWeight:500,
                            color:t.status==='completed'?'var(--text-muted)':'var(--text-primary)',
                            textDecoration:t.status==='completed'?'line-through':undefined,flex:1,lineHeight:1.4 }}>
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
                          <span style={{ display:'inline-flex',alignItems:'center',gap:3,fontSize:10,
                            padding:'1px 6px',borderRadius:4,
                            background:t.status==='completed'?'rgba(22,163,74,0.1)':t.status==='in_progress'?'rgba(13,148,136,0.1)':t.status==='in_review'?'rgba(124,58,237,0.1)':'var(--surface-subtle)',
                            color:STATUS_DOT[t.status]??'#94a3b8',fontWeight:500 }}>
                            <span style={{ width:5,height:5,borderRadius:'50%',background:STATUS_DOT[t.status]??'#94a3b8',display:'inline-block' }}/>
                            {t.status.replace('_',' ')}
                          </span>
                          {t.is_recurring&&(
                            <span style={{ display:'inline-flex',alignItems:'center',gap:3,fontSize:10,color:'#ea580c' }}>
                              <RefreshCw style={{ width:9,height:9 }}/> Recurring
                            </span>
                          )}
                          {t.assignee&&(
                            <span style={{ fontSize:10,color:'var(--text-muted)',marginLeft:'auto' }}>
                              → {t.assignee.name}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding:'28px 16px',textAlign:'center',
              background:'var(--surface)',borderRadius:12,border:'1px dashed var(--border)' }}>
              <div style={{ fontSize:28,marginBottom:8 }}>📅</div>
              <p style={{ fontSize:13,fontWeight:500,color:'var(--text-primary)',marginBottom:4 }}>
                Click any day to see tasks
              </p>
              <p style={{ fontSize:11,color:'var(--text-muted)' }}>
                Teal cells have tasks due that day
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}