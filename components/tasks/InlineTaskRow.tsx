'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, User, Flag, Calendar, Shield } from 'lucide-react'
import { toast } from '@/store/appStore'

interface Member { id: string; name: string; role?: string }
interface Client { id: string; name: string; color: string }

interface Props {
  projectId?:       string
  projectOwnerId?:  string
  defaultClientId?: string
  members:          Member[]
  clients:          Client[]
  currentUserId?:   string
  defaultStatus?:   string
  onCreated?:       (task?: Record<string, unknown>) => void  // passes new task for optimistic add
}

const PRIORITY_OPTIONS = [
  { value: 'none',   label: 'No priority', color: '#94a3b8' },
  { value: 'low',    label: 'Low',         color: '#16a34a' },
  { value: 'medium', label: 'Medium',      color: '#ca8a04' },
  { value: 'high',   label: 'High',        color: '#ea580c' },
  { value: 'urgent', label: 'Urgent',      color: '#dc2626' },
]

export function InlineTaskRow({
  projectId, projectOwnerId, defaultClientId,
  members, clients, currentUserId, defaultStatus = 'todo', onCreated,
}: Props) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef   = useRef<HTMLDivElement>(null)

  const [open,     setOpen]     = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [title,    setTitle]    = useState('')
  const [assignee, setAssignee] = useState(currentUserId ?? '')
  const [priority, setPriority] = useState('medium')
  const [dueDate,  setDueDate]  = useState('')
  const [approverId, setApproverId] = useState(projectOwnerId ?? '')

  const priConf = PRIORITY_OPTIONS.find(p => p.value === priority) ?? PRIORITY_OPTIONS[2]
  const approvers = members.filter(m => m.role && ['owner','admin','manager'].includes(m.role))

  function reset() {
    setOpen(false); setTitle(''); setAssignee(currentUserId ?? '')
    setPriority('medium'); setDueDate(''); setApproverId(projectOwnerId ?? '')
  }

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
      if (!title.trim()) reset()
    }
  }, [title])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  function openRow() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function save() {
    if (!title.trim()) { inputRef.current?.focus(); return }
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), status: defaultStatus,
          assignee_id:       assignee     || null,
          priority,
          due_date:          dueDate      || null,
          client_id:         defaultClientId || null,
          project_id:        projectId    || null,
          approver_id:       approverId   || null,
          approval_required: !!approverId,
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
      reset()
      // Pass the created task back so parent can add it optimistically
      onCreated ? onCreated(d.data ?? d) : router.refresh()
    } finally { setSaving(false) }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') reset()
  }

  /* ── Collapsed trigger ─────────────────────────────────────── */
  if (!open) {
    return (
      <div
        onClick={openRow}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', cursor: 'pointer',
          borderTop: '1px dashed var(--border)',
          color: 'var(--text-muted)', transition: 'all 0.15s',
          userSelect: 'none',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.color = 'var(--brand)'
          el.style.background = 'var(--brand-light)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.color = 'var(--text-muted)'
          el.style.background = 'transparent'
        }}
      >
        <Plus style={{ width: 13, height: 13, flexShrink: 0 }} />
        <span style={{ fontSize: 13 }}>Add task</span>
      </div>
    )
  }

  /* ── Expanded form ─────────────────────────────────────────── */
  return (
    <div
      ref={rowRef}
      style={{
        margin: '4px 10px 8px',
        borderRadius: 10,
        border: '1.5px solid var(--brand-border)',
        background: 'var(--surface)',
        boxShadow: '0 2px 12px rgba(13,148,136,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 8px' }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
          border: '2px solid var(--brand)', opacity: 0.5,
        }} />
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Task name…"
          style={{
            flex: 1, fontSize: 13, fontWeight: 500,
            border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={reset}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4,
          }}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-light)', margin: '0 12px' }} />

      {/* Options row — pill chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px 10px', flexWrap: 'wrap' }}>

        {/* Assignee pill */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20,
          border: '1px solid var(--border)', background: 'var(--surface-subtle)',
          cursor: 'pointer',
        }}>
          <User style={{ width: 11, height: 11, color: 'var(--text-muted)', flexShrink: 0 }} />
          <select
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            style={{
              fontSize: 12, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', appearance: 'none',
            }}
          >
            <option value="">Unassigned</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>
            ))}
          </select>
        </label>

        {/* Priority pill */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20,
          border: `1px solid ${priConf.color}44`,
          background: `${priConf.color}14`,
          cursor: 'pointer',
        }}>
          <Flag style={{ width: 11, height: 11, color: priConf.color, flexShrink: 0 }} />
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            style={{
              fontSize: 12, border: 'none', outline: 'none',
              background: 'transparent', color: priConf.color,
              cursor: 'pointer', appearance: 'none', fontWeight: 500,
            }}
          >
            {PRIORITY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {/* Due date pill */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20,
          border: '1px solid var(--border)', background: 'var(--surface-subtle)',
          cursor: 'pointer',
        }}>
          <Calendar style={{ width: 11, height: 11, color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{
              fontSize: 12, border: 'none', outline: 'none',
              background: 'transparent',
              color: dueDate ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', colorScheme: 'light',
              width: dueDate ? 'auto' : 76,
            }}
          />
        </label>

        {/* Approver pill */}
        {approvers.length > 0 && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20,
            border: approverId ? '1px solid #7c3aed44' : '1px solid var(--border)',
            background: approverId ? '#7c3aed12' : 'var(--surface-subtle)',
            cursor: 'pointer',
          }}>
            <Shield style={{ width: 11, height: 11, color: approverId ? '#7c3aed' : 'var(--text-muted)', flexShrink: 0 }} />
            <select
              value={approverId}
              onChange={e => setApproverId(e.target.value)}
              style={{
                fontSize: 12, border: 'none', outline: 'none',
                background: 'transparent',
                color: approverId ? '#7c3aed' : 'var(--text-secondary)',
                cursor: 'pointer', appearance: 'none',
                fontWeight: approverId ? 500 : 400,
              }}
            >
              <option value="">Set approver</option>
              {approvers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}

        {/* Save button */}
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          style={{
            marginLeft: 'auto',
            padding: '4px 14px', borderRadius: 20, border: 'none',
            background: title.trim() ? 'var(--brand)' : 'var(--border)',
            color: title.trim() ? '#fff' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 600,
            cursor: title.trim() ? 'pointer' : 'default',
            transition: 'all 0.15s', flexShrink: 0,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Add task'}
        </button>
      </div>
    </div>
  )
}
