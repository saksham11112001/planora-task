'use client'
import { useState, useTransition } from 'react'
import { useRouter }          from 'next/navigation'
import { CheckCheck }         from 'lucide-react'
import { InlineOneTimeTask }  from '@/components/tasks/InlineOneTimeTask'
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
  const today = todayStr()

  async function toggleDone(taskId: string, status: string, e: React.MouseEvent) {
    e.stopPropagation()
    const newStatus = status === 'completed' ? 'todo' : 'completed'
    // Optimistic update
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    setSelectedTask(prev => prev?.id === taskId ? { ...prev, status: newStatus } : prev)
    setCompleting(p => new Set(p).add(taskId))
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }),
    })
    setCompleting(p => { const s = new Set(p); s.delete(taskId); return s })
    if (!res.ok) { toast.error('Failed to update task'); return }
    if (newStatus === 'completed') toast.success('Task completed! ✓')
    startT(() => router.refresh())
  }

  async function bulkComplete() {
    await Promise.all([...checked].map(id => fetch(`/api/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    })))
    setChecked(new Set())
    toast.success(`${checked.size} tasks completed`)
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
        <div style={{ display: 'grid', gridTemplateColumns: '36px 22px 1fr 110px 80px 32px',
          padding: '6px 16px', background:'var(--surface-subtle)', borderBottom:'1px solid var(--border)',
          fontSize: 10, fontWeight: 700, color:'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          <div/><div/><div>Task</div><div style={{ textAlign: 'center' }}>Due date</div>
          <div style={{ textAlign: 'center' }}>Priority</div><div/>
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflowY: 'auto', background:'var(--surface)' }}>
          {sections.map(section => (
            <div key={section.key}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px 4px', fontSize: 11, fontWeight: 700,
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
                const assignee = task.assignee as { id: string; name: string } | null
                const client   = (task as any).client as { id: string; name: string; color: string } | null
                const pri      = PRIORITY_CONFIG[task.priority]
                const isChecked = checked.has(task.id)
                const isCompleting = completing.has(task.id)
                const isSelected   = selectedTask?.id === task.id

                return (
                  <div key={task.id}
                    onClick={() => setSelectedTask(task)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '36px 22px 1fr 110px 80px 32px',
                      alignItems: 'center',
                      padding: '0 16px',
                      minHeight: 42,
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
                      onClick={e => toggleDone(task.id, task.status, e)}
                      style={{
                        width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                        background: isComp ? '#0d9488' : 'transparent',
                        border: `1.5px solid ${isComp ? '#0d9488' : ov ? '#fca5a5' : '#cbd5e1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                        opacity: isCompleting ? 0.5 : 1,
                      }}>
                      {isComp && (
                        <svg viewBox="0 0 16 16" fill="none" style={{ width: 9, height: 9 }}>
                          <path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>

                    {/* Title + meta */}
                    <div style={{ minWidth: 0, paddingRight: 8 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 500, overflow: 'hidden',
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
