'use client'
import { useState, useTransition } from 'react'
import { useRouter }          from 'next/navigation'
import { RefreshCw, X }       from 'lucide-react'
import { InlineRecurringTask } from '@/components/tasks/InlineRecurringTask'
import { fmtDate }             from '@/lib/utils/format'
import { toast }               from '@/store/appStore'
import { PriorityBadge, Avatar } from '@/components/ui/Badge'

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', bi_weekly: 'Every 2 weeks',
  monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual',
}

interface Task {
  id: string; title: string; status: string; priority: string
  frequency: string | null; next_occurrence_date: string | null
  assignee_id: string | null
  assignee: { id: string; name: string } | null
  project:  { id: string; name: string; color: string } | null
}

interface Props {
  tasks:         Task[]
  members:       { id: string; name: string }[]
  projects:      { id: string; name: string; color: string }[]
  currentUserId: string
  canManage:     boolean
}

export function RecurringView({ tasks, members, projects, currentUserId, canManage }: Props) {
  const router = useRouter()
  const [isPending, startT] = useTransition()

  async function handleDelete(id: string) {
    if (!confirm('Delete this recurring task? All future instances will stop being created.')) return
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Recurring task deleted'); startT(() => router.refresh()) }
    else        { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring tasks</h1>
          <p className="text-sm text-gray-500 mt-1">{tasks.length} active · new instances spawn automatically each day</p>
        </div>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="text-center py-12">
            <RefreshCw className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">No recurring tasks yet</h3>
            <p className="text-sm text-gray-400 mb-1">Use the row below to set up your first recurring task</p>
            <p className="text-xs text-gray-300">Tasks are automatically created on schedule</p>
          </div>
          {canManage && (
            <InlineRecurringTask members={members} projects={projects} currentUserId={currentUserId}
              onCreated={() => startT(() => router.refresh())} />
          )}
        </div>
      )}

      {/* Task list */}
      {tasks.length > 0 && (
        <div className="card-elevated overflow-hidden mb-4">
          {/* Column headers */}
          <div className="grid px-4 py-2.5 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide"
            style={{ gridTemplateColumns: '1fr 7rem 6rem 6rem 2.5rem', background: 'var(--surface-subtle)', borderColor: 'var(--border)' }}>
            <div>Task</div>
            <div className="text-center">Frequency</div>
            <div className="text-center">Next due</div>
            <div className="text-center">Assignee</div>
            <div />
          </div>

          {tasks.map(task => (
            <div key={task.id}
              className="grid items-center px-4 py-3.5 border-b last:border-0 hover:bg-gray-50 transition-colors"
              style={{ gridTemplateColumns: '1fr 7rem 6rem 6rem 2.5rem', borderColor: 'var(--border)' }}>

              <div className="flex items-center gap-2.5 min-w-0">
                <RefreshCw className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.project && (
                      <><div className="h-2 w-2 rounded-sm" style={{ background: task.project.color }} />
                      <span className="text-xs text-gray-400 truncate">{task.project.name}</span></>
                    )}
                    <PriorityBadge priority={task.priority as any} />
                  </div>
                </div>
              </div>

              <div className="text-center">
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-teal-50 text-teal-700">
                  {FREQ_LABELS[task.frequency ?? ''] ?? task.frequency}
                </span>
              </div>

              <div className="text-center text-xs text-gray-500">
                {task.next_occurrence_date ? fmtDate(task.next_occurrence_date) : '—'}
              </div>

              <div className="flex justify-center">
                {task.assignee
                  ? <Avatar name={task.assignee.name} size="xs" />
                  : <div className="h-5 w-5 rounded-full border border-dashed border-gray-300" title="Unassigned" />
                }
              </div>

              <div className="flex justify-center">
                {canManage && (
                  <button onClick={() => handleDelete(task.id)}
                    className="h-6 w-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* ── Inline creator at bottom of list ── */}
          {canManage && (
            <InlineRecurringTask members={members} projects={projects} currentUserId={currentUserId}
              onCreated={() => startT(() => router.refresh())} />
          )}
        </div>
      )}

      <p className="text-xs text-center text-gray-400 mt-4">
        ⏰ New task instances are automatically created each morning at 7:00 AM
      </p>
    </div>
  )
}
