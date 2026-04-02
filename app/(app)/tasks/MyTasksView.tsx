'use client'

import { useState, useOptimistic, useTransition, useCallback, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Task, Client } from '@/types'
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge'
import TaskDetailPanel from '@/components/tasks/TaskDetailPanel'
import InlineOneTimeTask from '@/components/tasks/InlineOneTimeTask'
import { cn } from '@/lib/utils/cn'
import { fmtDate, isOverdue } from '@/lib/utils/format'
import {
  CheckCircle2, Clock, AlertCircle, Send, ChevronDown,
  List, LayoutKanban, Filter, X, User, Briefcase
} from 'lucide-react'

interface Props {
  tasks: Task[]
  clients: Client[]
  members: { id: string; name: string }[]
  currentUserId: string
  orgId: string
  canApprove: boolean
}

// Kanban column definitions for My Tasks
const COLUMNS = [
  {
    id: 'overdue',
    label: 'Overdue',
    icon: AlertCircle,
    color: 'text-red-500',
    border: 'border-red-200 dark:border-red-900',
    bg: 'bg-red-50 dark:bg-red-950/30',
    headerBg: 'bg-red-100 dark:bg-red-900/40',
    statuses: [] as string[], // computed dynamically
    isOverdue: true,
  },
  {
    id: 'todo',
    label: 'To Do',
    icon: Clock,
    color: 'text-slate-500',
    border: 'border-slate-200 dark:border-slate-700',
    bg: 'bg-slate-50 dark:bg-slate-900/30',
    headerBg: 'bg-slate-100 dark:bg-slate-800/50',
    statuses: ['todo', 'in_progress'],
    isOverdue: false,
  },
  {
    id: 'in_review',
    label: 'Pending Approval',
    icon: Send,
    color: 'text-amber-500',
    border: 'border-amber-200 dark:border-amber-900',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    headerBg: 'bg-amber-100 dark:bg-amber-900/40',
    statuses: ['in_review'],
    isOverdue: false,
  },
  {
    id: 'done',
    label: 'Done',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-900',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    headerBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    statuses: ['completed', 'approved'],
    isOverdue: false,
  },
]

const DONE_PAGE_SIZE = 5

export default function MyTasksView({ tasks, clients, members, currentUserId, orgId, canApprove }: Props) {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [donePage, setDonePage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const [optimisticTasks, updateOptimistic] = useOptimistic(
    tasks,
    (state: Task[], { id, patch }: { id: string; patch: Partial<Task> }) =>
      state.map(t => (t.id === id ? { ...t, ...patch } : t))
  )

  // Filter by client
  const filteredTasks = useMemo(() => {
    if (clientFilter === 'all') return optimisticTasks
    return optimisticTasks.filter(t => t.client_id === clientFilter)
  }, [optimisticTasks, clientFilter])

  // Assign tasks to columns
  const getColumnTasks = useCallback((colId: string) => {
    const col = COLUMNS.find(c => c.id === colId)!
    if (col.isOverdue) {
      return filteredTasks.filter(
        t => isOverdue(t.due_date) && !['completed', 'approved', 'in_review'].includes(t.status)
      )
    }
    return filteredTasks.filter(t => {
      if (isOverdue(t.due_date) && !['completed', 'approved', 'in_review'].includes(t.status)) return false
      return col.statuses.includes(t.status)
    })
  }, [filteredTasks])

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination } = result
    if (!destination) return

    const targetColId = destination.droppableId
    const targetCol = COLUMNS.find(c => c.id === targetColId)
    if (!targetCol) return

    const task = optimisticTasks.find(t => t.id === draggableId)
    if (!task) return

    // Map column → status + approval_status
    let newStatus = task.status
    let newApprovalStatus = task.approval_status ?? null

    if (targetColId === 'todo') {
      newStatus = 'todo'
      newApprovalStatus = null
    } else if (targetColId === 'in_review') {
      // Moving to "Pending Approval" — submit for approval
      newStatus = 'in_review'
      newApprovalStatus = 'pending'
    } else if (targetColId === 'done') {
      newStatus = 'completed'
      newApprovalStatus = null
    } else if (targetColId === 'overdue') {
      return // Can't drag TO overdue
    }

    if (newStatus === task.status && newApprovalStatus === task.approval_status) return

    // Optimistic update
    startTransition(() => {
      updateOptimistic({ id: draggableId, patch: { status: newStatus, approval_status: newApprovalStatus } })
    })

    try {
      if (targetColId === 'in_review') {
        // Use the approval endpoint so Inngest fires the email to approver
        const res = await fetch(`/api/tasks/${draggableId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'submit' }),
        })
        if (!res.ok) throw new Error(await res.text())
      } else {
        const res = await fetch(`/api/tasks/${draggableId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, approval_status: newApprovalStatus }),
        })
        if (!res.ok) throw new Error(await res.text())
      }
    } catch (err) {
      console.error('Drag update failed:', err)
      // Revert optimistic — refetch will correct state on next render
    }
  }, [optimisticTasks, updateOptimistic, startTransition])

  const selectedTask = optimisticTasks.find(t => t.id === selectedTaskId) ?? null

  const clientOptions = useMemo(() => {
    const ids = new Set(filteredTasks.map(t => t.client_id).filter(Boolean))
    return clients.filter(c => ids.has(c.id))
  }, [filteredTasks, clients])

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {/* View toggle */}
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
        </div>

        {/* Client filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
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
            <button
              onClick={() => setClientFilter('all')}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Inline task creator */}
      <InlineOneTimeTask orgId={orgId} clients={clients} members={members} currentUserId={currentUserId} />

      {/* Board or List */}
      {view === 'board' ? (
        <KanbanBoard
          getColumnTasks={getColumnTasks}
          onDragEnd={handleDragEnd}
          onSelectTask={setSelectedTaskId}
          clients={clients}
          donePage={donePage}
          setDonePage={setDonePage}
        />
      ) : (
        <ListView
          tasks={filteredTasks}
          onSelectTask={setSelectedTaskId}
          clients={clients}
        />
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          clients={clients}
          members={members}
          currentUserId={currentUserId}
          canApprove={canApprove}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => { setSelectedTaskId(null) }}
        />
      )}
    </div>
  )
}

// ─── Kanban Board ───────────────────────────────────────────────────────────

interface KanbanBoardProps {
  getColumnTasks: (colId: string) => Task[]
  onDragEnd: (r: DropResult) => void
  onSelectTask: (id: string) => void
  clients: Client[]
  donePage: number
  setDonePage: (n: number) => void
}

function KanbanBoard({ getColumnTasks, onDragEnd, onSelectTask, clients, donePage, setDonePage }: KanbanBoardProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-6 overflow-x-auto">
        {COLUMNS.map(col => {
          const Icon = col.icon
          let colTasks = getColumnTasks(col.id)
          const isDone = col.id === 'done'
          const totalDone = colTasks.length
          if (isDone) colTasks = colTasks.slice(0, donePage * DONE_PAGE_SIZE)

          return (
            <div key={col.id} className={cn('flex flex-col rounded-xl border', col.border)}>
              {/* Column header */}
              <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-t-xl', col.headerBg)}>
                <div className="flex items-center gap-2">
                  <Icon size={14} className={col.color} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{col.label}</span>
                </div>
                <span className={cn(
                  'text-xs font-bold rounded-full px-2 py-0.5',
                  col.id === 'overdue' ? 'bg-red-500 text-white' : 'bg-white/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                )}>
                  {isDone ? totalDone : colTasks.length}
                </span>
              </div>

              {/* Drop zone */}
              <Droppable droppableId={col.id} isDropDisabled={col.id === 'overdue'}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex flex-col gap-2 p-2 min-h-[120px] flex-1 rounded-b-xl transition-colors',
                      col.bg,
                      snapshot.isDraggingOver && 'ring-2 ring-teal-400 ring-inset'
                    )}
                  >
                    {colTasks.map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                        isDragDisabled={col.id === 'overdue' ? false : false}
                      >
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                          >
                            <TaskCard
                              task={task}
                              clients={clients}
                              onClick={() => onSelectTask(task.id)}
                              isDragging={snap.isDragging}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {/* Load more for Done column */}
                    {isDone && totalDone > donePage * DONE_PAGE_SIZE && (
                      <button
                        onClick={() => setDonePage(donePage + 1)}
                        className="flex items-center justify-center gap-1 text-xs text-slate-500
                                   hover:text-teal-600 py-2 transition-colors"
                      >
                        <ChevronDown size={14} />
                        Load {Math.min(DONE_PAGE_SIZE, totalDone - donePage * DONE_PAGE_SIZE)} more
                      </button>
                    )}

                    {colTasks.length === 0 && (
                      <div className="flex items-center justify-center h-16 text-xs text-slate-400 italic">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}

// ─── Task Card ───────────────────────────────────────────────────────────────

function TaskCard({ task, clients, onClick, isDragging }: {
  task: Task; clients: Client[]; onClick: () => void; isDragging: boolean
}) {
  const client = clients.find(c => c.id === task.client_id)
  const over = isOverdue(task.due_date) && !['completed', 'approved'].includes(task.status)

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-slate-800 rounded-lg p-3 cursor-pointer',
        'border border-slate-200 dark:border-slate-700',
        'hover:shadow-md hover:border-teal-400 transition-all',
        isDragging && 'shadow-xl rotate-1 opacity-90',
        over && 'border-l-4 border-l-red-400'
      )}
    >
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 mb-2">{task.title}</p>
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-1.5">
          {task.priority && <PriorityBadge priority={task.priority} size="xs" />}
          {client && (
            <span className="text-[11px] bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300
                             px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Briefcase size={9} />
              {client.name}
            </span>
          )}
        </div>
        {task.due_date && (
          <span className={cn(
            'text-[11px] font-medium',
            over ? 'text-red-500' : 'text-slate-400'
          )}>
            {fmtDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── List View ───────────────────────────────────────────────────────────────

function ListView({ tasks, onSelectTask, clients }: {
  tasks: Task[]; onSelectTask: (id: string) => void; clients: Client[]
}) {
  return (
    <div className="flex flex-col gap-1">
      {tasks.map(task => {
        const client = clients.find(c => c.id === task.client_id)
        return (
          <div
            key={task.id}
            onClick={() => onSelectTask(task.id)}
            className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800
                       border border-slate-200 dark:border-slate-700 rounded-lg
                       hover:border-teal-400 cursor-pointer transition-all hover:shadow-sm"
          >
            <StatusBadge status={task.status} size="sm" />
            <span className="flex-1 text-sm text-slate-800 dark:text-slate-100 truncate">{task.title}</span>
            {client && <span className="text-xs text-teal-600 dark:text-teal-400 truncate max-w-[120px]">{client.name}</span>}
            {task.priority && <PriorityBadge priority={task.priority} size="xs" />}
            {task.due_date && (
              <span className={cn(
                'text-xs',
                isOverdue(task.due_date) && !['completed', 'approved'].includes(task.status)
                  ? 'text-red-500 font-medium'
                  : 'text-slate-400'
              )}>
                {fmtDate(task.due_date)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
