'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { FileCheck, ChevronRight, GripVertical } from 'lucide-react'
import { CAMasterView } from './CAMasterView'
import { CAClientSetupView } from './CAClientSetupView'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import type { Task } from '@/types'

interface Props { userRole: string; currentUserId: string }

/* ─── Step 3: Kanban Board ─────────────────────────────────────── */

interface KanbanTask {
  id: string              // assignment ID (stable key)
  name: string
  group_name: string
  status: string          // spawned task status, or 'upcoming'
  priority: string
  due_date?: string | null
  is_recurring?: boolean
  next_occurrence_date?: string | null
  custom_fields?: Record<string, any> | null
  _raw?: any              // full spawned task for TaskDetailPanel (null if not yet spawned)
  _taskId?: string        // spawned task ID, if any
  _assignmentActive: boolean
  _nextDueDate?: string | null   // next upcoming due date from master task dates
  _daysBeforeDue?: number        // trigger window from master task
}

interface KanbanClient { id: string; name: string; color: string }

function CAKanbanView({ userRole, currentUserId }: { userRole: string; currentUserId: string }) {
  const [clients, setClients]   = useState<KanbanClient[]>([])
  const [selectedClient, setSelectedClient] = useState<KanbanClient | null>(null)
  const [allTasks, setAllTasks] = useState<KanbanTask[]>([])
  const [loading, setLoading]   = useState(false)
  const [selTask,  setSelTask]  = useState<Task | null>(null)
  const [selUpcoming, setSelUpcoming] = useState<KanbanTask | null>(null)
  const [members,  setMembers]  = useState<{ id: string; name: string }[]>([])

  /* board state: task id → 'active' | 'paused' */
  const [board, setBoard] = useState<Record<string, 'active' | 'paused'>>({})
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<'active' | 'paused' | null>(null)
  // In-memory cache of original next_occurrence_date before pausing
  // (also persisted to DB via custom_fields._paused_next_date as fallback)
  const pausedDatesRef = useRef<Record<string, string | null>>({})

  /* Load all clients + members */
  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(d => {
      const list: any[] = Array.isArray(d) ? d : (d.data ?? [])
      setClients(list.map((c: any) => ({ id: c.id, name: c.name, color: c.color ?? '#94a3b8' })))
    }).catch(() => {})

    fetch('/api/team').then(r => r.json()).then(d => {
      const list = (d.data ?? []) as any[]
      setMembers(list.map((m: any) => ({ id: m.user_id, name: (m.users as any)?.name ?? '' })))
    }).catch(() => {})

  }, [])

  /** Returns the nearest future due date from a master task's dates JSONB */
  function nextDueDateFromDates(dates: Record<string, string>): string | null {
    const today = new Date().toISOString().split('T')[0]
    const future = Object.values(dates ?? {}).filter(d => d >= today).sort()
    return future[0] ?? null
  }

  /* Load assignments for selected client + match to any already-spawned tasks */
  const loadTasks = useCallback(async (clientId: string) => {
    setLoading(true)
    try {
      const [assignRes, taskRes] = await Promise.all([
        fetch(`/api/ca/assignments?client_id=${clientId}`),
        fetch(`/api/tasks?client_id=${clientId}&top_level=true&limit=500`),
      ])
      const assignJson = await assignRes.json()
      const taskJson   = await taskRes.json()

      const assignments: any[] = assignJson.data ?? []
      const allClientTasks: any[] = Array.isArray(taskJson) ? taskJson : (taskJson.data ?? [])
      // Only care about CA compliance tasks that have been spawned
      const spawnedTasks = allClientTasks.filter((t: any) => t.custom_fields?._ca_compliance === true)

      // Build a map: masterTaskName → most-recent spawned task (by due_date desc)
      const spawnedByName = new Map<string, any>()
      for (const t of spawnedTasks) {
        const existing = spawnedByName.get(t.title)
        if (!existing || (t.due_date ?? '') > (existing.due_date ?? '')) {
          spawnedByName.set(t.title, t)
        }
      }

      const assignmentTasks: KanbanTask[] = assignments.map((a: any) => {
        const master      = a.master_task ?? {}
        const spawnedTask = spawnedByName.get(master.name ?? '')
        return {
          id:                  a.id,
          name:                master.name  ?? 'Unnamed',
          group_name:          master.group_name ?? '',
          status:              spawnedTask?.status ?? 'upcoming',
          priority:            master.priority ?? 'medium',
          due_date:            spawnedTask?.due_date ?? null,
          is_recurring:        spawnedTask?.is_recurring ?? false,
          next_occurrence_date: spawnedTask?.next_occurrence_date ?? null,
          custom_fields:       spawnedTask?.custom_fields ?? null,
          _raw:                spawnedTask ?? null,
          _taskId:             spawnedTask?.id ?? null,
          _assignmentActive:   a.is_active ?? true,
          _nextDueDate:        spawnedTask?.due_date ?? nextDueDateFromDates(master.dates ?? {}),
          _daysBeforeDue:      master.days_before_due ?? 7,
        }
      })

      // Also show imported compliance tasks that have no matching assignment
      const assignedNames = new Set(
        assignments.map((a: any) => (a.master_task?.name ?? '').toLowerCase().trim())
      )
      const unlinkedTasks: KanbanTask[] = spawnedTasks
        .filter((t: any) => !assignedNames.has((t.title ?? '').toLowerCase().trim()))
        .map((t: any) => ({
          id:                  t.id,
          name:                t.title ?? 'Unnamed',
          group_name:          '',
          status:              t.status ?? 'todo',
          priority:            t.priority ?? 'medium',
          due_date:            t.due_date ?? null,
          is_recurring:        t.is_recurring ?? false,
          next_occurrence_date: t.next_occurrence_date ?? null,
          custom_fields:       t.custom_fields ?? null,
          _raw:                t,
          _taskId:             t.id,
          _assignmentActive:   true,
        }))

      const tasks: KanbanTask[] = [...assignmentTasks, ...unlinkedTasks]

      setAllTasks(tasks)

      // Initial board state: paused assignments go to "paused" column;
      // override with any persisted localStorage preference
      const defaultBoard: Record<string, 'active' | 'paused'> = {}
      for (const t of tasks) {
        if (!t._assignmentActive) defaultBoard[t.id] = 'paused'
      }
      try {
        const stored = localStorage.getItem(`ca_board_${clientId}`)
        setBoard(stored ? { ...defaultBoard, ...JSON.parse(stored) } : defaultBoard)
      } catch { setBoard(defaultBoard) }
    } catch {
      setAllTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  function selectClient(c: KanbanClient) {
    setSelectedClient(c)
    void loadTasks(c.id)
  }

  function persistBoard(next: Record<string, 'active' | 'paused'>) {
    setBoard(next)
    if (selectedClient) {
      try { localStorage.setItem(`ca_board_${selectedClient.id}`, JSON.stringify(next)) } catch {}
    }
  }

  async function handleDrop(col: 'active' | 'paused') {
    if (!dragId) return
    const task = allTasks.find(t => t.id === dragId)
    persistBoard({ ...board, [dragId]: col })
    setDragId(null)
    setDragOver(null)
    if (!task) return

    const isPausing = col === 'paused'

    try {
      // 1. Pause/unpause the assignment (controls future spawning)
      await fetch(`/api/ca/assignments/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isPausing }),
      })

      // 2. If there's a spawned recurring task, also pause/unpause its next_occurrence_date
      if (task._taskId && task.is_recurring) {
        if (isPausing) {
          const originalDate = task.next_occurrence_date ?? task.due_date ?? null
          pausedDatesRef.current[task.id] = originalDate
          await fetch(`/api/tasks/${task._taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              next_occurrence_date: null,
              custom_fields: { _paused_next_date: originalDate },
            }),
          })
          setAllTasks(ts => ts.map(t => t.id === task.id ? { ...t, next_occurrence_date: null } : t))
        } else {
          const restoreDate =
            pausedDatesRef.current[task.id] ??
            task.custom_fields?._paused_next_date ??
            null
          delete pausedDatesRef.current[task.id]
          await fetch(`/api/tasks/${task._taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              next_occurrence_date: restoreDate,
              custom_fields: { _paused_next_date: null },
            }),
          })
          setAllTasks(ts => ts.map(t => t.id === task.id ? { ...t, next_occurrence_date: restoreDate } : t))
        }
      }
    } catch {
      // Non-critical — board state still persisted locally
    }
  }

  const activeTasks = allTasks.filter(t => (board[t.id] ?? 'active') === 'active')
  const pausedTasks = allTasks.filter(t => board[t.id] === 'paused')

  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    todo:       { bg: '#f1f5f9', color: '#64748b', label: 'To do' },
    in_progress:{ bg: '#eff6ff', color: '#2563eb', label: 'In progress' },
    in_review:  { bg: '#fdf4ff', color: '#9333ea', label: 'In review' },
    completed:  { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
    upcoming:   { bg: '#fff7ed', color: '#ea580c', label: '⏰ Upcoming' },
  }

  function KanbanCard({ task }: { task: KanbanTask }) {
    const statusStyle = STATUS_STYLE[task.status] ?? STATUS_STYLE.upcoming
    const hasTask = !!task._raw
    return (
      <div
        draggable
        onDragStart={e => { e.stopPropagation(); setDragId(task.id) }}
        onDragEnd={() => { setDragId(null); setDragOver(null) }}
        onClick={() => {
          if (dragId) return
          if (hasTask) setSelTask(task._raw as Task)
          else setSelUpcoming(task)
        }}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 12px', marginBottom: 8,
          cursor: dragId ? 'grabbing' : 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          opacity: dragId === task.id ? 0.5 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <GripVertical size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {/* Priority */}
              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, fontWeight: 600,
                background: task.priority === 'high' || task.priority === 'urgent' ? '#fef2f2' : task.priority === 'medium' ? '#fffbeb' : '#f0fdf4',
                color: task.priority === 'high' || task.priority === 'urgent' ? '#dc2626' : task.priority === 'medium' ? '#b45309' : '#16a34a',
              }}>
                {task.priority}
              </span>
              {/* Status pill */}
              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, fontWeight: 600,
                background: statusStyle.bg, color: statusStyle.color }}>
                {statusStyle.label}
              </span>
              {/* Due date (only if spawned) */}
              {task.due_date && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Due {task.due_date.slice(0, 10)}
                </span>
              )}
              {/* Paused badge */}
              {board[task.id] === 'paused' && (
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, fontWeight: 600,
                  background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                  ⏸ Paused
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function KanbanCol({ col, tasks, label, color }: { col: 'active' | 'paused'; tasks: KanbanTask[]; label: string; color: string }) {
    const isOver = dragOver === col
    return (
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(col) }}
        onDragLeave={() => setDragOver(null)}
        onDrop={() => handleDrop(col)}
        style={{
          flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column',
          background: isOver ? 'rgba(13,148,136,0.04)' : 'var(--surface-subtle)',
          border: `2px solid ${isOver ? 'var(--brand)' : 'var(--border)'}`,
          borderRadius: 12, padding: '12px 12px 16px', transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '1px 8px',
            borderRadius: 99, background: color + '22', color, border: `1px solid ${color}44` }}>
            {tasks.length}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '24px 0', opacity: 0.6 }}>
              {isOver ? 'Drop here' : 'No tasks'}
            </div>
          ) : (
            tasks.map(t => <KanbanCard key={t.id} task={t} />)
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      <TaskDetailPanel
        task={selTask}
        members={members}
        clients={clients.map(c => ({ ...c, color: c.color ?? '#94a3b8' }))}
        currentUserId={currentUserId}
        userRole={userRole}
        onClose={() => setSelTask(null)}
        onUpdated={() => { setSelTask(null); if (selectedClient) loadTasks(selectedClient.id) }}
      />

      {/* Upcoming task info overlay */}
      {selUpcoming && !selTask && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setSelUpcoming(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 14, padding: 28, minWidth: 340, maxWidth: 420,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{selUpcoming.name}</span>
              <button onClick={() => setSelUpcoming(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 110 }}>Status</span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 99,
                  background: '#fff7ed', color: '#ea580c' }}>⏰ Upcoming</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 110 }}>Priority</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{selUpcoming.priority}</span>
              </div>
              {selUpcoming._nextDueDate && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 110 }}>Next due date</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {new Date(selUpcoming._nextDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 110 }}>Trigger window</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selUpcoming._daysBeforeDue ?? 7} days before due date
                </span>
              </div>
              {selUpcoming._nextDueDate && selUpcoming._daysBeforeDue && (
                <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: 12, color: '#15803d' }}>
                    ✓ This task will appear in One-time tasks and My Tasks on{' '}
                    <strong>
                      {new Date(new Date(selUpcoming._nextDueDate).getTime() - (selUpcoming._daysBeforeDue ?? 7) * 86400000)
                        .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Left: client list */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--surface)' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Clients</span>
        </div>
        {clients.map(c => (
          <button
            key={c.id}
            onClick={() => selectClient(c)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', border: 'none', textAlign: 'left',
              background: selectedClient?.id === c.id ? 'var(--surface-alt)' : 'transparent',
              borderLeft: selectedClient?.id === c.id ? '3px solid var(--brand)' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: selectedClient?.id === c.id ? 600 : 400, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.name}
            </span>
          </button>
        ))}
      </div>

      {/* Right: kanban */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)' }}>
        {!selectedClient ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Select a client to view their compliance board
          </div>
        ) : loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading tasks…
          </div>
        ) : allTasks.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No compliance tasks assigned to {selectedClient.name}. Go to Step 2 to assign tasks.
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedClient.color }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedClient.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>— drag cards between boards</span>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 16, padding: 16, overflow: 'auto' }}>
              <KanbanCol col="active" tasks={activeTasks} label="Active" color="#0d9488" />
              <KanbanCol col="paused" tasks={pausedTasks} label="Paused" color="#f59e0b" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ComplianceShell({ userRole, currentUserId }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const isAdmin = ['owner', 'admin'].includes(userRole)
  const canSetupClients = ['owner', 'admin', 'manager'].includes(userRole)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Step header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 24px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Step 1 tab */}
        <button
          onClick={() => isAdmin && setStep(1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 20px 14px 0',
            background: 'none', border: 'none', cursor: isAdmin ? 'pointer' : 'default',
            borderBottom: step === 1 ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1,
          }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: step === 1 ? 'var(--brand)' : 'var(--border)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>1</div>
          <span style={{ fontSize: 13, fontWeight: step === 1 ? 700 : 500, color: step === 1 ? 'var(--brand)' : 'var(--text-secondary)' }}>
            Compliance Master
          </span>
          {!isAdmin && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
              Admin only
            </span>
          )}
        </button>

        <ChevronRight style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0, margin: '0 4px' }}/>

        {/* Step 2 tab */}
        <button
          onClick={() => canSetupClients && setStep(2)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 20px',
            background: 'none', border: 'none', cursor: canSetupClients ? 'pointer' : 'default',
            borderBottom: step === 2 ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1,
          }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: step === 2 ? 'var(--brand)' : 'var(--border)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>2</div>
          <span style={{ fontSize: 13, fontWeight: step === 2 ? 700 : 500, color: step === 2 ? 'var(--brand)' : 'var(--text-secondary)' }}>
            Client Setup
          </span>
        </button>

        <ChevronRight style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0, margin: '0 4px' }}/>

        {/* Step 3 tab */}
        <button
          onClick={() => canSetupClients && setStep(3)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 20px',
            background: 'none', border: 'none', cursor: canSetupClients ? 'pointer' : 'default',
            borderBottom: step === 3 ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1,
          }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: step === 3 ? 'var(--brand)' : 'var(--border)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>3</div>
          <span style={{ fontSize: 13, fontWeight: step === 3 ? 700 : 500, color: step === 3 ? 'var(--brand)' : 'var(--text-secondary)' }}>
            Kanban Board
          </span>
        </button>

        {step === 1 && canSetupClients && (
          <button
            onClick={() => setStep(2)}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
            Next: Client Setup <ChevronRight style={{ width: 14, height: 14 }}/>
          </button>
        )}
        {step === 2 && canSetupClients && (
          <button
            onClick={() => setStep(3)}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
            Next: Kanban Board <ChevronRight style={{ width: 14, height: 14 }}/>
          </button>
        )}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {step === 1 && isAdmin && <CAMasterView userRole={userRole} />}
        {step === 1 && !isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--text-muted)', fontSize: 14 }}>
            <FileCheck style={{ width: 32, height: 32, opacity: 0.4 }}/>
            <p>Compliance Master setup is restricted to admins.</p>
            <button onClick={() => setStep(2)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              Go to Client Setup →
            </button>
          </div>
        )}
        {step === 2 && <CAClientSetupView userRole={userRole} />}
        {step === 3 && <CAKanbanView userRole={userRole} currentUserId={currentUserId} />}
      </div>
    </div>
  )
}
