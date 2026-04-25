'use client'
import Link from 'next/link'
import React, { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter }    from 'next/navigation'
import { Filter, SortAsc, Plus, CheckCheck, Clock, DollarSign, Trash2, BookmarkPlus, Copy } from 'lucide-react'
import { InlineTaskRow }   from '@/components/tasks/InlineTaskRow'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { PriorityBadge, Avatar }   from '@/components/ui/Badge'
import { cn }              from '@/lib/utils/cn'
import { toast }           from '@/store/appStore'
import { fmtDate, isOverdue, todayStr, fmtHours } from '@/lib/utils/format'
import { STATUS_CONFIG, PRIORITY_CONFIG }  from '@/types'
import type { Task }       from '@/types'

interface Props {
  project: { id: string; name: string; color: string; status: string; description?: string|null; due_date?: string|null; budget?: number|null; hours_budget?: number|null }
  tasks: Task[]; members: { id: string; name: string }[]; clients: { id: string; name: string; color: string }[]
  defaultClientId: string; projectOwnerId?: string; canManage: boolean; currentUserId?: string; userRole?: string
  totalHours: number; billableHours: number
}

type ViewTab = 'list' | 'board' | 'overview'

const BOARD_COLS = [
  { status: 'todo',        label: 'To do',       color:'var(--text-muted)' },
  { status: 'in_progress', label: 'In progress',  color: '#0d9488' },
  { status: 'in_review',   label: 'In review',    color: '#7c3aed' },
  { status: 'completed',   label: 'Done',         color: '#16a34a' },
]

export function ProjectView({ project, tasks: initialTasks, members, clients, defaultClientId, projectOwnerId, canManage, currentUserId, userRole, totalHours, billableHours }: Props) {
  const router = useRouter()
  const [tab,          setTab]          = useState<ViewTab>('list')
  const [clientFilter, setClientFilter] = useState('')
  const [tasks,        setTasks]        = useState<Task[]>(initialTasks)

  const visibleTasks = clientFilter ? tasks.filter(t => (t as any).client?.id === clientFilter || t.client_id === clientFilter) : tasks
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const panelHasUpdates = useRef(false)
  const panelTaskIdRef  = useRef<string | null>(null)
  React.useEffect(() => { panelHasUpdates.current = false }, [selectedTask?.id])
  React.useEffect(() => { if (selectedTask?.id) panelTaskIdRef.current = selectedTask.id }, [selectedTask?.id])
  const [checked,      setChecked]      = useState<Set<string>>(new Set())
  const [completing,   setCompleting]   = useState<Set<string>>(new Set())
  const [collapsed,    setCollapsed]    = useState<Record<string, boolean>>({})
  const [isPending,    startT]          = useTransition()
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({})
  const [subtaskData,  setSubtaskData]  = useState<Record<string, any[]>>({})
  const [loadingSubs,  setLoadingSubs]  = useState<Record<string, boolean>>({})
  const today = todayStr()
  const toolbarRef = useRef<HTMLDivElement>(null)

  function handleTaskUpdated(fields?: Record<string, unknown>) {
    const taskId = panelTaskIdRef.current  // stable even after panel closes
    if (fields && taskId) {
      const enriched: Record<string, unknown> = { ...fields }
      // Mirror server-side implicit clears: status→'todo' always nulls these fields
      if (fields.status === 'todo') {
        enriched.approval_status = enriched.approval_status ?? null
        enriched.completed_at    = enriched.completed_at    ?? null
      }
      if ('assignee_id' in fields) {
        const m = members.find(mb => mb.id === fields.assignee_id)
        enriched.assignee = m ? { id: m.id, name: m.name } : null
      }
      if ('client_id' in fields) {
        const c = clients.find(cl => cl.id === fields.client_id)
        enriched.client = c ? { id: c.id, name: c.name, color: c.color } : null
      }
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...enriched } as Task : t))
      setSelectedTask(prev => prev ? { ...prev, ...enriched } as Task : null)
      panelHasUpdates.current = true
    }
    startT(() => router.refresh())
  }

  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [sortBy,         setSortBy]         = useState<'due_date'|'priority'|'title'|'created_at'|'updated_at'>('due_date')
  const [sortDir,        setSortDir]        = useState<'asc'|'desc'>('asc')
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [customSections, setCustomSections] = useState<{key:string;label:string}[]>([])
  const [newSubInputs,    setNewSubInputs]    = useState<Record<string,string>>({})
  const [newSubAssignees, setNewSubAssignees] = useState<Record<string,string|null>>({})   // parentId → assigneeId for new subtask row
  const [newSubAssigneeOpen, setNewSubAssigneeOpen] = useState<Record<string,boolean>>({}) // parentId → dropdown open
  const [subAssigneeOpen, setSubAssigneeOpen] = useState<Record<string, boolean>>({})
  const [subDueDateEdit,  setSubDueDateEdit]  = useState<string | null>(null)          // subtask id
  const [taskAssigneeOpen,setTaskAssigneeOpen]= useState<Record<string, boolean>>({})
  const [taskDueDateEdit,  setTaskDueDateEdit] = useState<string | null>(null)          // task id

  const memberMap = React.useMemo(() => {
    const m: Record<string, string> = {}
    members.forEach(mb => { m[mb.id] = mb.name })
    return m
  }, [members])
  const [filterOpen,        setFilterOpen]        = useState(false)
  const [sortOpen,          setSortOpen]          = useState(false)
  const [savingTemplate,    setSavingTemplate]    = useState(false)
  const [templateSavedMsg,  setTemplateSavedMsg]  = useState('')
  const [cloning,           setCloning]           = useState(false)
  // Close filter/sort dropdowns on outside click
  useEffect(() => {
    function close(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // Filter + Sort state

  // Add Section state

  const total    = tasks.length
  const done     = visibleTasks.filter(t => t.status === 'completed').length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  // Apply filters
  const filteredTasks = tasks.filter(t => {
    if (filterAssignee && t.assignee_id !== filterAssignee) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (filterStatus   && t.status   !== filterStatus)   return false
    return true
  })

  // Apply sort
  const PRIORITY_ORDER: Record<string,number> = { urgent:0, high:1, medium:2, low:3, none:4 }
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'due_date') {
      if (!a.due_date && !b.due_date) cmp = 0
      else if (!a.due_date) cmp = 1
      else if (!b.due_date) cmp = -1
      else cmp = a.due_date.localeCompare(b.due_date)
    } else if (sortBy === 'priority') {
      cmp = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)
    } else if (sortBy === 'title') {
      cmp = a.title.localeCompare(b.title)
    } else if (sortBy === 'updated_at') {
      cmp = ((a as any).updated_at ?? '').localeCompare((b as any).updated_at ?? '')
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const activeFilters = [filterAssignee, filterPriority, filterStatus].filter(Boolean).length

  const SECTIONS = [
    { key: 'overdue',    label: 'Overdue',    color: '#dc2626', creator: false, tasks: sortedTasks.filter(t => t.status !== 'completed' && isOverdue(t.due_date, t.status)) },
    { key: 'todo',       label: 'To do',      color:'var(--text-secondary)', creator: true,  tasks: sortedTasks.filter(t => t.status === 'todo' && !isOverdue(t.due_date, t.status)) },
    { key: 'inprogress', label: 'In progress',color: '#0d9488', creator: false, tasks: sortedTasks.filter(t => t.status === 'in_progress') },
    { key: 'inreview',   label: 'In review',  color: '#7c3aed', creator: false, tasks: sortedTasks.filter(t => t.status === 'in_review') },
    { key: 'done',       label: 'Done',       color: '#16a34a', creator: false, tasks: sortedTasks.filter(t => t.status === 'completed') },
    ...customSections.map(s => ({ ...s, creator: true, tasks: [] as Task[] })),
  ]

  async function toggleSubExpand(taskId: string) {
    const isOpen = expandedSubs[taskId]
    if (isOpen) { setExpandedSubs(p => ({ ...p, [taskId]: false })); return }
    setExpandedSubs(p => ({ ...p, [taskId]: true }))
    if (subtaskData[taskId]) return
    setLoadingSubs(p => ({ ...p, [taskId]: true }))
    const r = await fetch(`/api/tasks?parent_id=${taskId}&limit=50`)
    const d = await r.json()
    setSubtaskData(p => ({ ...p, [taskId]: d.data ?? [] }))
    setLoadingSubs(p => ({ ...p, [taskId]: false }))
  }

  async function toggleSubDone(subId: string, status: string, parentId: string) {
    const newStatus = status === 'completed' ? 'todo' : 'completed'
    // Only CA compliance subtasks require attachment — check custom_fields flag
    if (newStatus === 'completed') {
      const sub = (subtaskData[parentId] ?? []).find((s: any) => s.id === subId)
      const isComplianceSub = sub?.custom_fields?._compliance_subtask === true
      if (isComplianceSub) {
        const attRes = await fetch(`/api/tasks/${subId}/attachments`)
        const attData = await attRes.json().catch(() => ({ data: [] }))
        if ((attData.data ?? []).length === 0) {
          toast.error('📎 Upload the required document before completing this CA compliance subtask')
          return
        }
      }
    }
    // Optimistic update on subtask
    setSubtaskData(p => ({
      ...p,
      [parentId]: (p[parentId] ?? []).map(s =>
        s.id === subId ? { ...s, status: newStatus } : s
      ),
    }))
    await fetch(`/api/tasks/${subId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }),
    })
    // Re-fetch fresh subtask list
    const r = await fetch(`/api/tasks?parent_id=${parentId}&limit=50`)
    const d = await r.json()
    const freshSubs: any[] = d.data ?? []
    setSubtaskData(p => ({ ...p, [parentId]: freshSubs }))

    // Auto-complete parent only when ALL subtasks are done
    if (freshSubs.length > 0 && freshSubs.every(s => s.status === 'completed')) {
      await fetch(`/api/tasks/${parentId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
      })
      toast.success('All subtasks done — task completed! 🎉')
    }
    startT(() => router.refresh())
  }

  async function addSubtaskInline(parentId: string, title: string, assigneeId?: string | null) {
    if (!title.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), parent_task_id: parentId, status: 'todo', priority: 'medium', assignee_id: assigneeId ?? null }),
    })
    if (res.ok) {
      setNewSubInputs(p => ({ ...p, [parentId]: '' }))
      setNewSubAssignees(p => ({ ...p, [parentId]: null }))
      const r = await fetch(`/api/tasks?parent_id=${parentId}&limit=50`)
      const d = await r.json()
      setSubtaskData(p => ({ ...p, [parentId]: d.data ?? [] }))
    }
  }

  async function assignSubtask(subId: string, assigneeId: string | null, parentId: string) {
    setSubAssigneeOpen(p => ({ ...p, [subId]: false }))
    setSubtaskData(p => ({
      ...p,
      [parentId]: (p[parentId] ?? []).map(s =>
        s.id === subId ? { ...s, assignee_id: assigneeId } : s
      ),
    }))
    await fetch(`/api/tasks/${subId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_id: assigneeId }),
    })
  }

  async function patchTaskInline(taskId: string, field: string, value: unknown, parentId?: string) {
    if (parentId) {
      setSubtaskData(p => ({
        ...p,
        [parentId]: (p[parentId] ?? []).map(s => s.id === taskId ? { ...s, [field]: value } : s),
      }))
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } as Task : t))
      if (selectedTask?.id === taskId) setSelectedTask(prev => prev ? { ...prev, [field]: value } as Task : null)
    }
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function toggleDone(task: Task, e: React.MouseEvent) {
    e.stopPropagation()

    // Reopen a completed task — optimistic
    if (task.status === 'completed') {
      const snap = tasks.map(t => t)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'todo', completed_at: null } : t))
      setSelectedTask(prev => prev?.id === task.id ? { ...prev, status: 'todo', completed_at: null } : prev)
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'todo', completed_at: null }),
      })
      if (!res.ok) { setTasks(snap); toast.error('Could not reopen task') }
      else startT(() => router.refresh())
      return
    }

    // Already pending approval
    if (task.status === 'in_review' || task.approval_status === 'pending') {
      toast.info('This task is pending approval — waiting for the approver.')
      return
    }

    // Check subtasks — must all be completed first
    // Load them if not already loaded
    let subs = subtaskData[task.id]
    if (!subs) {
      setLoadingSubs(p => ({ ...p, [task.id]: true }))
      const r = await fetch(`/api/tasks?parent_id=${task.id}&limit=50`)
      const d = await r.json()
      subs = d.data ?? []
      setSubtaskData(p => ({ ...p, [task.id]: subs }))
      setLoadingSubs(p => ({ ...p, [task.id]: false }))
    }

    if (subs.length > 0 && !subs.every((s: any) => s.status === 'completed')) {
      // Expand subtasks so user can see what's left
      setExpandedSubs(p => ({ ...p, [task.id]: true }))
      const remaining = subs.filter((s: any) => s.status !== 'completed').length
      toast.error(`Complete all subtasks first — ${remaining} remaining`)
      return
    }

    // Needs approval → submit for review
    if (task.approval_required) {
      setCompleting(p => new Set(p).add(task.id))
      const res = await fetch(`/api/tasks/${task.id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'submit' }),
      })
      setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
      if (res.ok) {
        const data = await res.json()
        if (data.auto_completed) {
          // No approver assigned — API auto-completed the task
          const completedAt = new Date().toISOString()
          setTasks(prev => prev.map(t => t.id === task.id
            ? { ...t, status: 'completed', approval_status: 'approved', completed_at: completedAt } as Task : t))
          setSelectedTask(prev => prev?.id === task.id
            ? { ...prev, status: 'completed', approval_status: 'approved', completed_at: completedAt } as Task : prev)
          toast.success('Task completed ✓')
        } else {
          // Pending approval — show clock icon immediately
          setTasks(prev => prev.map(t => t.id === task.id
            ? { ...t, status: 'in_review', approval_status: 'pending' } as Task : t))
          setSelectedTask(prev => prev?.id === task.id
            ? { ...prev, status: 'in_review', approval_status: 'pending' } as Task : prev)
          toast.success('Submitted for approval ✓')
        }
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Could not submit')
      }
      startT(() => router.refresh()); return
    }

    // Normal complete — optimistic
    const completeSnap = tasks.map(t => t)
    const completedAt = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', completed_at: completedAt } : t))
    setSelectedTask(prev => prev?.id === task.id ? { ...prev, status: 'completed', completed_at: completedAt } : prev)
    setCompleting(p => new Set(p).add(task.id))
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_at: completedAt }),
    })
    setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
    if (!res.ok) { setTasks(completeSnap); toast.error('Could not complete task') }
    toast.success('Done! 🎉')
    startT(() => router.refresh())
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task? It will move to Trash.')) return
    const snap = tasks.map(t => t)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setSelectedTask(prev => prev?.id === taskId ? null : prev)
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    if (!res.ok) {
      setTasks(snap)
      toast.error('Could not delete task')
    } else {
      toast.success('Moved to Trash')
      startT(() => router.refresh())
    }
  }

  async function cloneTask(task: Task) {
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:             `${task.title} (copy)`,
        status:            'todo',
        priority:          task.priority,
        assignee_id:       task.assignee_id ?? null,
        client_id:         (task as any).client_id ?? null,
        project_id:        (task as any).project_id ?? null,
        approver_id:       (task as any).approver_id ?? null,
        approval_required: (task as any).approval_required ?? false,
        due_date:          task.due_date ?? null,
        custom_fields:     (task as any).custom_fields ?? null,
      }),
    })
    const d = await res.json()
    if (!res.ok) { toast.error(d.error ?? 'Clone failed'); return }
    const newTask = d.data ?? d
    if (newTask?.id) setTasks(prev => [{ ...newTask, assignee: (task as any).assignee, client: (task as any).client } as Task, ...prev])
    toast.success('Task cloned')
  }

  async function bulkComplete() {
    const ids = [...checked]
    const allTasks = tasks.filter(t => ids.includes(t.id))
    const canComplete   = allTasks.filter(t => !t.approval_required)
    const needsApproval = allTasks.filter(t => t.approval_required)
    await Promise.all(canComplete.map(t => fetch(`/api/tasks/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    })))
    setChecked(new Set())
    if (canComplete.length) toast.success(`${canComplete.length} tasks completed 🎉`)
    if (needsApproval.length) toast.info(`${needsApproval.length} task(s) need approval — skipped`)
    startT(() => router.refresh())
  }

  async function handleSaveAsTemplate() {
    setSavingTemplate(true)
    setTemplateSavedMsg('')
    try {
      const res = await fetch(`/api/projects/${project.id}/save-as-template`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not save template'); return }
      setTemplateSavedMsg(`Saved! ${data.task_count} tasks · ${data.subtask_count} subtasks`)
      toast.success(`"${project.name}" saved as org template ✓`)
      setTimeout(() => setTemplateSavedMsg(''), 4000)
    } catch { toast.error('Network error') } finally { setSavingTemplate(false) }
  }

  async function handleClone() {
    if (!confirm(`Clone "${project.name}"? A copy with all tasks will be created.`)) return
    setCloning(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/clone`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not clone project'); return }
      toast.success(`Project cloned — ${data.task_count} tasks copied ✓`)
      router.push(`/projects/${data.id}`)
    } catch { toast.error('Network error') } finally { setCloning(false) }
  }

  function TaskRow({ task }: { task: Task }) {
    const ov       = isOverdue(task.due_date, task.status)
    const isComp   = task.status === 'completed'
    const assignee = task.assignee as unknown as { id: string; name: string } | null
    const statConf = STATUS_CONFIG[task.status]
    const subs     = subtaskData[task.id] ?? []
    const subsDone = subs.filter((s: any) => s.status === 'completed').length
    const hasUndone = subs.length > 0 && subsDone < subs.length

    const isPending = task.status === 'in_review' || task.approval_status === 'pending'
    const _isCaComp = (task as any).custom_fields?._ca_compliance === true
    const _typeAccent = _isCaComp ? '#d97706' : '#7c3aed'
    const _typeBg = checked.has(task.id) ? undefined : isPending ? '#faf5ff' : _isCaComp ? 'rgba(234,179,8,0.07)' : 'rgba(124,58,237,0.05)'

    return (
      <>
      <div className={cn('task-row group', selectedTask?.id === task.id && 'selected', checked.has(task.id) && 'bg-teal-50/60')}
        style={{ background: _typeBg, borderLeft: `3px solid ${selectedTask?.id === task.id ? 'var(--brand)' : _typeAccent}` }}>
        <input type="checkbox" checked={checked.has(task.id)}
          onChange={() => setChecked(p => { const s = new Set(p); s.has(task.id) ? s.delete(task.id) : s.add(task.id); return s })}
          onClick={e => e.stopPropagation()} className="h-3.5 w-3.5 rounded border-gray-300 accent-teal-600 flex-shrink-0 cursor-pointer"/>
        {/* Check circle */}
        {(canManage || task.assignee_id === currentUserId) ? (
          isPending ? (
            <div title="Pending approval"
              className="task-check flex-shrink-0"
              style={{ background: '#f5f3ff', borderColor: '#7c3aed', cursor: 'default' }}>
              <Clock className="h-2 w-2" style={{ color: '#7c3aed' }}/>
            </div>
          ) : (
            <button onClick={e => toggleDone(task, e)}
              className={cn('task-check flex-shrink-0', isComp && 'done', completing.has(task.id) && 'popping')}>
              {isComp && <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5"><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          )
        ) : (
          <div className={cn('task-check flex-shrink-0', isComp && 'done')} style={{ cursor: 'default', opacity: 0.5 }}>
            {isComp && <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5"><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        )}
        <div className="flex-1 min-w-0 flex items-center gap-2" onClick={() => setSelectedTask(task)}>
          <span className={cn('text-sm', isComp ? 'line-through text-gray-400' : ov ? 'text-red-700' : 'text-gray-900')}>{task.title}</span>
        </div>
        {/* Subtask expand toggle — shows count + warns if incomplete */}
        <button
          onClick={e => { e.stopPropagation(); toggleSubExpand(task.id) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
            borderRadius: 6,
            border: `1px solid ${hasUndone ? '#fbbf24' : expandedSubs[task.id] ? 'var(--brand-border)' : 'var(--border)'}`,
            background: hasUndone ? '#fffbeb' : expandedSubs[task.id] ? 'var(--brand-light)' : 'transparent',
            color: hasUndone ? '#92400e' : expandedSubs[task.id] ? 'var(--brand)' : 'var(--text-muted)',
            fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            transition: 'all 0.1s',
          }}
          title={subs.length ? `${subsDone}/${subs.length} subtasks done` : 'Add subtasks'}>
          <svg viewBox="0 0 12 12" fill="none" style={{ width: 9, height: 9 }}>
            <path d="M2 3h8M4 6h6M6 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {subs.length > 0 ? `${subsDone}/${subs.length}` : '+'}
        </button>
        {/* ── Assignee inline picker ── */}
        <div className="w-36 hidden md:flex items-center gap-2 pl-2" style={{ position: 'relative' }}
          onClick={e => { e.stopPropagation(); if (canManage) setTaskAssigneeOpen(p => ({...p, [task.id]: !p[task.id]})); else setSelectedTask(task) }}>
          {taskAssigneeOpen[task.id] && canManage && (
            <>
              <div style={{ position:'fixed', inset:0, zIndex:49 }}
                onClick={e => { e.stopPropagation(); setTaskAssigneeOpen(p => ({...p, [task.id]:false})) }}/>
              <div style={{ position:'absolute', left:0, top:'calc(100% + 4px)', zIndex:50,
                background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)',
                minWidth:160, overflow:'hidden' }}>
                <button onClick={e => { e.stopPropagation(); setTaskAssigneeOpen(p=>({...p,[task.id]:false})); patchTaskInline(task.id,'assignee_id',null) }}
                  style={{ width:'100%', textAlign:'left', padding:'7px 12px', fontSize:12, border:'none',
                    cursor:'pointer', color:'var(--text-muted)', fontFamily:'inherit',
                    background: !task.assignee_id?'var(--surface-subtle)':'transparent' }}>
                  Unassigned
                </button>
                {members.map(m => (
                  <button key={m.id} onClick={e => { e.stopPropagation(); setTaskAssigneeOpen(p=>({...p,[task.id]:false})); patchTaskInline(task.id,'assignee_id',m.id) }}
                    style={{ width:'100%', textAlign:'left', padding:'7px 12px', fontSize:12, border:'none',
                      cursor:'pointer', fontFamily:'inherit', color:'var(--text-primary)',
                      fontWeight: task.assignee_id===m.id?600:400,
                      background: task.assignee_id===m.id?'var(--surface-subtle)':'transparent' }}>
                    {m.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {assignee
            ? <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:99,
                background: canManage?'var(--brand-light)':'var(--surface-subtle)',
                border:`1px solid ${canManage?'var(--brand-border)':'var(--border)'}`,
                fontSize:11, fontWeight:500, color: canManage?'var(--brand)':'var(--text-secondary)',
                maxWidth:120, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                cursor: canManage?'pointer':'default' }}>
                {assignee.name.split(' ')[0]}
              </span>
            : task.assignee_id
              ? <span className="text-xs" style={{ color:'var(--text-muted)' }}>Assigned</span>
              : <span className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ fontSize:11, color:'var(--brand)', background:'var(--brand-light)',
                    border:'1px solid var(--brand-border)', borderRadius:6, padding:'2px 8px',
                    whiteSpace:'nowrap', fontWeight:600, display: canManage?'inline':'none' }}>
                  + Assign
                </span>
          }
        </div>
        {/* ── Due date inline picker ── */}
        <div className="w-24 hidden md:block text-center" style={{ position:'relative' }}
          onClick={e => { e.stopPropagation(); if (canManage) setTaskDueDateEdit(task.id); else setSelectedTask(task) }}>
          {taskDueDateEdit === task.id ? (
            <>
              <div style={{ position:'fixed', inset:0, zIndex:49 }}
                onClick={e => { e.stopPropagation(); setTaskDueDateEdit(null) }}/>
              <input
                autoFocus
                type="date"
                defaultValue={task.due_date ?? ''}
                onClick={e => e.stopPropagation()}
                onChange={e => { patchTaskInline(task.id, 'due_date', e.target.value || null); setTaskDueDateEdit(null) }}
                onBlur={() => setTaskDueDateEdit(null)}
                style={{ fontSize:11, padding:'2px 5px', borderRadius:6, border:'1px solid var(--brand)',
                  background:'var(--surface)', outline:'none', colorScheme:'light dark',
                  fontFamily:'inherit', position:'absolute', right:0, top:'50%', transform:'translateY(-50%)',
                  zIndex:50, width:130 }}
              />
            </>
          ) : (
            <span className="text-xs" title={canManage ? 'Click to set date' : undefined}
              style={{ color: ov?'#dc2626':'#94a3b8', cursor: canManage?'pointer':'default' }}>
              {task.due_date ? fmtDate(task.due_date) : (canManage ? <span className="opacity-0 group-hover:opacity-60" style={{fontSize:11}}>+ Date</span> : null)}
            </span>
          )}
        </div>
        <div className="w-28 hidden lg:flex justify-center" onClick={() => setSelectedTask(task)}>
          {task.status !== 'todo' && (
            <span className="status-badge" style={{ background: statConf.bg, color: statConf.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: statConf.dot }}/>{statConf.label}
            </span>
          )}
        </div>
        {/* Priority dot + Clone + Delete buttons */}
        <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          <div title={task.priority}
            style={{ width:8, height:8, borderRadius:'50%',
              background: {'none':'#94a3b8','low':'#16a34a','medium':'#ca8a04','high':'#ea580c','urgent':'#dc2626'}[task.priority] ?? '#94a3b8' }}/>
          <button
            onClick={e => { e.stopPropagation(); cloneTask(task) }}
            className="opacity-0 group-hover:opacity-100"
            title="Clone task"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6, border: 'none',
              background: 'transparent', cursor: 'pointer',
              color: 'var(--text-muted)', transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(13,148,136,0.1)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--brand)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
            }}>
            <Copy className="h-3 w-3"/>
          </button>
          {canManage && (
            <button
              onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
              className="opacity-0 group-hover:opacity-100"
              title="Delete task"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, borderRadius: 6, border: 'none',
                background: 'transparent', cursor: 'pointer',
                color: 'var(--text-muted)', transition: 'all 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = '#fef2f2'
                ;(e.currentTarget as HTMLElement).style.color = '#dc2626'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
              }}>
              <Trash2 className="h-3 w-3"/>
            </button>
          )}
        </div>
      </div>

      {/* Inline subtasks */}
      {expandedSubs[task.id] && (
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-subtle)', position: 'relative' }}>
          {/* Vertical tree connector line */}
          <div style={{
            position: 'absolute', left: 34, top: 0, bottom: 20,
            width: 1.5, background: 'rgba(13,148,136,0.18)', borderRadius: 1,
            pointerEvents: 'none',
          }}/>
          {/* Progress bar */}
          {subs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 16px 3px 52px' }}>
              <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: subsDone === subs.length ? '#16a34a' : 'var(--brand)',
                  width: `${subs.length ? Math.round(subsDone / subs.length * 100) : 0}%`,
                  transition: 'width 0.3s ease',
                }}/>
              </div>
              <span style={{ fontSize: 10, color: subsDone === subs.length ? '#16a34a' : 'var(--text-muted)', flexShrink: 0, fontWeight: 600 }}>
                {subsDone}/{subs.length} done
              </span>
            </div>
          )}
          {loadingSubs[task.id] && (
            <div style={{ padding: '8px 48px', fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
          )}
          {subs.map((sub: any) => (
            <div key={sub.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 16px 5px 44px',
              borderBottom: '1px solid var(--border-light)',
            }}>
              {/* Tree corner connector */}
              <svg viewBox="0 0 10 10" fill="none" style={{ width: 9, height: 9, flexShrink: 0, marginRight: -2, opacity: 0.5 }}>
                <path d="M2 0v6h8" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <button onClick={() => toggleSubDone(sub.id, sub.status, task.id)}
                style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: 'none',
                  background: sub.status === 'completed' ? 'var(--brand)' : 'transparent',
                  outline: `2px solid ${sub.status === 'completed' ? 'var(--brand)' : 'var(--border)'}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                {sub.status === 'completed' && (
                  <svg viewBox="0 0 10 10" fill="none" style={{ width: 8, height: 8 }}>
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
              <span style={{
                flex: 1, fontSize: 12,
                color: sub.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: sub.status === 'completed' ? 'line-through' : 'none',
              }}>{sub.title}</span>
              {/* Inline due date picker */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {subDueDateEdit === sub.id ? (
                  <>
                    <div style={{ position:'fixed', inset:0, zIndex:49 }}
                      onClick={() => setSubDueDateEdit(null)}/>
                    <input
                      autoFocus
                      type="date"
                      defaultValue={sub.due_date ?? ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { patchTaskInline(sub.id, 'due_date', e.target.value||null, task.id); setSubDueDateEdit(null) }}
                      onBlur={() => setSubDueDateEdit(null)}
                      style={{ fontSize:11, padding:'2px 5px', borderRadius:6, border:'1px solid var(--brand)',
                        background:'var(--surface)', outline:'none', colorScheme:'light dark',
                        fontFamily:'inherit', zIndex:50, position:'relative', width:120 }}
                    />
                  </>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setSubDueDateEdit(sub.id) }}
                    style={{ fontSize:11, padding:'2px 8px', borderRadius:20, cursor:'pointer',
                      border:'1px solid var(--border)',
                      background: sub.due_date ? 'rgba(13,148,136,0.07)' : 'var(--surface)',
                      color: sub.due_date
                        ? (isOverdue(sub.due_date, sub.status) ? '#dc2626' : 'var(--brand)')
                        : 'var(--text-muted)',
                      whiteSpace:'nowrap', fontWeight: sub.due_date ? 600 : 400, fontFamily:'inherit' }}>
                    {sub.due_date ? fmtDate(sub.due_date) : '+ Date'}
                  </button>
                )}
              </div>
              {/* Inline assignee selector */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={e => { e.stopPropagation(); setSubAssigneeOpen(p => ({ ...p, [sub.id]: !p[sub.id] })) }}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20, cursor: 'pointer',
                    border: '1px solid var(--border)', background: sub.assignee_id ? 'rgba(13,148,136,0.07)' : 'var(--surface)',
                    color: sub.assignee_id ? 'var(--brand)' : 'var(--text-muted)', whiteSpace: 'nowrap',
                    fontWeight: sub.assignee_id ? 600 : 400, fontFamily: 'inherit',
                  }}
                >
                  {sub.assignee_id ? (memberMap[sub.assignee_id]?.split(' ')[0] ?? 'Assigned') : '+ Assign'}
                </button>
                {subAssigneeOpen[sub.id] && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                      onClick={() => setSubAssigneeOpen(p => ({ ...p, [sub.id]: false }))}
                    />
                    <div style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      minWidth: 148, overflow: 'hidden',
                    }}>
                      <button
                        onClick={() => assignSubtask(sub.id, null, task.id)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12,
                          background: !sub.assignee_id ? 'var(--surface-subtle)' : 'transparent',
                          border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit',
                        }}
                      >Unassigned</button>
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => assignSubtask(sub.id, m.id, task.id)}
                          style={{
                            width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12,
                            background: sub.assignee_id === m.id ? 'var(--surface-subtle)' : 'transparent',
                            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            color: 'var(--text-primary)', fontWeight: sub.assignee_id === m.id ? 600 : 400,
                          }}
                        >{m.name}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {/* Inline add subtask */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 16px 6px 62px' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: '1.5px dashed var(--brand)', opacity: 0.5 }}/>
            <input
              value={newSubInputs[task.id] ?? ''}
              onChange={e => setNewSubInputs(p => ({...p, [task.id]: e.target.value}))}
              onKeyDown={e => {
                if (e.key === 'Enter' && (newSubInputs[task.id] ?? '').trim()) {
                  addSubtaskInline(task.id, newSubInputs[task.id], newSubAssignees[task.id])
                  setNewSubInputs(p => ({...p, [task.id]: ''}))
                }
                if (e.key === 'Escape') {
                  setNewSubInputs(p => ({...p, [task.id]: ''}))
                  setNewSubAssignees(p => ({...p, [task.id]: null}))
                }
              }}
              placeholder="Add subtask… (Enter)"
              style={{
                flex: 1, fontSize: 12, border: 'none', outline: 'none',
                background: 'transparent', color: 'var(--text-primary)',
              }}
            />
            {/* Assignee picker for new subtask */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {newSubAssigneeOpen[task.id] && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                    onClick={() => setNewSubAssigneeOpen(p => ({...p, [task.id]: false}))}/>
                  <div style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 4px)', zIndex: 50,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    minWidth: 148, overflow: 'hidden' }}>
                    <button
                      onClick={() => { setNewSubAssignees(p => ({...p,[task.id]:null})); setNewSubAssigneeOpen(p=>({...p,[task.id]:false})) }}
                      style={{ width:'100%', textAlign:'left', padding:'7px 12px', fontSize:12,
                        background: !newSubAssignees[task.id]?'var(--surface-subtle)':'transparent',
                        border:'none', cursor:'pointer', color:'var(--text-muted)', fontFamily:'inherit' }}>
                      Unassigned
                    </button>
                    {members.map(m => (
                      <button key={m.id}
                        onClick={() => { setNewSubAssignees(p => ({...p,[task.id]:m.id})); setNewSubAssigneeOpen(p=>({...p,[task.id]:false})) }}
                        style={{ width:'100%', textAlign:'left', padding:'7px 12px', fontSize:12,
                          background: newSubAssignees[task.id]===m.id?'var(--surface-subtle)':'transparent',
                          border:'none', cursor:'pointer', fontFamily:'inherit', color:'var(--text-primary)',
                          fontWeight: newSubAssignees[task.id]===m.id?600:400 }}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button
                onClick={() => setNewSubAssigneeOpen(p => ({...p, [task.id]: !p[task.id]}))}
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: newSubAssignees[task.id] ? 'rgba(13,148,136,0.07)' : 'var(--surface)',
                  color: newSubAssignees[task.id] ? 'var(--brand)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap', fontWeight: newSubAssignees[task.id] ? 600 : 400, fontFamily: 'inherit' }}>
                {newSubAssignees[task.id] ? (memberMap[newSubAssignees[task.id]!]?.split(' ')[0] ?? 'Assigned') : '+ Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Progress bar */}
      <div className="px-6 py-3" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: progress >= 80 ? '#16a34a' : project.color }}/>
          </div>
          <span className="text-xs text-gray-400">{done}/{total} tasks · {progress}%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar px-6" style={{ background: 'var(--surface)' }}>
        {(['list','board','overview'] as ViewTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('tab-item capitalize', tab === t && 'active')}>{t}</button>
        ))}
      </div>

      {/* LIST view */}
      {tab === 'list' && (
        <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--surface)' }}>
          <div className="toolbar" ref={toolbarRef}>
            {checked.size > 0 ? (
              <><span className="text-sm font-medium text-gray-700 mr-2">{checked.size} selected</span>
                <button onClick={bulkComplete} className="btn btn-brand btn-sm flex items-center gap-1.5"><CheckCheck className="h-3.5 w-3.5"/> Complete</button>
                <button onClick={() => setChecked(new Set(filteredTasks.map(t => t.id)))}
                  style={{ background:'transparent', border:'1px solid var(--border)', padding:'5px 12px',
                    borderRadius:7, fontSize:12, fontWeight:500, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'inherit' }}>
                  Select all
                </button>
                <button onClick={() => setChecked(new Set())} className="btn btn-ghost btn-sm">Cancel</button></>
            ) : (
              <>
                {/* Filter button */}
                <div style={{position:'relative'}}>
                  <button onClick={() => { setFilterOpen(o=>!o); setSortOpen(false) }}
                    className="toolbar-btn"
                    style={{ color: activeFilters > 0 ? 'var(--brand)' : undefined,
                             background: activeFilters > 0 ? 'var(--brand-light)' : undefined }}>
                    <Filter className="h-3.5 w-3.5"/>
                    Filter{activeFilters > 0 ? ` (${activeFilters})` : ''}
                  </button>
                  {filterOpen && (
                    <div style={{ position:'absolute', top:'100%', left:0, marginTop:4,
                      background:'var(--surface)', border:'1px solid var(--border)',
                      borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:9999,
                      padding:12, minWidth:220 }} onClick={e=>e.stopPropagation()}>
                      <p style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',
                        textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Filter by</p>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        <div>
                          <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:3}}>Assignee</label>
                          <select value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)}
                            style={{width:'100%',padding:'5px 8px',borderRadius:6,border:'1px solid var(--border)',
                              background:'var(--surface)',color:'var(--text-primary)',fontSize:12}}>
                            <option value="">All members</option>
                            {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:3}}>Priority</label>
                          <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}
                            style={{width:'100%',padding:'5px 8px',borderRadius:6,border:'1px solid var(--border)',
                              background:'var(--surface)',color:'var(--text-primary)',fontSize:12}}>
                            <option value="">All priorities</option>
                            {['urgent','high','medium','low','none'].map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:3}}>Status</label>
                          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                            style={{width:'100%',padding:'5px 8px',borderRadius:6,border:'1px solid var(--border)',
                              background:'var(--surface)',color:'var(--text-primary)',fontSize:12}}>
                            <option value="">All statuses</option>
                            {['todo','in_progress','in_review','completed'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
                          </select>
                        </div>
                        {activeFilters > 0 && (
                          <button onClick={()=>{ setFilterAssignee(''); setFilterPriority(''); setFilterStatus(''); setFilterOpen(false) }}
                            style={{padding:'5px 0',borderRadius:6,border:'none',background:'var(--border-light)',
                              color:'var(--text-secondary)',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {canManage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                    <button
                      onClick={handleClone}
                      disabled={cloning}
                      className="toolbar-btn"
                      style={{ opacity: cloning ? 0.6 : 1 }}
                      title="Clone this project with all its tasks">
                      <Copy className="h-3.5 w-3.5"/>
                      {cloning ? 'Cloning…' : 'Clone project'}
                    </button>
                    <button
                      onClick={handleSaveAsTemplate}
                      disabled={savingTemplate}
                      className="toolbar-btn"
                      style={{ color: templateSavedMsg ? '#16a34a' : 'var(--brand)', background: templateSavedMsg ? 'rgba(22,163,74,0.08)' : 'var(--brand-light)', borderColor: templateSavedMsg ? '#16a34a' : 'var(--brand-border)', opacity: savingTemplate ? 0.6 : 1 }}
                      title="Save current tasks as a reusable org template">
                      <BookmarkPlus className="h-3.5 w-3.5"/>
                      {savingTemplate ? 'Saving…' : templateSavedMsg ? templateSavedMsg : 'Save as template'}
                    </button>
                  </div>
                )}

                {/* Sort button */}
                <div style={{position:'relative'}}>
                  <button onClick={() => { setSortOpen(o=>!o); setFilterOpen(false) }} className="toolbar-btn"
                    style={{ color: sortBy !== 'due_date' ? 'var(--brand)' : undefined,
                             background: sortBy !== 'due_date' ? 'var(--brand-light)' : undefined }}>
                    <SortAsc className="h-3.5 w-3.5"/>
                    Sort{sortBy !== 'due_date' ? ': '+sortBy.replace('_',' ') : ''}
                  </button>
                  {sortOpen && (
                    <div style={{ position:'absolute', top:'100%', left:0, marginTop:4,
                      background:'var(--surface)', border:'1px solid var(--border)',
                      borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:9999,
                      padding:12, minWidth:200 }} onClick={e=>e.stopPropagation()}>
                      <p style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',
                        textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Sort by</p>
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        {([['due_date','Due date'],['priority','Priority'],['title','Title'],['created_at','Created date'],['updated_at','Modified date']] as const).map(([val,label])=>(
                          <button key={val} onClick={()=>{
                            if(sortBy===val) setSortDir(d=>d==='asc'?'desc':'asc')
                            else { setSortBy(val); setSortDir('asc') }
                          }} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'7px 10px', borderRadius:6, border:'none', cursor:'pointer',
                            background: sortBy===val ? 'var(--brand-light)' : 'transparent',
                            color: sortBy===val ? 'var(--brand)' : 'var(--text-primary)',
                            fontSize:13, fontWeight: sortBy===val ? 600 : 400, textAlign:'left',
                          }}>
                            {label}
                            {sortBy===val && <span style={{fontSize:10}}>{sortDir==='asc'?'↑':'↓'}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center px-5 py-3 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide sticky top-0 z-10"
            style={{ gap: 12, background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {/* checkbox (14px) + gap(12) + check-circle (18px) = 44px */}
            <div style={{ width: 44, flexShrink: 0 }}/>
            <div className="flex-1">Task name</div>
            {/* subtask toggle button placeholder */}
            <div style={{ width: 52, flexShrink: 0 }}/>
            <div className="w-36 pl-2 hidden md:block">Assignee</div>
            <div className="w-24 text-center hidden md:block">Due date</div>
            <div className="w-28 text-center hidden lg:block">Status</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {SECTIONS.map(section => {
              if (section.tasks.length === 0 && !section.creator) return null
              const isCollapsed = collapsed[section.key]
              return (
                <div key={section.key}>
                  <button onClick={() => setCollapsed(p => ({ ...p, [section.key]: !p[section.key] }))}
                    className="section-header w-full text-left hover:opacity-80 transition-opacity" style={{ color: section.color }}>
                    <span className="transition-transform inline-block" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }}>▾</span>
                    {section.label} <span className="opacity-40 font-normal normal-case text-xs">({section.tasks.length})</span>
                  </button>
                  {!isCollapsed && (
                    <>
                      {section.tasks.map(t => <React.Fragment key={t.id}>{TaskRow({ task: t })}</React.Fragment>)}
                      {section.creator && canManage && (
                        <InlineTaskRow projectId={project.id} projectOwnerId={projectOwnerId} defaultClientId={defaultClientId} members={members} clients={clients}
                          currentUserId={currentUserId} defaultStatus="todo" onCreated={(newTask) => {
                          if (newTask?.id) {
                            setTasks(prev => [{
                              ...newTask,
                              status: newTask.status ?? 'todo',
                              priority: newTask.priority ?? 'medium',
                              assignee: members.find(m => m.id === newTask.assignee_id) ?? null,
                              client: clients.find(cl => cl.id === newTask.client_id) ?? null,
                              subtasks: [],
                            } as any, ...prev])
                          }
                          startT(() => router.refresh())
                        }}/>
                      )}</>
                  )}
                </div>
              )
            })}
            {/* Add section */}
            {addSectionOpen ? (
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',
                borderTop:'1px solid var(--border)',background:'var(--brand-light)'}}>
                <Plus style={{width:14,height:14,color:'var(--brand)',flexShrink:0}}/>
                <input
                  value={newSectionName}
                  onChange={e=>setNewSectionName(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==='Enter' && newSectionName.trim()){
                      const key = 'custom_'+Date.now()
                      setCustomSections(p=>[...p,{key,label:newSectionName.trim(),color:'var(--text-secondary)'}])
                      setNewSectionName('')
                      setAddSectionOpen(false)
                    }
                    if(e.key==='Escape'){setAddSectionOpen(false);setNewSectionName('')}
                  }}
                  placeholder="Section name… (Enter to add)"
                  autoFocus
                  style={{flex:1,padding:'5px 8px',borderRadius:6,border:'1px solid var(--brand)',
                    outline:'none',fontSize:13,background:'var(--surface)',color:'var(--text-primary)'}}
                />
                <button onClick={()=>{
                  if(newSectionName.trim()){
                    const key='custom_'+Date.now()
                    setCustomSections(p=>[...p,{key,label:newSectionName.trim(),color:'var(--text-secondary)'}])
                    setNewSectionName('')
                  }
                  setAddSectionOpen(false)
                }} style={{padding:'5px 12px',borderRadius:6,border:'none',background:'var(--brand)',
                  color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  Add
                </button>
                <button onClick={()=>{setAddSectionOpen(false);setNewSectionName('')}}
                  style={{padding:'5px 8px',borderRadius:6,border:'none',background:'transparent',
                    color:'var(--text-muted)',fontSize:12,cursor:'pointer'}}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={()=>setAddSectionOpen(true)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',
                  fontSize:13,color:'var(--text-muted)',background:'transparent',border:'none',
                  cursor:'pointer',width:'100%',textAlign:'left',transition:'color 0.1s'}}
                onMouseEnter={e=>(e.currentTarget.style.color='var(--brand)')}
                onMouseLeave={e=>(e.currentTarget.style.color='var(--text-muted)')}>
                <Plus style={{width:14,height:14}}/> Add section
              </button>
            )}
          </div>
        </div>
      )}

      {/* BOARD view */}
      {tab === 'board' && (
        <div className="flex-1 overflow-x-auto p-4" style={{ background: 'var(--surface-subtle)' }}>
          <div className="flex gap-4 h-full min-w-max">
            {BOARD_COLS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.status)
              return (
                <div key={col.status} className="kanban-col">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }}/>
                    <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{colTasks.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {colTasks.map(task => {
                      const assignee = task.assignee as unknown as { id: string; name: string } | null
                      const pri      = PRIORITY_CONFIG[task.priority]
                      const boardPending = task.status === 'in_review' || task.approval_status === 'pending'
                      return (
                        <div key={task.id} onClick={() => setSelectedTask(task)}
                          className={cn('bg-white rounded-xl p-3 cursor-pointer hover:shadow-md transition-all border',
                            selectedTask?.id === task.id ? 'border-teal-400 shadow-md' : boardPending ? 'border-violet-200' : 'border-gray-100 shadow-sm')}>
                          <div className="flex items-start gap-2 mb-2">
                            {boardPending ? (
                              <div className="task-check mt-0.5 flex-shrink-0"
                                style={{ background: '#f5f3ff', borderColor: '#7c3aed', cursor: 'default' }}
                                title="Pending approval">
                                <Clock className="h-2 w-2" style={{ color: '#7c3aed' }}/>
                              </div>
                            ) : (
                              <button onClick={e => toggleDone(task, e)}
                                className={cn('task-check mt-0.5 flex-shrink-0', task.status === 'completed' && 'done')}>
                                {task.status === 'completed' && <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5"><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </button>
                            )}
                            <p className={cn('text-sm font-medium leading-snug flex-1',
                              task.status === 'completed' ? 'line-through text-gray-400'
                              : boardPending ? 'text-violet-700' : 'text-gray-900')}>{task.title}</p>
                          </div>
                          {boardPending && (
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ fontSize: 10, background: '#ede9fe', color: '#7c3aed',
                                padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>⏳ Pending approval</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5">
                              <PriorityBadge priority={task.priority}/>
                              {task.due_date && <span className="text-xs text-gray-400">{fmtDate(task.due_date)}</span>}
                            </div>
                            {assignee && <Avatar name={assignee.name} size="xs"/>}
                          </div>
                        </div>
                      )
                    })}
                    {col.status === 'todo' && canManage && (
                      <InlineTaskRow projectId={project.id} projectOwnerId={projectOwnerId} defaultClientId={defaultClientId} members={members} clients={clients}
                        currentUserId={currentUserId} defaultStatus="todo" onCreated={(newTask) => {
                          if (newTask?.id) {
                            setTasks(prev => [{
                              ...newTask,
                              status: newTask.status ?? 'todo',
                              priority: newTask.priority ?? 'medium',
                              assignee: members.find(m => m.id === newTask.assignee_id) ?? null,
                              client: clients.find(cl => cl.id === newTask.client_id) ?? null,
                              subtasks: [],
                            } as any, ...prev])
                          }
                          startT(() => router.refresh())
                        }}/>
                    )}
                    {colTasks.length === 0 && col.status !== 'todo' && (
                      <div className="text-center py-8 text-xs text-gray-300">No tasks</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* OVERVIEW tab */}
      {tab === 'overview' && (
        <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--surface-subtle)' }}>
          <div className="max-w-3xl mx-auto grid grid-cols-2 gap-5">
            {/* Progress ring */}
            <div className="card-elevated p-5 col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Progress</h3>
              <div className="flex items-center gap-6">
                <div className="relative h-20 w-20 flex-shrink-0">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="30" fill="none" stroke="#f1f5f9" strokeWidth="10"/>
                    <circle cx="40" cy="40" r="30" fill="none" stroke={project.color} strokeWidth="10"
                      strokeDasharray={`${(progress/100)*188.5} 188.5`} strokeLinecap="round"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">{progress}%</span>
                </div>
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <Stat label="Total tasks" value={total} color="#64748b"/>
                  <Stat label="Completed"   value={done}  color="#16a34a"/>
                  <Stat label="In progress" value={tasks.filter(t => t.status === 'in_progress').length} color={project.color}/>
                  <Stat label="Overdue"     value={tasks.filter(t => isOverdue(t.due_date, t.status)).length} color="#dc2626"/>
                </div>
              </div>
            </div>

            {/* Time tracking */}
            <div className="card-elevated p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400"/> Time</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Total logged</span><span className="font-semibold text-gray-900">{fmtHours(totalHours)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Billable</span><span className="font-semibold text-green-600">{fmtHours(billableHours)}</span></div>
                {project.hours_budget && <div className="flex justify-between text-sm"><span className="text-gray-500">Budget</span><span className="font-semibold text-gray-700">{project.hours_budget}h</span></div>}
              </div>
            </div>

            {/* Description */}
            <div className="card-elevated p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
              {project.description ? (
                <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
              ) : <p className="text-sm text-gray-400 italic">No description added.</p>}
              {project.due_date && <p className="text-xs text-gray-400 mt-3">Due: {fmtDate(project.due_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
              {(project as any).clients && (
                <div className="flex items-center gap-2 mt-3">
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: ((project as any).clients as any).color ?? '#94a3b8', flexShrink: 0 }}/>
                  <span className="text-xs text-gray-500">Client: <span className="font-medium text-gray-700">{((project as any).clients as any).name}</span></span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <TaskDetailPanel task={selectedTask} members={members} clients={clients}
        currentUserId={currentUserId} userRole={userRole}
        onClose={() => {
          if (panelHasUpdates.current) {
            if (selectedTask) setTasks(prev => prev.map(t => t.id === panelTaskIdRef.current ? { ...t, ...selectedTask as unknown as Task } : t))
            toast.success('Task updated')
            panelHasUpdates.current = false
          }
          setSelectedTask(null)
        }}
        onUpdated={handleTaskUpdated}/>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div><p className="text-xs text-gray-400">{label}</p><p className="text-xl font-bold" style={{ color }}>{value}</p></div>
  )
}