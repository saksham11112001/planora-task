'use client'
import React from 'react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, Clock, Trash2 } from 'lucide-react'
import { InlineOneTimeTask } from '@/components/tasks/InlineOneTimeTask'
import { CompletionAttachModal } from '@/components/tasks/CompletionAttachModal'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { toast } from '@/store/appStore'
import { fmtDate, isOverdue, todayStr } from '@/lib/utils/format'
import { PRIORITY_CONFIG } from '@/types'
import type { Task } from '@/types'

interface Props {
  tasks:           Task[]
  members:         { id: string; name: string; role?: string }[]
  clients:         { id: string; name: string; color: string }[]
  currentUserId?:  string
  userRole?:       string
  canCreate:       boolean
  canViewAllTasks?: boolean
}

export function InboxView({ tasks, members, clients, currentUserId, userRole, canCreate, canViewAllTasks }: Props) {
  const canManage = ['owner','admin','manager'].includes(userRole ?? '')
  const router    = useRouter()
  const today     = todayStr()

  const [localTasks,      setLocalTasks]      = useState<Task[]>(tasks)
  const [selectedTask,    setSelectedTask]    = useState<Task | null>(null)
  const [checked,         setChecked]         = useState<Set<string>>(new Set())
  const [completing,      setCompleting]      = useState<Set<string>>(new Set())
  const [, startT]                            = useTransition()
  const [expandedTasks,   setExpandedTasks]   = useState<Set<string>>(new Set())
  const [searchQuery,     setSearchQuery]     = useState('')
  const [clientFilter,    setClientFilter]    = useState('')
  const [viewTab,         setViewTab]         = useState<'List'|'Board'>('List')
  const [boardClient,     setBoardClient]     = useState('')
  const [doneBoardExp,    setDoneBoardExp]    = useState(false)
  const [dragTaskId,      setDragTaskId]      = useState<string|null>(null)
  const [dragOverCol,     setDragOverCol]     = useState<string|null>(null)
  const [subtaskMap,      setSubtaskMap]      = useState<Record<string,{id:string;title:string;status:string}[]>>({})
  const [loadingSubtasks, setLoadingSubtasks] = useState<Set<string>>(new Set())
  const [newSubInputs,    setNewSubInputs]    = useState<Record<string,string>>({})
  const [completingTask,  setCompletingTask]  = useState<Task | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['done','overdue']))
  const BOARD_DONE_PAGE = 5

  async function toggleExpand(taskId: string) {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) { next.delete(taskId); return next }
      next.add(taskId); return next
    })
    if (!subtaskMap[taskId]) {
      setLoadingSubtasks(p => new Set(p).add(taskId))
      try {
        const r = await fetch(`/api/tasks?parent_id=${taskId}&limit=50`)
        const d = await r.json()
        setSubtaskMap(p => ({ ...p, [taskId]: d.data ?? [] }))
      } finally {
        setLoadingSubtasks(p => { const s = new Set(p); s.delete(taskId); return s })
      }
    }
  }

  async function toggleSubRow(parentId: string, subId: string, status: string) {
    const newStatus = status === 'completed' ? 'todo' : 'completed'
    setSubtaskMap(p => ({ ...p, [parentId]: (p[parentId]??[]).map(s => s.id===subId ? { ...s, status:newStatus } : s) }))
    const res = await fetch(`/api/tasks/${subId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completed_at: newStatus==='completed' ? new Date().toISOString() : null }),
    })
    if (!res.ok) {
      setSubtaskMap(p => ({ ...p, [parentId]: (p[parentId]??[]).map(s => s.id===subId ? { ...s, status } : s) }))
      toast.error('Could not update subtask')
    } else {
      const r = await fetch(`/api/tasks?parent_id=${parentId}&limit=50`)
      const d = await r.json()
      const fresh = d.data ?? []
      setSubtaskMap(p => ({ ...p, [parentId]: fresh }))
      if (fresh.length > 0 && fresh.every((s:any) => s.status === 'completed')) {
        await fetch(`/api/tasks/${parentId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
        })
        setLocalTasks(prev => prev.map(t => t.id===parentId ? { ...t, status:'completed' } : t))
        toast.success('All subtasks done — task completed! 🎉')
      }
    }
    startT(() => router.refresh())
  }

  async function addSubtaskInline(parentId: string, title: string) {
    if (!title.trim()) return
    const r = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), parent_task_id: parentId, status: 'todo' }),
    })
    const d = await r.json()
    if (r.ok && d.data) setSubtaskMap(p => ({ ...p, [parentId]: [...(p[parentId]??[]), d.data] }))
  }

  async function toggleDone(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    if (task.status === 'completed') {
      setLocalTasks(prev => prev.map(t => t.id===task.id ? { ...t, status:'todo', completed_at:null } : t))
      setSelectedTask(prev => prev?.id===task.id ? { ...prev, status:'todo' } : prev)
      await fetch(`/api/tasks/${task.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'todo', completed_at:null }) })
      startT(() => router.refresh()); return
    }
    if (task.status==='in_review' || task.approval_status==='pending') { toast.info('This task is pending approval.'); return }
    if (task.approval_required) {
      setCompleting(p => new Set(p).add(task.id))
      const res = await fetch(`/api/tasks/${task.id}/approve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ decision:'submit' }) })
      setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
      if (res.ok) {
        setLocalTasks(prev => prev.map(t => t.id===task.id ? { ...t, status:'in_review', approval_status:'pending' } : t))
        toast.success('Submitted for approval ✓')
      } else { toast.error('Could not submit') }
      startT(() => router.refresh()); return
    }
    setLocalTasks(prev => prev.map(t => t.id===task.id ? { ...t, status:'completed', completed_at:new Date().toISOString() } : t))
    setCompleting(p => new Set(p).add(task.id))
    const res = await fetch(`/api/tasks/${task.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'completed', completed_at:new Date().toISOString() }) })
    setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
    if (!res.ok) { setLocalTasks(prev => prev.map(t => t.id===task.id ? { ...t, status:task.status } : t)); toast.error('Failed') }
    else { toast.success('Task completed! ✓'); startT(() => router.refresh()) }
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return
    setLocalTasks(prev => prev.filter(t => t.id!==taskId))
    const res = await fetch(`/api/tasks/${taskId}`, { method:'DELETE' })
    if (!res.ok) { toast.error('Could not delete'); startT(() => router.refresh()) }
    else toast.success('Moved to Trash')
  }

  async function bulkComplete() {
    const ids = [...checked]
    const can = localTasks.filter(t => ids.includes(t.id) && !t.approval_required)
    const needs = localTasks.filter(t => ids.includes(t.id) && t.approval_required)
    await Promise.all(can.map(t => fetch(`/api/tasks/${t.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'completed', completed_at:new Date().toISOString() }) })))
    setChecked(new Set())
    if (can.length) toast.success(can.length + ' tasks completed')
    if (needs.length) toast.info(needs.length + ' task(s) need approval — skipped')
    startT(() => router.refresh())
  }

  async function handleBoardDrop(targetStatus: string) {
    if (!dragTaskId) return
    const task = localTasks.find(t => t.id===dragTaskId)
    if (!task || task.status===targetStatus) { setDragTaskId(null); setDragOverCol(null); return }
    setDragTaskId(null); setDragOverCol(null)
    setLocalTasks(prev => prev.map(t => t.id===dragTaskId ? { ...t, status:targetStatus as any } : t))
    const res = await fetch(`/api/tasks/${dragTaskId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:targetStatus }) })
    if (!res.ok) { setLocalTasks(prev => prev.map(t => t.id===dragTaskId ? { ...t, status:task.status } : t)); toast.error('Could not move task') }
  }

  const visibleTasks = clientFilter ? localTasks.filter(t => (t as any).client?.id===clientFilter) : localTasks
  const overdue  = visibleTasks.filter(t => t.status!=='completed' && isOverdue(t.due_date, t.status))
  const inProg   = visibleTasks.filter(t => t.status!=='completed' && !isOverdue(t.due_date, t.status) && t.approval_status!=='pending')
  const inReview = visibleTasks.filter(t => t.approval_status==='pending')
  const done     = visibleTasks.filter(t => t.status==='completed')
  const filterTasks = (list: Task[]) => !searchQuery.trim() ? list : list.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
  const sections = [
    { key:'overdue', label:'Overdue',          color:'#dc2626', bg:'#fff9f9', tasks:filterTasks(overdue),  addRow:false },
    { key:'inprog',  label:'In progress',      color:'#0d9488', bg:'#fff',   tasks:filterTasks(inProg),   addRow:true  },
    { key:'review',  label:'Pending approval', color:'#7c3aed', bg:'#faf5ff',tasks:filterTasks(inReview), addRow:false },
    { key:'done',    label:'Completed',         color:'#16a34a', bg:'#fff',   tasks:filterTasks(done),     addRow:false },
  ].filter(s => s.tasks.length > 0 || s.addRow)

  const INBOX_BOARD_COLS = [
    { status:'overdue',   label:'Overdue',         color:'#dc2626' },
    { status:'todo',      label:'To do',            color:'var(--text-muted)' },
    { status:'in_review', label:'Pending approval', color:'#7c3aed' },
    { status:'completed', label:'Done',             color:'#16a34a' },
  ]

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`@media(max-width:640px){.hide-mobile{display:none!important}.inbox-task-row{grid-template-columns:36px 22px 1fr 28px!important}}`}</style>

      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', padding:'0 20px', background:'var(--surface)', flexShrink:0 }}>
        {(['List','Board'] as const).map(t => (
          <button key={t} onClick={() => setViewTab(t)}
            style={{ padding:'10px 15px', fontSize:14, fontWeight:500, border:'none', background:'transparent', cursor:'pointer', marginBottom:-1, borderBottom:`2px solid ${viewTab===t?'var(--brand)':'transparent'}`, color:viewTab===t?'var(--brand)':'var(--text-muted)' }}>
            {t}
          </button>
        ))}
      </div>

      {viewTab === 'Board' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {clients.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 20px', borderBottom:'1px solid var(--border-light)', background:'var(--surface)', flexShrink:0 }}>
              <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Client</span>
              <select value={boardClient} onChange={e => setBoardClient(e.target.value)}
                style={{ padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', outline:'none', border:boardClient?'1px solid var(--brand)':'1px solid var(--border)', background:boardClient?'rgba(13,148,136,0.08)':'var(--surface-subtle)', color:boardClient?'var(--brand)':'var(--text-secondary)', fontFamily:'inherit', appearance:'none' }}>
                <option value=''>All clients</option>
                {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select>
              {boardClient && <button onClick={() => setBoardClient('')} style={{ fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>✕</button>}
            </div>
          )}
          <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', padding:'14px 20px', background:'var(--surface-subtle)', display:'flex', gap:12, alignItems:'flex-start' }}>
            {INBOX_BOARD_COLS.map(col => {
              const t2 = todayStr()
              let colTasks = col.status==='overdue'
                ? localTasks.filter(t => !!t.due_date && t.due_date<t2 && !['completed','in_review'].includes(t.status))
                : col.status==='in_review' ? localTasks.filter(t => t.approval_status==='pending'||t.status==='in_review')
                : col.status==='todo' ? localTasks.filter(t => ['todo','in_progress'].includes(t.status) && t.approval_status!=='pending' && !(!!t.due_date && t.due_date<t2))
                : localTasks.filter(t => t.status===col.status && t.approval_status!=='pending')
              if (boardClient) colTasks = colTasks.filter(t => (t as any).client?.id===boardClient)
              const allDone = colTasks
              if (col.status==='completed' && !doneBoardExp) colTasks = colTasks.slice(0, BOARD_DONE_PAGE)
              return (
                <div key={col.status}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col.status) }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => handleBoardDrop(col.status)}
                  style={{ width:260, flexShrink:0, borderRadius:10, overflow:'hidden', maxHeight:'100%', display:'flex', flexDirection:'column', background:dragOverCol===col.status?'var(--brand-light)':'var(--border-light)', border:dragOverCol===col.status?'2px solid var(--brand)':'1px solid var(--border)', transition:'all 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:col.color, flexShrink:0 }}/>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', flex:1 }}>{col.label}</span>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>{colTasks.length}</span>
                  </div>
                  <div style={{ padding:7, display:'flex', flexDirection:'column', gap:6, overflowY:'auto', flex:1 }}>
                    {colTasks.map(task => {
                      const pri = PRIORITY_CONFIG[task.priority]
                      const isDone = task.status==='completed'
                      const ov = !!task.due_date && task.due_date<todayStr()
                      return (
                        <div key={task.id} draggable
                          onDragStart={() => setDragTaskId(task.id)}
                          onDragEnd={() => { setDragTaskId(null); setDragOverCol(null) }}
                          onClick={() => setSelectedTask(selectedTask?.id===task.id ? null : task)}
                          style={{ background:'var(--surface)', borderRadius:8, padding:'9px 10px', cursor:'grab', border:`1px solid ${selectedTask?.id===task.id?'var(--brand)':'var(--border)'}`, opacity:isDone?0.65:dragTaskId===task.id?0.5:1, boxShadow:'0 1px 3px rgba(0,0,0,0.05)', transition:'opacity 0.15s' }}>
                          <div style={{ fontSize:12, fontWeight:500, color:isDone?'var(--text-muted)':'var(--text-primary)', textDecoration:isDone?'line-through':'none', marginBottom:6, lineHeight:1.4 }}>{task.title}</div>
                          {(task as any).client && (
                            <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:5 }}>
                              <span style={{ width:6, height:6, borderRadius:1, background:(task as any).client.color??'#0d9488', display:'inline-block' }}/>
                              <span style={{ fontSize:10, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(task as any).client.name}</span>
                            </div>
                          )}
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:5, fontSize:10, fontWeight:600, background:pri?.bg??'#f8fafc', color:pri?.color??'#94a3b8' }}>{pri?.icon} {task.priority}</span>
                            {task.due_date && <span style={{ fontSize:10, color:ov?'#dc2626':'var(--text-muted)', fontWeight:ov?600:400 }}>{fmtDate(task.due_date)}</span>}
                          </div>
                        </div>
                      )
                    })}
                    {col.status==='completed' && allDone.length>BOARD_DONE_PAGE && (
                      <button onClick={() => setDoneBoardExp(v => !v)}
                        style={{ width:'100%', padding:'7px', fontSize:11, fontWeight:600, color:'var(--text-muted)', background:'transparent', border:'none', cursor:'pointer', borderTop:'1px solid var(--border-light)' }}>
                        {doneBoardExp ? '▲ Show fewer' : `▼ ${allDone.length-BOARD_DONE_PAGE} more`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <TaskDetailPanel task={selectedTask} members={members} clients={clients}
            currentUserId={currentUserId} userRole={userRole}
            onClose={() => setSelectedTask(null)}
            onUpdated={() => { setSelectedTask(null); startT(() => router.refresh()) }}/>
        </div>
      )}

      {viewTab === 'List' && (
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px 12px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', margin:0 }}>One-time tasks</h1>
                {clients.length > 0 && (
                  <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
                    style={{ padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', outline:'none', border:clientFilter?'1px solid var(--brand)':'1px solid var(--border)', background:clientFilter?'rgba(13,148,136,0.08)':'var(--surface-subtle)', color:clientFilter?'var(--brand)':'var(--text-secondary)', fontFamily:'inherit', appearance:'none' }}>
                    <option value=''>All clients</option>
                    {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                  </select>
                )}
                {clientFilter && <button onClick={() => setClientFilter('')} style={{ fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>✕</button>}
              </div>
            </div>

            <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--border-light)', background:'var(--surface-subtle)', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 10px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color:'var(--text-muted)', flexShrink:0 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tasks…"
                  style={{ flex:1, fontSize:13, border:'none', outline:'none', background:'transparent', color:'var(--text-primary)', fontFamily:'inherit' }}/>
                {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:16 }}>×</button>}
              </div>
            </div>

            {localTasks.length > 0 && (
              <div style={{ padding:'6px 16px', borderBottom:'1px solid var(--border-light)', background:'var(--surface-subtle)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', flexShrink:0 }}>
                {overdue.length>0  && <span style={{ fontSize:11, fontWeight:600, color:'#dc2626' }}>⚠ {overdue.length} overdue</span>}
                {inProg.length>0   && <span style={{ fontSize:11, fontWeight:600, color:'#0d9488' }}>● {inProg.length} in progress</span>}
                {inReview.length>0 && <span style={{ fontSize:11, fontWeight:600, color:'#7c3aed' }}>◎ {inReview.length} pending</span>}
                {done.length>0     && <span style={{ fontSize:11, color:'var(--text-muted)' }}>✓ {done.length} done</span>}
                <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:'auto' }}>{localTasks.length} total</span>
              </div>
            )}

            {checked.size > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 20px', background:'#f0fdfa', borderBottom:'1px solid #99f6e4', flexShrink:0 }}>
                <span style={{ fontSize:13, fontWeight:500, color:'#0f766e' }}>{checked.size} selected</span>
                <button onClick={bulkComplete} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 12px', background:'#0d9488', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  <CheckCheck style={{ width:14, height:14 }}/> Mark complete
                </button>
                <button onClick={() => setChecked(new Set())} style={{ padding:'4px 10px', background:'transparent', border:'none', fontSize:12, color:'var(--text-secondary)', cursor:'pointer' }}>Cancel</button>
              </div>
            )}

            <div style={{ flex:1, overflowY:'auto', background:'var(--surface)' }}>
              {canCreate && (
                <div style={{ borderBottom:'1px solid var(--border-light)' }}>
                  <InlineOneTimeTask members={members} clients={clients} currentUserId={currentUserId}
                    onCreated={(newTask) => {
                      if (newTask?.id) setLocalTasks(prev => [{ ...newTask, assignee:members.find(m=>m.id===newTask.assignee_id)??null, client:clients.find(c=>c.id===newTask.client_id)??null } as any, ...prev])
                      startT(() => router.refresh())
                    }}/>
                </div>
              )}

              {sections.map(section => (
                <div key={section.key}>
                  <div
                    onClick={() => setCollapsedSections(p => { const n=new Set(p); n.has(section.key)?n.delete(section.key):n.add(section.key); return n })}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px 8px', cursor:'pointer', userSelect:'none', borderBottom:'1px solid var(--border-light)' }}>
                    <span style={{ fontSize:10, color:'var(--text-muted)', transform:collapsedSections.has(section.key)?'rotate(-90deg)':'none', display:'inline-block', transition:'transform 0.15s' }}>▾</span>
                    <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:section.color }}>{section.label}</span>
                    <span style={{ fontSize:11, fontWeight:700, padding:'1px 7px', borderRadius:99, background:`${section.color}18`, color:section.color, marginLeft:2 }}>{section.tasks.length}</span>
                  </div>
                  {!collapsedSections.has(section.key) && section.tasks.map(task => {
                    const ov       = isOverdue(task.due_date, task.status)
                    const isComp   = task.status==='completed'
                    const client   = (task as any).client as unknown as {id:string;name:string;color:string}|null
                    const pri      = PRIORITY_CONFIG[task.priority]
                    const isPending = task.status==='in_review' || task.approval_status==='pending'
                    return (
                      <div key={task.id}>
                        <div className="inbox-task-row" onClick={() => setSelectedTask(task)}
                          style={{ display:'grid', gridTemplateColumns:'36px 22px 1fr 110px 80px 32px 28px', alignItems:'center', padding:'0 16px', minHeight:48, borderBottom:'1px solid var(--border-light)', cursor:'pointer', background:checked.has(task.id)?'#f0fdfa':section.bg }}>
                          <input type="checkbox" checked={checked.has(task.id)}
                            onChange={() => setChecked(p => { const s=new Set(p); s.has(task.id)?s.delete(task.id):s.add(task.id); return s })}
                            onClick={e => e.stopPropagation()} style={{ width:13, height:13, accentColor:'#0d9488', cursor:'pointer' }}/>
                          <button onClick={e => { e.stopPropagation(); toggleDone(task, e) }}
                            style={{ width:17, height:17, borderRadius:'50%', flexShrink:0, background:isComp?'#0d9488':isPending?'#f5f3ff':'transparent', border:`1.5px solid ${isComp?'#0d9488':isPending?'#7c3aed':ov?'#fca5a5':'#cbd5e1'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:isPending?'default':'pointer', transition:'all 0.15s' }}>
                            {isComp && <svg viewBox="0 0 16 16" fill="none" style={{ width:9, height:9 }}><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            {isPending && !isComp && <Clock style={{ width:8, height:8, color:'#7c3aed' }}/>}
                          </button>
                          <div style={{ minWidth:0, paddingRight:8 }}>
                            <p style={{ fontSize:13, fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', color:isComp?'var(--text-muted)':ov?'#f87171':'var(--text-primary)', textDecoration:isComp?'line-through':'none', margin:0 }}>{task.title}</p>
                            {client && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:'var(--text-muted)' }}><span style={{ width:6, height:6, borderRadius:2, background:client.color, display:'inline-block' }}/>{client.name}</span>}
                          </div>
                          <div className="hide-mobile" style={{ textAlign:'center', fontSize:12, color:ov?'#f87171':task.due_date===today?'var(--brand)':'var(--text-muted)', fontWeight:ov||task.due_date===today?600:400 }}>
                            {task.due_date ? fmtDate(task.due_date) : '—'}
                          </div>
                          <div style={{ display:'flex', justifyContent:'center' }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 6px', borderRadius:4, fontSize:11, fontWeight:500, background:pri?.bg??'#f8fafc', color:pri?.color??'#94a3b8' }}>{pri?.label ?? task.priority}</span>
                          </div>
                          <button onClick={e => { e.stopPropagation(); toggleExpand(task.id) }}
                            style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'2px 4px', borderRadius:4, border:'none', background:expandedTasks.has(task.id)?'var(--brand-light)':'transparent', color:expandedTasks.has(task.id)?'var(--brand)':'var(--text-muted)', fontSize:10, cursor:'pointer' }}>
                            {(subtaskMap[task.id]??[]).length>0 ? (subtaskMap[task.id]??[]).filter((s:any)=>s.status==='completed').length+'/'+(subtaskMap[task.id]??[]).length : '+'}
                          </button>
                          {canManage ? (
                            <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:24, height:24, borderRadius:6, border:'none', background:'transparent', cursor:'pointer', color:'var(--text-muted)', flexShrink:0 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#fef2f2'; (e.currentTarget as HTMLElement).style.color='#dc2626' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--text-muted)' }}>
                              <Trash2 style={{ width:12, height:12 }}/>
                            </button>
                          ) : <div/>}
                        </div>
                        {expandedTasks.has(task.id) && (
                          <div style={{ background:'var(--surface-subtle)', borderBottom:'1px solid var(--border)' }}>
                            {loadingSubtasks.has(task.id) && <div style={{ padding:'6px 58px', fontSize:11, color:'var(--text-muted)' }}>Loading…</div>}
                            {(subtaskMap[task.id]??[]).map((sub:any) => (
                              <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 16px 5px 58px', borderBottom:'1px solid var(--border-light)' }}>
                                <button onClick={() => toggleSubRow(task.id, sub.id, sub.status)}
                                  style={{ width:14, height:14, borderRadius:'50%', flexShrink:0, border:'none', background:sub.status==='completed'?'var(--brand)':'transparent', outline:`2px solid ${sub.status==='completed'?'var(--brand)':'var(--border)'}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  {sub.status==='completed' && <svg viewBox="0 0 10 10" fill="none" style={{ width:8, height:8 }}><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                                </button>
                                <span style={{ flex:1, fontSize:12, color:sub.status==='completed'?'var(--text-muted)':'var(--text-primary)', textDecoration:sub.status==='completed'?'line-through':'none' }}>{sub.title}</span>
                              </div>
                            ))}
                            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 16px 6px 58px' }}>
                              <div style={{ width:14, height:14, borderRadius:'50%', flexShrink:0, border:'1.5px dashed var(--brand)', opacity:0.5 }}/>
                              <input value={newSubInputs[task.id]??''} onChange={e => setNewSubInputs(p => ({ ...p, [task.id]:e.target.value }))}
                                onKeyDown={e => { if (e.key==='Enter' && (newSubInputs[task.id]??'').trim()) { addSubtaskInline(task.id, newSubInputs[task.id]); setNewSubInputs(p => ({ ...p, [task.id]:'' })) } }}
                                placeholder="Add subtask… (Enter)" onClick={e => e.stopPropagation()}
                                style={{ flex:1, fontSize:12, border:'none', outline:'none', background:'transparent', color:'var(--text-primary)' }}/>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}

              {tasks.length === 0 && (
                <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
                  <p style={{ fontSize:14, fontWeight:500, marginBottom:6 }}>No tasks yet</p>
                  <p style={{ fontSize:13 }}>Click &quot;+ Add task&quot; to create your first one-time task</p>
                </div>
              )}
            </div>
          </div>
          {completingTask && (
            <CompletionAttachModal taskId={completingTask.id} taskTitle={completingTask.title}
              onConfirm={async () => {
                const task = completingTask; setCompletingTask(null)
                setCompleting(p => new Set(p).add(task.id))
                setLocalTasks(prev => prev.map(t => t.id===task.id ? { ...t, status:'completed', completed_at:new Date().toISOString() } : t))
                await fetch(`/api/tasks/${task.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'completed', completed_at:new Date().toISOString() }) })
                setCompleting(p => { const s=new Set(p); s.delete(task.id); return s })
                toast.success('Task completed! ✓'); startT(() => router.refresh())
              }}
              onCancel={() => setCompletingTask(null)}/>
          )}
          <TaskDetailPanel task={selectedTask} members={members} clients={clients}
            currentUserId={currentUserId} userRole={userRole}
            onClose={() => setSelectedTask(null)}
            onUpdated={() => { startT(() => router.refresh()) }}/>
        </div>
      )}
    </div>
  )
}
