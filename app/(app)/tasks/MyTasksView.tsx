'use client'

import { useState, useOptimistic, useTransition, useCallback, useMemo } from 'react'
import { Task, Client } from '@/types'
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import InlineOneTimeTask from '@/components/tasks/InlineOneTimeTask'
import { useKanbanDnd } from '@/lib/hooks/useKanbanDnd'
import { cn } from '@/lib/utils/cn'
import { fmtDate, isOverdue } from '@/lib/utils/format'
import {
  CheckCircle2, Clock, AlertCircle, Send, ChevronDown,
  List, LayoutKanban, Filter, X, Briefcase, User, Calendar,
} from 'lucide-react'

interface Props {
  tasks: Task[]
  clients: Client[]
  members: { id: string; name: string }[]
  currentUserId: string
  orgId: string
  canApprove: boolean
}

const COLUMNS = [
  {
    id: 'overdue',
    label: 'Overdue',
    icon: AlertCircle,
    color: 'text-red-500',
    border: 'border-red-200 dark:border-red-900',
    bg: 'bg-red-50 dark:bg-red-950/30',
    headerBg: 'bg-red-100 dark:bg-red-900/40',
    dropDisabled: true,
  },
  {
    id: 'todo',
    label: 'To Do',
    icon: Clock,
    color: 'text-slate-500',
    border: 'border-slate-200 dark:border-slate-700',
    bg: 'bg-slate-50 dark:bg-slate-900/30',
    headerBg: 'bg-slate-100 dark:bg-slate-800/50',
    dropDisabled: false,
  },
  {
    id: 'in_review',
    label: 'Pending Approval',
    icon: Send,
    color: 'text-amber-500',
    border: 'border-amber-200 dark:border-amber-900',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    headerBg: 'bg-amber-100 dark:bg-amber-900/40',
    dropDisabled: false,
  },
  {
    id: 'done',
    label: 'Done',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-900',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    headerBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    dropDisabled: false,
  },
] as const

const DONE_PAGE_SIZE = 5

export function MyTasksView({ tasks, clients, members, currentUserId, orgId, canApprove }: Props) {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [donePage, setDonePage] = useState(1)
  const [, startTransition] = useTransition()

  const [optimisticTasks, updateOptimistic] = useOptimistic(
    tasks,
    (state: Task[], { id, patch }: { id: string; patch: Partial<Task> }) =>
      state.map(t => (t.id === id ? { ...t, ...patch } : t))
  )

  const handleDrop = useCallback(async (taskId: string, targetColId: string) => {
    if (targetColId === 'overdue') return

    const task = optimisticTasks.find(t => t.id === taskId)
    if (!task) return

    let newStatus = task.status
    let newApprovalStatus = task.approval_status ?? null

    if (targetColId === 'todo') { newStatus = 'todo'; newApprovalStatus = null }
    else if (targetColId === 'in_review') { newStatus = 'in_review'; newApprovalStatus = 'pending' }
    else if (targetColId === 'done') { newStatus = 'completed'; newApprovalStatus = null }

    if (newStatus === task.status && newApprovalStatus === task.approval_status) return

    startTransition(() => {
      updateOptimistic({ id: taskId, patch: { status: newStatus, approval_status: newApprovalStatus } })
    })

    try {
      if (targetColId === 'in_review') {
        // Use approval endpoint so Inngest fires email to approver
        await fetch(`/api/tasks/${taskId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'submit' }),
        })
      } else {
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, approval_status: newApprovalStatus }),
        })
      }
    } catch (err) {
      console.error('Drag update failed:', err)
    }
  }, [optimisticTasks, updateOptimistic, startTransition])

  const { dragState, getDragProps, getDropProps } = useKanbanDnd(handleDrop)

  const filteredTasks = useMemo(() => {
    if (clientFilter === 'all') return optimisticTasks
    return optimisticTasks.filter(t => t.client_id === clientFilter)
  }, [optimisticTasks, clientFilter])

  const getColumnTasks = useCallback((colId: string): Task[] => {
    if (colId === 'overdue') {
      return filteredTasks.filter(
        t => isOverdue(t.due_date, t.status)
      )
    }
    if (colId === 'todo') {
      return filteredTasks.filter(
        t => ['todo', 'in_progress'].includes(t.status) &&
          !(isOverdue(t.due_date, t.status))
      )
    }
    if (colId === 'in_review') return filteredTasks.filter(t => t.status === 'in_review')
    if (colId === 'done') return filteredTasks.filter(t => ['completed', 'approved'].includes(t.status))
    return []
  }, [filteredTasks])

  const clientOptions = useMemo(() => {
    const ids = new Set(optimisticTasks.map(t => t.client_id).filter(Boolean))
    return clients.filter(c => ids.has(c.id))
  }, [optimisticTasks, clients])

  const selectedTask = optimisticTasks.find(t => t.id === selectedTaskId) ?? null

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
          <button
            onClick={() => setView('board')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
              view === 'board'
                ? 'bg-teal-600 text-white'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
            )}
          >
            <LayoutKanban size={14} /> Board
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
              view === 'list'
                ? 'bg-teal-600 text-white'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
            )}
          >
            <List size={14} /> List
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={clientFilter}
            onChange={e => { setClientFilter(e.target.value); setDonePage(1) }}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5
                       bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200
                       focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Clients</option>
            {clientOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {clientFilter !== 'all' && (
            <button onClick={() => setClientFilter('all')} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <InlineOneTimeTask
        orgId={orgId}
        clients={clients}
        members={members}
        currentUserId={currentUserId}
        showClientAssignee
        showDueDate
      />

      {view === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-6">
          {COLUMNS.map(col => {
            const Icon = col.icon
            let colTasks = getColumnTasks(col.id)
            const isDone = col.id === 'done'
            const totalCount = colTasks.length
            if (isDone) colTasks = colTasks.slice(0, donePage * DONE_PAGE_SIZE)
            const isOver = dragState.overColId === col.id && !col.dropDisabled

            return (
              <div key={col.id} className={cn('flex flex-col rounded-xl border transition-all', col.border)}>
                <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-t-xl', col.headerBg)}>
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={col.color} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{col.label}</span>
                  </div>
                  <span className={cn(
                    'text-xs font-bold rounded-full px-2 py-0.5',
                    col.id === 'overdue'
                      ? 'bg-red-500 text-white'
                      : 'bg-white/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  )}>
                    {totalCount}
                  </span>
                </div>

                <div
                  {...getDropProps(col.id, col.dropDisabled)}
                  className={cn(
                    'flex flex-col gap-2 p-2 min-h-[120px] flex-1 rounded-b-xl transition-all',
                    col.bg,
                    isOver && 'ring-2 ring-teal-400 ring-inset bg-teal-50/50 dark:bg-teal-900/20'
                  )}
                >
                  {colTasks.map(task => (
                    <div key={task.id} {...getDragProps(task.id)}>
                      <TaskCard
                        task={task}
                        clients={clients}
                        members={members}
                        onClick={() => setSelectedTaskId(task.id)}
                        isDragging={dragState.draggingId === task.id}
                      />
                    </div>
                  ))}

                  {isDone && totalCount > donePage * DONE_PAGE_SIZE && (
                    <button
                      onClick={() => setDonePage(p => p + 1)}
                      className="flex items-center justify-center gap-1 text-xs text-slate-500
                                 hover:text-teal-600 py-2 transition-colors"
                    >
                      <ChevronDown size={14} />
                      Load {Math.min(DONE_PAGE_SIZE, totalCount - donePage * DONE_PAGE_SIZE)} more
                    </button>
                  )}

                  {colTasks.length === 0 && (
                    <div className={cn(
                      'flex items-center justify-center h-16 text-xs italic',
                      isOver ? 'text-teal-500 font-medium' : 'text-slate-400'
                    )}>
                      {isOver ? 'Release to move here' : col.dropDisabled ? '' : 'Drop tasks here'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'list' && (
        <ListView tasks={filteredTasks} clients={clients} members={members} onSelectTask={setSelectedTaskId} />
      )}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          clients={clients}
          members={members}
          currentUserId={currentUserId}
          canApprove={canApprove}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}

function TaskCard({ task, clients, members, onClick, isDragging }: {
  task: Task
  clients: Client[]
  members: { id: string; name: string }[]
  onClick: () => void
  isDragging: boolean
}) {
  const client = clients.find(c => c.id === task.client_id)
  const assignee = members.find(m => m.id === task.assignee_id)
  const over = isOverdue(task.due_date, task.status)

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-slate-800 rounded-lg p-3 cursor-grab active:cursor-grabbing select-none',
        'border border-slate-200 dark:border-slate-700',
        'hover:shadow-md hover:border-teal-400 transition-all',
        isDragging && 'opacity-50 shadow-xl rotate-1',
        over && 'border-l-4 border-l-red-400'
      )}
    >
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 mb-2">{task.title}</p>
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        {task.priority && <PriorityBadge priority={task.priority} size="xs" />}
        {client && (
          <span className="text-[11px] bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300
                           px-1.5 py-0.5 rounded-full flex items-center gap-1 max-w-[110px] truncate">
            <Briefcase size={9} />{client.name}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        {assignee
          ? <span className="flex items-center gap-1 text-[11px] text-slate-500"><User size={10} />{assignee.name.split(' ')[0]}</span>
          : <span />
        }
        {task.due_date && (
          <span className={cn('flex items-center gap-1 text-[11px] font-medium', over ? 'text-red-500' : 'text-slate-400')}>
            <Calendar size={10} />{fmtDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

function ListView({ tasks, clients, members, onSelectTask }: {
  tasks: Task[]
  clients: Client[]
  members: { id: string; name: string }[]
  onSelectTask: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="hidden md:grid grid-cols-[1fr_140px_120px_100px_90px] gap-2 px-4 py-1.5
                      text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        <span>Task</span><span>Client</span><span>Assignee</span><span>Due Date</span><span>Priority</span>
      </div>
      {tasks.map(task => {
        const client = clients.find(c => c.id === task.client_id)
        const assignee = members.find(m => m.id === task.assignee_id)
        const over = isOverdue(task.due_date, task.status)
        return (
          <div
            key={task.id}
            onClick={() => onSelectTask(task.id)}
            className={cn(
              'grid grid-cols-1 md:grid-cols-[1fr_140px_120px_100px_90px] gap-2 items-center',
              'px-4 py-3 bg-white dark:bg-slate-800 rounded-lg cursor-pointer',
              'border border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:shadow-sm transition-all',
              over && 'border-l-4 border-l-red-400'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <StatusBadge status={task.status} size="sm" />
              <span className="text-sm text-slate-800 dark:text-slate-100 truncate">{task.title}</span>
            </div>
            <span className="text-xs text-teal-600 dark:text-teal-400 truncate">{client?.name ?? '—'}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{assignee?.name ?? '—'}</span>
            <span className={cn('text-xs font-medium', over ? 'text-red-500' : 'text-slate-400')}>
              {task.due_date ? fmtDate(task.due_date) : '—'}
            </span>
            <div>{task.priority && <PriorityBadge priority={task.priority} size="xs" />}</div>
          </div>
        )
      })}
      {tasks.length === 0 && (
        <div className="flex items-center justify-center h-32 text-sm text-slate-400">No tasks found</div>
      )}
    </div>
  )
}
