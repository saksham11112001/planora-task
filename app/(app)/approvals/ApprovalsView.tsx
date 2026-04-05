'use client'
import React, { useState, useTransition } from 'react'
import { useRouter }     from 'next/navigation'
import { fmtDate, isOverdue } from '@/lib/utils/format'
import { PriorityBadge, Avatar } from '@/components/ui/Badge'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { toast, useFilterStore } from '@/store/appStore'
import { UniversalFilterBar } from '@/components/filters/UniversalFilterBar'
import { CheckCheck, X, Clock, RefreshCw, FolderOpen, ChevronDown } from 'lucide-react'

interface Task {
  id: string; title: string; status: string; priority: string
  due_date: string | null; created_at: string; completed_at?: string | null
  assignee_id: string | null; approver_id?: string | null
  client_id: string | null; project_id: string | null
  approval_status: string | null; is_recurring: boolean
  assignee: { id: string; name: string } | null
  project:  { id: string; name: string; color: string } | null
  client:   { id: string; name: string; color: string } | null
}

interface Props {
  pending:       Task[]
  history:       Task[]
  members:       { id: string; name: string }[]
  clients:       { id: string; name: string; color: string }[]
  currentUserId: string
  userRole:      string
}

export function ApprovalsView({ pending: initialPending, history, members, clients, currentUserId, userRole }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [pending,    setPending]    = useState<Task[]>(initialPending)
  const [selTask,    setSelTask]    = useState<Task | null>(null)
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [showHistory, setShowHistory] = useState(false)

  // Global filters
  const { clientId: filterClient, search: filterSearch, priority: filterPriority } = useFilterStore()

  const visiblePending = pending.filter(t => {
    if (filterClient  && t.client_id !== filterClient) return false
    if (filterPriority && t.priority  !== filterPriority) return false
    if (filterSearch   && !t.title.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

  async function decide(taskId: string, decision: 'approve' | 'reject') {
    setProcessing(p => new Set(p).add(taskId))
    const res = await fetch(`/api/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    setProcessing(p => { const s = new Set(p); s.delete(taskId); return s })

    if (res.ok) {
      setPending(p => p.filter(t => t.id !== taskId))
      toast.success(decision === 'approve' ? '✓ Task approved' : 'Task returned to assignee')
      startT(() => router.refresh())
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Action failed')
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-subtle)' }}>
      {/* Universal filter bar */}
      <UniversalFilterBar clients={clients} showSearch showPriority/>

      <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            Approvals
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            {pending.length === 0
              ? 'All caught up — no tasks waiting for your approval'
              : `${pending.length} task${pending.length === 1 ? '' : 's'} waiting for your review`}
          </p>
        </div>

        {/* Empty state */}
        {pending.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface)',
            borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Nothing to approve
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              You&apos;re all caught up. Tasks submitted by your team will appear here.
            </p>
          </div>
        )}

        {/* Pending tasks */}
        {visiblePending.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {visiblePending.map(task => {
              const ov    = isOverdue(task.due_date, task.status)
              const busy  = processing.has(task.id)
              return (
                <div key={task.id}
                  style={{ background: 'var(--surface)', borderRadius: 12,
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    overflow: 'hidden', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}>

                  {/* Purple top accent */}
                  <div style={{ height: 3, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }}/>

                  <div style={{ padding: '16px 20px' }}>
                    {/* Top row: title + badge */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {task.is_recurring && (
                            <RefreshCw style={{ width: 11, height: 11, color: 'var(--brand)', flexShrink: 0 }}/>
                          )}
                          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.title}
                          </span>
                        </div>

                        {/* Meta row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {task.assignee && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                              color: 'var(--text-muted)' }}>
                              <Avatar name={task.assignee.name} size="xs"/>
                              Submitted by <strong style={{ color: 'var(--text-secondary)' }}>{task.assignee.name}</strong>
                            </span>
                          )}
                          {task.client && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                              color: 'var(--text-muted)' }}>
                              <span style={{ width: 7, height: 7, borderRadius: 2,
                                background: task.client.color, display: 'inline-block' }}/>
                              {task.client.name}
                            </span>
                          )}
                          {task.project && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                              color: 'var(--text-muted)' }}>
                              <FolderOpen style={{ width: 11, height: 11 }}/>
                              {task.project.name}
                            </span>
                          )}
                          {task.due_date && (
                            <span style={{ fontSize: 12, fontWeight: ov ? 600 : 400,
                              color: ov ? '#f87171' : 'var(--text-muted)' }}>
                              {ov ? '⚠️ Overdue · ' : '📅 '}{fmtDate(task.due_date)}
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Submitted {new Date(task.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <PriorityBadge priority={task.priority}/>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, fontWeight: 600,
                          background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.3)' }}>
                          <Clock style={{ width: 9, height: 9, display: 'inline', marginRight: 3 }}/>
                          Awaiting review
                        </span>
                      </div>
                    </div>

                    {/* Action row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setSelTask(selTask?.id === task.id ? null : task)}
                        style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none',
                          cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
                        View full task →
                      </button>
                      <div style={{ flex: 1 }}/>
                      <button onClick={() => decide(task.id, 'reject')} disabled={busy}
                        style={{ padding: '8px 18px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
                          fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                          border: '1px solid var(--border)', background: 'var(--surface)',
                          color: 'var(--text-secondary)', opacity: busy ? 0.6 : 1,
                          display: 'flex', alignItems: 'center', gap: 5 }}>
                        <X style={{ width: 13, height: 13 }}/> Return to assignee
                      </button>
                      <button onClick={() => decide(task.id, 'approve')} disabled={busy}
                        style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
                          cursor: busy ? 'not-allowed' : 'pointer',
                          background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 600,
                          fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
                          display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CheckCheck style={{ width: 14, height: 14 }}/> {busy ? 'Processing…' : 'Approve'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Recent history */}
        {history.length > 0 && (
          <div>
            <button onClick={() => setShowHistory(h => !h)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                fontWeight: 600, color: 'var(--text-muted)', background: 'none',
                border: 'none', cursor: 'pointer', padding: '0 0 12px', fontFamily: 'inherit' }}>
              <ChevronDown style={{ width: 14, height: 14,
                transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}/>
              Recent decisions (last 7 days) · {history.length}
            </button>

            {showHistory && (
              <div style={{ background: 'var(--surface)', borderRadius: 12,
                border: '1px solid var(--border)', overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 100px',
                  padding: '8px 16px', background: 'var(--surface-subtle)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div>Task</div><div>Assignee</div><div>Decision</div><div>Date</div>
                </div>
                {history.map(task => (
                  <div key={task.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 100px',
                      alignItems: 'center', padding: '10px 16px',
                      borderBottom: '1px solid var(--border-light)',
                      cursor: 'pointer' }}
                    onClick={() => setSelTask(selTask?.id === task.id ? null : task)}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </div>
                      {task.client && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 1,
                            background: task.client.color, display: 'inline-block' }}/>
                          {task.client.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {task.assignee && (
                        <><Avatar name={task.assignee.name} size="xs"/>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.assignee.name}
                        </span></>
                      )}
                    </div>
                    <div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                        background: task.approval_status === 'approved' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                        color: task.approval_status === 'approved' ? '#16a34a' : '#dc2626' }}>
                        {task.approval_status === 'approved' ? '✓ Approved' : '✕ Returned'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {task.completed_at
                        ? new Date(task.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Task detail modal */}
      <TaskDetailPanel
        task={selTask} members={members} clients={clients}
        currentUserId={currentUserId} userRole={userRole}
        onClose={() => setSelTask(null)}
        onUpdated={() => { setSelTask(null); startT(() => router.refresh()) }}
      />
    </div>
  )
}