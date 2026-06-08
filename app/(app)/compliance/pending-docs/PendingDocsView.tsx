'use client'
import { useState, useMemo } from 'react'

interface PendingTask {
  id: string
  title: string
  status: string
  priority: string | null
  due_date: string | null
  client_id: string | null
  assignee_id: string | null
}

interface ClientInfo {
  id: string
  name: string
  color: string
}

interface Props {
  pendingTasks: PendingTask[]
  clientMap: Record<string, ClientInfo>
  today: string
}

type FilterType = 'all' | 'overdue' | 'this_week' | 'this_month'

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#6b7280',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

function getDaysOverdue(dueDate: string | null, today: string): number {
  if (!dueDate) return 0
  const diff = new Date(today).getTime() - new Date(dueDate).getTime()
  return Math.floor(diff / 86400000)
}

function isThisWeek(dueDate: string | null, today: string): boolean {
  if (!dueDate) return false
  const t = new Date(today)
  const d = new Date(dueDate)
  const day = t.getDay()
  const startOfWeek = new Date(t)
  startOfWeek.setDate(t.getDate() - day)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  return d >= startOfWeek && d <= endOfWeek
}

function isThisMonth(dueDate: string | null, today: string): boolean {
  if (!dueDate) return false
  const t = new Date(today)
  const d = new Date(dueDate)
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth()
}

export function PendingDocsView({ pendingTasks, clientMap, today }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filteredTasks = useMemo(() => {
    return pendingTasks.filter(t => {
      if (filter === 'overdue') return getDaysOverdue(t.due_date, today) > 0
      if (filter === 'this_week') return isThisWeek(t.due_date, today)
      if (filter === 'this_month') return isThisMonth(t.due_date, today)
      return true
    })
  }, [pendingTasks, filter, today])

  // Group by client
  const grouped = useMemo(() => {
    const map: Record<string, PendingTask[]> = {}
    for (const t of filteredTasks) {
      const key = t.client_id ?? '__no_client__'
      if (!map[key]) map[key] = []
      map[key].push(t)
    }
    return map
  }, [filteredTasks])

  const clientCount = Object.keys(grouped).filter(k => k !== '__no_client__').length
  const totalCount = filteredTasks.length

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'this_week', label: 'Due This Week' },
    { key: 'this_month', label: 'Due This Month' },
  ]

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Page title */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--fg, #0f172a)' }}>
          Pending Documents
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-muted, #64748b)', marginTop: 4 }}>
          CA compliance tasks awaiting document upload
        </p>
      </div>

      {/* Summary strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(13,148,136,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg, #0f172a)' }}>
            {totalCount} task{totalCount !== 1 ? 's' : ''} waiting for documents
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-muted, #64748b)' }}>
            across {clientCount} client{clientCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all 0.12s',
              background: filter === f.key ? '#0d9488' : 'rgba(0,0,0,0.06)',
              color: filter === f.key ? '#fff' : 'var(--fg-muted, #64748b)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Grouped list */}
      {totalCount === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-muted, #64748b)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>No pending documents</p>
          <p style={{ fontSize: 13, margin: 0 }}>All tasks in this filter have documents uploaded.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([clientId, tasks]) => {
          const client = clientId === '__no_client__' ? null : clientMap[clientId]
          const clientName = client?.name ?? 'Unassigned Client'
          const clientColor = client?.color ?? '#94a3b8'

          return (
            <div key={clientId} style={{ marginBottom: 20 }}>
              {/* Client header chip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: clientColor, flexShrink: 0,
                }}/>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: 'var(--fg, #0f172a)',
                  background: `${clientColor}22`,
                  border: `1px solid ${clientColor}44`,
                  padding: '3px 10px', borderRadius: 99,
                }}>
                  {clientName}
                </span>
                <span style={{ fontSize: 11, color: 'var(--fg-muted, #64748b)' }}>
                  {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Task rows */}
              <div style={{
                border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
                overflow: 'hidden',
              }}>
                {tasks.map((task, idx) => {
                  const overdueDays = getDaysOverdue(task.due_date, today)
                  const isOverdue = overdueDays > 0
                  return (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 14px',
                      borderBottom: idx < tasks.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      background: isOverdue ? 'rgba(239,68,68,0.03)' : 'transparent',
                    }}>
                      {/* Priority dot */}
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: PRIORITY_COLOR[task.priority ?? 'low'] ?? '#6b7280',
                      }}/>

                      {/* Title */}
                      <span style={{
                        flex: 1, fontSize: 13, fontWeight: 500,
                        color: 'var(--fg, #0f172a)',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}>
                        {task.title}
                      </span>

                      {/* Priority badge */}
                      {task.priority && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                          background: `${PRIORITY_COLOR[task.priority] ?? '#6b7280'}20`,
                          color: PRIORITY_COLOR[task.priority] ?? '#6b7280',
                          flexShrink: 0,
                        }}>
                          {PRIORITY_LABEL[task.priority] ?? task.priority}
                        </span>
                      )}

                      {/* Due date / overdue */}
                      <span style={{
                        fontSize: 11, flexShrink: 0, fontWeight: isOverdue ? 700 : 400,
                        color: isOverdue ? '#ef4444' : 'var(--fg-muted, #64748b)',
                      }}>
                        {task.due_date
                          ? isOverdue
                            ? `${overdueDays}d overdue`
                            : new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : 'No due date'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
