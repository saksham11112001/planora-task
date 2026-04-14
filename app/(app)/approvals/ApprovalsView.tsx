'use client'
import React, { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate, isOverdue } from '@/lib/utils/format'
import { Avatar } from '@/components/ui/Badge'
import { toast } from '@/store/appStore'
import {
  CheckCheck, X, Clock, RefreshCw, FolderOpen, ChevronDown, ChevronRight,
  Paperclip, User, Calendar, FileCheck, ListTodo, ExternalLink, AlertTriangle,
} from 'lucide-react'

interface Task {
  id: string; title: string; status: string; priority: string
  due_date: string | null; created_at: string; completed_at?: string | null
  assignee_id: string | null; approver_id?: string | null; created_by?: string | null
  client_id: string | null; project_id: string | null
  approval_status: string | null; is_recurring: boolean; custom_fields?: any
  assignee: { id: string; name: string } | null
  creator:  { id: string; name: string } | null
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const isCaTask      = (t: Task) => t.custom_fields?._ca_compliance === true
const isRecurring   = (t: Task) => t.is_recurring
const isProjectTask = (t: Task) => !!t.project_id && !t.is_recurring && !isCaTask(t)
const isOneTime     = (t: Task) => !t.is_recurring && !isCaTask(t) && !t.project_id

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a',
}

function PriorityDot({ p }: { p: string }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLOR[p] ?? '#94a3b8', display: 'inline-block', flexShrink: 0 }}/>
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, count, color, icon, open, onToggle }:
  { label: string; count: number; color: string; icon: React.ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit', marginBottom: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
        background: `${color}18`, color }}>
        {count}
      </span>
      {open
        ? <ChevronDown style={{ width: 15, height: 15, color: 'var(--text-muted)', flexShrink: 0 }}/>
        : <ChevronRight style={{ width: 15, height: 15, color: 'var(--text-muted)', flexShrink: 0 }}/>}
    </button>
  )
}

// ── Single task card ──────────────────────────────────────────────────────────
function TaskCard({
  task, accentColor,
  onApprove, onReject, processing,
}: {
  task: Task; accentColor: string
  onApprove: () => void
  onReject: (comment: string) => void
  processing: boolean
}) {
  const [subtasksOpen,   setSubtasksOpen]   = useState(false)
  const [subtasks,       setSubtasks]       = useState<any[] | null>(null)
  const [subtaskLoading, setSubtaskLoading] = useState(false)

  const [attachOpen,     setAttachOpen]     = useState(false)
  const [attachments,    setAttachments]    = useState<any[] | null>(null)
  const [attachLoading,  setAttachLoading]  = useState(false)

  const [rejectOpen,  setRejectOpen]  = useState(false)
  const [comment,     setComment]     = useState('')

  const ov = isOverdue(task.due_date, task.status)

  async function toggleSubtasks() {
    const next = !subtasksOpen
    setSubtasksOpen(next)
    if (next && subtasks === null) {
      setSubtaskLoading(true)
      try {
        const r = await fetch(`/api/tasks?parent_id=${task.id}&limit=50`)
        const d = await r.json()
        setSubtasks(d.data ?? [])
      } catch { setSubtasks([]) }
      finally { setSubtaskLoading(false) }
    }
  }

  async function toggleAttachments() {
    const next = !attachOpen
    setAttachOpen(next)
    if (next && attachments === null) {
      setAttachLoading(true)
      try {
        const r = await fetch(`/api/tasks/${task.id}/attachments`)
        const d = await r.json()
        setAttachments(d.data ?? [])
      } catch { setAttachments([]) }
      finally { setAttachLoading(false) }
    }
  }

  function handleRejectSubmit() {
    onReject(comment)
    setRejectOpen(false)
    setComment('')
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
      overflow: 'hidden', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Accent bar */}
      <div style={{ height: 3, background: accentColor }}/>

      <div style={{ padding: '14px 18px' }}>

        {/* ── Row 1: title + priority ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <PriorityDot p={task.priority}/>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
            {task.title}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0,
            background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.2)',
            display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock style={{ width: 9, height: 9 }}/> Awaiting review
          </span>
        </div>

        {/* ── Row 2: meta chips ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {/* Due date */}
          {task.due_date && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
              color: ov ? '#dc2626' : 'var(--text-muted)', fontWeight: ov ? 600 : 400 }}>
              <Calendar style={{ width: 12, height: 12 }}/>
              {ov && <AlertTriangle style={{ width: 10, height: 10 }}/>}
              {fmtDate(task.due_date)}{ov ? ' · Overdue' : ''}
            </span>
          )}

          {/* Client */}
          {task.client && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: task.client.color, display: 'inline-block' }}/>
              {task.client.name}
            </span>
          )}

          {/* Project */}
          {task.project && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <FolderOpen style={{ width: 12, height: 12 }}/>
              {task.project.name}
            </span>
          )}

          {/* Assigned to */}
          {task.assignee && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <User style={{ width: 12, height: 12 }}/>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{task.assignee.name}</span>
              <span style={{ color: 'var(--text-muted)' }}>(assigned to)</span>
            </span>
          )}

          {/* Assigned by / creator */}
          {task.creator && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <User style={{ width: 12, height: 12 }}/>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{task.creator.name}</span>
              <span style={{ color: 'var(--text-muted)' }}>(assigned by)</span>
            </span>
          )}

          {/* Submitted date */}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Submitted {new Date(task.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* ── Row 3: subtasks + attachments toggles ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          {/* Subtasks */}
          <button onClick={toggleSubtasks}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px',
              borderRadius: 7, border: '1px solid var(--border)', background: subtasksOpen ? 'var(--surface-subtle)' : 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {subtasksOpen
              ? <ChevronDown style={{ width: 11, height: 11 }}/>
              : <ChevronRight style={{ width: 11, height: 11 }}/>}
            Subtasks
            {subtasks !== null && (
              <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--border)',
                padding: '1px 5px', borderRadius: 99, color: 'var(--text-muted)' }}>
                {subtasks.length}
              </span>
            )}
          </button>

          {/* Attachments */}
          <button onClick={toggleAttachments}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 10px',
              borderRadius: 7, border: '1px solid var(--border)', background: attachOpen ? 'var(--surface-subtle)' : 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Paperclip style={{ width: 11, height: 11 }}/>
            Attachments
            {attachments !== null && (
              <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--border)',
                padding: '1px 5px', borderRadius: 99, color: 'var(--text-muted)' }}>
                {attachments.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Subtask list ── */}
        {subtasksOpen && (
          <div style={{ marginBottom: 12, background: 'var(--surface-subtle)', borderRadius: 8,
            border: '1px solid var(--border)', overflow: 'hidden' }}>
            {subtaskLoading && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>Loading subtasks…</div>
            )}
            {!subtaskLoading && subtasks !== null && subtasks.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>No subtasks</div>
            )}
            {!subtaskLoading && subtasks !== null && subtasks.map((sub: any, i: number) => (
              <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px', borderBottom: i < subtasks.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${sub.status === 'completed' ? 'var(--brand)' : 'var(--border)'}`,
                  background: sub.status === 'completed' ? 'var(--brand)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sub.status === 'completed' && (
                    <svg viewBox="0 0 10 10" fill="none" style={{ width: 7, height: 7 }}>
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ flex: 1, fontSize: 12, color: sub.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: sub.status === 'completed' ? 'line-through' : 'none' }}>
                  {sub.title}
                </span>
                {sub.due_date && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{sub.due_date}</span>
                )}
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, flexShrink: 0, fontWeight: 500,
                  background: sub.status === 'completed' ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.1)',
                  color: sub.status === 'completed' ? '#16a34a' : 'var(--text-muted)' }}>
                  {sub.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Attachment list ── */}
        {attachOpen && (
          <div style={{ marginBottom: 12, background: 'var(--surface-subtle)', borderRadius: 8,
            border: '1px solid var(--border)', overflow: 'hidden' }}>
            {attachLoading && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>Loading attachments…</div>
            )}
            {!attachLoading && attachments !== null && attachments.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>No attachments uploaded</div>
            )}
            {!attachLoading && attachments !== null && attachments.map((att: any, i: number) => {
              const isNilAtt = att.drive_url === 'nil'
              const isLink   = !isNilAtt && (att.attachment_type === 'link' || att.drive_url)
              return (
                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px', borderBottom: i < attachments.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                  <Paperclip style={{ width: 13, height: 13, color: isNilAtt ? '#d97706' : 'var(--text-muted)', flexShrink: 0 }}/>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isNilAtt ? 'Not available (N/A)' : att.file_name}
                  </span>
                  {isNilAtt && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706',
                      background: 'rgba(217,119,6,0.1)', padding: '1px 6px', borderRadius: 4 }}>N/A</span>
                  )}
                  {isLink && !isNilAtt && (
                    <a href={att.drive_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11,
                        color: 'var(--brand)', textDecoration: 'none', flexShrink: 0 }}>
                      <ExternalLink style={{ width: 11, height: 11 }}/> View
                    </a>
                  )}
                  {!isLink && !isNilAtt && att.storage_path && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : 'File'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Reject comment box ── */}
        {rejectOpen && (
          <div style={{ marginBottom: 12, background: 'rgba(220,38,38,0.04)', borderRadius: 8,
            border: '1px solid rgba(220,38,38,0.2)', padding: '12px 14px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', margin: '0 0 8px' }}>
              Reason for returning (optional)
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Let the assignee know what needs to be corrected…"
              rows={3}
              style={{ width: '100%', fontSize: 12, padding: '8px 10px', borderRadius: 7,
                border: '1px solid rgba(220,38,38,0.25)', background: 'var(--surface)',
                color: 'var(--text-primary)', resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={handleRejectSubmit} disabled={processing}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7, border: 'none',
                  background: '#dc2626', color: '#fff', cursor: processing ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
                {processing ? 'Sending…' : 'Send & Return to assignee'}
              </button>
              <button onClick={() => { setRejectOpen(false); setComment('') }}
                style={{ fontSize: 12, padding: '7px 12px', borderRadius: 7,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Action row ── */}
        {!rejectOpen && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setRejectOpen(true)} disabled={processing}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                cursor: processing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
              <X style={{ width: 13, height: 13 }}/> Return to assignee
            </button>
            <button onClick={onApprove} disabled={processing}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 20px', borderRadius: 8,
                border: 'none', background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: processing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
              <CheckCheck style={{ width: 14, height: 14 }}/> {processing ? 'Processing…' : 'Approve'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ label, tasks, color, icon, accentColor, onApprove, onReject, processing }: {
  label: string; tasks: Task[]; color: string; icon: React.ReactNode; accentColor: string
  onApprove: (id: string) => void
  onReject:  (id: string, comment: string) => void
  processing: Set<string>
}) {
  const [open, setOpen] = useState(true)
  if (tasks.length === 0) return null
  return (
    <div style={{ marginBottom: 28 }}>
      <SectionHeader label={label} count={tasks.length} color={color} icon={icon} open={open} onToggle={() => setOpen(o => !o)}/>
      {open && tasks.map(t => (
        <TaskCard
          key={t.id}
          task={t}
          accentColor={accentColor}
          processing={processing.has(t.id)}
          onApprove={() => onApprove(t.id)}
          onReject={(comment) => onReject(t.id, comment)}
        />
      ))}
    </div>
  )
}

// ── History row ───────────────────────────────────────────────────────────────
function HistoryRow({ task }: { task: Task }) {
  const approved = task.approval_status === 'approved'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 90px',
      alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
        {task.client && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: 1, background: task.client.color, display: 'inline-block' }}/>
            {task.client.name}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.assignee ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Avatar name={task.assignee.name} size="xs"/>{task.assignee.name}</span> : '—'}
      </div>
      <div>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
          background: approved ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
          color: approved ? '#16a34a' : '#dc2626' }}>
          {approved ? '✓ Approved' : '✕ Returned'}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {task.completed_at
          ? new Date(task.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
          : '—'}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function ApprovalsView({ pending: initialPending, history, currentUserId, userRole }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [pending,    setPending]    = useState<Task[]>(initialPending)
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [historyOpen, setHistoryOpen] = useState(false)

  // Section buckets
  const recurring    = pending.filter(isRecurring)
  const compliance   = pending.filter(t => !isRecurring(t) && isCaTask(t))
  const projectTasks = pending.filter(isProjectTask)
  const oneTime      = pending.filter(isOneTime)

  // Stats
  const todayStr   = new Date().toISOString().split('T')[0]
  const approvedToday = history.filter(t =>
    t.approval_status === 'approved' && t.completed_at?.startsWith(todayStr)
  ).length

  async function decide(taskId: string, decision: 'approve' | 'reject', comment?: string) {
    setProcessing(p => new Set(p).add(taskId))
    const res = await fetch(`/api/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comment: comment ?? null }),
    })
    setProcessing(p => { const s = new Set(p); s.delete(taskId); return s })
    if (res.ok) {
      setPending(p => p.filter(t => t.id !== taskId))
      toast.success(decision === 'approve' ? '✓ Task approved' : 'Returned to assignee')
      startT(() => router.refresh())
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Action failed')
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-subtle)' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            Approvals
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {pending.length === 0
              ? 'All caught up — no tasks waiting for your approval'
              : `${pending.length} task${pending.length !== 1 ? 's' : ''} waiting for your review`}
          </p>
        </div>

        {/* ── Stats bar ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          <StatTile label="Pending review" value={pending.length} color="#7c3aed"
            icon={<Clock style={{ width: 18, height: 18 }}/>}/>
          <StatTile label="Recurring" value={recurring.length} color="#0d9488"
            icon={<RefreshCw style={{ width: 18, height: 18 }}/>}/>
          <StatTile label="One-time" value={oneTime.length} color="#0891b2"
            icon={<ListTodo style={{ width: 18, height: 18 }}/>}/>
          <StatTile label="Approved today" value={approvedToday} color="#16a34a"
            icon={<CheckCheck style={{ width: 18, height: 18 }}/>}/>
        </div>

        {/* ── Empty state ── */}
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

        {/* ── Recurring section ── */}
        <Section
          label="Recurring tasks" tasks={recurring} color="#0d9488" accentColor="#0d9488"
          icon={<RefreshCw style={{ width: 14, height: 14 }}/>}
          onApprove={id => decide(id, 'approve')}
          onReject={(id, comment) => decide(id, 'reject', comment)}
          processing={processing}
        />

        {/* ── CA Compliance section ── */}
        <Section
          label="CA Compliance tasks" tasks={compliance} color="#d97706" accentColor="#d97706"
          icon={<FileCheck style={{ width: 14, height: 14 }}/>}
          onApprove={id => decide(id, 'approve')}
          onReject={(id, comment) => decide(id, 'reject', comment)}
          processing={processing}
        />

        {/* ── Project-based section ── */}
        <Section
          label="Project tasks" tasks={projectTasks} color="#7c3aed" accentColor="#7c3aed"
          icon={<FolderOpen style={{ width: 14, height: 14 }}/>}
          onApprove={id => decide(id, 'approve')}
          onReject={(id, comment) => decide(id, 'reject', comment)}
          processing={processing}
        />

        {/* ── One-time section ── */}
        <Section
          label="One-time tasks" tasks={oneTime} color="#0891b2" accentColor="#0891b2"
          icon={<ListTodo style={{ width: 14, height: 14 }}/>}
          onApprove={id => decide(id, 'approve')}
          onReject={(id, comment) => decide(id, 'reject', comment)}
          processing={processing}
        />

        {/* ── History ── */}
        {history.length > 0 && (
          <div>
            <button onClick={() => setHistoryOpen(h => !h)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                fontWeight: 600, color: 'var(--text-muted)', background: 'none',
                border: 'none', cursor: 'pointer', padding: '0 0 12px', fontFamily: 'inherit' }}>
              <ChevronDown style={{ width: 14, height: 14,
                transform: historyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}/>
              Recent decisions (last 7 days) · {history.length}
            </button>
            {historyOpen && (
              <div style={{ background: 'var(--surface)', borderRadius: 12,
                border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 90px',
                  padding: '8px 16px', background: 'var(--surface-subtle)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div>Task</div><div>Assignee</div><div>Decision</div><div>Date</div>
                </div>
                {history.map(t => <HistoryRow key={t.id} task={t}/>)}
              </div>
            )}
          </div>
        )}

      </div>
      </div>
    </div>
  )
}
