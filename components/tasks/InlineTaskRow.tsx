'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
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
  onCreated?:       () => void
}

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
  const dateRef = useRef<HTMLInputElement>(null)

  function reset() {
    setOpen(false); setTitle(''); setAssignee(currentUserId ?? '')
    setPriority('medium'); setDueDate('')
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
          assignee_id:      assignee    || null,
          priority,
          due_date:         dueDate     || null,
          client_id:        defaultClientId || null,
          project_id:       projectId   || null,
          approver_id:      projectOwnerId || null,
          approval_required: !!projectOwnerId,
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
      reset()
      onCreated ? onCreated() : router.refresh()
    } finally { setSaving(false) }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') reset()
  }

  const PRIORITY_COLORS: Record<string, string> = {
    none: '#94a3b8', low: '#16a34a', medium: '#ca8a04', high: '#ea580c', urgent: '#dc2626'
  }

  if (!open) {
    return (
      <div onClick={openRow} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px',
        cursor: 'pointer', borderTop: '1px dashed var(--border)',
        color: 'var(--text-muted)', transition: 'all 0.1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--brand)'; (e.currentTarget as HTMLElement).style.background = 'var(--brand-light)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
        <Plus style={{ width: 13, height: 13, flexShrink: 0 }}/>
        <span style={{ fontSize: 13 }}>Add task</span>
      </div>
    )
  }

  return (
    <div ref={rowRef} style={{
      borderTop: '2px solid var(--brand)', background: 'var(--brand-light)',
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
          border: '2px solid var(--brand)', opacity: 0.6,
        }}/>
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Task name…"
          style={{
            flex: 1, fontSize: 13, fontWeight: 500, border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-primary)',
          }}
        />
        <button onClick={reset} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: 'var(--text-muted)', flexShrink: 0, display: 'flex',
        }}>
          <X style={{ width: 13, height: 13 }}/>
        </button>
      </div>

      {/* Options row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 10px', flexWrap: 'wrap' }}>

        {/* Assignee */}
        <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{
          fontSize: 12, padding: '4px 8px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text-secondary)', cursor: 'pointer', maxWidth: 130,
        }}>
          <option value="">Unassigned</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>)}
        </select>

        {/* Priority */}
        <select value={priority} onChange={e => setPriority(e.target.value)} style={{
          fontSize: 12, padding: '4px 8px', borderRadius: 6,
          border: `1px solid ${PRIORITY_COLORS[priority]}44`,
          background: PRIORITY_COLORS[priority] + '18',
          color: PRIORITY_COLORS[priority], cursor: 'pointer',
        }}>
          {[['none','No priority'],['low','Low'],['medium','Medium'],['high','High'],['urgent','Urgent']].map(([v,l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Due date */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <input
            ref={dateRef}
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{
              fontSize: 12, padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: dueDate ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', colorScheme: 'light dark',
            }}
          />
        </div>

        {/* Save */}
        <button onClick={save} disabled={saving || !title.trim()} style={{
          marginLeft: 'auto', padding: '4px 14px', borderRadius: 6, border: 'none',
          background: title.trim() ? 'var(--brand)' : 'var(--border)',
          color: title.trim() ? '#fff' : 'var(--text-muted)',
          fontSize: 12, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'default',
          transition: 'all 0.15s',
        }}>
          {saving ? 'Saving…' : 'Add task'}
        </button>
      </div>
    </div>
  )
}
