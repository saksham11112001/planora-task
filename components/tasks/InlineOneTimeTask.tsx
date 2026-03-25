'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter }   from 'next/navigation'
import { Plus, X, Flag, User, Briefcase, ShieldCheck, ChevronDown } from 'lucide-react'
import { cn }          from '@/lib/utils/cn'
import { toast }       from '@/store/appStore'
import { DatePicker }  from '@/components/ui/DatePicker'

interface Member { id: string; name: string; role?: string }
interface Props {
  members:        Member[]
  clients:        { id: string; name: string; color: string }[]
  currentUserId?: string
  onCreated?:     () => void
}

const PRIORITIES = [
  { v: 'none',   l: 'No priority', color: '#94a3b8' },
  { v: 'low',    l: 'Low',         color: '#16a34a' },
  { v: 'medium', l: 'Medium',      color: '#ca8a04' },
  { v: 'high',   l: 'High',        color: '#ea580c' },
  { v: 'urgent', l: 'Urgent',      color: '#dc2626' },
]

export function InlineOneTimeTask({ members, clients, currentUserId, onCreated }: Props) {
  const router   = useRouter()
  const rowRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open,       setOpen]       = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [title,      setTitle]      = useState('')
  const [assignee,   setAssignee]   = useState(currentUserId ?? '')
  const [approverId, setApproverId] = useState('')
  const [priority,   setPriority]   = useState('medium')
  const [dueDate,    setDueDate]    = useState('')
  const [clientId,   setClientId]   = useState('')
  const [drop,       setDrop]       = useState<string | null>(null)

  const approvers = members.filter(m => m.role && ['owner','admin','manager'].includes(m.role))

  function openRow() {
    setOpen(true)
    setAssignee(currentUserId ?? '')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function reset() {
    setOpen(false); setTitle(''); setAssignee(currentUserId ?? '')
    setApproverId(''); setPriority('medium'); setDueDate('')
    setClientId(''); setDrop(null)
  }

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
      setDrop(null)
      if (!title.trim()) reset()
    }
  }, [title])

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
          title: title.trim(), assignee_id: assignee || null,
          approver_id: approverId || null,
          approval_required: !!approverId,
          priority, due_date: dueDate || null, client_id: clientId || null,
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

  const assigneeName  = members.find(m => m.id === assignee)?.name
  const approverName  = members.find(m => m.id === approverId)?.name
  const clientObj     = clients.find(c => c.id === clientId)
  const priConf       = PRIORITIES.find(p => p.v === priority) ?? PRIORITIES[2]

  if (!open) {
    return (
      <div onClick={openRow}
        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400 hover:text-teal-600 hover:bg-teal-50 cursor-pointer transition-colors border-t border-dashed border-gray-200 group">
        <div className="h-4 w-4 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0 opacity-60 group-hover:opacity-100">
          <Plus className="h-2.5 w-2.5"/>
        </div>
        Add task
      </div>
    )
  }

  return (
    <div ref={rowRef} style={{ borderTop: '2px solid #0d9488', background: '#f0fdfa22' }}>
      {/* ── Title row ── */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="h-4 w-4 rounded-full border-2 border-teal-400 flex-shrink-0"/>
        <input
          ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={onKeyDown} placeholder="Task name"
          className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400 min-w-0 font-medium"
        />
        <button onClick={reset} className="h-6 w-6 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded hover:bg-gray-100 transition-colors flex-shrink-0">
          <X className="h-3.5 w-3.5"/>
        </button>
      </div>

      {/* ── Properties row ── */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">

        {/* Priority */}
        <div className="relative">
          <button type="button" onClick={() => setDrop(drop === 'pri' ? null : 'pri')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#e2e8f0', color: priConf.color }}>
            <Flag className="h-3 w-3" style={{ color: priConf.color }}/>
            {priConf.l}
            <ChevronDown className="h-2.5 w-2.5 opacity-50"/>
          </button>
          {drop === 'pri' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[155px]" style={{ zIndex: 9999 }}>
              {PRIORITIES.map(p => (
                <button type="button" key={p.v} onClick={() => { setPriority(p.v); setDrop(null) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-50 transition-colors',
                    p.v === priority && 'bg-gray-50'
                  )}>
                  <span style={{ color: p.color, fontSize:13 }}>●</span>
                  <span style={{ color: p.color, fontWeight: 500 }}>{p.l}</span>
                  {p.v === priority && <span className="ml-auto text-gray-300">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assignee */}
        <div className="relative">
          <button type="button" onClick={() => setDrop(drop === 'asgn' ? null : 'asgn')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600">
            {assigneeName
              ? <><div className="h-4 w-4 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold flex-shrink-0" style={{fontSize:8}}>{assigneeName[0].toUpperCase()}</div>{assigneeName}</>
              : <><User className="h-3 w-3 text-gray-400"/>Assignee</>
            }
            <ChevronDown className="h-2.5 w-2.5 opacity-40"/>
          </button>
          {drop === 'asgn' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[200px] max-h-52 overflow-y-auto" style={{ zIndex: 9999 }}>
              <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assign to</div>
              <button type="button" onClick={() => { setAssignee(''); setDrop(null) }}
                className={cn('w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-400', !assignee && 'bg-gray-50')}>
                Unassigned
              </button>
              {members.map(m => (
                <button type="button" key={m.id} onClick={() => { setAssignee(m.id); setDrop(null) }}
                  className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-50 transition-colors', m.id === assignee && 'bg-teal-50')}>
                  <div className="h-5 w-5 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ fontSize: 9 }}>
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 text-left text-gray-700">{m.name}</span>
                  {m.id === currentUserId && <span className="text-[10px] text-gray-400">You</span>}
                  {m.id === assignee && <span className="text-teal-600 text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Due date */}
        <div className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600">
          <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date" />
        </div>

        {/* Client — only if org has clients */}
        {clients.length > 0 && (
          <div className="relative">
            <button type="button" onClick={() => setDrop(drop === 'cli' ? null : 'cli')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600">
              <Briefcase className="h-3 w-3 text-gray-400"/>
              {clientObj
                ? <><div className="h-2 w-2 rounded-sm" style={{ background: clientObj.color }}/>{clientObj.name}</>
                : 'Client'}
              <ChevronDown className="h-2.5 w-2.5 opacity-40"/>
            </button>
            {drop === 'cli' && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[170px] max-h-52 overflow-y-auto" style={{ zIndex: 9999 }}>
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Client</div>
                <button type="button" onClick={() => { setClientId(''); setDrop(null) }}
                  className={cn('w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50', !clientId && 'bg-gray-50')}>
                  No client
                </button>
                {clients.map(c => (
                  <button type="button" key={c.id} onClick={() => { setClientId(c.id); setDrop(null) }}
                    className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-50 transition-colors', c.id === clientId && 'bg-teal-50')}>
                    <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }}/>
                    <span className="text-gray-700">{c.name}</span>
                    {c.id === clientId && <span className="ml-auto text-teal-600 text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approver — collapsed behind a toggle for cleanliness */}
        {approvers.length > 0 && (
          <div className="relative">
            <button type="button" onClick={() => setDrop(drop === 'apr' ? null : 'apr')}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50 transition-colors',
                approverId ? 'border-violet-300 text-violet-700' : 'border-gray-200 text-gray-500'
              )}>
              <ShieldCheck className={cn('h-3 w-3', approverId ? 'text-violet-500' : 'text-gray-400')}/>
              {approverId ? approverName : 'Approval'}
              <ChevronDown className="h-2.5 w-2.5 opacity-40"/>
            </button>
            {drop === 'apr' && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[210px]" style={{ zIndex: 9999 }}>
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Set approver</div>
                <button type="button" onClick={() => { setApproverId(''); setDrop(null) }}
                  className={cn('w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50', !approverId && 'bg-gray-50')}>
                  No approval needed
                </button>
                {approvers.map(m => (
                  <button type="button" key={m.id} onClick={() => { setApproverId(m.id); setDrop(null) }}
                    className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-50 transition-colors', m.id === approverId && 'bg-violet-50')}>
                    <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ fontSize: 9 }}>
                      {m.name[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 text-left text-gray-700">{m.name}</span>
                    <span className="text-gray-400 capitalize text-[10px]">{m.role}</span>
                    {m.id === approverId && <span className="text-violet-600 text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-gray-300 px-1.5 py-0.5 rounded border border-gray-200">⏎ to add</kbd>
          <button type="button" onClick={save} disabled={saving || !title.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
            {saving ? 'Saving…' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )
}