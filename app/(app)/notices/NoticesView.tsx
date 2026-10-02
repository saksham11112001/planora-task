'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, FileWarning, ExternalLink } from 'lucide-react'
import { toast } from '@/store/appStore'
import {
  normaliseStatus, normalisePortal, isOverdue, isDueSoon,
  NOTICE_STATUS_LABEL, NOTICE_PORTAL_LABEL, NOTICE_STATUSES,
  type Notice, type NoticeStatus,
} from '@/lib/notices'

interface Member { id: string; name: string }
type NoticeRow = Notice & { clients?: { id: string; name: string } | null }

/** Which bucket a notice falls in. Mutually exclusive, so the three counts
 *  always add up to the number of open notices. */
type Bucket = 'overdue' | 'due_soon' | 'open' | 'closed'

function bucketOf(n: NoticeRow, today: string): Bucket {
  if (normaliseStatus(n.status) === 'closed') return 'closed'
  if (isOverdue(n, today))  return 'overdue'
  if (isDueSoon(n, today))  return 'due_soon'
  return 'open'
}

export default function NoticesView({
  today, members, canEdit,
}: {
  today:   string
  members: Member[]
  canEdit: boolean
}) {
  const [notices, setNotices] = useState<NoticeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | Bucket>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | NoticeStatus>('all')
  const [busyId, setBusyId]   = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notices')
      if (!r.ok) throw new Error()
      setNotices((await r.json()).data ?? [])
    } catch {
      toast.error('Could not load notices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const nameOf = useCallback(
    (id: string | null) => (id ? members.find(m => m.id === id)?.name ?? 'Unknown' : 'Unassigned'),
    [members],
  )

  const counts = useMemo(() => {
    const c = { overdue: 0, due_soon: 0, open: 0, closed: 0 }
    for (const n of notices) c[bucketOf(n, today)]++
    return c
  }, [notices, today])

  const visible = useMemo(() => notices.filter(n => {
    if (filter !== 'all' && bucketOf(n, today) !== filter) return false
    if (statusFilter !== 'all' && normaliseStatus(n.status) !== statusFilter) return false
    return true
  }), [notices, filter, statusFilter, today])

  /** Optimistic status change, rolled back on failure. */
  async function setStatus(n: NoticeRow, status: NoticeStatus) {
    if (busyId) return
    setBusyId(n.id)
    const prev = notices
    setNotices(ns => ns.map(x => x.id === n.id ? { ...x, status } : x))
    try {
      const r = await fetch(`/api/notices/${n.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setNotices(prev)
        toast.error(j.error ?? 'Could not update the notice')
        return
      }
      toast.success('Notice updated')
    } catch {
      setNotices(prev)
      toast.error('Could not update the notice')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ padding: '20px 24px 48px', maxWidth: 1200, margin: '0 auto' }}>

      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Notices</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Every statutory notice across all clients, by response deadline.
        </p>
      </header>

      {/* Buckets. Clicking one filters; clicking it again clears. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat label="Overdue"     value={counts.overdue}  tone="#dc2626"
              active={filter === 'overdue'}  onClick={() => setFilter(f => f === 'overdue'  ? 'all' : 'overdue')}
              icon={<AlertTriangle className="h-4 w-4"/>}/>
        <Stat label="Due in 7 days" value={counts.due_soon} tone="#d97706"
              active={filter === 'due_soon'} onClick={() => setFilter(f => f === 'due_soon' ? 'all' : 'due_soon')}
              icon={<Clock className="h-4 w-4"/>}/>
        <Stat label="Open"        value={counts.open}     tone="var(--text-secondary)"
              active={filter === 'open'}     onClick={() => setFilter(f => f === 'open'     ? 'all' : 'open')}
              icon={<FileWarning className="h-4 w-4"/>}/>
        <Stat label="Closed"      value={counts.closed}   tone="var(--brand)"
              active={filter === 'closed'}   onClick={() => setFilter(f => f === 'closed'   ? 'all' : 'closed')}/>
      </div>

      <div style={{ marginBottom: 12 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | NoticeStatus)}
          style={{
            padding: '6px 9px', borderRadius: 7, fontSize: 13, fontFamily: 'inherit',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-primary)', outline: 'none',
          }}>
          <option value="all">All statuses</option>
          {NOTICE_STATUSES.map(s => <option key={s} value={s}>{NOTICE_STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {loading && <Empty text="Loading…"/>}

      {!loading && visible.length === 0 && (
        <Empty text={notices.length === 0
          ? 'No notices recorded yet. Add one from a client’s page.'
          : 'No notices match this filter.'}/>
      )}

      {!loading && visible.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-subtle)' }}>
                {['Client', 'Notice', 'Portal', 'Due', 'Owner', 'Status', ''].map((h, i) => (
                  <th key={i} style={{
                    textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 600,
                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(n => {
                const bucket = bucketOf(n, today)
                const status = normaliseStatus(n.status)
                return (
                  <tr key={n.id}>
                    <Td>
                      {n.clients?.id
                        ? <Link href={`/clients/${n.clients.id}`} style={{ color: 'var(--brand)', textDecoration: 'none' }}>
                            {n.clients.name} <ExternalLink className="h-3 w-3" style={{ display: 'inline' }}/>
                          </Link>
                        : '—'}
                    </Td>
                    <Td>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{n.title}</div>
                      {(n.section || n.notice_type) && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {[n.notice_type, n.section && `s. ${n.section}`].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </Td>
                    <Td>{NOTICE_PORTAL_LABEL[normalisePortal(n.portal)]}</Td>
                    <Td>
                      <span style={{
                        color: bucket === 'overdue' ? '#dc2626' : bucket === 'due_soon' ? '#d97706' : 'var(--text-secondary)',
                        fontWeight: bucket === 'overdue' || bucket === 'due_soon' ? 600 : 400,
                      }}>
                        {n.response_due ?? 'No deadline'}
                      </span>
                    </Td>
                    <Td>{nameOf(n.assigned_to)}</Td>
                    <Td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 8px',
                        border: '1px solid var(--border)', color: 'var(--text-secondary)',
                      }}>{NOTICE_STATUS_LABEL[status]}</span>
                      {n.source === 'api' && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>auto</span>
                      )}
                    </Td>
                    <Td>
                      {canEdit && status !== 'closed' && (
                        <button onClick={() => setStatus(n, status === 'action_pending' ? 'response_filed' : 'closed')}
                          disabled={busyId === n.id}
                          style={{
                            padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            fontFamily: 'inherit', cursor: 'pointer',
                            border: '1px solid var(--brand)', background: 'transparent', color: 'var(--brand)',
                          }}>
                          {status === 'action_pending' ? 'Mark filed' : 'Close'}
                        </button>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone, active, onClick, icon }: {
  label: string; value: number; tone: string; active: boolean
  onClick: () => void; icon?: React.ReactNode
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
      borderRadius: 10, fontFamily: 'inherit', cursor: 'pointer', minWidth: 130,
      border: `1px solid ${active ? tone : 'var(--border)'}`,
      background: active ? 'var(--surface-subtle)' : 'var(--surface)',
      textAlign: 'left',
    }}>
      <span style={{ color: tone }}>{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: 18, fontWeight: 700, color: tone }}>{value}</span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      </span>
    </button>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '9px 12px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
      {children}
    </td>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{
      border: '1px dashed var(--border)', borderRadius: 10, padding: '28px 16px',
      textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
    }}>{text}</div>
  )
}
