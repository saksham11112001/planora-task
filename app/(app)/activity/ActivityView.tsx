'use client'
import { useState, useCallback, useRef } from 'react'
import {
  Activity, CheckSquare, Receipt, Search, Filter,
  RefreshCw, ArrowRight, User,
} from 'lucide-react'

interface LogEntry {
  id:          string
  org_id:      string
  user_id:     string | null
  user_name:   string | null
  action:      string
  entity_type: string
  entity_id:   string | null
  entity_name: string | null
  meta:        Record<string, any>
  created_at:  string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)      return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)      return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)      return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)       return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function absTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ACTION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'task.created':         { label: 'Task created',         color: '#0d9488', icon: <CheckSquare style={{ width: 13, height: 13 }}/> },
  'task.completed':       { label: 'Task completed',       color: '#16a34a', icon: <CheckSquare style={{ width: 13, height: 13 }}/> },
  'task.status_changed':  { label: 'Task status changed',  color: '#6366f1', icon: <CheckSquare style={{ width: 13, height: 13 }}/> },
  'invoice.created':      { label: 'Invoice created',      color: '#0d9488', icon: <Receipt style={{ width: 13, height: 13 }}/> },
  'invoice.status_changed':{ label: 'Invoice status changed', color: '#f59e0b', icon: <Receipt style={{ width: 13, height: 13 }}/> },
}

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, color: '#64748b', icon: <Activity style={{ width: 13, height: 13 }}/> }
}

function describeLog(log: LogEntry): string {
  const meta = log.meta ?? {}
  switch (log.action) {
    case 'task.created':
      return `Created task "${log.entity_name ?? 'Untitled'}"`
    case 'task.completed':
      return `Completed task "${log.entity_name ?? 'Untitled'}"`
    case 'task.status_changed':
      return `Changed task "${log.entity_name ?? 'Untitled'}" from ${meta.from ?? '?'} → ${meta.to ?? '?'}`
    case 'invoice.created':
      return `Created invoice ${meta.invoice_number ?? ''} "${log.entity_name ?? 'Untitled'}"`
    case 'invoice.status_changed':
      return `Marked invoice "${log.entity_name ?? 'Untitled'}" as ${meta.to ?? '?'}`
    default:
      return log.entity_name ? `"${log.entity_name}"` : log.action
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ActivityView({ logs: initial }: { logs: LogEntry[] }) {
  const [logs,      setLogs]      = useState<LogEntry[]>(initial)
  const [search,    setSearch]    = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading,   setLoading]   = useState(false)
  const [hasMore,   setHasMore]   = useState(initial.length === 200)
  const offsetRef   = useRef(initial.length)

  const loadMore = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/activity?limit=100&offset=${offsetRef.current}`)
      const data = await res.json()
      const rows: LogEntry[] = data.data ?? []
      setLogs(prev => [...prev, ...rows])
      offsetRef.current += rows.length
      setHasMore(rows.length === 100)
    } catch {} finally { setLoading(false) }
  }, [loading])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/activity?limit=200')
      const data = await res.json()
      const rows: LogEntry[] = data.data ?? []
      setLogs(rows)
      offsetRef.current = rows.length
      setHasMore(rows.length === 200)
    } catch {} finally { setLoading(false) }
  }, [])

  // Filter
  const filtered = logs.filter(log => {
    if (typeFilter !== 'all' && log.entity_type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const desc = describeLog(log).toLowerCase()
      if (!desc.includes(q) && !(log.user_name ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // Group by date
  const grouped: { label: string; items: LogEntry[] }[] = []
  const seen: Record<string, number> = {}
  for (const log of filtered) {
    const d   = new Date(log.created_at)
    const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    if (seen[key] == null) { seen[key] = grouped.length; grouped.push({ label: key, items: [] }) }
    grouped[seen[key]].items.push(log)
  }

  return (
    <div style={{ padding: '24px', flex: 1, maxWidth: 860, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity style={{ width: 22, height: 22, color: 'var(--brand)' }}/>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Activity log</h1>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
            background: 'var(--surface-subtle)', color: 'var(--text-muted)',
            border: '1px solid var(--border)', fontWeight: 600 }}>
            {filtered.length} events
          </span>
        </div>
        <button onClick={refresh} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface-subtle)',
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            opacity: loading ? 0.6 : 1 }}>
          <RefreshCw style={{ width: 12, height: 12 }}/>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
          border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
          flex: 1, minWidth: 180, maxWidth: 300 }}>
          <Search style={{ width: 13, height: 13, color: 'var(--text-muted)', flexShrink: 0 }}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search activity…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit' }}/>
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface-subtle)',
            color: 'var(--text-primary)', fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="all">All types</option>
          <option value="task">Tasks only</option>
          <option value="invoice">Invoices only</option>
        </select>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 20px', color: 'var(--text-muted)' }}>
          <Activity style={{ width: 40, height: 40, opacity: 0.15, marginBottom: 12 }}/>
          <p style={{ fontSize: 14, fontWeight: 500 }}>
            {logs.length === 0 ? 'No activity recorded yet' : 'No results match your filters'}
          </p>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
            Activity is logged when tasks and invoices are created or updated.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {grouped.map(group => (
            <div key={group.label}>
              {/* Date divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }}/>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                  {group.label}
                </span>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }}/>
              </div>

              {/* Events for this date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {group.items.map((log, i) => {
                  const am = getActionMeta(log.action)
                  return (
                    <div key={log.id}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '10px 14px', borderRadius: 10,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        transition: 'border-color 0.12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand-border)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>

                      {/* Icon dot */}
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: `${am.color}18`,
                        border: `1.5px solid ${am.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: am.color, marginTop: 1 }}>
                        {am.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500,
                          lineHeight: 1.4, marginBottom: 3 }}>
                          {describeLog(log)}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {/* Action badge */}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                            background: `${am.color}15`, color: am.color,
                            border: `1px solid ${am.color}30`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {am.label}
                          </span>
                          {/* User */}
                          {log.user_name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <User style={{ width: 10, height: 10, color: 'var(--text-muted)' }}/>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.user_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div title={absTime(log.created_at)}
                        style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2, cursor: 'default' }}>
                        {relTime(log.created_at)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
              <button onClick={loadMore} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Loading…' : 'Load more'}
                {!loading && <ArrowRight style={{ width: 12, height: 12 }}/>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
