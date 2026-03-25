'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, RefreshCw } from 'lucide-react'
import { toast } from '@/store/appStore'

const FREQUENCIES = [
  { v: 'daily',     l: 'Daily' },
  { v: 'weekly',    l: 'Weekly' },
  { v: 'bi_weekly', l: 'Every 2 weeks' },
  { v: 'monthly',   l: 'Monthly' },
  { v: 'quarterly', l: 'Quarterly' },
  { v: 'annual',    l: 'Annual' },
]

const PRIORITY_COLORS: Record<string, string> = {
  none: '#94a3b8', low: '#16a34a', medium: '#ca8a04', high: '#ea580c', urgent: '#dc2626',
}

interface Props {
  members:        { id: string; name: string }[]
  projects:       { id: string; name: string; color: string }[]
  clients?:       { id: string; name: string; color: string }[]
  currentUserId?: string
  // Edit mode
  editTask?: {
    id: string; title: string; frequency: string; priority: string
    assignee_id: string | null; project_id: string | null; client_id?: string | null
  }
  onCreated?:  () => void
  onEdited?:   () => void
  onCancelEdit?: () => void
}

export function InlineRecurringTask({ members, projects, clients = [], currentUserId, editTask, onCreated, onEdited, onCancelEdit }: Props) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef   = useRef<HTMLDivElement>(null)

  const isEdit = !!editTask

  const [open,      setOpen]      = useState(isEdit)
  const [saving,    setSaving]    = useState(false)
  const [title,     setTitle]     = useState(editTask?.title ?? '')
  const [frequency, setFrequency] = useState(editTask?.frequency ?? 'weekly')
  const [priority,  setPriority]  = useState(editTask?.priority ?? 'medium')
  const [assignee,  setAssignee]  = useState(editTask?.assignee_id ?? currentUserId ?? '')
  const [projectId, setProjectId] = useState(editTask?.project_id ?? '')
  const [clientId,  setClientId]  = useState(editTask?.client_id ?? '')

  useEffect(() => {
    if (open && !isEdit) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, isEdit])

  function close() {
    if (isEdit) { onCancelEdit?.(); return }
    setOpen(false); setTitle(''); setFrequency('weekly'); setPriority('medium')
    setProjectId(''); setClientId(''); setAssignee(currentUserId ?? '')
  }

  async function save() {
    if (!title.trim()) { inputRef.current?.focus(); return }
    setSaving(true)
    try {
      const body = {
        title:       title.trim(),
        frequency,   priority,
        assignee_id: assignee   || null,
        project_id:  projectId  || null,
        client_id:   clientId   || null,
        start_date:  new Date().toISOString().split('T')[0],
      }

      let res: Response
      if (isEdit) {
        res = await fetch(`/api/recurring/${editTask!.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/recurring', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed'); return }
      toast.success(isEdit ? 'Updated!' : 'Recurring task created!')
      if (isEdit) { onEdited?.() } else { close(); onCreated?.() }
      router.refresh()
    } finally { setSaving(false) }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') close()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '10px 16px', border: 'none', background: 'transparent',
        cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--brand)'; (e.currentTarget as HTMLElement).style.background = 'var(--brand-light)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
        <Plus style={{ width: 14, height: 14, flexShrink: 0 }}/>
        <span style={{ fontSize: 13 }}>Add recurring task</span>
      </button>
    )
  }

  return (
    <div ref={rowRef} style={{
      borderTop: isEdit ? 'none' : '2px solid var(--brand)',
      background: 'var(--brand-light)', padding: '12px 16px',
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <RefreshCw style={{ width: 14, height: 14, color: 'var(--brand)', flexShrink: 0 }}/>
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isEdit ? 'Task name…' : 'Recurring task name…'}
          style={{
            flex: 1, fontSize: 13, fontWeight: 500, border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-primary)',
          }}
        />
        <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <X style={{ width: 13, height: 13 }}/>
        </button>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

        {/* Frequency */}
        <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{
          fontSize: 12, padding: '4px 8px', borderRadius: 6,
          border: '1px solid var(--brand)', background: 'var(--brand-light)',
          color: 'var(--brand)', fontWeight: 600, cursor: 'pointer',
        }}>
          {FREQUENCIES.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>

        {/* Assignee */}
        <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{
          fontSize: 12, padding: '4px 8px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text-secondary)', cursor: 'pointer',
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

        {/* Project */}
        {projects.length > 0 && (
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{
            fontSize: 12, padding: '4px 8px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {/* Client */}
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

        {/* Save */}
        <button onClick={save} disabled={saving || !title.trim()} style={{
          marginLeft: 'auto', padding: '4px 16px', borderRadius: 6, border: 'none',
          background: title.trim() ? 'var(--brand)' : 'var(--border)',
          color: title.trim() ? '#fff' : 'var(--text-muted)',
          fontSize: 12, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'default',
          flexShrink: 0, transition: 'all 0.15s',
        }}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add'}
        </button>
      </div>
    </div>
  )
}
