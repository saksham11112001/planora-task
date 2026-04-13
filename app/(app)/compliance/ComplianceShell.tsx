'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileCheck, ChevronRight, Search, ClipboardList } from 'lucide-react'
import { CAMasterView } from './CAMasterView'
import { CAClientSetupView } from './CAClientSetupView'
import { CATasksView } from './CATasksView'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import type { Task } from '@/types'

interface Props { userRole: string; currentUserId: string }

/* ─── Step 3: Kanban Board ─────────────────────────────────────── */

interface KanbanTask {
  id: string
  name: string
  group_name: string
  status: string
  priority: string
  due_date?: string | null
  is_recurring?: boolean
  next_occurrence_date?: string | null
  custom_fields?: Record<string, any> | null
  _raw?: any
  _taskId?: string
  _assignmentActive: boolean
  _nextDueDate?: string | null
  _daysBeforeDue?: number
}

interface KanbanClient { id: string; name: string; color: string }

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  todo:       { bg: '#f1f5f9', color: '#64748b', label: 'To do' },
  in_progress:{ bg: '#eff6ff', color: '#2563eb', label: 'In progress' },
  in_review:  { bg: '#fdf4ff', color: '#9333ea', label: 'In review' },
  completed:  { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
  upcoming:   { bg: '#fff7ed', color: '#ea580c', label: '⏰ Upcoming' },
}

function nextDueDateFromDates(dates: Record<string, string>): string | null {
  const today = new Date().toISOString().split('T')[0]
  const future = Object.values(dates ?? {}).filter(d => d >= today).sort()
  return future[0] ?? null
}

function buildTaskList(assignJson: any, taskJson: any): KanbanTask[] {
  const assignments: any[] = assignJson.data ?? []
  const allClientTasks: any[] = Array.isArray(taskJson) ? taskJson : (taskJson.data ?? [])
  const spawnedTasks = allClientTasks.filter((t: any) => t.custom_fields?._ca_compliance === true)
  const spawnedByName = new Map<string, any>()
  for (const t of spawnedTasks) {
    const existing = spawnedByName.get(t.title)
    if (!existing || (t.due_date ?? '') > (existing.due_date ?? '')) spawnedByName.set(t.title, t)
  }
  const assignmentTasks: KanbanTask[] = assignments.map((a: any) => {
    const master = a.master_task ?? {}
    const spawned = spawnedByName.get(master.name ?? '')
    return {
      id: a.id, name: master.name ?? 'Unnamed', group_name: master.group_name ?? '',
      status: spawned?.status ?? 'upcoming', priority: master.priority ?? 'medium',
      due_date: spawned?.due_date ?? null, is_recurring: spawned?.is_recurring ?? false,
      next_occurrence_date: spawned?.next_occurrence_date ?? null,
      custom_fields: spawned?.custom_fields ?? null, _raw: spawned ?? null,
      _taskId: spawned?.id ?? null, _assignmentActive: a.is_active ?? true,
      _nextDueDate: spawned?.due_date ?? nextDueDateFromDates(master.dates ?? {}),
      _daysBeforeDue: master.days_before_due ?? 7,
    }
  })
  const assignedNames = new Set(assignments.map((a: any) => (a.master_task?.name ?? '').toLowerCase().trim()))
  const unlinkedTasks: KanbanTask[] = spawnedTasks
    .filter((t: any) => !assignedNames.has((t.title ?? '').toLowerCase().trim()))
    .map((t: any) => ({
      id: t.id, name: t.title ?? 'Unnamed', group_name: '', status: t.status ?? 'todo',
      priority: t.priority ?? 'medium', due_date: t.due_date ?? null,
      is_recurring: t.is_recurring ?? false, next_occurrence_date: t.next_occurrence_date ?? null,
      custom_fields: t.custom_fields ?? null, _raw: t, _taskId: t.id, _assignmentActive: true,
    }))
  return [...assignmentTasks, ...unlinkedTasks]
}

function CAKanbanView({ userRole, currentUserId }: { userRole: string; currentUserId: string }) {
  const [clients,       setClients]       = useState<KanbanClient[]>([])
  const [members,       setMembers]       = useState<{ id: string; name: string }[]>([])
  const [search,        setSearch]        = useState('')
  const [clientTasks,   setClientTasks]   = useState<Record<string, KanbanTask[]>>({})
  const [clientLoading, setClientLoading] = useState<Record<string, boolean>>({})
  const [allBoards,     setAllBoards]     = useState<Record<string, Record<string, 'active' | 'paused'>>>({})
  const [selTask,       setSelTask]       = useState<Task | null>(null)
  const [selUpcoming,   setSelUpcoming]   = useState<KanbanTask | null>(null)
  const pausedDatesRef = useRef<Record<string, string | null>>({})

  const loadClientTasks = useCallback(async (clientId: string) => {
    setClientLoading(p => ({ ...p, [clientId]: true }))
    try {
      const [assignRes, taskRes] = await Promise.all([
        fetch(`/api/ca/assignments?client_id=${clientId}`),
        fetch(`/api/tasks?client_id=${clientId}&top_level=true&limit=500`),
      ])
      const tasks = buildTaskList(await assignRes.json(), await taskRes.json())
      setClientTasks(p => ({ ...p, [clientId]: tasks }))
      const defaultBoard: Record<string, 'active' | 'paused'> = {}
      for (const t of tasks) { if (!t._assignmentActive) defaultBoard[t.id] = 'paused' }
      try {
        const stored = localStorage.getItem(`ca_board_${clientId}`)
        setAllBoards(p => ({ ...p, [clientId]: stored ? { ...defaultBoard, ...JSON.parse(stored) } : defaultBoard }))
      } catch { setAllBoards(p => ({ ...p, [clientId]: defaultBoard })) }
    } catch {
      setClientTasks(p => ({ ...p, [clientId]: [] }))
    } finally {
      setClientLoading(p => ({ ...p, [clientId]: false }))
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([cd, td]) => {
      const clientList: KanbanClient[] = (Array.isArray(cd) ? cd : (cd.data ?? []))
        .map((c: any) => ({ id: c.id, name: c.name, color: c.color ?? '#94a3b8' }))
      setClients(clientList)
      setMembers(((td.data ?? []) as any[]).map((m: any) => ({ id: m.user_id, name: (m.users as any)?.name ?? '' })))
      clientList.forEach(c => loadClientTasks(c.id))
    }).catch(() => {})
  }, [loadClientTasks])

  async function toggleTaskBoard(clientId: string, taskId: string, newCol: 'active' | 'paused') {
    const task = (clientTasks[clientId] ?? []).find(t => t.id === taskId)
    if (!task) return
    const newBoard = { ...(allBoards[clientId] ?? {}), [taskId]: newCol }
    setAllBoards(p => ({ ...p, [clientId]: newBoard }))
    try { localStorage.setItem(`ca_board_${clientId}`, JSON.stringify(newBoard)) } catch {}
    const isPausing = newCol === 'paused'
    try {
      await fetch(`/api/ca/assignments/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isPausing }),
      })
      if (task._taskId && task.is_recurring) {
        if (isPausing) {
          const originalDate = task.next_occurrence_date ?? task.due_date ?? null
          pausedDatesRef.current[task.id] = originalDate
          await fetch(`/api/tasks/${task._taskId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ next_occurrence_date: null, custom_fields: { _paused_next_date: originalDate } }),
          })
          setClientTasks(p => ({ ...p, [clientId]: (p[clientId]??[]).map(t => t.id === taskId ? { ...t, next_occurrence_date: null } : t) }))
        } else {
          const restoreDate = pausedDatesRef.current[task.id] ?? task.custom_fields?._paused_next_date ?? null
          delete pausedDatesRef.current[task.id]
          await fetch(`/api/tasks/${task._taskId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ next_occurrence_date: restoreDate, custom_fields: { _paused_next_date: null } }),
          })
          setClientTasks(p => ({ ...p, [clientId]: (p[clientId]??[]).map(t => t.id === taskId ? { ...t, next_occurrence_date: restoreDate } : t) }))
        }
      }
    } catch {}
  }

  function KanbanCard({ task, clientId }: { task: KanbanTask; clientId: string }) {
    const isPaused    = (allBoards[clientId] ?? {})[task.id] === 'paused'
    const statusStyle = STATUS_STYLE[task.status] ?? STATUS_STYLE.upcoming
    return (
      <div
        onClick={() => { if (task._raw) setSelTask(task._raw as Task); else setSelUpcoming(task) }}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderLeft: '3px solid rgba(234,179,8,0.6)',  // amber — all CA compliance cards
          borderRadius: 8, padding: '8px 10px', marginBottom: 6, cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'box-shadow 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget as any).style.boxShadow = '0 3px 10px rgba(0,0,0,0.1)'}
        onMouseLeave={e => (e.currentTarget as any).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, fontWeight: 600,
            background: task.priority === 'high' || task.priority === 'urgent' ? '#fef2f2' : task.priority === 'medium' ? '#fffbeb' : '#f0fdf4',
            color: task.priority === 'high' || task.priority === 'urgent' ? '#dc2626' : task.priority === 'medium' ? '#b45309' : '#16a34a' }}>
            {task.priority}
          </span>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, fontWeight: 600,
            background: statusStyle.bg, color: statusStyle.color }}>
            {statusStyle.label}
          </span>
          {task.due_date && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {task.due_date.slice(0, 10)}
            </span>
          )}
        </div>
        {/* Pause / Activate toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            onClick={e => { e.stopPropagation(); toggleTaskBoard(clientId, task.id, isPaused ? 'active' : 'paused') }}
            style={{ fontSize: 10, padding: '2px 9px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${isPaused ? '#0d9488' : '#f59e0b'}`,
              background: 'transparent',
              color: isPaused ? '#0d9488' : '#b45309',
              fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.12s' }}>
            {isPaused ? '▶ Activate' : '⏸ Pause'}
          </button>
        </div>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const visibleClients = q
    ? clients.filter(c => {
        if (c.name.toLowerCase().includes(q)) return true
        const tasks = clientTasks[c.id] ?? []
        return tasks.some(t => t.name.toLowerCase().includes(q))
      })
    : clients

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TaskDetailPanel
        task={selTask}
        members={members}
        clients={clients}
        currentUserId={currentUserId}
        userRole={userRole}
        onClose={() => setSelTask(null)}
        onUpdated={() => { setSelTask(null); clients.forEach(c => loadClientTasks(c.id)) }}
      />

      {/* Upcoming overlay */}
      {selUpcoming && !selTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelUpcoming(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: 28,
            minWidth: 340, maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{selUpcoming.name}</span>
              <button onClick={() => setSelUpcoming(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 110 }}>Status</span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 99, background: '#fff7ed', color: '#ea580c' }}>⏰ Upcoming</span>
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
                    ✓ This task will appear on{' '}
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

      {/* Search bar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '6px 12px' }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients or tasks…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent',
              color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}>✕</button>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {clients.length} client{clients.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Horizontal client columns */}
      <div style={{ display: 'flex', gap: 14, padding: '14px 16px', overflowX: 'auto',
        flex: 1, minHeight: 0, alignItems: 'flex-start', background: 'var(--surface-subtle)' }}>
        {visibleClients.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 13 }}>
            {search ? `No clients or tasks matching "${search}"` : 'No clients found'}
          </div>
        ) : visibleClients.map(client => {
          const allTasks = clientTasks[client.id] ?? []
          const board    = allBoards[client.id] ?? {}
          const loading  = clientLoading[client.id] ?? false

          // Filter tasks by search if query doesn't match client name directly
          const taskFilter = (q && !client.name.toLowerCase().includes(q))
            ? (t: KanbanTask) => t.name.toLowerCase().includes(q)
            : () => true

          const active = allTasks.filter(t => (board[t.id] ?? 'active') === 'active').filter(taskFilter)
          const paused = allTasks.filter(t => board[t.id] === 'paused').filter(taskFilter)

          return (
            <div key={client.id} style={{ minWidth: 250, width: 265, flexShrink: 0,
              background: 'var(--surface)', borderRadius: 12,
              border: '1px solid var(--border)', overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

              {/* Column header */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--surface)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: client.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {client.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {allTasks.length}
                </span>
              </div>

              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  Loading…
                </div>
              ) : allTasks.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', opacity: 0.7 }}>
                  No tasks assigned
                </div>
              ) : (
                <div style={{ padding: '10px 12px', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>

                  {/* Active section */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    paddingBottom: 6, marginBottom: 8,
                    borderBottom: '1px solid rgba(13,148,136,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Active</span>
                    <span style={{ fontWeight: 600, fontSize: 10, background: 'rgba(13,148,136,0.12)',
                      color: '#0d9488', padding: '1px 7px', borderRadius: 99 }}>{active.length}</span>
                  </div>
                  {active.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0', opacity: 0.6 }}>No active tasks</div>
                  ) : (
                    active.map(t => <KanbanCard key={t.id} task={t} clientId={client.id} />)
                  )}

                  {/* Paused section — only show if there are paused tasks */}
                  {(paused.length > 0 || allTasks.some(t => board[t.id] === 'paused')) && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        paddingBottom: 6, marginBottom: 8,
                        borderBottom: '1px solid rgba(245,158,11,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Paused</span>
                        <span style={{ fontWeight: 600, fontSize: 10, background: 'rgba(245,158,11,0.12)',
                          color: '#b45309', padding: '1px 7px', borderRadius: 99 }}>{paused.length}</span>
                      </div>
                      {paused.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0', opacity: 0.6 }}>None</div>
                      ) : (
                        paused.map(t => <KanbanCard key={t.id} task={t} clientId={client.id} />)
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ComplianceShell({ userRole, currentUserId }: Props) {
  const searchParams = useSearchParams()
  const initStep = searchParams.get('tab') === 'catasks' ? 4 : 1
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initStep as 1 | 2 | 3 | 4)
  const isAdmin = ['owner', 'admin'].includes(userRole)
  const canSetupClients = ['owner', 'admin', 'manager'].includes(userRole)

  /* ── Shared members + clients for CATasksView ── */
  const [sharedMembers, setSharedMembers] = useState<{ id: string; name: string; role?: string }[]>([])
  const [sharedClients, setSharedClients] = useState<{ id: string; name: string; color: string }[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/team').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([td, cd]) => {
      setSharedMembers(
        ((td.data ?? []) as any[]).map((m: any) => ({
          id: m.user_id,
          name: (m.users as any)?.name ?? 'Unknown',
          role: m.role ?? 'member',
        }))
      )
      setSharedClients(
        (Array.isArray(cd) ? cd : (cd.data ?? [])).map((c: any) => ({
          id: c.id, name: c.name, color: c.color ?? '#94a3b8',
        }))
      )
    }).catch(() => {})
  }, [])

  const tabBtn = (s: 1 | 2 | 3 | 4, label: string, num: number, enabled: boolean) => (
    <button
      onClick={() => enabled && setStep(s)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: s === 1 ? '14px 20px 14px 0' : '14px 20px',
        background: 'none', border: 'none', cursor: enabled ? 'pointer' : 'default',
        borderBottom: step === s ? '2px solid var(--brand)' : '2px solid transparent',
        marginBottom: -1, flexShrink: 0,
      }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: step === s ? 'var(--brand)' : 'var(--border)',
        color: '#fff', fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{num}</div>
      <span style={{ fontSize: 13, fontWeight: step === s ? 700 : 500, color: step === s ? 'var(--brand)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Tab header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 24px', overflowX: 'auto',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Step 1 */}
        <button
          onClick={() => isAdmin && setStep(1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 20px 14px 0',
            background: 'none', border: 'none', cursor: isAdmin ? 'pointer' : 'default',
            borderBottom: step === 1 ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1, flexShrink: 0,
          }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: step === 1 ? 'var(--brand)' : 'var(--border)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>1</div>
          <span style={{ fontSize: 13, fontWeight: step === 1 ? 700 : 500, color: step === 1 ? 'var(--brand)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Compliance Master
          </span>
          {!isAdmin && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
              Admin only
            </span>
          )}
        </button>

        <ChevronRight style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0, margin: '0 4px' }}/>

        {tabBtn(2, 'Client Setup', 2, canSetupClients)}

        <ChevronRight style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0, margin: '0 4px' }}/>

        {tabBtn(3, 'Kanban Board', 3, canSetupClients)}

        <ChevronRight style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0, margin: '0 4px' }}/>

        {/* Step 4 — CA Tasks */}
        <button
          onClick={() => setStep(4)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 20px',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: step === 4 ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1, flexShrink: 0,
          }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: step === 4 ? 'var(--brand)' : 'var(--border)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ClipboardList style={{ width: 13, height: 13 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: step === 4 ? 700 : 500, color: step === 4 ? 'var(--brand)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            CA Tasks
          </span>
        </button>

        {/* Next buttons */}
        {step === 1 && canSetupClients && (
          <button
            onClick={() => setStep(2)}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
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
              fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}>
            Next: Kanban Board <ChevronRight style={{ width: 14, height: 14 }}/>
          </button>
        )}
        {step === 3 && (
          <button
            onClick={() => setStep(4)}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}>
            View CA Tasks <ChevronRight style={{ width: 14, height: 14 }}/>
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
        {step === 4 && (
          <CATasksView
            userRole={userRole}
            currentUserId={currentUserId}
            members={sharedMembers}
            clients={sharedClients}
          />
        )}
      </div>
    </div>
  )
}
