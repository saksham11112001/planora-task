'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { FileCheck, ChevronRight, GripVertical } from 'lucide-react'
import { CAMasterView } from './CAMasterView'
import { CAClientSetupView } from './CAClientSetupView'

interface Props { userRole: string }

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
}

interface KanbanClient { id: string; name: string; color: string }

function CAKanbanView({ userRole }: { userRole: string }) {
  const [clients, setClients]   = useState<KanbanClient[]>([])
  const [selectedClient, setSelectedClient] = useState<KanbanClient | null>(null)
  const [allTasks, setAllTasks] = useState<KanbanTask[]>([])
  const [loading, setLoading]   = useState(false)

  /* board state: task id → 'active' | 'paused' */
  const [board, setBoard] = useState<Record<string, 'active' | 'paused'>>({})
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<'active' | 'paused' | null>(null)
  // In-memory cache of original next_occurrence_date before pausing
  // (also persisted to DB via custom_fields._paused_next_date as fallback)
  const pausedDatesRef = useRef<Record<string, string | null>>({})

  /* Load clients */
  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(j => {
      setClients(Array.isArray(j) ? j : (j.data ?? []))
    }).catch(() => {})
  }, [])

  /* Load tasks for selected client (from tasks table — covers both imported and manually created) */
  const loadTasks = useCallback(async (clientId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?client_id=${clientId}&top_level=true&limit=200`)
      const json = await res.json()
      const data: any[] = Array.isArray(json) ? json : (json.data ?? [])
      const tasks: KanbanTask[] = data.map((t: any) => ({
        id: t.id,
        name: t.title,
        group_name: '',
        status: t.status ?? 'todo',
        priority: t.priority ?? 'medium',
        due_date: t.due_date ?? null,
        is_recurring: t.is_recurring ?? false,
        next_occurrence_date: t.next_occurrence_date ?? null,
        custom_fields: t.custom_fields ?? null,
      }))
      setAllTasks(tasks)
      /* restore board state from localStorage */
      try {
        const stored = localStorage.getItem(`ca_board_${clientId}`)
        if (stored) setBoard(JSON.parse(stored))
        else setBoard({})
      } catch { setBoard({}) }
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

    // For recurring tasks: pause = clear next_occurrence_date (stops future triggers)
    //                       unpause = restore original next_occurrence_date
    if (task?.is_recurring) {
      try {
        if (col === 'paused') {
          // Remember original date in-memory AND persist to DB so it survives page reloads
          const originalDate = task.next_occurrence_date ?? task.due_date ?? null
          pausedDatesRef.current[task.id] = originalDate
          await fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              next_occurrence_date: null,
              custom_fields: { _paused_next_date: originalDate },
            }),
          })
          setAllTasks(ts => ts.map(t => t.id === task.id ? { ...t, next_occurrence_date: null } : t))
        } else {
          // Restore: prefer in-memory ref, fall back to DB-persisted value
          const restoreDate =
            pausedDatesRef.current[task.id] ??
            (task as any).custom_fields?._paused_next_date ??
            null
          delete pausedDatesRef.current[task.id]
          await fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              next_occurrence_date: restoreDate,
              custom_fields: { _paused_next_date: null },
            }),
          })
          setAllTasks(ts => ts.map(t => t.id === task.id ? { ...t, next_occurrence_date: restoreDate } : t))
        }
      } catch {
        // Non-critical — board state still persisted locally
      }
    }
  }

  const activeTasks = allTasks.filter(t => (board[t.id] ?? 'active') === 'active')
  const pausedTasks = allTasks.filter(t => board[t.id] === 'paused')

  function KanbanCard({ task }: { task: KanbanTask }) {
    return (
      <div
        draggable
        onDragStart={() => setDragId(task.id)}
        onDragEnd={() => { setDragId(null); setDragOver(null) }}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 12px', marginBottom: 8,
          cursor: 'grab', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
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
              {task.priority && (
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, fontWeight: 600,
                  background: task.priority === 'high' || task.priority === 'urgent' ? '#fef2f2' : task.priority === 'medium' ? '#fffbeb' : '#f0fdf4',
                  color: task.priority === 'high' || task.priority === 'urgent' ? '#dc2626' : task.priority === 'medium' ? '#b45309' : '#16a34a',
                }}>
                  {task.priority}
                </span>
              )}
              {task.due_date && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Due {task.due_date.slice(0, 10)}
                </span>
              )}
              {task.is_recurring && board[task.id] === 'paused' && (
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, fontWeight: 600,
                  background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                  ⏸ Paused
                </span>
              )}
              {task.is_recurring && board[task.id] !== 'paused' && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>↻ Recurring</span>
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
            No saved tasks for {selectedClient.name}. Go to Step 2 to assign tasks.
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

export function ComplianceShell({ userRole }: Props) {
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
        {step === 3 && <CAKanbanView userRole={userRole} />}
      </div>
    </div>
  )
}
