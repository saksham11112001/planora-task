'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { toast } from '@/store/appStore'

interface Member { id: string; name: string; role?: string }

interface Props {
  members:        Member[]
  clients:        { id: string; name: string; color: string }[]
  currentUserId?: string
  onCreated?:     () => void
}

const PRIORITY_COLORS: Record<string, string> = {
  none: '#94a3b8', low: '#16a34a', medium: '#ca8a04', high: '#ea580c', urgent: '#dc2626'
}

export function InlineOneTimeTask({ members, clients, currentUserId, onCreated }: Props) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef   = useRef<HTMLDivElement>(null)

  const [open,      setOpen]      = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [title,     setTitle]     = useState('')
  const [assignee,  setAssignee]  = useState(currentUserId ?? '')
  const [priority,  setPriority]  = useState('medium')
  const [dueDate,   setDueDate]   = useState('')
  const [clientId,  setClientId]  = useState('')
  const [approverId,setApproverId]= useState('')

  const approvers = members.filter(m => m.role && ['owner','admin','manager'].includes(m.role))

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
          assignee_id:      assignee     || null,
          priority,
          due_date:         dueDate      || null,
          client_id:        clientId     || null,
          approver_id:      approverId   || null,
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

  if (!open) {
    return (
      <div onClick={openRow} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
        cursor: 'pointer', borderTop: '1px dashed var(--border)',
        color: 'var(--text-muted)', transition: 'all 0.1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--brand)'; (e.currentTarget as HTMLElement).style.background = 'var(--brand-light)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
        <Plus style={{ width: 14, height: 14, flexShrink: 0 }}/>
        <span style={{ fontSize: 13 }}>Add task</span>
      </div>
    )
  }

  return (
    <div ref={rowRef} style={{
      borderTop: '2px solid var(--brand)', background: 'var(--brand-light)',
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px' }}>
        <div style={{
          width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
          border: '2px solid var(--brand)', opacity: 0.6,
        }}/>
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Task name…"
          style={{
            flex: 1, fontSize: 14, fontWeight: 500, border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-primary)',
          }}
        />
        <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <X style={{ width: 14, height: 14 }}/>
        </button>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px 12px', flexWrap: 'wrap' }}>

        <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{
          fontSize: 12, padding: '4px 8px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
          <option value="">Unassigned</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>)}
        </select>

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

        <input
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

        {clients.length > 0 && (
          <select value={clientId} onChange={e => setClientId(e.target.value)} style={{
            fontSize: 12, padding: '4px 8px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {approvers.length > 0 && (
          <select value={approverId} onChange={e => setApproverId(e.target.value)} style={{
            fontSize: 12, padding: '4px 8px', borderRadius: 6,
            border: approverId ? '1px solid #7c3aed44' : '1px solid var(--border)',
            background: approverId ? '#7c3aed18' : 'var(--surface)',
            color: approverId ? '#7c3aed' : 'var(--text-secondary)', cursor: 'pointer',
          }}>
            <option value="">No approver</option>
            {approvers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}

        <button onClick={save} disabled={saving || !title.trim()} style={{
          marginLeft: 'auto', padding: '5px 16px', borderRadius: 6, border: 'none',
          background: title.trim() ? 'var(--brand)' : 'var(--border)',
          color: title.trim() ? '#fff' : 'var(--text-muted)',
          fontSize: 12, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'default',
          transition: 'all 0.15s', flexShrink: 0,
        }}>
          {saving ? 'Saving…' : 'Add task'}
        </button>
      </div>
    </div>
  )
}
