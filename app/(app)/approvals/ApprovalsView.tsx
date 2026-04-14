'use client'
import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate, isOverdue } from '@/lib/utils/format'
import { Avatar } from '@/components/ui/Badge'
import { toast } from '@/store/appStore'
import {
  CheckCheck, X, Clock, RefreshCw, FolderOpen, ChevronDown, ChevronRight,
  Paperclip, FileCheck, ListTodo, ExternalLink, AlertTriangle,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const isCaTask      = (t: Task) => t.custom_fields?._ca_compliance === true
const isRecurring   = (t: Task) => t.is_recurring
const isProjectTask = (t: Task) => !!t.project_id && !t.is_recurring && !isCaTask(t)
const isOneTime     = (t: Task) => !t.is_recurring && !isCaTask(t) && !t.project_id

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a',
}

// Column grid — shared across header and every row
const GRID = '22px 1fr 88px 106px 104px 104px 48px 174px'

// ─────────────────────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────────────────────
function StatTile({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 120 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Column header row (rendered once per section, inside the table)
// ─────────────────────────────────────────────────────────────────────────────
function ColHeader() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: GRID, alignItems: 'center',
      padding: '7px 14px', gap: 8,
      background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)',
      fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      <div/>
      <div>Task</div>
      <div>Due date</div>
      <div>Client</div>
      <div>Assigned to</div>
      <div>Assigned by</div>
      <div style={{ textAlign: 'center' }}>Att.</div>
      <div style={{ textAlign: 'right' }}>Actions</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subtask panel (expanded below a row)
// ─────────────────────────────────────────────────────────────────────────────
function SubtaskPanel({ subtasks, loading }: { subtasks: any[] | null; loading: boolean }) {
  return (
    <div style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.02)',
      borderBottom: '1px solid var(--border-light)', padding: '6px 14px 6px 44px' }}>
      {loading && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0' }}>Loading subtasks…</p>}
      {!loading && subtasks !== null && subtasks.length === 0 &&
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0' }}>No subtasks</p>}
      {!loading && subtasks !== null && subtasks.map((sub, i) => (
        <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 0', borderBottom: i < subtasks.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
          {/* Status circle */}
          <div style={{ width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${sub.status === 'completed' ? 'var(--brand)' : 'var(--border)'}`,
            background: sub.status === 'completed' ? 'var(--brand)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {sub.status === 'completed' && (
              <svg viewBox="0 0 10 10" fill="none" style={{ width: 7, height: 7 }}>
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            )}
          </div>
          <span style={{ flex: 1, fontSize: 12,
            color: sub.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
            textDecoration: sub.status === 'completed' ? 'line-through' : 'none' }}>
            {sub.title}
          </span>
          {sub.due_date && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{sub.due_date}</span>
          )}
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, fontWeight: 500, flexShrink: 0,
            background: sub.status === 'completed' ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.1)',
            color: sub.status === 'completed' ? '#16a34a' : 'var(--text-muted)' }}>
            {sub.status.replace('_', ' ')}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Attachment panel (expanded below a row)
// ─────────────────────────────────────────────────────────────────────────────
function AttachPanel({ attachments, loading }: { attachments: any[] | null; loading: boolean }) {
  return (
    <div style={{ gridColumn: '1 / -1', background: 'rgba(0,0,0,0.02)',
      borderBottom: '1px solid var(--border-light)', padding: '6px 14px 6px 44px' }}>
      {loading && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0' }}>Loading attachments…</p>}
      {!loading && attachments !== null && attachments.length === 0 &&
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0' }}>No attachments uploaded</p>}
      {!loading && attachments !== null && attachments.map((att, i) => {
        const isNil  = att.drive_url === 'nil'
        const isLink = !isNil && (att.attachment_type === 'link' || att.drive_url)
        return (
          <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 0', borderBottom: i < attachments.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
            <Paperclip style={{ width: 12, height: 12, color: isNil ? '#d97706' : 'var(--text-muted)', flexShrink: 0 }}/>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isNil ? 'Not available (N/A)' : att.file_name}
            </span>
            {isNil && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706',
                background: 'rgba(217,119,6,0.1)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>N/A</span>
            )}
            {isLink && !isNil && (
              <a href={att.drive_url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11,
                  color: 'var(--brand)', textDecoration: 'none', flexShrink: 0 }}>
                <ExternalLink style={{ width: 10, height: 10 }}/> View
              </a>
            )}
            {!isLink && !isNil && att.file_size && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                {(att.file_size / 1024).toFixed(0)} KB
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reject comment panel (expanded below a row)
// ─────────────────────────────────────────────────────────────────────────────
function RejectPanel({ processing, onSend, onCancel }: {
  processing: boolean
  onSend: (comment: string) => void
  onCancel: () => void
}) {
  const [comment, setComment] = useState('')
  return (
    <div style={{ gridColumn: '1 / -1',
      background: 'rgba(220,38,38,0.03)', borderBottom: '1px solid rgba(220,38,38,0.15)',
      padding: '10px 14px 12px 44px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', margin: '0 0 6px',
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Reason for returning (optional)
      </p>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Let the assignee know what needs to be corrected…"
        rows={2}
        style={{ width: '100%', maxWidth: 560, fontSize: 12, padding: '7px 10px', borderRadius: 7,
          border: '1px solid rgba(220,38,38,0.25)', background: 'var(--surface)',
          color: 'var(--text-primary)', resize: 'vertical', outline: 'none',
          fontFamily: 'inherit', boxSizing: 'border-box', display: 'block' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => onSend(comment)} disabled={processing}
          style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7, border: 'none',
            background: '#dc2626', color: '#fff', cursor: processing ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
          {processing ? 'Sending…' : 'Send & Return to assignee'}
        </button>
        <button onClick={onCancel}
          style={{ fontSize: 12, padding: '6px 12px', borderRadius: 7,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single task row  (inline columns + expandable panels below)
// ─────────────────────────────────────────────────────────────────────────────
function TaskRow({ task, accentColor, processing, onApprove, onReject }: {
  task: Task; accentColor: string; processing: boolean
  onApprove: () => void
  onReject: (comment: string) => void
}) {
  const [subtasksOpen,   setSubtasksOpen]   = useState(false)
  const [subtasks,       setSubtasks]       = useState<any[] | null>(null)
  const [subtaskLoading, setSubtaskLoading] = useState(false)

  const [attachOpen,    setAttachOpen]    = useState(false)
  const [attachments,   setAttachments]   = useState<any[] | null>(null)
  const [attachLoading, setAttachLoading] = useState(false)

  const [rejectOpen, setRejectOpen] = useState(false)

  const ov = isOverdue(task.due_date, task.status)

  async function toggleSubtasks() {
    const next = !subtasksOpen
    setSubtasksOpen(next)
    setAttachOpen(false)
    setRejectOpen(false)
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
    setSubtasksOpen(false)
    setRejectOpen(false)
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

  function openReject() {
    setRejectOpen(true)
    setSubtasksOpen(false)
    setAttachOpen(false)
  }

  const anyExpanded = subtasksOpen || attachOpen || rejectOpen

  return (
    <>
      {/* ── Main data row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: GRID, alignItems: 'center',
        padding: '0 14px', gap: 8, minHeight: 44,
        borderBottom: anyExpanded ? 'none' : '1px solid var(--border-light)',
        borderLeft: `3px solid ${accentColor}`,
        background: 'var(--surface)',
        transition: 'background 0.1s',
      }}
        onMouseEnter={e => { if (!(e.currentTarget as HTMLElement).closest('[data-expanded]')) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover, var(--surface-subtle))' }}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
      >
        {/* 1 — Expand toggle */}
        <button onClick={toggleSubtasks}
          title="Toggle subtasks"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {subtasksOpen
            ? <ChevronDown style={{ width: 13, height: 13 }}/>
            : <ChevronRight style={{ width: 13, height: 13 }}/>}
        </button>

        {/* 2 — Task name + priority */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, padding: '10px 0' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: PRIORITY_COLOR[task.priority] ?? '#94a3b8' }}/>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </span>
          {task.project && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
              background: `${task.project.color}22`, color: task.project.color,
              border: `1px solid ${task.project.color}44`,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>
              {task.project.name}
            </span>
          )}
        </div>

        {/* 3 — Due date */}
        <div style={{ fontSize: 12, color: ov ? '#dc2626' : 'var(--text-muted)',
          fontWeight: ov ? 600 : 400, display: 'flex', alignItems: 'center', gap: 3 }}>
          {ov && <AlertTriangle style={{ width: 10, height: 10, flexShrink: 0 }}/>}
          {task.due_date ? fmtDate(task.due_date) : <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>}
        </div>

        {/* 4 — Client */}
        <div style={{ fontSize: 12, color: 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.client
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: task.client.color,
                  display: 'inline-block', flexShrink: 0 }}/>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.client.name}
                </span>
              </span>
            : <span style={{ opacity: 0.35 }}>—</span>}
        </div>

        {/* 5 — Assigned to */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          {task.assignee
            ? <><Avatar name={task.assignee.name} size="xs"/>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.assignee.name}
                </span></>
            : <span style={{ fontSize: 12, opacity: 0.35, color: 'var(--text-muted)' }}>—</span>}
        </div>

        {/* 6 — Assigned by */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          {task.creator
            ? <><Avatar name={task.creator.name} size="xs"/>
                <span style={{ fontSize: 12, color: 'var(--text-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.creator.name}
                </span></>
            : <span style={{ fontSize: 12, opacity: 0.35, color: 'var(--text-muted)' }}>—</span>}
        </div>

        {/* 7 — Attachments */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={toggleAttachments}
            title="View attachments"
            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none',
              cursor: 'pointer', padding: '3px 5px', borderRadius: 5,
              color: attachOpen ? 'var(--brand)' : 'var(--text-muted)',
              background: attachOpen ? 'rgba(13,148,136,0.08)' : 'transparent' } as any}>
            <Paperclip style={{ width: 13, height: 13 }}/>
            {attachments !== null && (
              <span style={{ fontSize: 10, fontWeight: 700 }}>{attachments.length}</span>
            )}
          </button>
        </div>

        {/* 8 — Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <button onClick={openReject} disabled={processing}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6,
              border: `1px solid ${rejectOpen ? 'rgba(220,38,38,0.4)' : 'var(--border)'}`,
              background: rejectOpen ? 'rgba(220,38,38,0.06)' : 'var(--surface)',
              color: rejectOpen ? '#dc2626' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: processing ? 0.5 : 1, flexShrink: 0 }}>
            <X style={{ width: 11, height: 11 }}/> Return
          </button>
          <button onClick={onApprove} disabled={processing}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6,
              border: 'none', background: '#0d9488', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: processing ? 0.5 : 1, flexShrink: 0 }}>
            <CheckCheck style={{ width: 12, height: 12 }}/> {processing ? '…' : 'Approve'}
          </button>
        </div>
      </div>

      {/* ── Expanded panels (full width, below the row) ── */}
      {subtasksOpen && (
        <SubtaskPanel subtasks={subtasks} loading={subtaskLoading}/>
      )}
      {attachOpen && (
        <AttachPanel attachments={attachments} loading={attachLoading}/>
      )}
      {rejectOpen && (
        <RejectPanel
          processing={processing}
          onSend={(comment) => { onReject(comment); setRejectOpen(false) }}
          onCancel={() => setRejectOpen(false)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section block (header + column header + rows, all in one bordered container)
// ─────────────────────────────────────────────────────────────────────────────
function Section({ label, tasks, color, accentColor, icon, onApprove, onReject, processing }: {
  label: string; tasks: Task[]; color: string; accentColor: string; icon: React.ReactNode
  onApprove: (id: string) => void
  onReject:  (id: string, comment: string) => void
  processing: Set<string>
}) {
  const [open, setOpen] = useState(true)
  if (tasks.length === 0) return null

  return (
    <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden',
      border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

      {/* Section header bar */}
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 14px', background: `${color}0d`, border: 'none',
          borderBottom: open ? `1px solid ${color}30` : 'none',
          cursor: 'pointer', fontFamily: 'inherit' }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: `${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>
          {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
          background: `${color}18`, color }}>
          {tasks.length}
        </span>
        {open
          ? <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }}/>
          : <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }}/>}
      </button>

      {/* Column headers + rows */}
      {open && (
        <div>
          <ColHeader/>
          {tasks.map(t => (
            <TaskRow
              key={t.id}
              task={t}
              accentColor={accentColor}
              processing={processing.has(t.id)}
              onApprove={() => onApprove(t.id)}
              onReject={(comment) => onReject(t.id, comment)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// History table
// ─────────────────────────────────────────────────────────────────────────────
function HistoryTable({ history }: { history: Task[] }) {
  const [open, setOpen] = useState(false)
  if (history.length === 0) return null

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '10px 14px', background: 'var(--surface-subtle)', border: 'none',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          cursor: 'pointer', fontFamily: 'inherit' }}>
        <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-muted)',
          transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }}/>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', flex: 1, textAlign: 'left' }}>
          Recent decisions (last 7 days)
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{history.length}</span>
      </button>

      {open && (
        <div style={{ background: 'var(--surface)' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 90px',
            padding: '7px 14px', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)',
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <div>Task</div><div>Assignee</div><div>Decision</div><div>Date</div>
          </div>
          {history.map(t => {
            const approved = t.approval_status === 'approved'
            return (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 90px',
                alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  {t.client && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 1,
                        background: t.client.color, display: 'inline-block' }}/>
                      {t.client.name}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  {t.assignee && <><Avatar name={t.assignee.name} size="xs"/>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.assignee.name}
                    </span></>}
                </div>
                <div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                    background: approved ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                    color: approved ? '#16a34a' : '#dc2626' }}>
                    {approved ? '✓ Approved' : '✕ Returned'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {t.completed_at
                    ? new Date(t.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────────────
export function ApprovalsView({ pending: initialPending, history }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [pending,    setPending]    = useState<Task[]>(initialPending)
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  const recurring    = pending.filter(isRecurring)
  const compliance   = pending.filter(t => !isRecurring(t) && isCaTask(t))
  const projectTasks = pending.filter(isProjectTask)
  const oneTime      = pending.filter(isOneTime)

  const todayStr      = new Date().toISOString().split('T')[0]
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--surface-subtle)' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* Page header */}
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

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatTile label="Pending review"  value={pending.length}    color="#7c3aed" icon={<Clock      style={{ width: 17, height: 17 }}/>}/>
          <StatTile label="Recurring"       value={recurring.length}  color="#0d9488" icon={<RefreshCw  style={{ width: 17, height: 17 }}/>}/>
          <StatTile label="One-time"        value={oneTime.length}    color="#0891b2" icon={<ListTodo   style={{ width: 17, height: 17 }}/>}/>
          <StatTile label="Approved today"  value={approvedToday}     color="#16a34a" icon={<CheckCheck style={{ width: 17, height: 17 }}/>}/>
        </div>

        {/* Empty state */}
        {pending.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface)',
            borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Nothing to approve
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              You&apos;re all caught up. Tasks submitted by your team will appear here.
            </p>
          </div>
        )}

        {/* CA Compliance section */}
        <Section label="CA Compliance" tasks={compliance} color="#d97706" accentColor="#d97706"
          icon={<FileCheck style={{ width: 13, height: 13 }}/>}
          onApprove={id => decide(id, 'approve')}
          onReject={(id, c) => decide(id, 'reject', c)}
          processing={processing}/>

        {/* Recurring section */}
        <Section label="Recurring tasks" tasks={recurring} color="#0d9488" accentColor="#0d9488"
          icon={<RefreshCw style={{ width: 13, height: 13 }}/>}
          onApprove={id => decide(id, 'approve')}
          onReject={(id, c) => decide(id, 'reject', c)}
          processing={processing}/>

        {/* Project section */}
        <Section label="Project tasks" tasks={projectTasks} color="#7c3aed" accentColor="#7c3aed"
          icon={<FolderOpen style={{ width: 13, height: 13 }}/>}
          onApprove={id => decide(id, 'approve')}
          onReject={(id, c) => decide(id, 'reject', c)}
          processing={processing}/>

        {/* One-time section */}
        <Section label="One-time tasks" tasks={oneTime} color="#0891b2" accentColor="#0891b2"
          icon={<ListTodo style={{ width: 13, height: 13 }}/>}
          onApprove={id => decide(id, 'approve')}
          onReject={(id, c) => decide(id, 'reject', c)}
          processing={processing}/>

        {/* History */}
        <HistoryTable history={history}/>

      </div>
      </div>
    </div>
  )
}
