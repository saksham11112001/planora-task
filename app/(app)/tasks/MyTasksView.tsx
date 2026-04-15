'use client'
import React from 'react'
import { useState, useTransition } from 'react'
import { useRouter }    from 'next/navigation'
import { RefreshCw, CheckCheck, CheckCircle2, Clock, FolderOpen, Trash2, User, SortAsc } from 'lucide-react'
import { PriorityBadge, Avatar } from '@/components/ui/Badge'
import { TaskDetailPanel }       from '@/components/tasks/TaskDetailPanel'
import { InlineOneTimeTask }     from '@/components/tasks/InlineOneTimeTask'
import { CompletionAttachModal }  from '@/components/tasks/CompletionAttachModal'
import { fmtDate, isOverdue, todayStr } from '@/lib/utils/format'
import { PRIORITY_CONFIG } from '@/types'
import type { Task } from '@/types'
import { toast, useFilterStore } from '@/store/appStore'
import { UniversalFilterBar } from '@/components/filters/UniversalFilterBar'

interface UpcomingCATrigger {
  id: string; title: string; triggerDate: string; dueDate: string
  clientId: string | null; clientName: string | null; clientColor: string | null
  assigneeId: string | null; priority: string
}

interface Props {
  tasks:               Task[]
  pendingApprovalTasks?: Task[]
  assignedByMeTasks?:  Task[]
  isManager?:          boolean
  members:       { id: string; name: string }[]
  clients:       { id: string; name: string; color: string }[]
  currentUserId?: string
  userRole?:      string
  canCreate?:     boolean
  upcomingCATriggers?: UpcomingCATrigger[]
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
  { status:'in_progress', label:'In progress',       color:'#0d9488' },
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

function CATriggerSection({ triggers }: { triggers: UpcomingCATrigger[] }) {
  const [expanded, setExpanded] = React.useState(true)
  return (
    <div style={{ borderBottom:'1px solid var(--border-light)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 18px 5px',
        fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#d97706' }}>
        <button onClick={() => setExpanded(v => !v)}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'#d97706',
            display:'flex', alignItems:'center', gap:4, padding:0, fontFamily:'inherit', fontWeight:700 }}>
          {expanded ? '▾' : '▸'} ⏰ CA tasks triggering soon
          <span style={{ opacity:0.5, fontWeight:400, textTransform:'none' }}>({triggers.length})</span>
        </button>
        <span style={{ fontSize:10, color:'#d97706', opacity:0.6, fontWeight:400, textTransform:'none', marginLeft:4 }}>
          next 3 days
        </span>
      </div>
      {expanded && triggers.map(ct => (
        <div key={ct.id} style={{
          display:'grid', gridTemplateColumns:'18px 1fr 90px 90px 80px',
          gap:0, alignItems:'center', padding:'6px 18px',
          borderLeft:'3px dashed #d97706',
          background:'rgba(234,179,8,0.04)',
          borderBottom:'1px solid rgba(234,179,8,0.1)',
          opacity:0.85,
        }}>
          <span style={{ fontSize:9, fontWeight:700, color:'#d97706' }}>⏰</span>
          <div style={{ overflow:'hidden' }}>
            <span style={{ fontSize:12, fontWeight:500, color:'#d97706',
              overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', display:'block' }}>
              {ct.title}
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4, paddingLeft:4 }}>
            {ct.clientColor && <span style={{ width:6, height:6, borderRadius:2, background:ct.clientColor, flexShrink:0 }}/>}
            <span style={{ fontSize:11, color:'#a16207', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
              {ct.clientName ?? '—'}
            </span>
          </div>
          <div style={{ fontSize:11, color:'#a16207', paddingLeft:4 }}>
            Due {ct.dueDate}
          </div>
          <div style={{ fontSize:10, color:'#a16207', fontStyle:'italic', textAlign:'right' }}>
            spawns {ct.triggerDate}
          </div>
        </div>
      ))}
    </div>
  )
}

export function MyTasksView({
  tasks: initialTasks,
  pendingApprovalTasks = [],
  assignedByMeTasks = [],
  isManager: isManagerProp = false,
  members,
  clients,
  currentUserId,
  userRole,
  canCreate = false,
  upcomingCATriggers = [],
}: Props) {
  const router     = useRouter()
  const [,startT]  = useTransition()
  const today      = todayStr()
  const canManage  = ['owner','admin','manager'].includes(userRole ?? '')

  const [tasks,           setTasks]           = useState<Task[]>(initialTasks)
  const [pendingTasks,    setPendingTasks]    = useState<Task[]>(pendingApprovalTasks)
  const [assignedByMeList, setAssignedByMeList] = useState<Task[]>(assignedByMeTasks)
  const [tab,          setTab]          = useState<'List'|'Board'>('Board')
  const [selTask,    setSelTask]    = useState<Task | null>(null)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [checked,    setChecked]    = useState<Set<string>>(new Set())
  const [completing, setCompleting] = useState<Set<string>>(new Set())
  const [completingTask,  setCompletingTask]  = useState<Task | null>(null)
  // Undo-able actions: task marked done or submitted for approval, with a 2.5s undo window
  const [pendingUndo, setPendingUndo] = useState<{
    taskId:  string
    task:    Task
    action:  'completed' | 'submitted'
    timer:   ReturnType<typeof setTimeout>
  }[]>([])

  const [dragOverCol,    setDragOverCol]    = useState<string | null>(null)
  const [doneExpanded,   setDoneExpanded]   = useState(false)
  const [listDoneExpanded, setListDoneExpanded] = useState(false)
  const DONE_PAGE = 5
  const LIST_DONE_PAGE = 5
  const [subtaskMap,     setSubtaskMap]     = useState<Record<string, any[]>>({})
  const [expandedTasks,  setExpandedTasks]  = useState<Set<string>>(new Set())
  const [subInputs,      setSubInputs]      = useState<Record<string,string>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [groupPages,      setGroupPages]      = useState<Record<string, number>>({})
  const [showAssignedByMe, setShowAssignedByMe] = useState(false)
  const [sortBy, setSortBy] = useState<'due_date'|'created_at'|'updated_at'>('due_date')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [sortOpen, setSortOpen] = useState(false)
  // Inline editing: maps taskId → field name being edited
  const [inlineEdit, setInlineEdit] = useState<{taskId:string;field:string}|null>(null)

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }
  function groupPage(key: string) { return groupPages[key] ?? 1 }
  function showMoreGroup(key: string) { setGroupPages(prev => ({ ...prev, [key]: (prev[key] ?? 1) + 1 })) }

  // Global filters (My Tasks never filters by assignee — already scoped to current user)
  const { clientId: filterClient, priority: filterPriority, status: filterStatus, search: filterSearch, dueDateFrom, dueDateTo, creatorId: filterCreator, createdFrom, createdTo, updatedFrom, updatedTo } = useFilterStore()

  // Apply filters
  const filteredTasks = tasks.filter(t => {
    if (filterClient   && (t as any).client?.id !== filterClient) return false
    if (filterPriority && t.priority !== filterPriority)          return false
    if (filterStatus   && t.status   !== filterStatus)            return false
    if (filterSearch   && !t.title.toLowerCase().includes(filterSearch.toLowerCase())) return false
    if (dueDateFrom    && (!t.due_date   || t.due_date < dueDateFrom))     return false
    if (dueDateTo      && (!t.due_date   || t.due_date > dueDateTo))       return false
    if (createdFrom    && (!t.created_at || t.created_at.slice(0,10) < createdFrom)) return false
    if (createdTo      && (!t.created_at || t.created_at.slice(0,10) > createdTo))   return false
    if (updatedFrom    && (!(t as any).updated_at || (t as any).updated_at.slice(0,10) < updatedFrom)) return false
    if (updatedTo      && (!(t as any).updated_at || (t as any).updated_at.slice(0,10) > updatedTo))   return false
    if (filterCreator  && (t as any).creator?.id !== filterCreator) return false
    return true
  })

  const displayTasks = showAssignedByMe ? assignedByMeList : filteredTasks

  // Subtasks load lazily on user click only

  function refresh() { startT(() => router.refresh()) }

  function handleTaskUpdated(fields?: Record<string, unknown>) {
    if (fields && selTask) {
      setTasks(prev => prev.map(t => t.id === selTask.id ? { ...t, ...fields } as Task : t))
      setSelTask(prev => prev ? { ...prev, ...fields } as Task : null)
      // If task moved out of pending approval, remove it from that list too
      if (fields.status && fields.status !== 'in_review') {
        setPendingTasks(prev => prev.filter(t => t.id !== selTask.id))
      }
    }
    refresh()
  }

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
      const d = await res.json().catch(() => ({}))
      if (d.auto_completed) {
        // No approver required → auto-completed; show 2.5s undo banner
        const completedAt = new Date().toISOString()
        setTasks(prev => prev.map(t => t.id === task.id
          ? { ...t, status: 'completed', approval_status: 'approved', completed_at: completedAt } : t))
        setSelTask(prev => prev?.id === task.id
          ? { ...prev, status: 'completed', approval_status: 'approved' } : prev)
        const timer = setTimeout(() => {
          setPendingUndo(prev => prev.filter(u => u.taskId !== task.id))
        }, 2600)
        setPendingUndo(prev => [...prev.filter(u => u.taskId !== task.id),
          { taskId: task.id, task, action: 'completed', timer }])
      } else {
        // Sent for approval → show 2.5s undo banner too
        const timer = setTimeout(() => {
          setPendingUndo(prev => prev.filter(u => u.taskId !== task.id))
        }, 2600)
        setPendingUndo(prev => [...prev.filter(u => u.taskId !== task.id),
          { taskId: task.id, task, action: 'submitted', timer }])
      }
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

  // Fire undo — withdraw submission or reopen completed task via API
  async function fireUndo(taskId: string) {
    const entry = pendingUndo.find(u => u.taskId === taskId)
    if (!entry) return
    clearTimeout(entry.timer)
    setPendingUndo(prev => prev.filter(u => u.taskId !== taskId))
    // Restore UI to the state before the action
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, status: entry.task.status, approval_status: entry.task.approval_status ?? null, completed_at: null } : t))
    setSelTask(prev => prev?.id === taskId
      ? { ...prev, status: entry.task.status, approval_status: entry.task.approval_status ?? null } : prev)
    // PATCH back to todo — server auto-clears approval_status + completed_at when status='todo'
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'todo' }),
    })
    if (res.ok) {
      toast.info(entry.action === 'submitted' ? 'Submission withdrawn' : 'Task reopened')
    } else {
      // Rollback the rollback — re-apply the original action state
      setTasks(prev => prev.map(t => t.id === taskId
        ? { ...t,
            status: entry.action === 'completed' ? 'completed' : 'in_review' as any,
            approval_status: entry.action === 'completed' ? 'approved' : 'pending',
          } : t))
      toast.error('Could not undo — please try manually')
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
      const droppedTaskId = dragTaskId   // capture before clearing
      setDragTaskId(null); setDragOverCol(null)
      // Optimistic: show as pending immediately
      setTasks(prev => prev.map(t => t.id === droppedTaskId
        ? { ...t, status: 'in_review' as any, approval_status: 'pending' } : t))
      const res = await fetch(`/api/tasks/${droppedTaskId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'submit' }),
      })
      if (res.ok) {
        const d = await res.json().catch(() => ({}))
        if (d.auto_completed) {
          setTasks(prev => prev.map(t => t.id === droppedTaskId
            ? { ...t, status: 'completed' as any, approval_status: 'approved', completed_at: new Date().toISOString() } : t))
          const timer = setTimeout(() => {
            setPendingUndo(prev => prev.filter(u => u.taskId !== droppedTaskId))
          }, 2600)
          setPendingUndo(prev => [...prev.filter(u => u.taskId !== droppedTaskId),
            { taskId: droppedTaskId, task, action: 'completed', timer }])
        } else {
          const timer = setTimeout(() => {
            setPendingUndo(prev => prev.filter(u => u.taskId !== droppedTaskId))
          }, 2600)
          setPendingUndo(prev => [...prev.filter(u => u.taskId !== droppedTaskId),
            { taskId: droppedTaskId, task, action: 'submitted', timer }])
        }
      } else {
        // Rollback
        setTasks(prev => prev.map(t => t.id === droppedTaskId
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

  async function bulkDelete() {
    const ids = [...checked]
    if (!ids.length) return
    if (!confirm(`Delete ${ids.length} task(s)? They will be moved to Trash.`)) return
    setChecked(new Set())
    setTasks(prev => prev.filter(t => !ids.includes(t.id)))
    setAssignedByMeList(prev => prev.filter(t => !ids.includes(t.id)))
    const results = await Promise.all(ids.map(id => fetch(`/api/tasks/${id}`, { method: 'DELETE' })))
    const failed = results.filter(r => !r.ok).length
    if (ids.length - failed > 0) toast.success(`${ids.length - failed} task(s) deleted`)
    if (failed > 0) { toast.error(`${failed} task(s) could not be deleted`); refresh() }
  }

  // Approve or reject a task (for managers/approvers)
  async function handleApproveDecision(taskId: string, decision: 'approve' | 'reject') {
    // Snapshot for rollback
    const task = tasks.find(t => t.id === taskId)
    const pendingTaskSnapshot = pendingTasks.find(t => t.id === taskId)
    const newStatus = decision === 'approve' ? 'completed' : 'todo'
    // Optimistic: update tasks state (for tasks in own list) and remove from pendingTasks
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, status: newStatus as any, approval_status: decision === 'approve' ? 'approved' : 'rejected',
          completed_at: decision === 'approve' ? new Date().toISOString() : null } : t))
    setPendingTasks(prev => prev.filter(t => t.id !== taskId))
    setSelTask(prev => prev?.id === taskId
      ? { ...prev, status: newStatus as any, approval_status: decision === 'approve' ? 'approved' : 'rejected' } : prev)

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
      if (pendingTaskSnapshot) setPendingTasks(prev => [pendingTaskSnapshot, ...prev])
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Action failed')
    }
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task? It will move to Trash.')) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setAssignedByMeList(prev => prev.filter(t => t.id !== taskId))
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete task')
      refresh()
    } else {
      toast.success('Moved to Trash')
    }
  }

  async function patchTaskField(taskId: string, field: string, value: unknown) {
    setInlineEdit(null)
    const prev = tasks.find(t => t.id === taskId)
    // Optimistic update in both task lists
    const applyUpdate = (t: Task) => t.id === taskId ? { ...t, [field]: value } as Task : t
    setTasks(p => p.map(applyUpdate))
    setAssignedByMeList(p => p.map(applyUpdate))
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok && prev) {
      // rollback
      const rollback = (t: Task) => t.id === taskId ? prev : t
      setTasks(p => p.map(rollback))
      setAssignedByMeList(p => p.map(rollback))
      toast.error('Could not update task')
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
    <div style={{ display:'flex', alignItems:'center', borderBottom:`1px solid var(--border)`, padding:'0 20px',
      background:'var(--surface)', flexShrink:0, gap:8 }}>
      {(['List','Board'] as const).map(t => (
        <button key={t} onClick={() => setTab(t)}
          style={{ padding:'10px 15px', fontSize:14, fontWeight:500, border:'none',
            background:'transparent', cursor:'pointer', marginBottom:-1,
            borderBottom:`2px solid ${tab===t?'var(--brand)':'transparent'}`,
            color: tab===t?'var(--brand)':'var(--text-muted)' }}>
          {t}
        </button>
      ))}
      {canManage && (
        <button
          type="button"
          onClick={() => setShowAssignedByMe(v => !v)}
          style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: showAssignedByMe ? '1.5px solid #0d9488' : '1.5px solid #e5e7eb',
            background: showAssignedByMe ? 'rgba(13,148,136,0.08)' : 'transparent',
            color: showAssignedByMe ? '#0d9488' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}>
          Assigned by me
        </button>
      )}
    </div>
  )

  if (tab === 'List') return (
    <>
      {/* ── Undo completion banners (List view) ── */}
      {pendingUndo.length > 0 && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          zIndex:9999, display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
          {pendingUndo.map(u => (
            <div key={u.taskId} style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'10px 16px', borderRadius:10,
              background:'#1e293b', color:'#fff',
              boxShadow:'0 8px 32px rgba(0,0,0,0.3)',
              fontSize:13, fontWeight:500, minWidth:280,
            }}>
              <span style={{ flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {u.action === 'completed' ? '✓' : '⏳'}{' '}
                "{tasks.find(t => t.id === u.taskId)?.title ?? 'Task'}"{' '}
                {u.action === 'completed' ? 'completed' : 'submitted for approval'}
              </span>
              <button onClick={() => fireUndo(u.taskId)}
                style={{ padding:'4px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.25)',
                  background:'transparent', color:'#7dd3fc', fontSize:12, fontWeight:700,
                  cursor:'pointer', flexShrink:0, fontFamily:'inherit' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.1)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                Undo
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--surface)' }}>
        <Tabs/>

        {/* ── Quick add task bar at top of list ── */}
        {canCreate && (
          <div style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--surface)' }}>
            <InlineOneTimeTask
              members={members} clients={clients} currentUserId={currentUserId}
              onCreated={(newTask) => {
                if (newTask?.id) {
                  // Only add to "My Tasks" state if the task is assigned to current user
                  const assignedToMe = !newTask.assignee_id || newTask.assignee_id === currentUserId
                  if (assignedToMe) {
                    const enriched = {
                      ...newTask,
                      description:       newTask.description       ?? null,
                      project_id:        newTask.project_id        ?? null,
                      project:           null,
                      is_archived:       false,
                      created_at:        '',
                      approval_required: newTask.approval_required ?? false,
                      completed_at:      null,
                      is_recurring:      newTask.is_recurring      ?? false,
                      estimated_hours:   newTask.estimated_hours   ?? null,
                      approval_status:   null,
                      approver:          null,
                      approver_id:       newTask.approver_id       ?? null,
                      assignee:          members.find(m => m.id === newTask.assignee_id) ?? null,
                      client:            clients.find(cl => cl.id === newTask.client_id) ?? null,
                    }
                    setTasks(prev => [...prev, enriched as any].sort((a, b) => {
                      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
                      if (a.due_date) return -1
                      if (b.due_date) return 1
                      return 0
                    }))
                  }
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
            {canManage && (
              <button onClick={bulkDelete}
                style={{ background:'#dc2626', color:'#fff', border:'none', padding:'6px 14px',
                  borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <Trash2 style={{width:13,height:13}}/> Delete
              </button>
            )}
            <button onClick={() => setChecked(new Set(displayTasks.map(t => t.id)))}
              style={{ background:'transparent', border:'1px solid var(--border)', padding:'5px 12px',
                borderRadius:7, fontSize:12, fontWeight:500, color:'var(--text-secondary)', cursor:'pointer' }}>
              Select all
            </button>
            <button onClick={() => setChecked(new Set())}
              style={{ background:'none', border:'none', fontSize:12, color:'var(--text-muted)', cursor:'pointer' }}>
              Cancel
            </button>
          </div>
        )}
        {/* ── Needs your approval section ─────────────────────────── */}
        {pendingTasks.length > 0 && (
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
                {pendingTasks.length}
              </span>
            </div>
            {/* Approval task rows */}
            {pendingTasks.map(task => {
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
        <UniversalFilterBar clients={clients} members={members} showSearch showPriority showStatus showDueDate showAssignor showCreatedDate showUpdatedDate/>
        {/* Sort bar */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 18px', borderBottom:'1px solid var(--border-light)', background:'var(--surface)', flexShrink:0 }}>
          <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:'auto' }}>Sort:</span>
          <div style={{ position:'relative' }}>
            <button onClick={() => setSortOpen(v => !v)}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:6,
                border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer',
                fontSize:11, fontWeight:500, color: sortBy !== 'due_date' ? 'var(--brand)' : 'var(--text-secondary)',
                background: sortBy !== 'due_date' ? 'var(--brand-light)' : 'var(--surface)' }}>
              <SortAsc style={{ width:12, height:12 }}/>
              {sortBy === 'due_date' ? 'Due date' : sortBy === 'created_at' ? 'Created' : 'Modified'}
              {' '}{sortDir === 'asc' ? '↑' : '↓'}
            </button>
            {sortOpen && (
              <div style={{ position:'absolute', top:'100%', right:0, marginTop:4, background:'var(--surface)',
                border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)',
                zIndex:9999, padding:8, minWidth:160 }} onClick={e => e.stopPropagation()}>
                {([['due_date','Due date'],['created_at','Created date'],['updated_at','Modified date']] as const).map(([val,label]) => (
                  <button key={val} onClick={() => { if (sortBy===val) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortBy(val); setSortDir('asc') } setSortOpen(false) }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%',
                      padding:'7px 10px', borderRadius:6, border:'none', cursor:'pointer', textAlign:'left',
                      background: sortBy===val ? 'var(--brand-light)' : 'transparent',
                      color: sortBy===val ? 'var(--brand)' : 'var(--text-primary)',
                      fontSize:12, fontWeight: sortBy===val ? 600 : 400 }}>
                    {label}
                    {sortBy===val && <span style={{ fontSize:10 }}>{sortDir==='asc'?'↑':'↓'}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Column headers — 8 cols: checkbox | circle | expand | title | assignee | client | due | actions */}
        <div style={{ display:'grid', gridTemplateColumns:'28px 22px 18px 1fr 90px 90px 72px 40px',
          alignItems:'center', padding:'5px 18px', borderBottom:`1px solid var(--border)`,
          background:'var(--surface-subtle)', flexShrink:0, fontSize:10, fontWeight:700,
          color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <div/><div/><div/>
          <div>Task name</div>
          <div>{showAssignedByMe ? 'Assignee' : 'Assigned by'}</div>
          <div>Client</div>
          <div style={{textAlign:'center'}}>Due date</div>
          <div/>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {showAssignedByMe && (
            <div style={{ padding:'10px 18px 4px', fontSize:12, fontWeight:600, color:'#0d9488' }}>
              Tasks assigned by me to others
            </div>
          )}
          {LIST_SECS.map(sec => {
            const secTasks = displayTasks.filter(t => sec.filter(t, today))
              .sort((a, b) => {
                let cmp = 0
                if (sortBy === 'due_date') {
                  if (a.due_date && b.due_date) cmp = a.due_date.localeCompare(b.due_date)
                  else if (a.due_date) cmp = -1
                  else if (b.due_date) cmp = 1
                } else if (sortBy === 'created_at') {
                  cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '')
                } else if (sortBy === 'updated_at') {
                  cmp = ((a as any).updated_at ?? '').localeCompare((b as any).updated_at ?? '')
                }
                return sortDir === 'asc' ? cmp : -cmp
              })
            if (secTasks.length === 0) return null
            return (
              <div key={sec.key}>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 18px 5px',
                  fontSize:10, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'0.06em', color:sec.color }}>
                  ▾ {sec.label}
                  <span style={{ opacity:0.4, fontWeight:400, textTransform:'none', fontSize:10 }}>({secTasks.length})</span>
                </div>
                {secTasks.map(task => {
                  const ov         = isOverdue(task.due_date, task.status)
                  const isPending  = task.approval_status === 'pending' || task.status === 'in_review'
                  const client     = (task as any).client as {id:string;name:string;color:string}|null
                  const creator    = (task as any).creator as {id:string;name:string}|null
                  const isCompliance = (task as any).custom_fields?._ca_compliance === true
                  const isRecurring  = task.is_recurring === true
                  const isProject    = !!task.project_id && !isRecurring && !isCompliance
                  const typeAccent   = isCompliance ? '#d97706' : isRecurring ? '#0d9488' : isProject ? '#7c3aed' : '#0891b2'
                  const typeBg = checked.has(task.id) ? 'var(--brand-light)'
                    : isPending    ? 'var(--pending-surface, #faf5ff)'
                    : ov           ? 'var(--overdue-surface, #fff9f9)'
                    : isCompliance ? 'rgba(234,179,8,0.09)'
                    : isRecurring  ? 'rgba(13,148,136,0.07)'
                    : isProject    ? 'rgba(124,58,237,0.07)'
                    : 'var(--surface)'
                  return (
                    <React.Fragment key={task.id}>
                    <div
                      className="mytasks-row" style={{ display:'grid', gridTemplateColumns:'28px 22px 18px 1fr 90px 90px 72px 40px',
                        alignItems:'center', padding:'0 18px', minHeight:38,
                        borderBottom:`1px solid var(--border-light)`,
                        borderLeft:`3px solid ${typeAccent}`,
                        background: typeBg,
                        cursor:'pointer' }}
                      onClick={() => setSelTask(selTask?.id === task.id ? null : task)}>
                      <input type="checkbox" checked={checked.has(task.id)}
                        onChange={() => setChecked(p => { const s=new Set(p); s.has(task.id)?s.delete(task.id):s.add(task.id); return s })}
                        onClick={e => e.stopPropagation()} style={{ accentColor:'var(--brand)', width:13, height:13 }}/>
                      <CircleBtn task={task}/>
                      {/* Expand button — toggle subtasks inline */}
                      <button
                        onClick={async e => {
                          e.stopPropagation()
                          setExpandedTasks(prev => { const s=new Set(prev); s.has(task.id)?s.delete(task.id):s.add(task.id); return s })
                          if (!subtaskMap[task.id]) {
                            const r = await fetch(`/api/tasks?parent_id=${task.id}&limit=50`)
                            const d = await r.json()
                            setSubtaskMap(p => ({ ...p, [task.id]: d.data ?? [] }))
                          }
                        }}
                        title="Subtasks"
                        style={{ width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center',
                          border:'none', background:'transparent', cursor:'pointer', padding:0, borderRadius:3,
                          color: expandedTasks.has(task.id) ? 'var(--brand)' : 'var(--text-muted)',
                          fontSize:9, fontWeight:700, transition:'color 0.1s', flexShrink:0 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='var(--brand)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color=expandedTasks.has(task.id)?'var(--brand)':'var(--text-muted)'}>
                        {expandedTasks.has(task.id) ? '▼' : '▶'}
                        {(subtaskMap[task.id]??[]).length > 0 && (
                          <span style={{ fontSize:8, marginLeft:1, opacity:0.7 }}>
                            {(subtaskMap[task.id]??[]).filter((s:any)=>s.status==='completed').length}/{(subtaskMap[task.id]??[]).length}
                          </span>
                        )}
                      </button>
                      <div style={{ minWidth:0, overflow:'hidden' }}>
                        <div style={{ fontSize:13,
                          color: task.status==='completed'?'#94a3b8':isPending?'#7c3aed':ov?'#dc2626':'var(--text-primary)',
                          textDecoration: task.status==='completed'?'line-through':'none',
                          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                          display:'flex', alignItems:'center', gap:6 }}>
                          {task.is_recurring && <RefreshCw style={{ flexShrink:0, width:11, height:11, color:'var(--brand)', marginRight:2 }} title="Recurring task"/>}
                          {task.project_id && !task.is_recurring && <FolderOpen style={{ flexShrink:0, width:11, height:11, color:'#7c3aed', marginRight:2 }} title="Project task"/>}
                          {isCompliance && <span style={{ flexShrink:0, fontSize:9, fontWeight:700, background:'rgba(234,179,8,0.15)', color:'#b45309', padding:'1px 4px', borderRadius:3 }}>CA</span>}
                          <span className="task-title" style={{ overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', flex:1 }}>{task.title}</span>
                          {((task as any).custom_fields?._blocked_by?.length > 0) && task.status !== 'completed' && (
                            <span title="Blocked by incomplete tasks" style={{ flexShrink:0, display:'inline-flex', alignItems:'center', gap:2, padding:'1px 5px', borderRadius:4, fontSize:9, fontWeight:700, background:'rgba(220,38,38,0.1)', color:'#dc2626', letterSpacing:'0.02em', whiteSpace:'nowrap' }}>
                              ⊘ Blocked
                            </span>
                          )}
                          {isPending && <span style={{ flexShrink:0, fontSize:11, background:'rgba(124,58,237,0.12)',
                            color:'#7c3aed', padding:'1px 5px', borderRadius:3, fontWeight:500 }}>
                            Pending
                          </span>}
                          {(isCompliance || task.approval_required) && task.status !== 'completed' && (
                            <label
                              title={isCompliance ? 'Upload compliance document' : 'Upload attachment'}
                              onClick={e => e.stopPropagation()}
                              style={{ flexShrink:0, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
                                width:18, height:18, borderRadius:4, opacity:0.5, transition:'opacity 0.15s, background 0.15s',
                                color: isCompliance ? '#b45309' : 'var(--text-muted)' }}
                              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity='1'; el.style.background=isCompliance?'rgba(234,179,8,0.15)':'var(--surface-subtle)' }}
                              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity='0.5'; el.style.background='transparent' }}
                            >
                              <input type="file" style={{ display:'none' }} onClick={e => e.stopPropagation()} onChange={async e => {
                                const file = e.target.files?.[0]; if (!file) return
                                const fd = new FormData(); fd.append('file', file)
                                const res = await fetch(`/api/tasks/${task.id}/attachments`, { method:'POST', body:fd })
                                if (res.ok) toast.success(`Uploaded: ${file.name} ✓`)
                                else toast.error('Upload failed')
                                e.target.value = ''
                              }}/>
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width:11, height:11 }}>
                                <path d="M8 10V3M5 6l3-3 3 3M3 13h10"/>
                              </svg>
                            </label>
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
                      {/* Assignee column — inline editable for managers */}
                      <div className="hide-mobile" style={{ display:'flex', alignItems:'center', gap:5, overflow:'hidden' }}
                        onClick={e => { e.stopPropagation(); if (canManage) setInlineEdit({taskId:task.id,field:'assignee_id'}) }}>
                        {inlineEdit?.taskId===task.id && inlineEdit.field==='assignee_id' ? (
                          <select autoFocus defaultValue={task.assignee_id ?? ''}
                            onChange={e => patchTaskField(task.id,'assignee_id',e.target.value||null)}
                            onBlur={() => setInlineEdit(null)}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize:11, padding:'2px 5px', borderRadius:6, border:'1px solid var(--brand)',
                              background:'var(--surface)', color:'var(--text-primary)', outline:'none',
                              fontFamily:'inherit', maxWidth:84, cursor:'pointer' }}>
                            <option value="">Unassigned</option>
                            {members.map(m => <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>)}
                          </select>
                        ) : showAssignedByMe ? (
                          (() => {
                            const assignee = task.assignee as {id:string;name:string}|null
                            return assignee ? (
                              <span title={canManage ? 'Click to reassign' : undefined}
                                style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:99,
                                background:'var(--surface-subtle)', border:'1px solid var(--border)',
                                fontSize:11, fontWeight:500, color:'var(--text-secondary)',
                                maxWidth:84, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                                cursor: canManage ? 'pointer' : 'default' }}>
                                {assignee.name.split(' ')[0]}
                              </span>
                            ) : <span style={{ fontSize:12, color:'var(--text-muted)', cursor: canManage?'pointer':'default' }}>—</span>
                          })()
                        ) : (
                          creator ? (
                            <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:99,
                              background:'var(--surface-subtle)', border:'1px solid var(--border)',
                              fontSize:11, fontWeight:500, color:'var(--text-secondary)',
                              maxWidth:84, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                              {creator.name.split(' ')[0]}
                            </span>
                          ) : <span style={{ fontSize:12, color:'var(--text-muted)' }}>—</span>
                        )}
                      </div>
                      {/* Client column — inline editable for managers */}
                      <div className="hide-mobile" style={{ display:'flex', alignItems:'center', gap:4, overflow:'hidden', paddingRight:4 }}
                        onClick={e => { e.stopPropagation(); if (canManage) setInlineEdit({taskId:task.id,field:'client_id'}) }}>
                        {inlineEdit?.taskId===task.id && inlineEdit.field==='client_id' ? (
                          <select autoFocus defaultValue={task.client_id ?? ''}
                            onChange={e => patchTaskField(task.id,'client_id',e.target.value||null)}
                            onBlur={() => setInlineEdit(null)}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize:11, padding:'2px 5px', borderRadius:6, border:'1px solid var(--brand)',
                              background:'var(--surface)', color:'var(--text-primary)', outline:'none',
                              fontFamily:'inherit', maxWidth:84, cursor:'pointer' }}>
                            <option value="">No client</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        ) : client ? (
                          <>
                            <span style={{ width:7, height:7, borderRadius:2, background:client.color, flexShrink:0, display:'inline-block' }}/>
                            <span title={canManage ? 'Click to change client' : undefined}
                              style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', whiteSpace:'nowrap',
                                textOverflow:'ellipsis', cursor: canManage?'pointer':'default' }}>{client.name}</span>
                          </>
                        ) : <span style={{ fontSize:12, color:'var(--text-muted)', cursor: canManage?'pointer':'default' }}>—</span>}
                      </div>
                      {/* Due date — inline editable for managers */}
                      <div className="hide-mobile" style={{ textAlign:'center', fontSize:12,
                        color: task.due_date===today?'var(--brand)':ov?'#dc2626':'var(--text-muted)',
                        fontWeight: (task.due_date===today||ov)?600:400,
                        cursor: canManage ? 'pointer' : 'default' }}
                        onClick={e => { e.stopPropagation(); if (canManage) setInlineEdit({taskId:task.id,field:'due_date'}) }}>
                        {inlineEdit?.taskId===task.id && inlineEdit.field==='due_date' ? (
                          <input autoFocus type="date" defaultValue={task.due_date ?? ''}
                            onChange={e => patchTaskField(task.id,'due_date',e.target.value||null)}
                            onBlur={() => setInlineEdit(null)}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize:11, padding:'1px 4px', borderRadius:5, border:'1px solid var(--brand)',
                              background:'var(--surface)', outline:'none', colorScheme:'light dark', fontFamily:'inherit' }}/>
                        ) : (
                          <span title={canManage ? 'Click to change due date' : undefined}>
                            {task.due_date ? fmtDate(task.due_date) : '—'}
                          </span>
                        )}
                      </div>
                      {/* Delete — last grid cell, priority dot + delete button */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}
                        onClick={e => e.stopPropagation()}>
                        <div title={task.priority}
                          style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                            background: PRIORITY_CONFIG[task.priority]?.color ?? '#94a3b8' }}/>
                        {canManage && (
                          <button onClick={() => deleteTask(task.id)} title="Delete task"
                            className="delete-task-btn"
                            style={{ opacity:0, transition:'opacity 0.15s', display:'flex', alignItems:'center',
                              justifyContent:'center', width:22, height:22, borderRadius:5, border:'none',
                              background:'transparent', cursor:'pointer', color:'var(--text-muted)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(220,38,38,0.1)'; (e.currentTarget as HTMLElement).style.color='#dc2626' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--text-muted)' }}>
                            <Trash2 style={{ width:11, height:11 }}/>
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Inline subtasks — shown when expanded */}
                    {expandedTasks.has(task.id) && (
                      <div style={{ background:'var(--surface-subtle)', borderBottom:'1px solid var(--border-light)' }}>
                        {(subtaskMap[task.id] ?? []).map((sub: any) => (
                          <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8,
                            padding:'4px 18px 4px 68px', borderBottom:'1px solid var(--border-light)' }}>
                            <button onClick={async e => {
                              e.stopPropagation()
                              const newStatus = sub.status === 'completed' ? 'todo' : 'completed'
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
                              style={{ width:13, height:13, borderRadius:'50%', border:'none', flexShrink:0, cursor:'pointer',
                                background: sub.status==='completed'?'var(--brand)':'transparent',
                                outline:`2px solid ${sub.status==='completed'?'var(--brand)':'var(--border)'}`,
                                display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                              {sub.status==='completed' && (
                                <svg viewBox="0 0 10 10" fill="none" style={{width:8,height:8}}>
                                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                              )}
                            </button>
                            <span style={{ flex:1, fontSize:11,
                              color: sub.status==='completed'?'var(--text-muted)':'var(--text-primary)',
                              textDecoration: sub.status==='completed'?'line-through':'none' }}>{sub.title}</span>
                            {sub.assignee_id && (
                              <span style={{ fontSize:10, color:'var(--text-muted)', flexShrink:0 }}>
                                {members.find(m=>m.id===sub.assignee_id)?.name.split(' ')[0] ?? ''}
                              </span>
                            )}
                            {sub.due_date && (
                              <span style={{ fontSize:10, color:'var(--text-muted)', flexShrink:0 }}>{fmtDate(sub.due_date)}</span>
                            )}
                            {sub.status !== 'completed' && (
                              <label style={{ cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center',
                                gap:3, padding:'1px 6px', borderRadius:99, fontSize:10, fontWeight:600,
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
                        {/* Inline add subtask row */}
                        {canManage && (
                          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 18px 5px 68px' }}
                            onClick={e => e.stopPropagation()}>
                            <div style={{ width:13, height:13, borderRadius:'50%', flexShrink:0,
                              border:'1.5px dashed var(--brand)', opacity:0.4 }}/>
                            <input
                              value={subInputs[task.id] ?? ''}
                              onChange={e => setSubInputs(p => ({ ...p, [task.id]: e.target.value }))}
                              onKeyDown={async e => {
                                const val = subInputs[task.id] ?? ''
                                if (e.key==='Enter' && val.trim()) {
                                  setSubInputs(p => ({ ...p, [task.id]: '' }))
                                  const r = await fetch('/api/tasks', {
                                    method:'POST', headers:{'Content-Type':'application/json'},
                                    body: JSON.stringify({ title:val.trim(), parent_task_id:task.id,
                                      assignee_id:task.assignee_id||null, project_id:task.project_id||null })
                                  })
                                  const d = await r.json()
                                  if (r.ok && d.data) setSubtaskMap(p => ({ ...p, [task.id]: [...(p[task.id]??[]), d.data] }))
                                }
                                if (e.key==='Escape') setSubInputs(p => ({ ...p, [task.id]: '' }))
                              }}
                              placeholder="Add subtask… (Enter)"
                              style={{ flex:1, fontSize:11, border:'none', outline:'none',
                                background:'transparent', color:'var(--text-primary)', fontFamily:'inherit' }}/>
                          </div>
                        )}
                      </div>
                    )}
                    </React.Fragment>
                  )
                })}
              </div>
            )
          })}

          {/* ── CA tasks triggering in next 3 days (owner/admin only) ── */}
          {upcomingCATriggers.length > 0 && !showAssignedByMe && (
            <CATriggerSection triggers={upcomingCATriggers} />
          )}

          {/* Empty state — shown when all sections empty after filtering */}
          {displayTasks.length === 0 && (filterCreator || filterClient || filterPriority || filterStatus || filterSearch || dueDateFrom || dueDateTo) && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              padding:'48px 24px', color:'var(--text-muted)', textAlign:'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                style={{ marginBottom:12, opacity:0.3 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>No tasks match the active filters</div>
              <div style={{ fontSize:12 }}>Try clearing one or more filters above</div>
            </div>
          )}

          {/* Completed — paginated to LIST_DONE_PAGE */}
          {(() => {
            const allDone = displayTasks.filter(t => t.status === 'completed')
            if (!allDone.length) return null
            const visibleDone = listDoneExpanded ? allDone : allDone.slice(0, LIST_DONE_PAGE)
            const hiddenCount = allDone.length - LIST_DONE_PAGE
            return (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 18px 5px',
                  fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#16a34a' }}>
                  <button onClick={() => setListDoneExpanded(v => !v)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'#16a34a',
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
                  const client  = (task as any).client as {id:string;name:string;color:string}|null
                  const creator = (task as any).creator as {id:string;name:string}|null
                  return (
                    <React.Fragment key={task.id}>
                    <div
                      className="mytasks-row" style={{ display:'grid', gridTemplateColumns:'28px 22px 18px 1fr 90px 90px 72px 40px',
                        alignItems:'center', padding:'0 18px', minHeight:38,
                        borderBottom:`1px solid var(--border-light)`,
                        background:'var(--surface)', cursor:'pointer', opacity:0.7 }}
                      onClick={() => setSelTask(selTask?.id === task.id ? null : task)}>
                      <input type="checkbox" checked={checked.has(task.id)}
                        onChange={() => setChecked(p => { const s=new Set(p); s.has(task.id)?s.delete(task.id):s.add(task.id); return s })}
                        onClick={e => e.stopPropagation()} style={{ accentColor:'var(--brand)', width:13, height:13 }}/>
                      <CircleBtn task={task}/>
                      <div/>
                      <div style={{ fontSize:13, color:'var(--text-muted)', textDecoration:'line-through',
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', paddingRight:8 }}>
                        {task.title}
                      </div>
                      <div className="hide-mobile" style={{ display:'flex', alignItems:'center', gap:5, overflow:'hidden' }}>
                        {creator ? (
                          <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:99,
                            background:'var(--surface-subtle)', border:'1px solid var(--border)',
                            fontSize:11, fontWeight:500, color:'var(--text-secondary)',
                            maxWidth:84, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                            {creator.name.split(' ')[0]}
                          </span>
                        ) : <span style={{ fontSize:12, color:'var(--text-muted)' }}>—</span>}
                      </div>
                      <div className="hide-mobile" style={{ display:'flex', alignItems:'center', gap:4, overflow:'hidden', paddingRight:4 }}>
                        {client ? (
                          <>
                            <span style={{ width:7, height:7, borderRadius:2, background:client.color, flexShrink:0, display:'inline-block' }}/>
                            <span style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{client.name}</span>
                          </>
                        ) : <span style={{ fontSize:12, color:'var(--text-muted)' }}>—</span>}
                      </div>
                      <div style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>
                        {task.due_date ? fmtDate(task.due_date) : '—'}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}
                        onClick={e => e.stopPropagation()}>
                        <div title={task.priority}
                          style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                            background: PRIORITY_CONFIG[task.priority]?.color ?? '#94a3b8' }}/>
                        {canManage && (
                          <button onClick={() => deleteTask(task.id)} title="Delete task"
                            className="delete-task-btn"
                            style={{ opacity:0, transition:'opacity 0.15s', display:'flex', alignItems:'center',
                              justifyContent:'center', width:22, height:22, borderRadius:5, border:'none',
                              background:'transparent', cursor:'pointer', color:'var(--text-muted)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(220,38,38,0.1)'; (e.currentTarget as HTMLElement).style.color='#dc2626' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='var(--text-muted)' }}>
                            <Trash2 style={{ width:11, height:11 }}/>
                          </button>
                        )}
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
        onUpdated={handleTaskUpdated}/>
    </>
  )

  // BOARD VIEW
  return (
    <>
      <style>{`
        .mytasks-row:hover .delete-task-btn { opacity: 1 !important; }
        @media (max-width: 640px) {
          .hide-mobile { display: none !important; }
          .mytasks-row, .mytasks-header {
            grid-template-columns: 28px 22px 1fr 28px !important;
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
      <UniversalFilterBar clients={clients} members={members} showSearch showPriority showDueDate showAssignor showCreatedDate showUpdatedDate/>

      {/* ── Undo completion banners ── */}
      {pendingUndo.length > 0 && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          zIndex:9999, display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
          {pendingUndo.map(u => (
            <div key={u.taskId} style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'10px 16px', borderRadius:10,
              background:'#1e293b', color:'#fff',
              boxShadow:'0 8px 32px rgba(0,0,0,0.3)',
              fontSize:13, fontWeight:500, minWidth:280,
              animation:'slideUp 0.2s ease',
            }}>
              <span style={{ flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                ✓ "{tasks.find(t => t.id === u.taskId)?.title ?? 'Task'}" completed
              </span>
              <button onClick={() => fireUndo(u.taskId)}
                style={{ padding:'4px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.25)',
                  background:'transparent', color:'#7dd3fc', fontSize:12, fontWeight:700,
                  cursor:'pointer', flexShrink:0, fontFamily:'inherit', transition:'all 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.1)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', padding:'14px 20px',
        background:'var(--surface-subtle)', display:'flex', gap:12, alignItems:'flex-start' }}>
        {(() => {
          // Tasks pending manager approval that aren't already in filteredTasks
          const extraPendingForBoard = !showAssignedByMe
            ? pendingTasks.filter(pt => !filteredTasks.some(t => t.id === pt.id))
            : []
          return BOARD_COLS.map(col => {
          const today2 = todayStr()
          // Build base list for this column
          let colTasks = col.status === 'overdue'
            ? displayTasks.filter(t => !!t.due_date && t.due_date < today2
                && !['completed','cancelled','in_review'].includes(t.status)
                && t.approval_status !== 'pending')
            : col.status === 'in_review'
            ? [...displayTasks.filter(t => t.status === 'in_review' || t.approval_status === 'pending'), ...extraPendingForBoard]
            : displayTasks.filter(t =>
                (t.status === col.status || (col.status === 'in_progress' && t.status === 'todo'))
                && t.approval_status !== 'pending'
                && !(!!t.due_date && t.due_date < today2 && t.status !== 'completed'))

          // Apply global filters
          if (filterClient)   colTasks = colTasks.filter(t => (t as any).client?.id === filterClient)
          if (filterPriority) colTasks = colTasks.filter(t => t.priority === filterPriority)
          if (filterSearch)   colTasks = colTasks.filter(t => t.title.toLowerCase().includes(filterSearch.toLowerCase()))
          if (dueDateFrom)    colTasks = colTasks.filter(t => t.due_date && t.due_date >= dueDateFrom)
          if (dueDateTo)      colTasks = colTasks.filter(t => t.due_date && t.due_date <= dueDateTo)
          if (createdFrom)    colTasks = colTasks.filter(t => t.created_at && t.created_at.slice(0,10) >= createdFrom)
          if (createdTo)      colTasks = colTasks.filter(t => t.created_at && t.created_at.slice(0,10) <= createdTo)
          if (updatedFrom)    colTasks = colTasks.filter(t => (t as any).updated_at && (t as any).updated_at.slice(0,10) >= updatedFrom)
          if (updatedTo)      colTasks = colTasks.filter(t => (t as any).updated_at && (t as any).updated_at.slice(0,10) <= updatedTo)

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
            const assignee  = task.assignee as {id:string;name:string}|null
            const client    = (task as any).client as {id:string;name:string;color:string}|null
            const pri       = PRIORITY_CONFIG[task.priority]
            const isDone    = task.status === 'completed'
            const isPending = task.status === 'in_review' || task.approval_status === 'pending'
            const ov        = isOverdue(task.due_date, task.status)
            const _isComp   = (task as any).custom_fields?._ca_compliance === true
            const _isRec    = task.is_recurring === true
            const _isPrj    = !!task.project_id && !_isRec && !_isComp
            const _accent   = _isComp ? '#d97706' : _isRec ? '#0d9488' : _isPrj ? '#7c3aed' : '#0891b2'
            const _cardBg   = _isComp ? 'rgba(234,179,8,0.07)' : _isRec ? 'rgba(13,148,136,0.06)' : _isPrj ? 'rgba(124,58,237,0.06)' : 'var(--surface)'
            const isSelected = dragTaskId===task.id || selTask?.id===task.id
            return (
              <div
                draggable
                onDragStart={() => handleDragStart(task.id)}
                onDragEnd={() => { setDragTaskId(null); setDragOverCol(null) }}
                onClick={() => setSelTask(selTask?.id === task.id ? null : task)}
                style={{ background:_cardBg, borderRadius:8, padding:'9px 10px',
                  cursor:'grab',
                  border:`1px solid ${isSelected?'var(--brand)':isPending?'#ddd6fe':'var(--border)'}`,
                  borderLeft:`3px solid ${isSelected?'var(--brand)':_accent}`,
                  boxShadow: dragTaskId===task.id ? '0 4px 14px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
                  opacity: isDone ? 0.65 : dragTaskId===task.id ? 0.5 : 1,
                  transform: dragTaskId===task.id ? 'scale(1.02)' : 'none',
                  transition: 'opacity 0.15s, transform 0.1s' }}>
                {/* Title row */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:7 }}>
                  {isPending
                    ? <div style={{ width:14, height:14, borderRadius:'50%', flexShrink:0, marginTop:1,
                        background:'rgba(124,58,237,0.1)', border:'1.5px solid #7c3aed',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Clock style={{ width:7, height:7, color:'#7c3aed' }}/>
                      </div>
                    : <div onClick={e => toggleDone(task, e)}
                        style={{ width:14, height:14, borderRadius:'50%', flexShrink:0, marginTop:1,
                          background: isDone?'var(--brand)':'transparent',
                          border:`1.5px solid ${isDone?'var(--brand)':ov?'#dc2626':'#cbd5e1'}`,
                          display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s' }}>
                        {isDone && <svg viewBox="0 0 10 10" fill="none" style={{width:7,height:7}}><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                      </div>
                  }
                  <span style={{ fontSize:13, fontWeight:600, lineHeight:1.4, flex:1, minWidth:0,
                    color: isDone?'var(--text-muted)':isPending?'#7c3aed':ov?'#dc2626':'var(--text-primary)',
                    textDecoration: isDone?'line-through':'none',
                    overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {task.title}
                  </span>
                </div>
                {/* Chips row: client + assignee (compact, with full-name tooltip) */}
                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6, flexWrap:'wrap', opacity: 0.85 }}>
                  {client && (
                    <span title={client.name}
                      style={{ display:'inline-flex', alignItems:'center', gap:3,
                        padding:'2px 6px', borderRadius:99, fontSize:10, fontWeight:600,
                        background:`${client.color}18`, border:`1px solid ${client.color}44`,
                        color: client.color, maxWidth:90, overflow:'hidden',
                        whiteSpace:'nowrap', textOverflow:'ellipsis', cursor:'default' }}>
                      <span style={{ width:5, height:5, borderRadius:1, background:client.color, flexShrink:0 }}/>
                      {client.name.split(' ')[0]}
                    </span>
                  )}
                  {assignee && (
                    <span title={assignee.name}
                      style={{ display:'inline-flex', alignItems:'center', gap:3,
                        padding:'2px 6px', borderRadius:99, fontSize:10, fontWeight:600,
                        background:'var(--surface-subtle)', border:'1px solid var(--border)',
                        color:'var(--text-secondary)', maxWidth:80, overflow:'hidden',
                        whiteSpace:'nowrap', textOverflow:'ellipsis', cursor:'default' }}>
                      <span style={{ width:16, height:16, borderRadius:'50%', background:'var(--brand)',
                        color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center',
                        fontSize:8, fontWeight:800, flexShrink:0 }}>
                        {assignee.name[0]?.toUpperCase()}
                      </span>
                      {assignee.name.split(' ')[0]}
                    </span>
                  )}
                </div>
                {/* Footer: priority + blocked badge + due date + icons */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3,
                      padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:600,
                      background: pri?.bg ?? '#f8fafc', color: pri?.color ?? '#94a3b8' }}>
                      {task.priority === 'none' ? '—' : task.priority.charAt(0).toUpperCase()+task.priority.slice(1)}
                    </span>
                    {((task as any).custom_fields?._blocked_by?.length > 0) && !isDone && (
                      <span title="Blocked by incomplete tasks" style={{ display:'inline-flex', alignItems:'center', gap:2, padding:'1px 5px', borderRadius:4, fontSize:9, fontWeight:700, background:'rgba(220,38,38,0.1)', color:'#dc2626', letterSpacing:'0.02em', whiteSpace:'nowrap' }}>
                        ⊘ Blocked
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    {task.due_date && (
                      <span style={{ fontSize:10, color: ov?'#dc2626':task.due_date===today2?'var(--brand)':'var(--text-muted)',
                        fontWeight: (ov||task.due_date===today2)?600:400 }}>
                        {fmtDate(task.due_date)}
                      </span>
                    )}
                    {task.is_recurring && <RefreshCw style={{width:8,height:8,color:'var(--brand)'}}/>}
                    {canManage && (
                      <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                        title="Delete" style={{ background:'none', border:'none', cursor:'pointer',
                          color:'var(--text-muted)', padding:2, display:'flex', alignItems:'center',
                          borderRadius:4, transition:'all 0.1s' }}
                        onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.color='#dc2626'; el.style.background='rgba(220,38,38,0.1)' }}
                        onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.color='var(--text-muted)'; el.style.background='none' }}>
                        <Trash2 style={{width:9,height:9}}/>
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
                    ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                        justifyContent:'center', padding:'32px 12px', gap:10, textAlign:'center' }}>
                        <div style={{ width:36, height:36, borderRadius:'50%',
                          background:'rgba(255,255,255,0.04)', border:'1px dashed var(--border)',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {col.status === 'in_review'
                            ? <Clock style={{ width:16, height:16, color:'var(--text-muted)' }}/>
                            : <CheckCheck style={{ width:16, height:16, color:'var(--text-muted)' }}/>
                          }
                        </div>
                        <p style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.5, margin:0 }}>
                          {col.status === 'in_review'
                            ? 'No tasks waiting for approval'
                            : 'All clear — drag a task here or create one above'}
                        </p>
                      </div>
                    )
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
                    {flatTasks.length === 0 && (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                        justifyContent:'center', padding:'32px 12px', gap:10, textAlign:'center' }}>
                        <div style={{ width:36, height:36, borderRadius:'50%',
                          background:'rgba(255,255,255,0.04)', border:'1px dashed var(--border)',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {col.status === 'overdue'
                            ? <CheckCircle2 style={{ width:16, height:16, color:'var(--text-muted)' }}/>
                            : <CheckCheck style={{ width:16, height:16, color:'var(--text-muted)' }}/>
                          }
                        </div>
                        <p style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.5, margin:0 }}>
                          {col.status === 'overdue'
                            ? 'No overdue tasks — great work!'
                            : 'No completed tasks yet'}
                        </p>
                      </div>
                    )}
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
          })
        })()}
      </div>
      <TaskDetailPanel task={selTask} members={members} clients={clients}
        currentUserId={currentUserId} userRole={userRole}
        onClose={() => setSelTask(null)} onUpdated={handleTaskUpdated}/>
    </>
  )
}