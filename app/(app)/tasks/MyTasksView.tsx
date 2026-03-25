'use client'
import { useState, useTransition, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import { RefreshCw, CheckCheck, Plus } from 'lucide-react'
import { cn }           from '@/lib/utils/cn'
import { PriorityBadge, Avatar } from '@/components/ui/Badge'
import { TaskDetailPanel }       from '@/components/tasks/TaskDetailPanel'
import { fmtDate, isOverdue, todayStr } from '@/lib/utils/format'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'
import type { Task } from '@/types'

interface Props {
  tasks:         Task[]
  members:       { id: string; name: string }[]
  clients:       { id: string; name: string; color: string }[]
  currentUserId?: string
  userRole?:      string
}

const LIST_SECS = [
  { key:'overdue',   label:'Overdue',    color:'#dc2626', filter:(t:Task,today:string)=> !!t.due_date && t.due_date < today && !['completed','cancelled'].includes(t.status) },
  { key:'today',     label:'Today',      color:'#0d9488', filter:(t:Task,today:string)=> t.due_date === today && !['completed','cancelled'].includes(t.status) },
  { key:'this_week', label:'This week',  color:'var(--text-secondary)', filter:(t:Task,today:string)=> { const d=new Date(t.due_date??''); const end=new Date(today); end.setDate(end.getDate()+7); return !!t.due_date && t.due_date>today && d<=end && !['completed','cancelled'].includes(t.status) } },
  { key:'later',     label:'Later',      color:'var(--text-muted)', filter:(t:Task,today:string)=> { const end=new Date(today); end.setDate(end.getDate()+7); return (t.due_date===null || (!!t.due_date && new Date(t.due_date)>end)) && !['completed','cancelled'].includes(t.status) } },
]
const BOARD_COLS = [
  { status:'todo',        label:'To do',       color:'var(--text-muted)' },
  { status:'in_progress', label:'In progress', color:'#0d9488' },
  { status:'in_review',   label:'In review',   color:'#7c3aed' },
  { status:'completed',   label:'Done',        color:'#16a34a' },
]

export function MyTasksView({ tasks: initialTasks, members, clients, currentUserId, userRole }: Props) {
  const router  = useRouter()
  const [,startT] = useTransition()
  const today = todayStr()

  // ── Local task state for instant optimistic updates ──────────────
  const [tasks,       setTasks]       = useState<Task[]>(initialTasks)
  const [tab,         setTab]         = useState<'List'|'Board'>('List')
  const [selTask,     setSelTask]     = useState<Task | null>(null)
  const [checked,     setChecked]     = useState<Set<string>>(new Set())
  const [completing,  setCompleting]  = useState<Set<string>>(new Set())

  function refresh() {
    startT(() => router.refresh())
  }

  // Optimistic toggle — updates local state instantly then syncs server
  async function toggleDone(taskId: string, status: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    const newStatus = status === 'completed' ? 'todo' : 'completed'

    // Instant local update
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }
      : t
    ))
    // Update selected task panel if open
    setSelTask(prev => prev?.id === taskId ? { ...prev, status: newStatus } : prev)

    setCompleting(p => new Set(p).add(taskId))
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }),
    })
    setCompleting(p => { const s = new Set(p); s.delete(taskId); return s })
    // Background server sync
    refresh()
  }

  async function bulkComplete() {
    const ids = [...checked]
    setTasks(prev => prev.map(t => ids.includes(t.id)
      ? { ...t, status: 'completed', completed_at: new Date().toISOString() }
      : t
    ))
    setChecked(new Set())
    await Promise.all(ids.map(id => fetch(`/api/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    })))
    refresh()
  }

  const Tabs = () => (
    <div style={{ display:'flex', borderBottom:`1px solid var(--border)`, padding:'0 20px',
      background:'var(--surface)', flexShrink:0 }}>
      {(['List','Board'] as const).map(t => (
        <button key={t} onClick={() => setTab(t)}
          style={{ padding:'9px 14px', fontSize:13, fontWeight:500, border:'none',
            background:'transparent', cursor:'pointer', marginBottom:-1,
            borderBottom:`2px solid ${tab===t?'var(--brand)':'transparent'}`,
            color: tab===t ? 'var(--brand)' : 'var(--text-muted)' }}>
          {t}
        </button>
      ))}
    </div>
  )

  // ── LIST VIEW ─────────────────────────────────────────────────────
  if (tab === 'List') return (
    <>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--surface)' }}>
        <Tabs/>

        {/* Bulk bar */}
        {checked.size > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 20px',
            background:'var(--brand-light)', borderBottom:`1px solid var(--brand-border)`, flexShrink:0 }}>
            <span style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)' }}>{checked.size} selected</span>
            <button onClick={bulkComplete}
              style={{ background:'var(--brand)', color:'#fff', border:'none', padding:'4px 12px',
                borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              <CheckCheck style={{width:13,height:13}}/> Mark complete
            </button>
            <button onClick={() => setChecked(new Set())}
              style={{ background:'none', border:'none', fontSize:12, color:'var(--text-muted)', cursor:'pointer' }}>Cancel</button>
          </div>
        )}

        {/* Column headers */}
        <div style={{ display:'grid', gridTemplateColumns:'28px 20px 1fr 150px 95px 105px',
          alignItems:'center', padding:'5px 16px', borderBottom:`1px solid var(--border)`,
          background:'var(--surface)', flexShrink:0, fontSize:10, fontWeight:700,
          color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <div/><div/><div>Task name</div><div>Assignee</div>
          <div style={{textAlign:'center'}}>Due date</div>
          <div style={{textAlign:'center'}}>Priority</div>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {LIST_SECS.map(sec => {
            const secTasks = tasks.filter(t => sec.filter(t, today))
            const completedTasks = tasks.filter(t => t.status === 'completed')
            if (sec.key !== 'overdue' && secTasks.length === 0) return null
            return (
              <div key={sec.key}>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px 3px',
                  fontSize:11, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'0.06em', color: sec.color }}>
                  ▾ {sec.label}
                  <span style={{ opacity:0.4, fontWeight:400, textTransform:'none', fontSize:11 }}>({secTasks.length})</span>
                </div>
                {secTasks.map(task => {
                  const ov = isOverdue(task.due_date, task.status)
                  const assignee = task.assignee as {id:string;name:string}|null
                  return (
                    <div key={task.id}
                      style={{ display:'grid', gridTemplateColumns:'28px 20px 1fr 150px 95px 105px',
                        alignItems:'center', padding:'0 16px', height:40,
                        borderBottom:`1px solid var(--border-light)`,
                        background: checked.has(task.id) ? 'var(--brand-light)' : ov ? '#fff9f9' : 'var(--surface)',
                        cursor:'pointer' }}
                      onClick={() => setSelTask(selTask?.id === task.id ? null : task)}>
                      <input type="checkbox" checked={checked.has(task.id)}
                        onChange={() => setChecked(p => { const s=new Set(p); s.has(task.id)?s.delete(task.id):s.add(task.id); return s })}
                        onClick={e => e.stopPropagation()} style={{ accentColor:'var(--brand)', width:13, height:13 }}/>
                      {/* Check circle */}
                      <div
                        onClick={e => toggleDone(task.id, task.status, e)}
                        style={{ width:16, height:16, borderRadius:'50%',
                          border:`1.5px solid ${task.status==='completed'?'var(--brand)':ov?'#dc2626':'#cbd5e1'}`,
                          background: task.status==='completed' ? 'var(--brand)' : completing.has(task.id) ? '#e2e8f0' : 'transparent',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          cursor:'pointer', transition:'all 0.15s', flexShrink:0 }}>
                        {(task.status==='completed' || completing.has(task.id)) &&
                          <svg viewBox="0 0 10 10" fill="none" style={{width:8,height:8}}>
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>}
                      </div>
                      <div style={{ fontSize:13, color: task.status==='completed'?'#94a3b8':ov?'#dc2626':'var(--text-primary)',
                        textDecoration: task.status==='completed'?'line-through':'none',
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', paddingRight:8 }}>
                        {task.title}
                        {task.is_recurring && <RefreshCw style={{display:'inline',marginLeft:5,width:10,height:10,color:'var(--brand)',verticalAlign:'middle'}}/>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {assignee && <><Avatar name={assignee.name} size="xs"/>
                          <span style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{assignee.name}</span></>}
                      </div>
                      <div style={{ textAlign:'center', fontSize:12,
                        color: task.due_date===today?'var(--brand)':ov?'#dc2626':'var(--text-muted)',
                        fontWeight: (task.due_date===today||ov)?600:400 }}>
                        {task.due_date ? fmtDate(task.due_date) : '—'}
                      </div>
                      <div style={{ display:'flex', justifyContent:'center' }}>
                        <PriorityBadge priority={task.priority}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Completed section */}
          {(() => {
            const done = tasks.filter(t => t.status === 'completed')
            if (!done.length) return null
            return (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px 3px',
                  fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#16a34a' }}>
                  ▾ Completed <span style={{ opacity:0.4, fontWeight:400, textTransform:'none', fontSize:11 }}>({done.length})</span>
                </div>
                {done.map(task => {
                  const assignee = task.assignee as {id:string;name:string}|null
                  return (
                    <div key={task.id}
                      style={{ display:'grid', gridTemplateColumns:'28px 20px 1fr 150px 95px 105px',
                        alignItems:'center', padding:'0 16px', height:40,
                        borderBottom:`1px solid var(--border-light)`,
                        background:'var(--surface)', cursor:'pointer', opacity:0.7 }}
                      onClick={() => setSelTask(selTask?.id === task.id ? null : task)}>
                      <input type="checkbox" checked={checked.has(task.id)}
                        onChange={() => setChecked(p => { const s=new Set(p); s.has(task.id)?s.delete(task.id):s.add(task.id); return s })}
                        onClick={e => e.stopPropagation()} style={{ accentColor:'var(--brand)', width:13, height:13 }}/>
                      <div onClick={e => toggleDone(task.id, task.status, e)}
                        style={{ width:16, height:16, borderRadius:'50%', border:'1.5px solid var(--brand)',
                          background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center',
                          cursor:'pointer', flexShrink:0 }}>
                        <svg viewBox="0 0 10 10" fill="none" style={{width:8,height:8}}>
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-muted)', textDecoration:'line-through',
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', paddingRight:8 }}>
                        {task.title}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {assignee && <><Avatar name={assignee.name} size="xs"/>
                          <span style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{assignee.name}</span></>}
                      </div>
                      <div style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>
                        {task.due_date ? fmtDate(task.due_date) : '—'}
                      </div>
                      <div style={{ display:'flex', justifyContent:'center' }}>
                        <PriorityBadge priority={task.priority}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

      <TaskDetailPanel task={selTask} members={members} clients={clients}
        currentUserId={currentUserId} userRole={userRole}
        onClose={() => setSelTask(null)}
        onUpdated={() => {
          refresh()
          // Also re-sync local state from server after panel updates
          setSelTask(null)
        }}/>
    </>
  )

  // ── BOARD VIEW ─────────────────────────────────────────────────────
  return (
    <>
      <Tabs/>
      <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', padding:'14px 20px',
        background:'var(--surface-subtle)', display:'flex', gap:12, alignItems:'flex-start' }}>
        {BOARD_COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.status)
          return (
            <div key={col.status} style={{ width:268, flexShrink:0, background:'var(--border-light)',
              borderRadius:10, overflow:'hidden', maxHeight:'100%', display:'flex', flexDirection:'column',
              border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'11px 13px',
                borderBottom:`1px solid var(--border)` }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:col.color, flexShrink:0 }}/>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', flex:1 }}>{col.label}</span>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{colTasks.length}</span>
              </div>
              <div style={{ padding:8, display:'flex', flexDirection:'column', gap:7, overflowY:'auto', flex:1 }}>
                {colTasks.map(task => {
                  const assignee = task.assignee as {id:string;name:string}|null
                  const pri = PRIORITY_CONFIG[task.priority]
                  const isDone = col.status === 'completed'
                  return (
                    <div key={task.id}
                      onClick={() => setSelTask(selTask?.id === task.id ? null : task)}
                      style={{ background:'var(--surface)', borderRadius:8, padding:'10px 11px',
                        cursor:'pointer', border:`1px solid ${selTask?.id===task.id?'var(--brand)':'var(--border)'}`,
                        boxShadow: selTask?.id===task.id?'0 0 0 2px var(--brand-light)':'0 1px 3px rgba(0,0,0,0.05)',
                        opacity: isDone ? 0.65 : 1 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:8 }}>
                        {/* Check circle for board cards */}
                        <div onClick={e => toggleDone(task.id, task.status, e)}
                          style={{ width:15, height:15, borderRadius:'50%', flexShrink:0, marginTop:1,
                            background: isDone?'var(--brand)':'transparent',
                            border:`1.5px solid ${isDone?'var(--brand)':isOverdue(task.due_date,task.status)?'#dc2626':'#cbd5e1'}`,
                            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s' }}>
                          {isDone && <svg viewBox="0 0 10 10" fill="none" style={{width:8,height:8}}><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                        </div>
                        <span style={{ fontSize:12.5, fontWeight:500, lineHeight:1.35,
                          color: isDone?'var(--text-muted)':'var(--text-primary)',
                          textDecoration: isDone?'line-through':'none' }}>{task.title}</span>
                      </div>
                      {task.approval_status === 'pending' && (
                        <div style={{ marginBottom:6 }}>
                          <span style={{ fontSize:10, background:'var(--violetL,#f5f3ff)', color:'#7c3aed',
                            padding:'2px 7px', borderRadius:4, fontWeight:500 }}>🔔 Pending approval</span>
                        </div>
                      )}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4,
                          padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:600,
                          background: pri?.bg ?? '#f8fafc', color: pri?.color ?? '#94a3b8' }}>
                          {pri?.icon} {task.priority.charAt(0).toUpperCase()+task.priority.slice(1)}
                        </span>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          {task.due_date && <span style={{ fontSize:10, color:isOverdue(task.due_date,task.status)?'#dc2626':'var(--text-muted)' }}>{fmtDate(task.due_date)}</span>}
                          {task.is_recurring && <RefreshCw style={{width:9,height:9,color:'var(--brand)'}}/>}
                          {assignee && <Avatar name={assignee.name} size="xs"/>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <TaskDetailPanel task={selTask} members={members} clients={clients}
        currentUserId={currentUserId} userRole={userRole}
        onClose={() => setSelTask(null)} onUpdated={refresh}/>
    </>
  )
}
