'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { Client } from '@/types'
import { Plus, ChevronDown, ChevronUp, Calendar, User, Briefcase, Flag, X } from 'lucide-react'
import { Spinner } from '@/components/ui/AppLoader'

interface Props {
  orgId: string
  clients: { id: string; name: string }[]
  members: { id: string; name: string }[]
  currentUserId: string
  showClientAssignee?: boolean
  showDueDate?: boolean
  projectId?: string
  defaultClientId?: string
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-slate-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
]

export default function InlineOneTimeTask({
  orgId, clients, members, currentUserId,
  showClientAssignee = true, showDueDate = true,
  projectId, defaultClientId
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleRef = useRef<HTMLInputElement>(null)

  const canSubmit = title.trim().length > 0

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!canSubmit || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          client_id: clientId || null,
          assignee_id: assigneeId || currentUserId,
          due_date: dueDate || null,
          priority,
          project_id: projectId || null,
          status: 'todo',
          is_recurring: false,
          org_id: orgId,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to create task')
      }

      // Reset
      setTitle('')
      setClientId(defaultClientId ?? '')
      setAssigneeId('')
      setDueDate('')
      setPriority('medium')
      setExpanded(false)

      startTransition(() => router.refresh())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (expanded) {
        handleSubmit()
      } else {
        handleSubmit()
      }
    }
    if (e.key === 'Escape') {
      setExpanded(false)
      setTitle('')
      setError(null)
    }
  }

  return (
    <div className={cn(
      'bg-white dark:bg-slate-800 rounded-xl border transition-all',
      expanded
        ? 'border-teal-400 shadow-md'
        : 'border-slate-200 dark:border-slate-700 hover:border-teal-300'
    )}>
      {/* Title row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          onClick={() => {
            setExpanded(true)
            setTimeout(() => titleRef.current?.focus(), 50)
          }}
          className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600
                     hover:border-teal-500 flex items-center justify-center
                     transition-colors flex-shrink-0 text-slate-300 hover:text-teal-500"
        >
          <Plus size={11} />
        </button>

        <input
          ref={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={() => setExpanded(true)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task... (press Enter to save)"
          className="flex-1 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400
                     bg-transparent outline-none"
        />

        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded && (
            <button
              onClick={() => { setExpanded(false); setTitle(''); setError(null) }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-slate-400 hover:text-teal-600 transition-colors"
            title={expanded ? 'Collapse' : 'Expand for more options'}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded fields */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Client */}
            {showClientAssignee && clients.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Briefcase size={11} /> Client
                </label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg
                             px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                             focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">No client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Assignee */}
            {showClientAssignee && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <User size={11} /> Assign To
                </label>
                <select
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg
                             px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                             focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Assign to me</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Due date */}
            {showDueDate && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Calendar size={11} /> Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg
                             px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                             focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Flag size={11} /> Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg
                           px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                           focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <X size={11} /> {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={() => { setExpanded(false); setTitle(''); setError(null) }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400
                         hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={cn(
                'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
                'flex items-center gap-1.5',
                canSubmit && !submitting
                  ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <><Spinner size={12} /> Saving...</>
              ) : (
                <><Plus size={12} /> Add Task</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
