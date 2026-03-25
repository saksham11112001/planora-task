'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, User, Flag, Calendar, Briefcase, X, Clock, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/store/appStore'

interface Member { id: string; name: string; role?: string }
interface Client { id: string; name: string; color: string }

interface Props {
  projectId?:       string
  projectOwnerId?:  string   // ← project lead auto-set as approver
  defaultClientId?: string
  members:          Member[]
  clients:          Client[]
  currentUserId?:   string
  defaultStatus?:   string
  onCreated?:       () => void
}

const PRIORITIES = [
  { v: 'none',   l: 'No priority', cls: 'text-gray-400' },
  { v: 'low',    l: 'Low',          cls: 'text-green-500' },
  { v: 'medium', l: 'Medium',       cls: 'text-yellow-500' },
  { v: 'high',   l: 'High',         cls: 'text-orange-500' },
  { v: 'urgent', l: 'Urgent',       cls: 'text-red-500' },
]

export function InlineTaskRow({
  projectId, projectOwnerId, defaultClientId,
  members, clients, currentUserId, defaultStatus = 'todo', onCreated,
}: Props) {
  const router   = useRouter()
  const rowRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open,     setOpen]     = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [title,    setTitle]    = useState('')
  const [assignee, setAssignee] = useState(currentUserId ?? '')
  const [priority, setPriority] = useState('medium')
  const [dueDate,  setDueDate]  = useState('')
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [hours,    setHours]    = useState('')
  const [drop,     setDrop]     = useState<string | null>(null)

  // Project lead is always the approver — derived, not selectable
  const approverName = projectOwnerId
    ? (members.find(m => m.id === projectOwnerId)?.name ?? 'Project lead')
    : null

  function openRow() {
    setOpen(true)
    setAssignee(currentUserId ?? '')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function reset() {
    setOpen(false); setTitle(''); setAssignee(currentUserId ?? '')
    setPriority('medium'); setDueDate(''); setClientId(defaultClientId ?? '')
    setHours(''); setDrop(null)
  }

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
      if (drop) { setDrop(null); return }
      if (open && !title.trim()) reset()
    }
  }, [open, drop, title])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  async function save() {
    if (!title.trim()) { inputRef.current?.focus(); return }
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), priority, status: defaultStatus,
          assignee_id:      assignee || null,
          // Project lead is always the approver for project tasks
          approver_id:      projectOwnerId || null,
          approval_required: !!projectOwnerId,
          due_date:         dueDate || null,
          project_id:       projectId || null,
          client_id:        clientId || null,
          estimated_hours:  hours ? parseFloat(hours) : null,
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
      toast.success('Task added')
      setTitle(''); setDueDate(''); setHours('')
      inputRef.current?.focus()
      onCreated ? onCreated() : router.refresh()
    } finally { setSaving(false) }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') reset()
  }

  const assigneeName = members.find(m => m.id === assignee)?.name
  const clientObj    = clients.find(c => c.id === clientId)
  const priCls       = PRIORITIES.find(p => p.v === priority)?.cls ?? 'text-gray-400'

  if (!open) {
    return (
      <div onClick={openRow}
        className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-400 hover:text-teal-600 hover:bg-teal-50 cursor-pointer transition-colors group">
        <div className="h-4 w-4 rounded-full border-2 border-current flex items-center justify-center opacity-60 group-hover:opacity-100">
          <Plus className="h-2.5 w-2.5"/>
        </div>
        Add task
        {approverName && (
          <span className="ml-auto text-[10px] text-violet-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <ShieldCheck className="h-3 w-3"/> Approver: {approverName}
          </span>
        )}
      </div>
    )
  }

  return (
    <div ref={rowRef} className="border-t border-teal-200 bg-teal-50/40 px-4 py-2.5">
      {/* Title */}
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 w-4 rounded-full border-2 border-teal-400 flex-shrink-0"/>
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={onKeyDown} placeholder="Task title…"
          className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400 min-w-0"/>
        <button onClick={reset} className="h-5 w-5 flex items-center justify-center text-gray-400 hover:text-gray-600">
          <X className="h-3.5 w-3.5"/>
        </button>
      </div>

      {/* Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">

        {/* Priority */}
        <div className="relative">
          <button onClick={() => setDrop(drop === 'pri' ? null : 'pri')}
            className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border border-gray-200 bg-white hover:bg-gray-50', priCls)}>
            <Flag className="h-3 w-3"/>{PRIORITIES.find(p => p.v === priority)?.l}
          </button>
          {drop === 'pri' && (
            <div className="absolute top-7 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
              {PRIORITIES.map(p => (
                <button key={p.v} onClick={() => { setPriority(p.v); setDrop(null) }}
                  className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50', p.cls)}>
                  <Flag className="h-3 w-3"/>{p.l}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assignee */}
        <div className="relative">
          <button onClick={() => setDrop(drop === 'asgn' ? null : 'asgn')}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border border-gray-200 bg-white hover:bg-gray-50 text-gray-600">
            <User className="h-3 w-3 text-gray-400"/>{assigneeName ?? 'Assign'}
          </button>
          {drop === 'asgn' && (
            <div className="absolute top-7 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] max-h-48 overflow-y-auto">
              <button onClick={() => { setAssignee(''); setDrop(null) }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50">Unassigned</button>
              {members.map(m => (
                <button key={m.id} onClick={() => { setAssignee(m.id); setDrop(null) }}
                  className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50', m.id === assignee && 'bg-teal-50 text-teal-700')}>
                  <div className="h-5 w-5 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ fontSize: 8 }}>
                    {m.name[0].toUpperCase()}
                  </div>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Project lead approver — display only, not editable */}
        {approverName && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-violet-50 text-violet-700 border border-violet-200">
            <ShieldCheck className="h-3 w-3"/>
            Approver: {approverName}
          </div>
        )}

        {/* Due date */}
        <div className="relative inline-flex items-center rounded border border-gray-200 bg-white hover:bg-gray-50 transition-colors overflow-hidden">
          <button type="button"
            onClick={() => (document.getElementById('itr-date') as HTMLInputElement)?.showPicker?.()}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 cursor-pointer">
            <Calendar className="h-3 w-3 text-gray-400"/>
            {dueDate ? new Date(dueDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Due date'}
          </button>
          <input id="itr-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" style={{ colorScheme: 'light' }}/>
        </div>

        {/* Est. hours */}
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border border-gray-200 bg-white">
          <Clock className="h-3 w-3 text-gray-400"/>
          <input value={hours} onChange={e => setHours(e.target.value)} placeholder="Est. hrs"
            type="number" min="0" step="0.5" className="w-14 bg-transparent outline-none text-gray-600"/>
        </div>

        {/* Client */}
        {clients.length > 0 && (
          <div className="relative">
            <button onClick={() => setDrop(drop === 'cli' ? null : 'cli')}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border border-gray-200 bg-white hover:bg-gray-50 text-gray-600">
              <Briefcase className="h-3 w-3 text-gray-400"/>
              {clientObj ? <><div className="h-2 w-2 rounded-sm" style={{ background: clientObj.color }}/>{clientObj.name}</> : 'Client'}
            </button>
            {drop === 'cli' && (
              <div className="absolute top-7 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                <button onClick={() => { setClientId(''); setDrop(null) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50">No client</button>
                {clients.map(c => (
                  <button key={c.id} onClick={() => { setClientId(c.id); setDrop(null) }}
                    className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50', c.id === clientId && 'bg-teal-50')}>
                    <div className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }}/>{c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={save} disabled={saving || !title.trim()}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  )
}
