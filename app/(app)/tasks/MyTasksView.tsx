'use client'
import React from 'react'
import { useState, useTransition } from 'react'
import { useRouter }    from 'next/navigation'
import { RefreshCw, CheckCheck, Clock, FolderOpen, Trash2 } from 'lucide-react'
import { PriorityBadge, Avatar } from '@/components/ui/Badge'
import { TaskDetailPanel }       from '@/components/tasks/TaskDetailPanel'
import { InlineOneTimeTask }     from '@/components/tasks/InlineOneTimeTask'
import { CompletionAttachModal }  from '@/components/tasks/CompletionAttachModal'
import { fmtDate, isOverdue, todayStr } from '@/lib/utils/format'
import { PRIORITY_CONFIG } from '@/types'
import type { Task } from '@/types'
import { toast, useFilterStore } from '@/store/appStore'
import { UniversalFilterBar } from '@/components/filters/UniversalFilterBar'

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
  { status:'overdue',     label:'Overdue',          color:'#dc2626' },
  { status:'todo',        label:'To do',             color:'var(--text-muted)' },
  { status:'in_review',   label:'Pending approval',  color:'#7c3aed' },
  { status:'completed',   label:'Done',              color:'#16a34a' },
]

// ── Board grouping helpers ──────────────────────────────────────────────────
const PRIO_ORDER: Record<string, number> = { urgent:0, high:1, medium:2, low:3, none:4 }
const GROUP_PAGE = 5   // cards shown per group before "Show more"

function smartSort(a: Task, b: Task): number {
  const pa = PRIO_ORDER[a.priority] ?? 4
  const pb = PRIO_ORDER[b.priority] ?? 4
  if (pa !== pb) return pa - pb
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
  if (a.due_date) return -1
  if (b.due_date) return  1
  return 0
}

function groupByDue(tasks: Task[], today: string) {
  const todayGroup: Task[] = [], weekGroup: Task[] = [], laterGroup: Task[] = []
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
  for (const t of tasks) {
    if (!t.due_date)                         { laterGroup.push(t); continue }
    if (t.due_date === today)                { todayGroup.push(t); continue }
    if (new Date(t.due_date) <= weekEnd)     { weekGroup.push(t);  continue }
    laterGroup.push(t)
  }
  return [
    { key:'today', label:'Due today',          color:'#0d9488',               tasks: todayGroup.sort(smartSort) },
    { key:'week',  label:'Due this week',       color:'var(--text-secondary)', tasks: weekGroup.sort(smartSort)  },
    { key:'later', label:'Later / No due date', color:'var(--text-muted)',     tasks: laterGroup.sort(smartSort) },
  ].filter(g => g.tasks.length > 0)
}

export function MyTasksView({
  tasks: initialTasks,
  pendingApprovalTasks = [],
  members,
  clients,
  currentUserId,
  userRole,
  canCreate = false,
}: Props) {
  const router     = useRouter()
  const [,startT]  = useTransition()
  const today      = todayStr()
  const canManage  = ['owner','admin','manager'].includes(userRole ?? '')

  const [tasks,      setTasks]      = useState<Task[]>(initialTasks)
  const [tab,        setTab]        = useState<'List'|'Board'>('Board')
  const [selTask,    setSelTask]    = useState<Task | null>(null)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [checked,    setChecked]    = useState<Set<string>>(new Set())
  const [completing, setCompleting] = useState<Set<string>>(new Set())
  const [completingTask,  setCompletingTask]  = useState<Task | null>(null)
  
  const [dragOverCol,    setDragOverCol]    = useState<string | null>(null)
  const [doneExpanded,   setDoneExpanded]   = useState(false)
  const [listDoneExpanded, setListDoneExpanded] = useState(false)
  const DONE_PAGE = 5
  const LIST_DONE_PAGE = 5
  const [subtaskMap,     setSubtaskMap]     = useState<Record<string, any[]>>({})
  const [expandedTasks,  setExpandedTasks]  = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [groupPages,      setGroupPages]      = useState<Record<string, number>>({})

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }
  function groupPage(key: string) { return groupPages[key] ?? 1 }
  function showMoreGroup(key: string) { setGroupPages(prev => ({ ...prev, [key]: (prev[key] ?? 1) + 1 })) }

  // Global filters (My Tasks never filters by assignee — already scoped to current user)
  const { clientId: filterClient, priority: filterPriority, status: filterStatus, search: filterSearch, dueDateFrom, dueDateTo } = useFilterStore()

  // Apply filters
  const filteredTasks = tasks.filter(t => {
    if (filterClient   && (t as any).client?.id !== filterClient) return false
    if (filterPriority && t.priority !== filterPriority)          return false
    if (filterStatus   && t.status   !== filterStatus)            return false
    if (filterSearch   && !t.title.toLowerCase().includes(filterSearch.toLowerCase())) return false
    if (dueDateFrom    && (!t.due_date || t.due_date < dueDateFrom)) return false
    if (dueDateTo      && (!t.due_date || t.due_date > dueDateTo))   return false
    return true
  })

  // Subtasks load lazily on user click only

  function refresh() { startT(() => router.refresh()) }

  // Universal toggle: ALL tasks go through approval (no direct completion by anyone)
  async function toggleDone(task: Task, e?: React.MouseEvent) {
    e?.stopPropagation()

    // Reopen: completed or in_review → back to todo
    if (task.status === 'completed' || task.status === 'in_review') {
      const snapshot = tasks.map(t => t)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'todo', completed_at: null, approval_status: null } : t))
      setSelTask(prev => prev?.id === task.id ? { ...prev, status: 'todo', completed_at: null, approval_status: null } : prev)
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'todo', completed_at: null }),
      })
      if (!res.ok) {
        setTasks(snapshot)
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? 'Could not reopen task')
      }
      return
    }

    // Already pending approval → inform user
    if (task.approval_status === 'pending') {
      toast.info('This task is already pending approval — waiting for your approver.')
      return
    }

    // All tasks: submit for approval (in_review)
    setCompleting(p => new Set(p).add(task.id))
    // Optimistic: immediately move to pending
    setTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, status: 'in_review', approval_status: 'pending' } : t))
    setSelTask(prev => prev?.id === task.id
      ? { ...prev, status: 'in_review', approval_status: 'pending' } : prev)

    const res = await fetch(`/api/tasks/${task.id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'submit' }),
    })
    setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
    if (res.ok) {
      toast.success('Submitted for approval ✓')
    } else {
      // Rollback optimistic update on failure
      setTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, status: task.status, approval_status: task.approval_status ?? null } : t))
      setSelTask(prev => prev?.id === task.id
        ? { ...prev, status: task.status, approval_status: task.approval_status ?? null } : prev)
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Could not submit — please try again')
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

    // Dragging to completed or in_review → always submit for approval
    if (newStatus === 'completed' || newStatus === 'in_review') {
      setDragTaskId(null); setDragOverCol(null)
      // Optimistic: show as pending immediately
      setTasks(prev => prev.map(t => t.id === dragTaskId
        ? { ...t, status: 'in_review' as any, approval_status: 'pending' } : t))
      const res = await fetch(`/api/tasks/${dragTaskId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'submit' }),
      })
      if (res.ok) {
        toast.success('Submitted for approval ✓')
      } else {
        // Rollback
        setTasks(prev => prev.map(t => t.id === dragTaskId
          ? { ...t, status: task.status as any, approval_status: task.approval_status ?? null } : t))
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? 'Could not submit for approval')
      }
      return
    }

    // Other transitions (e.g. reopen from review → todo) — plain PATCH
    setTasks(prev => prev.map(t => t.id === dragTaskId ? { ...t, status: newStatus as any } : t))
    setDragTaskId(null)
    setDragOverCol(null)

    const patchBody: any = { status: newStatus }
    if (newStatus === 'in_progress') patchBody.completed_at = null

    const res = await fetch(`/api/tasks/${dragTaskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    })
    if (!res.ok) {
      setTasks(prev => prev.map(t => t.id === dragTaskId ? { ...t, status: task.status as any } : t))
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Could not move task')
    } else {
      toast.success(`Moved to ${newStatus.replace('_', ' ')}`)
    }
  }

  async function bulkComplete() {
    const ids = [...checked]
    // ALL selected tasks → submit for approval (in_review)
    const toSubmit = tasks.filter(t =>
      ids.includes(t.id) && t.status !== 'in_review' && t.approval_status !== 'pending'
    )
    setChecked(new Set())
    // Optimistic: mark all as pending
    setTasks(prev => prev.map(t =>
      toSubmit.find(s => s.id === t.id)
        ? { ...t, status: 'in_review', approval_status: 'pending' } as any
        : t
    ))
    const results = await Promise.all(toSubmit.map(t => fetch(`/api/tasks/${t.id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'submit' }),
    })))
    const failed = results.filter(r => !r.ok).length
    if (toSubmit.length - failed > 0) toast.success(`${toSubmit.length - failed} task(s) submitted for approval ✓`)
    if (failed > 0) toast.error(`${failed} task(s) could not be submitted`)
  }

  // Approve or reject a task (for managers/approvers)
  async function handleApproveDecision(taskId: string, decision: 'approve' | 'reject') {
    // Optimistic update
    const task = tasks.find(t => t.id === taskId)
    const newStatus = decision === 'approve' ? 'completed' : 'todo'
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, status: newStatus as any, approval_status: decision === 'approve' ? 'approved' : null,
          completed_at: decision === 'approve' ? new Date().toISOString() : null } : t))
    setSelTask(prev => prev?.id === taskId
      ? { ...prev, status: newStatus as any, approval_status: decision === 'approve' ? 'approved' : null } : prev)

    const res = await fetch(`/api/tasks/${taskId}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    if (res.ok) {
      toast.success(decision === 'approve' ? 'Task approved ✓' : 'Task returned to assignee')
    } else {
      // Rollback
      if (task) {
        setTasks(prev => prev.map(t => t.id === taskId ? task : t))
        setSelTask(prev => prev?.id === taskId ? task : prev)
      }
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

  // Circle button: pending approval shows purple clock; completed shows green tick; others show submit-for-approval on click
  function CircleBtn({ task }: { task: Task }) {
    const isPending = task.approval_status === 'pending' || task.status === 'in_review'
    const isDone    = task.status === 'completed'
    const isComp    = completing.has(task.id)
    const ov        = isOverdue(task.due_date, task.status)

    if (isPending) return (
      <div onClick={e => toggleDone(task, e)} title="Pending approval — click to reopen"
        style={{ width:16, height:16, borderRadius:'50%', flexShrink:0,
          border:'1.5px solid #7c3aed', background:'rgba(124,58,237,0.1)',
          display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <Clock style={{ width:8, height:8, color:'#7c3aed' }}/>
      </div>
    )
    return (
      <div onClick={e => toggleDone(task, e)}
        title={isDone ? 'Mark incomplete' : 'Submit for approval'}
        style={{ width:16, height:16, borderRadius:'50%', flexShrink:0,
          border:`1.5px solid ${isDone?'var(--brand)':ov?'#dc2626':'#cbd5e1'}`,
          background: isDone?'var(--brand)':isComp?'var(--border)':'transparent',
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
              <CheckCheck style={{width:13,height:13}}/> Submit for approval
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
                          background: sub.status==='completed' ? 'rgba(13,148,136,0.1)' : 'var(--surface-subtle)',
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

        {/* Universal filter bar */}
        <UniversalFilterBar clients={clients} showSearch showPriority showStatus showDueDate/>
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
                          {isPending && <span style={{ flexShrink:0, fontSize:11, background:'rgba(124,58,237,0.12)',
                            color:'#7c3aed', padding:'1px 5px', borderRadius:3, fontWeight:500 }}>
                            Pending
                          </span>}
                        </div>
                        {/* Assignor (approver) + Client inline */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2, flexWrap:'wrap' }}>
                          {(task as any).approver && (
                            <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3, overflow:'hidden', whiteSpace:'nowrap' }}>
                              <span style={{ color:'var(--text-muted)', opacity:0.6 }}>Assignor:</span>
                              <span style={{ color:'var(--text-secondary)', fontWeight:500 }}>{(task as any).approver.name}</span>
                            </div>
                          )}
                          {(task as any).client && (
                            <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3, overflow:'hidden', whiteSpace:'nowrap' }}>
                              <span style={{ width:5, height:5, borderRadius:'50%',
                                background:(task as any).client?.color??'#ccc', display:'inline-block', flexShrink:0 }}/>
                              <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{(task as any).client?.name}</span>
                            </div>
                          )}
                          {(task as any).project && !((task as any).client) && (
                            <div style={{ fontSize:11, color:'var(--text-muted)',
                              display:'flex', alignItems:'center', gap:3, overflow:'hidden', whiteSpace:'nowrap' }}>
                              <span style={{ width:5, height:5, borderRadius:1,
                                background:(task as any).project?.color??'#7c3aed', display:'inline-block', flexShrink:0 }}/>
                              <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{(task as any).project?.name}</span>
                            </div>
                          )}
                        </div>
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
                            (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.1)'
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

          {/* Completed — paginated to LIST_DONE_PAGE */}
          {(() => {
            const allDone = filteredTasks.filter(t => t.status === 'completed')
            if (!allDone.length) return null
            const visibleDone = listDoneExpanded ? allDone : allDone.slice(0, LIST_DONE_PAGE)
            const hiddenCount = allDone.length - LIST_DONE_PAGE
            return (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'13px 18px 5px',
                  fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#16a34a' }}>
                  <button onClick={() => setListDoneExpanded(v => !v)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#16a34a',
                      display:'flex', alignItems:'center', gap:4, padding:0, fontFamily:'inherit', fontWeight:700 }}>
                    {listDoneExpanded ? '▾' : '▸'} Completed
                    <span style={{ opacity:0.4, fontWeight:400, textTransform:'none' }}>({allDone.length})</span>
                  </button>
                  {!listDoneExpanded && allDone.length > LIST_DONE_PAGE && (
                    <span style={{ fontSize:10, color:'#16a34a', opacity:0.6, fontWeight:400, textTransform:'none' }}>
                      showing {LIST_DONE_PAGE} of {allDone.length}
                    </span>
                  )}
                </div>
                {listDoneExpanded && visibleDone.map(task => {
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
                {/* Collapsed view — show just count with expand prompt */}
                {!listDoneExpanded && (
                  <button onClick={() => setListDoneExpanded(true)}
                    style={{ width:'100%', padding:'10px 18px', fontSize:12, fontWeight:500,
                      color:'#16a34a', background:'rgba(22,163,74,0.04)', border:'none',
                      borderTop:'1px solid rgba(22,163,74,0.1)', cursor:'pointer',
                      display:'flex', alignItems:'center', gap:6, fontFamily:'inherit',
                      borderBottom:'1px solid var(--border-light)' }}>
                    <span style={{ width:16, height:16, borderRadius:'50%', background:'rgba(22,163,74,0.15)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, flexShrink:0 }}>
                      ✓
                    </span>
                    {allDone.length} completed task{allDone.length !== 1 ? 's' : ''}
                    {hiddenCount > 0 && ` · click to expand`}
                  </button>
                )}
                {listDoneExpanded && allDone.length > LIST_DONE_PAGE && (
                  <button onClick={() => setListDoneExpanded(false)}
                    style={{ width:'100%', padding:'8px 18px', fontSize:11, fontWeight:500,
                      color:'var(--text-muted)', background:'transparent', border:'none',
                      borderTop:'1px solid var(--border-light)', cursor:'pointer', fontFamily:'inherit' }}>
                    ▲ Collapse completed
                  </button>
                )}
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
      {/* Universal filter bar (no assignee — My Tasks is already user-scoped) */}
      <UniversalFilterBar clients={clients} showSearch showPriority showDueDate/>
      <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', padding:'14px 20px',
        background:'var(--surface-subtle)', display:'flex', gap:12, alignItems:'flex-start' }}>
        {BOARD_COLS.map(col => {
          const today2 = todayStr()
          // Build base list for this column
          let colTasks = col.status === 'overdue'
            ? tasks.filter(t => !!t.due_date && t.due_date < today2
                && !['completed','cancelled','in_review'].includes(t.status)
                && t.approval_status !== 'pending')
            : col.status === 'in_review'
            ? tasks.filter(t => t.status === 'in_review' || t.approval_status === 'pending')
            : tasks.filter(t => t.status === col.status && t.approval_status !== 'pending'
                && !(!!t.due_date && t.due_date < today2 && t.status !== 'completed'))

          // Apply global filters
          if (filterClient)   colTasks = colTasks.filter(t => (t as any).client?.id === filterClient)
          if (filterPriority) colTasks = colTasks.filter(t => t.priority === filterPriority)
          if (filterSearch)   colTasks = colTasks.filter(t => t.title.toLowerCase().includes(filterSearch.toLowerCase()))
          if (dueDateFrom)    colTasks = colTasks.filter(t => t.due_date && t.due_date >= dueDateFrom)
          if (dueDateTo)      colTasks = colTasks.filter(t => t.due_date && t.due_date <= dueDateTo)

          // Determine whether to render groups (todo + pending) or flat (overdue + done)
          const useGroups = col.status === 'todo' || col.status === 'in_review'
          const groups     = useGroups ? groupByDue(colTasks, today2) : []

          // Paginate done column (flat)
          const allDoneTasks = colTasks
          const flatTasks    = (col.status === 'completed' && !doneExpanded)
            ? colTasks.slice(0, DONE_PAGE)
            : colTasks

          // Total count for column header
          const totalCount = colTasks.length

          // ── Shared task card renderer ──────────────────────────────────────
          const TaskCard = ({ task }: { task: Task }) => {
            const assignee = task.assignee as {id:string;name:string}|null
            const pri = PRIORITY_CONFIG[task.priority]
            const isDone = task.status === 'completed'
            const isPending = task.status === 'in_review' || task.approval_status === 'pending'
            const ov = isOverdue(task.due_date, task.status)
            return (
              <div
                draggable
                onDragStart={() => handleDragStart(task.id)}
                onDragEnd={() => { setDragTaskId(null); setDragOverCol(null) }}
                onClick={() => setSelTask(selTask?.id === task.id ? null : task)}
                style={{ background:'var(--surface)', borderRadius:8, padding:'10px 11px',
                  cursor:'grab',
                  border:`1px solid ${dragTaskId===task.id?'var(--brand)':selTask?.id===task.id?'var(--brand)':isPending?'#ddd6fe':'var(--border)'}`,
                  boxShadow: dragTaskId===task.id ? '0 4px 14px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
                  opacity: isDone ? 0.65 : dragTaskId===task.id ? 0.5 : 1,
                  transform: dragTaskId===task.id ? 'scale(1.02)' : 'none',
                  transition: 'opacity 0.15s, transform 0.1s' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:8 }}>
                  {isPending
                    ? <div style={{ width:15, height:15, borderRadius:'50%', flexShrink:0, marginTop:1,
                        background:'rgba(124,58,237,0.1)', border:'1.5px solid #7c3aed',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Clock style={{ width:8, height:8, color:'#7c3aed' }}/>
                      </div>
                    : <div onClick={e => toggleDone(task, e)}
                        style={{ width:15, height:15, borderRadius:'50%', flexShrink:0, marginTop:1,
                          background: isDone?'var(--brand)':'transparent',
                          border:`1.5px solid ${isDone?'var(--brand)':ov?'#dc2626':'#cbd5e1'}`,
                          display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s' }}>
                        {isDone && <svg viewBox="0 0 10 10" fill="none" style={{width:8,height:8}}><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                      </div>
                  }
                  <span style={{ fontSize:13, fontWeight:500, lineHeight:1.4,
                    color: isDone?'var(--text-muted)':isPending?'#7c3aed':ov?'#dc2626':'var(--text-primary)',
                    textDecoration: isDone?'line-through':'none' }}>{task.title}</span>
                </div>
                {(task as any).client && (
                  <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                    <span style={{ width:7, height:7, borderRadius:2, flexShrink:0, display:'inline-block',
                      background:(task as any).client.color ?? '#0d9488' }}/>
                    <span style={{ fontSize:10, color:'var(--text-muted)', overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>
                      {(task as any).client.name}
                    </span>
                  </div>
                )}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4,
                    padding:'3px 8px', borderRadius:5, fontSize:11, fontWeight:600,
                    background: pri?.bg ?? '#f8fafc', color: pri?.color ?? '#94a3b8' }}>
                    {task.priority.charAt(0).toUpperCase()+task.priority.slice(1)}
                  </span>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    {task.due_date && (
                      <span style={{ fontSize:11, color: ov?'#dc2626':'var(--text-muted)' }}>
                        {fmtDate(task.due_date)}
                      </span>
                    )}
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
          }

          return (
            <div key={col.status}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.status) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.status)}
              style={{ width:272, flexShrink:0, borderRadius:10, overflow:'hidden',
                maxHeight:'100%', display:'flex', flexDirection:'column',
                background: dragOverCol === col.status ? 'var(--brand-light)' : 'var(--border-light)',
                border: dragOverCol === col.status ? '2px solid var(--brand)' : '1px solid var(--border)',
                transition: 'all 0.15s' }}>

              {/* Column header */}
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'11px 13px',
                borderBottom:`1px solid var(--border)`, flexShrink:0 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:col.color, flexShrink:0 }}/>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', flex:1 }}>{col.label}</span>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{totalCount}</span>
              </div>

              <div style={{ padding:8, display:'flex', flexDirection:'column', gap:7, overflowY:'auto', flex:1 }}>
                {useGroups ? (
                  /* ── Grouped columns: To do & Pending approval ── */
                  groups.length === 0
                    ? <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Nothing here</p>
                    : groups.map(grp => {
                        const gKey = `${col.status}-${grp.key}`
                        const isCollapsed = collapsedGroups.has(gKey)
                        const page = groupPage(gKey)
                        const visible = grp.tasks.slice(0, page * GROUP_PAGE)
                        const hasMore = grp.tasks.length > visible.length
                        return (
                          <div key={grp.key}>
                            {/* Group header */}
                            <button
                              onClick={() => toggleGroup(gKey)}
                              style={{ width:'100%', display:'flex', alignItems:'center', gap:5,
                                padding:'4px 2px 4px 0', background:'none', border:'none',
                                cursor:'pointer', marginBottom: isCollapsed ? 0 : 4 }}>
                              <span style={{ fontSize:10, color: isCollapsed ? 'var(--text-muted)' : grp.color,
                                transition:'transform 0.15s', display:'inline-block',
                                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
                              <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
                                letterSpacing:'0.06em', color: isCollapsed ? 'var(--text-muted)' : grp.color }}>
                                {grp.label}
                              </span>
                              <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:'auto' }}>
                                {grp.tasks.length}
                              </span>
                            </button>

                            {!isCollapsed && (
                              <>
                                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                  {visible.map(task => <TaskCard key={task.id} task={task}/>)}
                                </div>
                                {hasMore && (
                                  <button onClick={() => showMoreGroup(gKey)}
                                    style={{ width:'100%', padding:'6px 0', fontSize:11, fontWeight:600,
                                      color:'var(--text-muted)', background:'transparent', border:'none',
                                      cursor:'pointer', marginTop:4 }}>
                                    ▼ {grp.tasks.length - visible.length} more
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })
                ) : (
                  /* ── Flat columns: Overdue & Done ── */
                  <>
                    {flatTasks.map(task => <TaskCard key={task.id} task={task}/>)}
                    {col.status === 'completed' && allDoneTasks.length > DONE_PAGE && (
                      <button onClick={() => setDoneExpanded(v => !v)}
                        style={{ width:'100%', padding:'8px', fontSize:11, fontWeight:600,
                          color:'var(--text-muted)', background:'transparent', border:'none',
                          cursor:'pointer', borderTop:'1px solid var(--border-light)', marginTop:2 }}>
                        {doneExpanded ? `▲ Show fewer` : `▼ ${allDoneTasks.length - DONE_PAGE} more`}
                      </button>
                    )}
                  </>
                )}
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