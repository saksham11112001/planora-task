'use client'
import { useState, useMemo } from 'react'

interface Client {
  id: string
  name: string
  color: string
}

interface Task {
  id: string
  title: string
  status: string
  priority: string | null
  due_date: string | null
  client_id: string | null
}

interface Props {
  clients: Client[]
  tasks: Task[]
}

// Indian FY months: Apr(3) to Mar(2 of next year)
const FY_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2]
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getStatusChip(status: string, dueDate: string): { label: string; bg: string; color: string } {
  const now = new Date()
  const due = new Date(dueDate)
  if (status === 'completed') return { label: 'Filed', bg: 'rgba(16,185,129,0.15)', color: '#10b981' }
  if (due < now) return { label: 'Overdue', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' }
  return { label: 'Pending', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
}

export function AnnualCalendarView({ clients, tasks }: Props) {
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id ?? '')

  const clientTasks = useMemo(
    () => tasks.filter(t => t.client_id === selectedClientId),
    [tasks, selectedClientId]
  )

  // Build unique task types (titles) for the selected client
  const taskTypes = useMemo(() => {
    const seen = new Set<string>()
    const types: string[] = []
    for (const t of clientTasks) {
      if (!seen.has(t.title)) { seen.add(t.title); types.push(t.title) }
    }
    return types
  }, [clientTasks])

  // Map: taskTitle -> monthIndex(0-11) -> Task[]
  const cellMap = useMemo(() => {
    const map: Record<string, Record<number, Task[]>> = {}
    for (const t of clientTasks) {
      if (!t.due_date) continue
      const month = new Date(t.due_date).getMonth()
      if (!map[t.title]) map[t.title] = {}
      if (!map[t.title][month]) map[t.title][month] = []
      map[t.title][month].push(t)
    }
    return map
  }, [clientTasks])

  // Summary counts
  const summary = useMemo(() => {
    let filed = 0, pending = 0, overdue = 0
    const now = new Date()
    for (const t of clientTasks) {
      if (t.status === 'completed') { filed++; continue }
      if (t.due_date && new Date(t.due_date) < now) { overdue++; continue }
      pending++
    }
    return { filed, pending, overdue }
  }, [clientTasks])

  const selectedClient = clients.find(c => c.id === selectedClientId)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--fg, #0f172a)' }}>
            Annual Compliance Calendar
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted, #64748b)', marginTop: 4 }}>
            Indian FY (Apr – Mar) compliance view per client
          </p>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)',
            background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: 'var(--fg-muted, #64748b)', transition: 'all 0.12s',
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print
        </button>
      </div>

      {/* Client selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--fg-muted, #64748b)', display: 'block', marginBottom: 6 }}>
          Select Client
        </label>
        <select
          value={selectedClientId}
          onChange={e => setSelectedClientId(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: '1px solid rgba(0,0,0,0.15)', background: 'var(--surface, #fff)',
            color: 'var(--fg, #0f172a)', cursor: 'pointer', minWidth: 220,
          }}>
          {clients.length === 0 && <option value="">No active clients</option>}
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      {selectedClientId && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Filed', count: summary.filed, bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'rgba(16,185,129,0.25)' },
            { label: 'Pending', count: summary.pending, bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
            { label: 'Overdue', count: summary.overdue, bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '10px 18px', borderRadius: 10,
              background: s.bg, border: `1px solid ${s.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80,
            }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: s.color, marginTop: 3 }}>{s.label}</span>
            </div>
          ))}
          {selectedClient && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto',
              padding: '8px 14px', borderRadius: 10,
              background: `${selectedClient.color}15`, border: `1px solid ${selectedClient.color}33` }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedClient.color }}/>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg, #0f172a)' }}>{selectedClient.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Calendar grid */}
      {selectedClientId && taskTypes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-muted, #64748b)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>No compliance tasks found</p>
          <p style={{ fontSize: 13, margin: 0 }}>This client has no CA compliance tasks with due dates.</p>
        </div>
      ) : selectedClientId ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{
                  padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: 'var(--fg-muted, #64748b)',
                  background: 'rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  minWidth: 180, position: 'sticky', left: 0, zIndex: 1,
                }}>
                  Task Type
                </th>
                {FY_MONTHS.map(m => (
                  <th key={m} style={{
                    padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: 11,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    color: 'var(--fg-muted, #64748b)',
                    background: 'rgba(0,0,0,0.03)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    minWidth: 70,
                  }}>
                    {MONTH_LABELS[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taskTypes.map((type, rowIdx) => (
                <tr key={type}>
                  <td style={{
                    padding: '9px 12px', fontWeight: 600, fontSize: 12,
                    color: 'var(--fg, #0f172a)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: rowIdx % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent',
                    position: 'sticky', left: 0, zIndex: 1,
                    maxWidth: 200, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {type}
                  </td>
                  {FY_MONTHS.map(m => {
                    const cellTasks = cellMap[type]?.[m] ?? []
                    return (
                      <td key={m} style={{
                        padding: '6px 4px', textAlign: 'center',
                        border: '1px solid rgba(0,0,0,0.08)',
                        background: rowIdx % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent',
                      }}>
                        {cellTasks.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                            {cellTasks.slice(0, 2).map(t => {
                              const chip = getStatusChip(t.status, t.due_date!)
                              return (
                                <span key={t.id} style={{
                                  display: 'inline-block', padding: '2px 7px', borderRadius: 99,
                                  fontSize: 10, fontWeight: 700,
                                  background: chip.bg, color: chip.color,
                                  whiteSpace: 'nowrap',
                                }}>
                                  {chip.label}
                                </span>
                              )
                            })}
                            {cellTasks.length > 2 && (
                              <span style={{ fontSize: 9, color: 'var(--fg-muted, #64748b)' }}>
                                +{cellTasks.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'rgba(0,0,0,0.12)', fontSize: 14 }}>–</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
