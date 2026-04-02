'use client'
import React from 'react'
import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter }    from 'next/navigation'
import { RefreshCw, CheckCheck, Clock, FolderOpen, Filter, X, Trash2 } from 'lucide-react'
import { cn }           from '@/lib/utils/cn'
import { PriorityBadge, Avatar } from '@/components/ui/Badge'
import { TaskDetailPanel }       from '@/components/tasks/TaskDetailPanel'
import { InlineOneTimeTask }     from '@/components/tasks/InlineOneTimeTask'
import { CompletionAttachModal }  from '@/components/tasks/CompletionAttachModal'
import { fmtDate, isOverdue, todayStr } from '@/lib/utils/format'
import { PRIORITY_CONFIG } from '@/types'
import type { Task } from '@/types'
import { toast } from '@/store/appStore'

interface Props {
  tasks:               Task[]
  pendingApprovalTasks?: Task[]
  members:       { id: string; name: string }[]
  clients:       { id: string; name: string; color: string }[]
  currentUserId?: string
  userRole?:      string
  canCreate?:     boolean
}

const LIST_SECS = [
  { key:'overdue',   label:'Overdue',     color:'#dc2626',
    filter:(t:Task,today:string)=> !!t.due_date && t.due_date < today && !['completed','cancelled'].includes(t.status) && t.status !== 'in_review' },
  { key:'review',    label:'Pending approval', color:'#7c3aed',
    filter:(t:Task)=> t.approval_status === 'pending' || t.status === 'in_review' },
  { key:'today',     label:'Today',       color:'#0d9488',
    filter:(t:Task,today:string)=> t.due_date === today && !['completed','cancelled','in_review'].includes(t.status) && t.approval_status !== 'pending' },
  { key:'this_week', label:'This week',   color:'var(--text-secondary)',
    filter:(t:Task,today:string)=>{ const d=new Date(t.due_date??''); const end=new Date(today); end.setDate(end.getDate()+7); return !!t.due_date && t.due_date>today && d<=end && !['completed','cancelled','in_review'].includes(t.status) && t.approval_status !== 'pending' } },
  { key:'later',     label:'Later',       color:'var(--text-muted)',
    filter:(t:Task,today:string)=>{ const end=new Date(today); end.setDate(end.getDate()+7); return (t.due_date===null || (!!t.due_date && new Date(t.due_date)>end)) && !['completed','cancelled','in_review'].includes(t.status) && t.approval_status !== 'pending' } },
]
const BOARD_COLS = [
  { status:'todo',        label:'To do',       color:'var(--text-muted)' },
  { status:'in_progress', label:'In progress', color:'#0d9488' },
  { status:'in_review',   label:'Pending approval', color:'#7c3aed' },
  { status:'completed',   label:'Done',        color:'#16a34a' },
]

export function MyTasksView({ tasks: initialTasks, pendingApprovalTasks = [], members, clients, currentUserId, userRole }: Props) {
  const router     = useRouter()
  const [,startT]  = useTransition()
  const today      = todayStr()
  const canManage  = ['owner','admin','manager'].includes(userRole ?? '')

  const [tasks,      setTasks]      = useState<Task[]>(initialTasks)
  const [tab,        setTab]        = useState<'List'|'Board'>('List')
  const [selTask,    setSelTask]    = useState<Task | null>(null)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOver,   setDragOver]   = useState<string | null>(null)
  const [checked,    setChecked]    = useState<Set<string>>(new Set())
  const [completing, setCompleting] = useState<Set<string>>(new Set())
  const [completingTask,  setCompletingTask]  = useState<Task | null>(null)
  
  const [dragOverCol,    setDragOverCol]    = useState<string | null>(null)
  const [subtaskMap,     setSubtaskMap]     = useState<Record<string, any[]>>({})
  const [expandedTasks,  setExpandedTasks]  = useState<Set<string>>(new Set())
  const [filterPriority, setFilterPriority] = useState('')
  const [filterClient,   setFilterClient]   = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterOpen,     setFilterOpen]     = useState(false)

  // Apply filters
  const filteredTasks = tasks.filter(t => {
    if (filterClient && (t as any).client?.id !== filterClient) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (filterStatus   && t.status   !== filterStatus)   return false
    return true
  })
  const activeFilters = [filterPriority, filterStatus].filter(Boolean).length

  // Subtasks load lazily on user click only

  function refresh() { startT(() => router.refresh()) }

  // Smart toggle: approval-required tasks go to "in review" instead of completed
  async function toggleDone(task: Task, e?: React.MouseEvent) {
    e?.stopPropagation()

    // If currently completed → reopen as todo
    if (task.status === 'completed') {
      // Optimistic: instantly mark as todo
      const snapshot = tasks.map(t => t)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'todo', completed_at: null } : t))
      setSelTask(prev => prev?.id === task.id ? { ...prev, status: 'todo' } : prev)
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'todo', completed_at: null }),
      })
      if (!res.ok) {
        setTasks(snapshot) // revert
        toast.error('Could not reopen task')
      } else {
        refresh()
      }
      return
    }

    // If in_review already → no action (must be approved by approver)
    if (task.status === 'in_review' || task.approval_status === 'pending') {
      toast.info('This task is pending approval — waiting for your approver.')
      return
    }

    // Needs approval → check subtasks first, then submit for review
    if (task.approval_required) {
      setCompleting(p => new Set(p).add(task.id))
      const res = await fetch(`/api/tasks/${task.id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'submit' }),
      })
      setCompleting(p => { const s=new Set(p); s.delete(task.id); return s })
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === task.id
          ? { ...t, status: 'in_review', approval_status: 'pending' } : t))
        setSelTask(prev => prev?.id === task.id
          ? { ...prev, status: 'in_review', approval_status: 'pending' } : prev)
        toast.success('Submitted for approval ✓')
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? 'Could not submit — please try again')
      }
      refresh(); return
    }

    // Only show attachment modal for CA compliance tasks that require it
    // Regular tasks complete immediately without forcing an attachment
    const hasComplianceSubtasks = task.custom_fields?._compliance_subtask
    const isCACompliance = !!(task as any).custom_fields?._ca_compliance
    
    if (hasComplianceSubtasks || isCACompliance) {
      setCompletingTask(task)
    } else {
      // Regular task — complete directly without attachment requirement
      setCompleting(p => new Set(p).add(task.id))
      setTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t))
      setSelTask(prev => prev?.id === task.id
        ? { ...prev, status: 'completed', completed_at: new Date().toISOString() } : prev)
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
      })
      setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
      if (res.ok) {
        toast.success('Done! ✅')
        refresh()
      } else {
        const snapshot = tasks.map(t => t)
        setTasks(snapshot)
        toast.error('Could not complete task')
      }
    }
  }

  function handleDragStart(taskId: string) {
    setDragTaskId(taskId)
  }

  async function handleDrop(targetStatus: string) {
    if (!dragTaskId) return
    const task = tasks.find(t => t.id === dragTaskId)
    if (!task || task.status === targetStatus) { setDragTaskId(null); setDragOverCol(null); return }
    
    // Map board column status to actual task status
    const statusMap: Record<string, string> = {
      'todo': 'todo', 'in_progress': 'in_progress',
      'in_review': 'in_review', 'completed': 'completed',
    }
    const newStatus = statusMap[targetStatus] ?? targetStatus

    // Don't allow dragging to completed if approval required
    if (newStatus === 'completed' && task.approval_required && task.approval_status !== 'approved') {
      toast.error('This task requires approval before completion')
      setDragTaskId(null); setDragOverCol(null); return
    }

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === dragTaskId
      ? { ...t, status: newStatus as any, approval_status: newStatus === 'in_review' ? 'pending' : t.approval_status }
      : t
    ))
    setDragTaskId(null)
    setDragOverCol(null)
    
    const patchBody: any = { status: newStatus }
    if (newStatus === 'completed') patchBody.completed_at = new Date().toISOString()
    if (newStatus === 'in_progress') patchBody.completed_at = null
    
    const res = await fetch(`/api/tasks/${dragTaskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    })
    if (!res.ok) {
      setTasks(prev => prev.map(t => t.id === dragTaskId ? { ...t, status: task.status as any } : t))
      toast.error('Could not move task')
    } else {
      toast.success(`Moved to ${targetStatus.replace('_', ' ')}`)
      refresh()
    }
  }

  async function bulkComplete() {
    const ids = [...checked]
    // Only complete tasks that don't need approval
    const canComplete = tasks.filter(t => ids.includes(t.id) && !t.approval_required)
    const needsApproval = tasks.filter(t => ids.includes(t.id) && t.approval_required)
    const bulkSnapshot = tasks.map(t => t) // snapshot for rollback
    setTasks(prev => prev.map(t =>
      canComplete.find(c => c.id === t.id)
        ? { ...t, status: 'completed', completed_at: new Date().toISOString() }
        : t
    ))
    setChecked(new Set())
    const results = await Promise.all(canComplete.map(t => fetch(`/api/tasks/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    })))
    if (needsApproval.length)
      toast.info(`${needsApproval.length} task(s) require approval and were skipped`)
    refresh()
  }

  // Approve or reject a task (for managers/approvers)
  async function handleApproveDecision(taskId: string, decision: 'approve' | 'reject') {
    const res = await fetch(`/api/tasks/${taskId}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    if (res.ok) {
      toast.success(decision === 'approve' ? 'Task approved ✓' : 'Task returned to assignee')
      refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Action failed')
    }
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task? It will move to Trash.')) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete task')
      refresh()
    } else {
      toast.success('Moved to Trash')
    }
  }

  // Circle button appearance based on state
  function CircleBtn({ task }: { task: Task }) {
    const isPending = task.approval_status === 'pending' || task.status === 'in_review'
    const isDone    = task.status === 'completed'
    const isComp    = completing.has(task.id)
    const ov        = isOverdue(task.due_date, task.status)

    if (isPending) return (
      <div title="Pending approval"
        style={{ width:16, height:16, borderRadius:'50%', flexShrink:0,
          border:'1.5px solid #7c3aed', background:'#f5f3ff',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Clock style={{ width:8, height:8, color:'#7c3aed' }}/>
      </div>
    )
    return (
      <div onClick={e => toggleDone(task, e)}
        style={{ width:16, height:16, borderRadius:'50%', flexShrink:0,
          border:`1.5px solid ${isDone?'var(--brand)':ov?'#dc2626':'#cbd5e1'}`,
          background: isDone?'var(--brand)':isComp?'#e2e8f0':'transparent',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', transition:'all 0.15s' }}>
        {(isDone||isComp) && <svg viewBox="0 0 10 10" fill="none" style={{width:8,height:8}}>
          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>}
      </div>
    )
  }

  const Tabs = () => (
    <div style={{ display:'flex', borderBottom:`1px solid var(--border)`, padding:'0 20px',
      background:'var(--surface)', flexShrink:0 }}>
      {(['List','Board'] as const).map(t => (
        <button key={t} onClick={() => setTab(t)}
          style={{ padding:'10px 15px', fontSize:14, fontWeight:500, border:'none',
            background:'transparent', cursor:'pointer', marginBottom:-1,
            borderBottom:`2px solid ${tab===t?'var(--brand)':'transparent'}`,
            color: tab===t?'var(--brand)':'var(--text-muted)' }}>
          {t}
        </button>
      ))}
    </div>
  )

  if (tab === 'List') return (
    <>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--surface)' }}>
        <Tabs/>

        {/* ── Quick add task bar at top of list ── */}
        {canCreate && (
          <div style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--surface)' }}>
            <InlineOneTimeTask
              members={members} clients={clients} currentUserId={currentUserId}
              onCreated={(newTask) => {
                if (newTask?.id) {
                  const enriched = {
                    ...newTask, description: null, project_id: null, project: null,
                    is_archived: false, created_at: '', approval_required: false,
                    completed_at: null, is_recurring: false, estimated_hours: null,
                    approval_status: null, approver: null, approver_id: null,
                    assignee: members.find(m => m.id === newTask.assignee_id) ?? null,
                    client: clients.find(cl => cl.id === newTask.client_id) ?? null,
                  }
                  setTasks(prev => [enriched as any, ...prev])
                }
                refresh()
              }}
            />
          </div>
        )}

        {checked.size > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 20px',
            background:'var(--brand-light)', borderBottom:`1px solid var(--brand-border)`, flexShrink:0 }}>
            <span style={{ fontSize:13, fontWeight:500, color:'var(--brand-dark)' }}>{checked.size} selected</span>
            <button onClick={bulkComplete}
              style={{ background:'var(--brand)', color:'#fff', border:'none', padding:'6px 14px',
                borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              <CheckCheck style={{width:13,height:13}}/> Mark complete
            </button>
            <button onClick={() => setChecked(new Set())}
              style={{ background:'none', border:'none', fontSize:12, color:'var(--text-muted)', cursor:'pointer' }}>
              Cancel
            </button>
          </div>
        )}
        {/* ── Needs your approval section ─────────────────────────── */}
        {pendingApprovalTasks.length > 0 && (
          <div style={{ borderBottom:'2px solid #7c3aed', marginBottom:0 }}>
            {/* Section header */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px 8px',
              background:'var(--pending-surface, #faf5ff)' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#7c3aed',
                textTransform:'uppercase', letterSpacing:'0.06em' }}>
                🔔 Needs your approval
              </span>
              <span style={{ fontSize:11, background:'#7c3aed', color:'#fff',
                borderRadius:99, padding:'1px 8px', fontWeight:600 }}>
                {pendingApprovalTasks.length}
              </span>
            </div>
            {/* Approval task rows */}
            {pendingApprovalTasks.map(task => {
              const assignee = task.assignee as {id:string;name:string}|null
              const ov = isOverdue(task.due_date, task.status)
              return (
                <React.Fragment key={task.id}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 140px 100px 110px 200px',
                  alignItems:'center', padding:'0 18px', minHeight:52,
                  borderBottom:'1px solid var(--border-light)',
                  background:'var(--pending-surface, #faf5ff)',
                  cursor:'pointer' }}
                  onClick={() => setSelTask(selTask?.id === task.id ? null : task)}>
                  {/* Title */}
                  <div style={{ minWidth:0, paddingRight:12 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)',
                      overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                      {task.title}
                    </div>
                    {assignee && (
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2,
                        display:'flex', alignItems:'center', gap:4 }}>
                        <span>Submitted by {assignee.name}</span>
                        {task.client_id && (task as any).client && (
                          <>
                            <span>·</span>
                            <span style={{ width:6, height:6, borderRadius:1,
                              background:(task as any).client?.color ?? '#ccc', display:'inline-block' }}/>
                            <span>{(task as any).client?.name}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Assignee */}
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {assignee && <><Avatar name={assignee.name} size="xs"/>
                      <span style={{ fontSize:12, color:'var(--text-muted)',
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{assignee.name}</span>
                    </>}
                  </div>
                  {/* Due date */}
                  <div style={{ textAlign:'center', fontSize:13,
                    color: ov ? '#dc2626' : 'var(--text-muted)', fontWeight: ov ? 600 : 400 }}>
                    {task.due_date ? fmtDate(task.due_date) : '—'}
                  </div>
                  {/* Priority */}
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <PriorityBadge priority={task.priority}/>
                  </div>
                  {/* Approve / Reject buttons */}
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleApproveDecision(task.id, 'approve')}
                      style={{ padding:'6px 16px', borderRadius:8, border:'none', cursor:'pointer',
                        background:'#0d9488', color:'#fff', fontSize:12, fontWeight:600,
                        fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
                      ✓ Approve
                    </button>
                    <button onClick={() => handleApproveDecision(task.id, 'reject')}
                      style={{ padding:'6px 16px', borderRadius:8, cursor:'pointer', fontSize:12,
                        fontWeight:600, fontFamily:'inherit', display:'flex', alignItems:'center', gap:4,
                        border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text-secondary)' }}>
                      ✕ Return
                    </button>
                  </div>
                </div>
                {/* Subtasks if any */}
                {expandedTasks.has(task.id) && (subtaskMap[task.id] ?? []).length > 0 && (
                  <div style={{ background:'var(--surface-subtle)', borderBottom:'1px solid var(--border-light)' }}>
                    {(subtaskMap[task.id] ?? []).map((sub: any) => (
                      <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8,
                        padding:'5px 18px 5px 60px', borderBottom:'1px solid var(--border-light)' }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', flexShrink:0,
                          background: sub.status==='completed' ? 'var(--brand)' : 'transparent',
                          outline: '2px solid ' + (sub.status==='completed' ? 'var(--brand)' : 'var(--border)') }}/>
                        <span style={{ flex:1, fontSize:12,
                          color: sub.status==='completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: sub.status==='completed' ? 'line-through' : 'none' }}>{sub.title}</span>
                        <span style={{ fontSize:11, padding:'1px 8px', borderRadius:99,
                          background: sub.status==='completed' ? 'rgba(13,148,136,0.1)' : '#f1f5f9',
                          color: sub.status==='completed' ? 'var(--brand)' : 'var(--text-muted)' }}>
                          {sub.status === 'completed' ? '✓ Done' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* Client filter bar */}
        {clients && clients.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 18px',
            borderBottom:'1px solid var(--border-light)', background:'var(--surface)', flexShrink:0 }}>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Client</span>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
              style={{ padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', outline:'none',
                border: filterClient ? '1px solid var(--brand)' : '1px solid var(--border)',
                background: filterClient ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)',
                color: filterClient ? 'var(--brand)' : 'var(--text-secondary)',
                fontWeight: filterClient ? 600 : 400, fontFamily:'inherit', appearance:'none', paddingRight:20 }}>
              <option value=''>All clients</option>
              {(clients ?? []).map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
            </select>
            {filterClient && <button onClick={() => setFilterClient('')}
              style={{ fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>
              ✕ Clear
            </button>}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'28px 22px 1fr 160px 100px 110px',
          alignItems:'center', padding:'8px 18px', borderBottom:`1px solid var(--border)`,
          background:'var(--surface-subtle)', flexShrink:0, fontSize:11, fontWeight:700,
          color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <div/><div/><div>Task name</div><div>Assignee</div>
          <div style={{textAlign:'center'}}>Due date</div>
          <div style={{textAlign:'center'}}>Priority</div>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {LIST_SECS.map(sec => {
            const secTasks = filteredTasks.filter(t => sec.filter(t, today))
            if (secTasks.length === 0) return null
            return (
              <div key={sec.key}>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'13px 18px 5px',
                  fontSize:11, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'0.06em', color:sec.color }}>
                  ▾ {sec.label}
                  <span style={{ opacity:0.4, fontWeight:400, textTransform:'none', fontSize:11 }}>({secTasks.length})</span>
                </div>
                {secTasks.map(task => {
                  const ov = isOverdue(task.due_date, task.status)
                  const assignee = task.assignee as {id:string;name:string}|null
                  const isPending = task.approval_status === 'pending' || task.status === 'in_review'
                  return (
                    <React.Fragment key={task.id}>
                    <div
                      className="mytasks-row" style={{ display:'grid', gridTemplateColumns:'28px 22px 1fr 160px 100px 110px',
                        alignItems:'center', padding:'0 18px', minHeight:48,
                        borderBottom:`1px solid var(--border-light)`,
                        background: checked.has(task.id) ? 'var(--brand-light)'
                          : isPending ? 'var(--pending-surface, #faf5ff)' : ov ? 'var(--overdue-surface, #fff9f9)' : 'var(--surface)',
                        cursor:'pointer' }}
                      onClick={() => setSelTask(selTask?.id === task.id ? null : task)}>
                      <input type="checkbox" checked={checked.has(task.id)}
                        onChange={() => setChecked(p => { const s=new Set(p); s.has(task.id)?s.delete(task.id):s.add(task.id); return s })}
                        onClick={e => e.stopPropagation()} style={{ accentColor:'var(--brand)', width:13, height:13 }}/>
                      <CircleBtn task={task}/>
                      <div style={{ minWidth:0, overflow:'hidden' }}>
                        <div style={{ fontSize:13,
                          color: task.status==='completed'?'#94a3b8':isPending?'#7c3aed':ov?'#dc2626':'var(--text-primary)',
                          textDecoration: task.status==='completed'?'line-through':'none',
                          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                          display:'flex', alignItems:'center', gap:6 }}>
                          {task.is_recurring && <RefreshCw style={{ flexShrink:0, width:11, height:11, color:'var(--brand)', marginRight:2 }} title="Recurring task"/>}
                          {task.project_id && !task.is_recurring && <FolderOpen style={{ flexShrink:0, width:11, height:11, color:'#7c3aed', marginRight:2 }} title="Project task"/>}
                          <span className="task-title" style={{ overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', flex:1 }}>{task.title}</span>
                          {isPending && <span style={{ flexShrink:0, fontSize:11, background:'#ede9fe',
                            color:'#7c3aed', padding:'1px 5px', borderRadius:3, fontWeight:500 }}>
                            Pending
                          </span>}
                        </div>
                        {(task as any).project && (
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1,
                            display:'flex', alignItems:'center', gap:3, overflow:'hidden', whiteSpace:'nowrap' }}>
                            <span style={{ width:5, height:5, borderRadius:1,
                              background:(task as any).project?.color??'#7c3aed', display:'inline-block', flexShrink:0 }}/>
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{(task as any).project?.name}</span>
                          </div>
                        )}
                        {/* Mobile: show due date + priority inline */}
                        <div className="show-mobile-meta" style={{ display:'none', alignItems:'center', gap:6, marginTop:2 }}>
                          {task.due_date && <span style={{ fontSize:10, color:ov?'#dc2626':'var(--text-muted)', fontWeight:ov?600:400 }}>{fmtDate(task.due_date)}</span>}
                          {task.priority && task.priority!=='none' && <span style={{ fontSize:10, fontWeight:600, color:
                            task.priority==='urgent'?'#dc2626':task.priority==='high'?'#ea580c':task.priority==='medium'?'#ca8a04':'#16a34a' }}>
                            {task.priority}
                          </span>}
                        </div>
                      </div>
                      <div className="hide-mobile" style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {assignee && <><Avatar name={assignee.name} size="xs"/>
                          <span style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{assignee.name}</span></>}
                      </div>
                      <div className="hide-mobile" style={{ textAlign:'center', fontSize:13,
                        color: task.due_date===today?'var(--brand)':ov?'#dc2626':'var(--text-muted)',
                        fontWeight: (task.due_date===today||ov)?600:400 }}>
                        {task.due_date ? fmtDate(task.due_date) : '—'}
                      </div>
                      <div className="hide-mobile" style={{ display:'flex', justifyContent:'center' }}>
                        <PriorityBadge priority={task.priority}/>
                      </div>
                    </div>
                    {/* Inline subtasks */}
                    {expandedTasks.has(task.id) && (subtaskMap[task.id] ?? []).length > 0 && (
                      <div style={{ background:'var(--surface-subtle)', borderBottom:'1px solid var(--border-light)' }}>
                        {(subtaskMap[task.id] ?? []).map((sub: any) => (
                          <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8,
                            padding:'5px 18px 5px 60px', borderBottom:'1px solid var(--border-light)' }}>
                            <button onClick={async e => {
                              e.stopPropagation()
                              const newStatus = sub.status === 'completed' ? 'todo' : 'completed'
                              // Only CA compliance subtasks require attachment
                              if (newStatus === 'completed' && sub.custom_fields?._compliance_subtask) {
                                const ar = await fetch(`/api/tasks/${sub.id}/attachments`)
                                const ad = await ar.json().catch(() => ({ data: [] }))
                                if ((ad.data ?? []).length === 0) {
                                  toast.error('📎 Upload the required document before completing this CA compliance subtask')
                                  return
                                }
                              }
                              setSubtaskMap(p => ({ ...p, [task.id]: (p[task.id]??[]).map(s => s.id===sub.id?{...s,status:newStatus}:s) }))
                              await fetch(`/api/tasks/${sub.id}`, {
                                method:'PATCH', headers:{'Content-Type':'application/json'},
                                body: JSON.stringify({ status: newStatus, completed_at: newStatus==='completed'?new Date().toISOString():null })
                              })
                            }}
                              style={{ width:14, height:14, borderRadius:'50%', border:'none', flexShrink:0, cursor:'pointer',
                                background: sub.status==='completed'?'var(--brand)':'transparent',
                                outline:`2px solid ${sub.status==='completed'?'var(--brand)':'var(--border)'}`,
                                display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                              {sub.status==='completed' && (
                                <svg viewBox="0 0 10 10" fill="none" style={{width:8,height:8}}>
                                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                              )}
                            </button>
                            <span style={{ flex:1, fontSize:12,
                              color: sub.status==='completed'?'var(--text-muted)':'var(--text-primary)',
                              textDecoration: sub.status==='completed'?'line-through':'none' }}>{sub.title}</span>
                            {sub.status !== 'completed' && (
                              <label style={{ cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center',
                                gap:4, padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600,
                                background:'rgba(13,148,136,0.1)', color:'var(--brand)',
                                border:'1px solid rgba(13,148,136,0.3)' }} onClick={e => e.stopPropagation()}>
                                <input type="file" style={{ display:'none' }}
                                  onChange={async e => {
                                    const file = e.target.files?.[0]; if (!file) return
                                    const fd = new FormData(); fd.append('file', file)
                                    const res = await fetch(`/api/tasks/${sub.id}/attachments`, { method:'POST', body: fd })
                                    if (res.ok) toast.success(`✓ Uploaded: ${file.name}`)
                                    else toast.error('Upload failed')
                                    e.target.value = ''
                                  }}/>
                                ↑ Upload
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Delete button — managers only, hover to reveal */}
                    {canManage && (
                      <div style={{ display:'flex', justifyContent:'flex-end', padding:'0 18px 4px' }}
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => deleteTask(task.id)}
                          title="Delete task"
                          style={{
                            opacity: 0, transition: 'opacity 0.15s',
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 6, border: 'none',
                            background: 'transparent', cursor: 'pointer',
                            color: 'var(--text-muted)', fontSize: 11, fontFamily: 'inherit',
                          }}
                          className="delete-task-btn"
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = '#fef2f2'
                            ;(e.currentTarget as HTMLElement).style.color = '#dc2626'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent'
                            ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                          }}>
                          <Trash2 style={{ width: 11, height: 11 }}/> Delete
                        </button>
                      </div>
                    )}
                    </React.Fragment>
                  )
                })}
              </div>
            )
          })}

          {/* Completed */}
          {(() => {
            const done = filteredTasks.filter(t => t.status === 'completed')
            if (!done.length) return null
            return (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'13px 18px 5px',
                  fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#16a34a' }}>
                  ▾ Completed <span style={{ opacity:0.4, fontWeight:400, textTransform:'none', fontSize:11 }}>({done.length})</span>
                </div>
                {done.map(task => {
                  const assignee = task.assignee as {id:string;name:string}|null
                  return (
                    <React.Fragment key={task.id}>
                    <div
                      className="mytasks-row" style={{ display:'grid', gridTemplateColumns:'28px 22px 1fr 160px 100px 110px',
                        alignItems:'center', padding:'0 18px', minHeight:48,
                        borderBottom:`1px solid var(--border-light)`,
                        background:'var(--surface)', cursor:'pointer', opacity:0.7 }}
                      onClick={() => setSelTask(selTask?.id === task.id ? null : task)}>
                      <input type="checkbox" checked={checked.has(task.id)}
                        onChange={() => setChecked(p => { const s=new Set(p); s.has(task.id)?s.delete(task.id):s.add(task.id); return s })}
                        onClick={e => e.stopPropagation()} style={{ accentColor:'var(--brand)', width:13, height:13 }}/>
                      <CircleBtn task={task}/>
                      <div style={{ fontSize:13, color:'var(--text-muted)', textDecoration:'line-through',
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', paddingRight:8 }}>
                        {task.title}
                      </div>
                      <div className="hide-mobile" style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {assignee && <><Avatar name={assignee.name} size="xs"/>
                          <span style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{assignee.name}</span></>}
                      </div>
                      <div style={{ textAlign:'center', fontSize:13, color:'var(--text-muted)' }}>
                        {task.due_date ? fmtDate(task.due_date) : '—'}
                      </div>
                      <div className="hide-mobile" style={{ display:'flex', justifyContent:'center' }}>
                        <PriorityBadge priority={task.priority}/>
                      </div>
                    </div>
                    </React.Fragment>
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
        onUpdated={() => { refresh(); setSelTask(null) }}/>
    </>
  )

  // Drag & drop: update task status when dropped to new column
  async function handleDrop(newStatus: string) {
    if (!dragTaskId || !newStatus) return
    const task = tasks.find(t => t.id === dragTaskId)
    if (!task || task.status === newStatus) return
    setDragTaskId(null)
    setDragOver(null)
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === dragTaskId ? { ...t, status: newStatus as any } : t))
    const res = await fetch(`/api/tasks/${dragTaskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === dragTaskId ? { ...t, status: task.status } : t))
      toast.error('Could not move task')
    } else {
      refresh()
    }
  }

  // BOARD VIEW
  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .hide-mobile { display: none !important; }
          .mytasks-row, .mytasks-header {
            grid-template-columns: 28px 22px 1fr 32px !important;
          }
          .show-mobile-meta { display: flex !important; }
        }
      `}</style>
      {completingTask && (
        <CompletionAttachModal
          taskId={completingTask.id}
          taskTitle={completingTask.title}
          onConfirm={async () => {
            const task = completingTask
            setCompletingTask(null)
            setCompleting(p => new Set(p).add(task.id))
            setTasks(prev => prev.map(t => t.id === task.id
              ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t))
            setSelTask(prev => prev?.id === task.id
              ? { ...prev, status: 'completed', completed_at: new Date().toISOString() } : prev)
            await fetch(`/api/tasks/${task.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
            })
            setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
            toast.success('Task done! 🎉')
            refresh()
          }}
          onCancel={() => setCompletingTask(null)}
        />
      )}
      <Tabs/>
      <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', padding:'14px 20px',
        background:'var(--surface-subtle)', display:'flex', gap:12, alignItems:'flex-start' }}>
        {BOARD_COLS.map(col => {
          const colTasks = tasks.filter(t =>
            col.status === 'in_review'
              ? (t.status === 'in_review' || t.approval_status === 'pending')
              : t.status === col.status && t.approval_status !== 'pending'
          )
          return (
            <div key={col.status}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.status) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.status)}
              style={{ width:268, flexShrink:0, borderRadius:10, overflow:'hidden',
                maxHeight:'100%', display:'flex', flexDirection:'column',
                background: dragOverCol === col.status ? 'var(--brand-light)' : 'var(--border-light)',
                border: dragOverCol === col.status ? '2px solid var(--brand)' : '1px solid var(--border)',
                transition: 'all 0.15s' }}>
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
                  const isDone = task.status === 'completed'
                  const isPending = task.status === 'in_review' || task.approval_status === 'pending'
                  return (
                    <div key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onDragEnd={() => { setDragTaskId(null); setDragOverCol(null) }}
                      onClick={() => setSelTask(selTask?.id === task.id ? null : task)}
                      style={{ background:'var(--surface)', borderRadius:8, padding:'10px 11px',
                        cursor:'grab', border:`1px solid ${dragTaskId===task.id?'var(--brand)':selTask?.id===task.id?'var(--brand)':isPending?'#ddd6fe':'var(--border)'}`,
                        boxShadow: dragTaskId===task.id ? '0 4px 14px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
                        opacity: isDone ? 0.65 : dragTaskId===task.id ? 0.5 : 1,
                        transform: dragTaskId===task.id ? 'scale(1.02)' : 'none',
                        transition: 'opacity 0.15s, transform 0.1s' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:8 }}>
                        {isPending
                          ? <div style={{ width:15, height:15, borderRadius:'50%', flexShrink:0, marginTop:1,
                              background:'#f5f3ff', border:'1.5px solid #7c3aed',
                              display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <Clock style={{ width:8, height:8, color:'#7c3aed' }}/>
                            </div>
                          : <div onClick={e => toggleDone(task, e)}
                              style={{ width:15, height:15, borderRadius:'50%', flexShrink:0, marginTop:1,
                                background: isDone?'var(--brand)':'transparent',
                                border:`1.5px solid ${isDone?'var(--brand)':isOverdue(task.due_date,task.status)?'#dc2626':'#cbd5e1'}`,
                                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s' }}>
                              {isDone && <svg viewBox="0 0 10 10" fill="none" style={{width:8,height:8}}><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                            </div>
                        }
                        <span style={{ fontSize:13, fontWeight:500, lineHeight:1.4,
                          color: isDone?'var(--text-muted)':isPending?'#7c3aed':'var(--text-primary)',
                          textDecoration: isDone?'line-through':'none' }}>{task.title}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4,
                          padding:'3px 8px', borderRadius:5, fontSize:11, fontWeight:600,
                          background: pri?.bg ?? '#f8fafc', color: pri?.color ?? '#94a3b8' }}>
                          {pri?.icon} {task.priority.charAt(0).toUpperCase()+task.priority.slice(1)}
                        </span>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          {task.due_date && <span style={{ fontSize:11, color:isOverdue(task.due_date,task.status)?'#dc2626':'var(--text-muted)' }}>{fmtDate(task.due_date)}</span>}
                          {task.is_recurring && <RefreshCw style={{width:9,height:9,color:'var(--brand)'}}/>}
                          {assignee && <Avatar name={assignee.name} size="xs"/>}
                          {canManage && (
                            <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                              title="Delete" style={{ background:'none', border:'none', cursor:'pointer',
                                color:'var(--text-muted)', padding:2, display:'flex', alignItems:'center' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}>
                              <Trash2 style={{width:10,height:10}}/>
                            </button>
                          )}
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
