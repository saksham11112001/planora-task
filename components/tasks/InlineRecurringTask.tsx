'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter }   from 'next/navigation'
import { Plus, X, RefreshCw, Flag, User } from 'lucide-react'
import { cn }          from '@/lib/utils/cn'
import { toast }       from '@/store/appStore'

const FREQUENCIES = [
  { v: 'daily',     l: 'Daily' },
  { v: 'weekly',    l: 'Weekly' },
  { v: 'bi_weekly', l: 'Every 2 weeks' },
  { v: 'monthly',   l: 'Monthly' },
  { v: 'quarterly', l: 'Quarterly' },
  { v: 'annual',    l: 'Annual' },
]

const PRIORITIES = [
  { v: 'none',   l: 'No priority', color: '#94a3b8' },
  { v: 'low',    l: 'Low',         color: '#16a34a' },
  { v: 'medium', l: 'Medium',      color: '#ca8a04' },
  { v: 'high',   l: 'High',        color: '#ea580c' },
  { v: 'urgent', l: 'Urgent',      color: '#dc2626' },
]

interface Props {
  members:        { id: string; name: string }[]
  projects:       { id: string; name: string; color: string }[]
  currentUserId?: string
  onCreated?:     () => void
}

export function InlineRecurringTask({ members, projects, currentUserId, onCreated }: Props) {
  const router   = useRouter()
  const rowRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open,      setOpen]      = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [title,     setTitle]     = useState('')
  const [frequency, setFrequency] = useState('weekly')
  const [priority,  setPriority]  = useState('medium')
  const [assignee,  setAssignee]  = useState(currentUserId ?? '')
  const [projectId, setProjectId] = useState('')
  const [drop,      setDrop]      = useState<string | null>(null)

  function openRow() {
    setOpen(true)
    setAssignee(currentUserId ?? '')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const close = useCallback(() => {
    setOpen(false); setTitle(''); setFrequency('weekly'); setPriority('medium')
    setProjectId(''); setDrop(null); setAssignee(currentUserId ?? '')
  }, [currentUserId])

  const save = useCallback(async (andNew = false) => {
    if (!title.trim()) { close(); return }
    setSaving(true)
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       title.trim(),
          frequency,
          priority,
          assignee_id: assignee  || null,
          project_id:  projectId || null,
          start_date:  new Date().toISOString().split('T')[0],
        }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed'); return }
      toast.success('Recurring task created!')
      onCreated?.()
      router.refresh()
      if (andNew) { setTitle(''); setTimeout(() => inputRef.current?.focus(), 50) }
      else close()
    } finally { setSaving(false) }
  }, [title, frequency, priority, assignee, projectId, close, onCreated, router])

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')  { e.preventDefault(); save(true) }
    if (e.key === 'Escape') close()
  }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) save(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, save])

  const selFreq    = FREQUENCIES.find(f => f.v === frequency)
  const selPri     = PRIORITIES.find(p => p.v === priority) ?? PRIORITIES[0]
  const selMember  = members.find(m => m.id === assignee)
  const selProject = projects.find(p => p.id === projectId)

  if (!open) {
    return (
      <button onClick={openRow}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.background = 'var(--brand-light)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = '' }}>
        <div className="h-4 w-4 rounded-full border border-dashed flex items-center justify-center flex-shrink-0" style={{ borderColor: 'currentColor' }}>
          <Plus className="h-2.5 w-2.5" />
        </div>
        Add recurring task
      </button>
    )
  }

  return (
    <div ref={rowRef}
      className="flex flex-wrap items-center gap-2 px-4 py-3 border-t"
      style={{ background: 'var(--brand-light)', borderColor: 'var(--brand-border)' }}>

      <RefreshCw className="h-4 w-4 text-teal-500 flex-shrink-0" />

      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={onKey}
        disabled={saving}
        placeholder="Recurring task name — Enter to add, Esc to cancel"
        className="flex-1 min-w-48 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
      />

      <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">

        {/* Frequency */}
        <Chip
          icon={<RefreshCw className="h-3 w-3" />}
          label={selFreq?.l ?? 'Weekly'}
          active
          onClick={() => setDrop(drop === 'freq' ? null : 'freq')}
        >
          {drop === 'freq' && (
            <DropDown>
              {FREQUENCIES.map(f => (
                <DropItem key={f.v} label={f.l} onClick={() => { setFrequency(f.v); setDrop(null) }} />
              ))}
            </DropDown>
          )}
        </Chip>

        {/* Assignee */}
        <Chip
          icon={<User className="h-3 w-3" />}
          label={selMember ? selMember.name.split(' ')[0] : 'Assign'}
          active={!!assignee}
          onClick={() => setDrop(drop === 'assign' ? null : 'assign')}
        >
          {drop === 'assign' && (
            <DropDown>
              <DropItem label="Unassigned" onClick={() => { setAssignee(''); setDrop(null) }} />
              {members.map(m => (
                <DropItem key={m.id} label={m.name + (m.id === currentUserId ? ' (me)' : '')} onClick={() => { setAssignee(m.id); setDrop(null) }} />
              ))}
            </DropDown>
          )}
        </Chip>

        {/* Priority */}
        <Chip
          icon={<Flag className="h-3 w-3" style={{ color: priority !== 'none' ? selPri.color : undefined }} />}
          label={priority !== 'none' ? selPri.l : 'Priority'}
          active={priority !== 'none'}
          onClick={() => setDrop(drop === 'priority' ? null : 'priority')}
        >
          {drop === 'priority' && (
            <DropDown>
              {PRIORITIES.map(p => (
                <DropItem key={p.v} label={p.l}
                  icon={<Flag className="h-3 w-3" style={{ color: p.color }} />}
                  onClick={() => { setPriority(p.v); setDrop(null) }} />
              ))}
            </DropDown>
          )}
        </Chip>

        {/* Project */}
        {projects.length > 0 && (
          <Chip
            icon={selProject ? <div className="h-2 w-2 rounded-sm" style={{ background: selProject.color }} /> : undefined}
            label={selProject?.name ?? 'Project'}
            active={!!projectId}
            onClick={() => setDrop(drop === 'project' ? null : 'project')}
          >
            {drop === 'project' && (
              <DropDown>
                <DropItem label="No project" onClick={() => { setProjectId(''); setDrop(null) }} />
                {projects.map(p => (
                  <DropItem key={p.id} label={p.name} dot={p.color} onClick={() => { setProjectId(p.id); setDrop(null) }} />
                ))}
              </DropDown>
            )}
          </Chip>
        )}

        <button onClick={close} className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function Chip({ icon, label, active, dot, onClick, children }: {
  icon?: React.ReactNode; label: string; active: boolean; dot?: string; onClick: () => void; children?: React.ReactNode
}) {
  return (
    <div className="relative">
      <button type="button" onClick={onClick}
        className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
          active ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
        {dot && <div className="h-2 w-2 rounded-sm" style={{ background: dot }} />}
        {icon}{label}
      </button>
      {children}
    </div>
  )
}

function DropDown({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <div className={cn('absolute bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 min-w-36', right ? 'right-0' : 'left-0')}>
      {children}
    </div>
  )
}

function DropItem({ label, onClick, dot, icon }: { label: string; onClick: () => void; dot?: string; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
      {dot && <div className="h-2 w-2 rounded-sm" style={{ background: dot }} />}
      {icon}{label}
    </button>
  )
}
