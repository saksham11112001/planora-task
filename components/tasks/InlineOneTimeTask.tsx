'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, User, Flag, Calendar, Shield, Briefcase } from 'lucide-react'
import { toast } from '@/store/appStore'

interface Member { id: string; name: string; role?: string }

interface Props {
  members:        Member[]
  clients:        { id: string; name: string; color: string }[]
  currentUserId?: string
  onCreated?:     () => void
}

const PRIORITY_OPTIONS = [
  { value: 'none',   label: 'No priority', color: '#94a3b8' },
  { value: 'low',    label: 'Low',         color: '#16a34a' },
  { value: 'medium', label: 'Medium',      color: '#ca8a04' },
  { value: 'high',   label: 'High',        color: '#ea580c' },
  { value: 'urgent', label: 'Urgent',      color: '#dc2626' },
]

export function InlineOneTimeTask({ members, clients, currentUserId, onCreated }: Props) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef   = useRef<HTMLDivElement>(null)

  const [open,       setOpen]       = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [title,      setTitle]      = useState('')
  const [assignee,   setAssignee]   = useState(currentUserId ?? '')
  const [priority,   setPriority]   = useState('medium')
  const [dueDate,    setDueDate]    = useState('')
  const [clientId,   setClientId]   = useState('')
  const [approverId, setApproverId] = useState('')

  const approvers = members.filter(m => m.role && ['owner','admin','manager'].includes(m.role))
  const priConf = PRIORITY_OPTIONS.find(p => p.value === priority) ?? PRIORITY_OPTIONS[2]

  function reset() {
    setOpen(false); setTitle(''); setAssignee(currentUserId ?? '')
    setPriority('medium'); setDueDate(''); setClientId(''); setApproverId('')
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
          title: title.trim(),
          assignee_id:       assignee     || null,
          priority,
          due_date:          dueDate      || null,
          client_id:         clientId     || null,
          approver_id:       approverId   || null,
          approval_required: !!approverId,
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
      toast.success('Task created')
      reset()
      onCreated ? onCreated() : router.refresh()
    } finally { setSaving(false) }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') reset()
  }

  /* ── Collapsed trigger ── */
  if (!open) {
    return (
      <div
        onClick={openRow}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 20px',
          cursor: 'pointer',
          borderTop: '1px dashed var(--border)',
          color: 'var(--text-muted)',
          transition: 'all 0.15s',
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
        <Plus style={{ width: 14, height: 14, flexShrink: 0 }} />
        <span style={{ fontSize: 13 }}>Add task</span>
      </div>
    )
  }

  /* ── Expanded form ── */
  return (
    <div
      ref={rowRef}
      style={{
        margin: '6px 12px 10px',
        borderRadius: 10,
        border: '1.5px solid var(--brand-border)',
        background: 'var(--surface)',
        boxShadow: '0 2px 12px rgba(13,148,136,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 8px' }}>
        {/* Circle placeholder for task check */}
        <div style={{
          width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
          border: '2px solid var(--brand)', opacity: 0.5,
        }} />
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Task name…"
          style={{
            flex: 1, fontSize: 14, fontWeight: 500,
            border: 'none', outline: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
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
      <div style={{ height: 1, background: 'var(--border-light)', margin: '0 14px' }} />

      {/* Options row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px 10px', flexWrap: 'wrap' }}>

        {/* Assignee */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 20,
          border: '1px solid var(--border)',
          background: 'var(--surface-subtle)',
          cursor: 'pointer', position: 'relative',
        }}>
          <User style={{ width: 11, height: 11, color: 'var(--text-muted)', flexShrink: 0 }} />
          <select
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            style={{
              fontSize: 12, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', appearance: 'none', paddingRight: 2,
            }}
          >
            <option value="">Unassigned</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>
            ))}
          </select>
        </label>

        {/* Priority */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 20,
          border: `1px solid ${priConf.color}44`,
          background: `${priConf.color}18`,
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

        {/* Due date */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 20,
          border: '1px solid var(--border)',
          background: 'var(--surface-subtle)',
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
              cursor: 'pointer', colorScheme: 'light dark',
              width: dueDate ? 'auto' : 80,
            }}
            placeholder="Due date"
          />
        </label>

        {/* Client */}
        {clients.length > 0 && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
            border: clientId ? `1px solid ${clients.find(c=>c.id===clientId)?.color ?? 'var(--border)'}44` : '1px solid var(--border)',
            background: clientId ? `${clients.find(c=>c.id===clientId)?.color ?? '#0d9488'}12` : 'var(--surface-subtle)',
            cursor: 'pointer',
          }}>
            {clientId
              ? <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: clients.find(c=>c.id===clientId)?.color ?? '#0d9488', display: 'inline-block' }}/>
              : <Briefcase style={{ width: 11, height: 11, color: 'var(--text-muted)', flexShrink: 0 }} />
            }
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              style={{
                fontSize: 12, border: 'none', outline: 'none',
                background: 'transparent',
                color: clientId ? (clients.find(c=>c.id===clientId)?.color ?? 'var(--text-secondary)') : 'var(--text-secondary)',
                cursor: 'pointer', appearance: 'none',
                fontWeight: clientId ? 500 : 400,
              }}
            >
              <option value="">No client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        {/* Approver */}
        {approvers.length > 0 && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
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
                cursor: 'pointer', appearance: 'none', fontWeight: approverId ? 500 : 400,
              }}
            >
              <option value="">No approver</option>
              {approvers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}

        {/* Save button — pushed right */}
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          style={{
            marginLeft: 'auto',
            padding: '5px 16px', borderRadius: 20, border: 'none',
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
