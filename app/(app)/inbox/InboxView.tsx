'use client'
import React from 'react'
import { useState, useTransition } from 'react'
import { useRouter }          from 'next/navigation'
import { CheckCheck, Clock } from 'lucide-react'
import { InlineOneTimeTask }  from '@/components/tasks/InlineOneTimeTask'
import { CompletionAttachModal } from '@/components/tasks/CompletionAttachModal'
import { TaskDetailPanel }    from '@/components/tasks/TaskDetailPanel'
import { cn }                 from '@/lib/utils/cn'
import { toast }              from '@/store/appStore'
import { fmtDate, isOverdue, todayStr } from '@/lib/utils/format'
import { PRIORITY_CONFIG }    from '@/types'
import type { Task }          from '@/types'

interface Props {
  tasks:          Task[]
  members:        { id: string; name: string; role?: string }[]
  clients:        { id: string; name: string; color: string }[]
  currentUserId?: string
  userRole?:      string
  canCreate:      boolean
}

export function InboxView({ tasks, members, clients, currentUserId, userRole, canCreate }: Props) {
  const router = useRouter()
  const [localTasks,   setLocalTasks]   = useState<Task[]>(tasks)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [checked,      setChecked]      = useState<Set<string>>(new Set())
  const [completing,   setCompleting]   = useState<Set<string>>(new Set())
  const [, startT]                      = useTransition()
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [subtaskMap,    setSubtaskMap]    = useState<Record<string, {id:string;title:string;status:string}[]>>({})
  const [loadingSubtasks, setLoadingSubtasks] = useState<Set<string>>(new Set())
  const [newSubInputs, setNewSubInputs]   = useState<Record<string, string>>({})
  const [completingTask, setCompletingTask] = useState<Task | null>(null)

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
    // Optimistic update
    setSubtaskMap(p => ({
      ...p,
      [parentId]: (p[parentId] ?? []).map(s => s.id === subId ? { ...s, status: newStatus } : s)
    }))
    await fetch(`/api/tasks/${subId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }),
    })
    // Re-fetch fresh list
    const r = await fetch(`/api/tasks?parent_id=${parentId}&limit=50`)
    const d = await r.json()
    const freshSubs = d.data ?? []
    setSubtaskMap(p => ({ ...p, [parentId]: freshSubs }))
    // Auto-complete parent when ALL subtasks done
    if (freshSubs.length > 0 && freshSubs.every((s: any) => s.status === 'completed')) {
      await fetch(`/api/tasks/${parentId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
      })
      setLocalTasks(prev => prev.map(t => t.id === parentId ? { ...t, status: 'completed' } : t))
      toast.success('All subtasks done — task completed! 🎉')
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
    if (r.ok && d.data) {
      setSubtaskMap(p => ({ ...p, [parentId]: [...(p[parentId] ?? []), d.data] }))
    }
  }
  const today = todayStr()

  async function toggleDone(task: Task, e: React.MouseEvent) {
    e.stopPropagation()

    // Reopen a completed task
    if (task.status === 'completed') {
      setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'todo', completed_at: null } : t))
      setSelectedTask(prev => prev?.id === task.id ? { ...prev, status: 'todo' } : prev)
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'todo', completed_at: null }),
      })
      startT(() => router.refresh()); return
    }

    // Already in review — inform user
    if (task.status === 'in_review' || task.approval_status === 'pending') {
      toast.info('This task is pending approval — waiting for your approver.')
      return
    }

    // Block if subtasks are incomplete
    const subs = subtaskMap[task.id]
    if (subs && subs.length > 0 && !subs.every((s: any) => s.status === 'completed')) {
      setExpandedTasks(prev => { const next = new Set(prev); next.add(task.id); return next })
      const remaining = subs.filter((s: any) => s.status !== 'completed').length
      toast.error(`Complete all subtasks first — ${remaining} remaining`)
      return
    }

    // Needs approval → submit for review
    if (task.approval_required) {
      setCompleting(p => new Set(p).add(task.id))
      setLocalTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, status: 'in_review', approval_status: 'pending' } : t))
      setSelectedTask(prev => prev?.id === task.id
        ? { ...prev, status: 'in_review', approval_status: 'pending' } : prev)
      const res = await fetch(`/api/tasks/${task.id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'submit' }),
      })
      setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
      if (res.ok) toast.success('Submitted for approval ✓')
      else toast.error('Could not submit — please try again')
      startT(() => router.refresh()); return
    }

    // Normal completion
    setLocalTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t))
    setSelectedTask(prev => prev?.id === task.id ? { ...prev, status: 'completed' } : prev)
    setCompleting(p => new Set(p).add(task.id))
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    })
    setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
    if (!res.ok) { toast.error('Failed to update task'); return }
    toast.success('Task completed! ✓')
    startT(() => router.refresh())
  }

  async function bulkComplete() {
    const ids = [...checked]
    const canComplete = localTasks.filter(t => ids.includes(t.id) && !t.approval_required)
    const needsApproval = localTasks.filter(t => ids.includes(t.id) && t.approval_required)
    await Promise.all(canComplete.map(t => fetch(`/api/tasks/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    })))
    setChecked(new Set())
    if (canComplete.length) toast.success(`${canComplete.length} tasks completed`)
    if (needsApproval.length) toast.info(`${needsApproval.length} task(s) need approval — skipped`)
    startT(() => router.refresh())
  }

  const overdue  = localTasks.filter(t => t.status !== 'completed' && isOverdue(t.due_date, t.status))
  const inProg   = localTasks.filter(t => t.status !== 'completed' && !isOverdue(t.due_date, t.status) && t.approval_status !== 'pending')
  const inReview = localTasks.filter(t => t.approval_status === 'pending')
  const done     = localTasks.filter(t => t.status === 'completed')

  const sections = [
    { key: 'overdue',  label: 'Overdue',          color: '#dc2626', bg: '#fff9f9', tasks: overdue,   addRow: false },
    { key: 'inprog',   label: 'In progress',       color: '#0d9488', bg: '#fff',   tasks: inProg,    addRow: true  },
    { key: 'review',   label: 'Pending approval',  color: '#7c3aed', bg: '#faf5ff',tasks: inReview,  addRow: false },
    { key: 'done',     label: 'Completed',          color: '#16a34a', bg: '#fff',   tasks: done,      addRow: false },
  ].filter(s => s.tasks.length > 0 || s.addRow)

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Main list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 14px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color:'var(--text-primary)', marginBottom: 4 }}>One-time tasks</h1>
          <p style={{ fontSize: 13, color:'var(--text-secondary)' }}>
            {tasks.length} total · {tasks.filter(t => t.assignee_id === currentUserId).length} assigned to you
          </p>
        </div>

        {/* Bulk bar */}
        {checked.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px',
            background: '#f0fdfa', borderBottom: '1px solid #99f6e4', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#0f766e' }}>{checked.size} selected</span>
            <button onClick={bulkComplete}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <CheckCheck style={{ width: 14, height: 14 }} /> Mark complete
            </button>
            <button onClick={() => setChecked(new Set())}
              style={{ padding: '4px 10px', background: 'transparent', border: 'none', fontSize: 12, color:'var(--text-secondary)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 22px 1fr 70px 110px 80px 32px',
          padding: '6px 16px', background:'var(--surface-subtle)', borderBottom:'1px solid var(--border)',
          fontSize: 10, fontWeight: 700, color:'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          <div/><div/><div>Task</div><div style={{ textAlign: 'center', fontSize: 9 }}>Subtasks</div><div style={{ textAlign: 'center' }}>Due date</div>
          <div style={{ textAlign: 'center' }}>Priority</div><div/>
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflowY: 'auto', background:'var(--surface)' }}>
          {sections.map(section => (
            <div key={section.key}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                padding: '13px 18px 5px', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em', color: section.color }}>
                ▾ {section.label}
                <span style={{ opacity: 0.45, fontWeight: 400, textTransform: 'none', fontSize: 11 }}>
                  ({section.tasks.length})
                </span>
              </div>

              {/* Task rows */}
              {section.tasks.map(task => {
                const ov      = isOverdue(task.due_date, task.status)
                const isComp  = task.status === 'completed'
                const assignee = task.assignee as unknown as { id: string; name: string } | null
                const client   = (task as any).client as unknown as { id: string; name: string; color: string } | null
                const pri      = PRIORITY_CONFIG[task.priority]
                const isChecked = checked.has(task.id)
                const isCompleting = completing.has(task.id)
                const isSelected   = selectedTask?.id === task.id
                const isPending    = task.status === 'in_review' || task.approval_status === 'pending'

                return (
                  <div key={task.id}>
                  <div
                    onClick={() => setSelectedTask(task)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '36px 22px 1fr 70px 110px 80px 32px',
                      alignItems: 'center',
                      padding: '0 16px',
                      minHeight: 50,
                      borderBottom: '1px solid #f8fafc',
                      cursor: 'pointer',
                      background: isSelected ? '#f0fdfa' : isChecked ? '#f7fffe' : section.bg,
                    }}>
                    {/* Checkbox */}
                    <input type="checkbox" checked={isChecked}
                      onChange={() => setChecked(p => { const s = new Set(p); s.has(task.id) ? s.delete(task.id) : s.add(task.id); return s })}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 13, height: 13, accentColor: '#0d9488', cursor: 'pointer' }}/>

                    {/* Circle check button */}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        toggleDone(task, e)
                      }}
                      title={task.approval_required && task.status !== 'completed' ? (task.status === 'in_review' ? 'Pending approval' : 'Submit for approval') : (isComp ? 'Mark incomplete' : 'Mark complete')}
                      style={{
                        width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                        background: isComp ? '#0d9488' : isPending ? '#f5f3ff' : 'transparent',
                        border: `1.5px solid ${isComp ? '#0d9488' : isPending ? '#7c3aed' : ov ? '#fca5a5' : '#cbd5e1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: isPending ? 'default' : 'pointer', transition: 'all 0.15s',
                        opacity: isCompleting ? 0.5 : 1,
                      }}>
                      {isComp && (
                        <svg viewBox="0 0 16 16" fill="none" style={{ width: 9, height: 9 }}>
                          <path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {isPending && !isComp && <Clock style={{ width: 8, height: 8, color: '#7c3aed' }}/>}
                    </button>

                    {/* Title + meta */}
                    <div style={{ minWidth: 0, paddingRight: 8 }}>
                      <p style={{
                        fontSize: 13.5, fontWeight: 500, overflow: 'hidden',
                        whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        color: isComp ? '#94a3b8' : ov ? '#b91c1c' : '#0f172a',
                        textDecoration: isComp ? 'line-through' : 'none',
                      }}>{task.title}</p>
                      {(client || assignee || task.approval_status) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          {client && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color:'var(--text-muted)' }}>
                              <span style={{ width: 6, height: 6, borderRadius: 2, background: client.color, display: 'inline-block' }}/>
                              {client.name}
                            </span>
                          )}
                          {assignee && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color:'var(--text-muted)' }}>
                              <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#0d9488',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: 8, fontWeight: 700 }}>
                                {assignee.name[0]?.toUpperCase()}
                              </span>
                              {assignee.name}
                            </span>
                          )}
                          {task.approval_status === 'pending' && (
                            <span style={{ fontSize: 10, background: '#faf5ff', color: '#7c3aed',
                              padding: '1px 5px', borderRadius: 3, fontWeight: 500 }}>
                              Pending approval
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Due date */}
                    <div style={{ textAlign: 'center', fontSize: 12,
                      color: ov ? '#dc2626' : task.due_date === today ? '#0d9488' : '#94a3b8',
                      fontWeight: ov || task.due_date === today ? 600 : 400 }}>
                      {task.due_date ? fmtDate(task.due_date) : '—'}
                    </div>

                    {/* Priority */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: pri?.bg ?? '#f8fafc', color: pri?.color ?? '#94a3b8' }}>
                        {pri?.label ?? task.priority}
                      </span>
                    </div>

                    {/* Subtask toggle button */}
                    {(() => {
                      const subs = subtaskMap[task.id] ?? []
                      const subsDone = subs.filter((s: any) => s.status === 'completed').length
                      const hasUndone = subs.length > 0 && subsDone < subs.length
                      const isExpanded = expandedTasks.has(task.id)
                      return (
                        <button
                          onClick={e => { e.stopPropagation(); toggleExpand(task.id) }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                            padding: '2px 6px', borderRadius: 6, border: 'none',
                            background: hasUndone ? '#fffbeb' : isExpanded ? 'var(--brand-light)' : 'transparent',
                            color: hasUndone ? '#92400e' : isExpanded ? 'var(--brand)' : 'var(--text-muted)',
                            fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          }}
                          title={subs.length ? `${subsDone}/${subs.length} subtasks` : 'Add subtasks'}>
                          {subs.length > 0 ? (
                            <>
                              <svg viewBox="0 0 10 10" fill="none" style={{ width: 8, height: 8, flexShrink: 0 }}>
                                <path d="M1 2.5h8M2.5 5h5.5M4 7.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                              </svg>
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{subsDone}/{subs.length}</span>
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 10 10" fill="none" style={{ width: 8, height: 8, flexShrink: 0 }}>
                                <path d="M1 2.5h8M2.5 5h5.5M4 7.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                              </svg>
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      )
                    })()}

                    {/* Assignee avatar (right edge) */}
                    {assignee ? (
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0d9488',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0 }}
                        title={assignee.name}>
                        {assignee.name[0]?.toUpperCase()}
                      </div>
                    ) : <div/>}
                  </div>

                  {/* Inline subtasks panel */}
                  {expandedTasks.has(task.id) && (
                    <div style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                      {/* Progress bar */}
                      {(subtaskMap[task.id] ?? []).length > 0 && (() => {
                        const subs = subtaskMap[task.id] ?? []
                        const done = subs.filter((s: any) => s.status === 'completed').length
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 16px 3px 58px' }}>
                            <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 99,
                                background: done === subs.length ? '#16a34a' : 'var(--brand)',
                                width: `${subs.length ? Math.round(done / subs.length * 100) : 0}%`,
                                transition: 'width 0.3s',
                              }}/>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, flexShrink: 0,
                              color: done === subs.length ? '#16a34a' : 'var(--text-muted)' }}>
                              {done}/{subs.length} done
                            </span>
                          </div>
                        )
                      })()}
                      {loadingSubtasks.has(task.id) && (
                        <div style={{ padding: '6px 58px', fontSize: 11, color: 'var(--text-muted)' }}>Loading…</div>
                      )}
                      {(subtaskMap[task.id] ?? []).map((sub: any) => (
                        <div key={sub.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 16px 5px 58px',
                          borderBottom: '1px solid var(--border-light)',
                        }}>
                          <button
                            onClick={() => toggleSubRow(task.id, sub.id, sub.status)}
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
                        </div>
                      ))}
                      {/* Add subtask input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 16px 6px 58px' }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                          border: '1.5px dashed var(--brand)', opacity: 0.5 }}/>
                        <input
                          value={newSubInputs[task.id] ?? ''}
                          onChange={e => setNewSubInputs(p => ({ ...p, [task.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (newSubInputs[task.id] ?? '').trim()) {
                              addSubtaskInline(task.id, newSubInputs[task.id])
                              setNewSubInputs(p => ({ ...p, [task.id]: '' }))
                            }
                            if (e.key === 'Escape') setNewSubInputs(p => ({ ...p, [task.id]: '' }))
                          }}
                          placeholder="Add subtask… (press Enter)"
                          style={{
                            flex: 1, fontSize: 12, border: 'none', outline: 'none',
                            background: 'transparent', color: 'var(--text-primary)',
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}
                  </div>
                )
              })}

              {/* Inline add row for In-progress section */}
              {section.addRow && canCreate && (
                <InlineOneTimeTask
                  members={members} clients={clients} currentUserId={currentUserId}
                  onCreated={() => startT(() => router.refresh())}
                />
              )}
            </div>
          ))}

          {tasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 24px', color:'var(--text-muted)' }}>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No tasks yet</p>
              <p style={{ fontSize: 13 }}>Click "+ Add task" to create your first one-time task</p>
            </div>
          )}
        </div>
      </div>

      {/* Completion attach modal */}
      {completingTask && (
        <CompletionAttachModal
          taskId={completingTask.id}
          taskTitle={completingTask.title}
          onConfirm={async () => {
            const task = completingTask
            setCompletingTask(null)
            setCompleting(p => new Set(p).add(task.id))
            setLocalTasks(prev => prev.map(t => t.id === task.id
              ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t))
            setSelectedTask(prev => prev?.id === task.id
              ? { ...prev, status: 'completed', completed_at: new Date().toISOString() } : prev)
            await fetch(`/api/tasks/${task.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
            })
            setCompleting(p => { const s = new Set(p); s.delete(task.id); return s })
            toast.success('Task completed! ✓')
            startT(() => router.refresh())
          }}
          onCancel={() => setCompletingTask(null)}
        />
      )}

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask} members={members} clients={clients}
          currentUserId={currentUserId} userRole={userRole}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => { startT(() => router.refresh()) }}
        />
      )}
    </div>
  )
}

function SubtaskAdder({ onAdd }: { onAdd: (title: string) => void }) {
  const [val, setVal] = React.useState('')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px dashed var(--brand)', opacity: 0.5, flexShrink: 0 }}/>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && val.trim()) { onAdd(val); setVal('') }
          if (e.key === 'Escape') setVal('')
        }}
        placeholder="Add subtask…"
        style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none',
          background: 'transparent', color: 'var(--text-primary)' }}
      />
    </div>
  )
}
