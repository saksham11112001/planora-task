'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, X, Pencil, User } from 'lucide-react'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { InlineRecurringTask, FREQ_LABEL } from '@/components/tasks/InlineRecurringTask'
import { fmtDate } from '@/lib/utils/format'
import { toast, useFilterStore } from '@/store/appStore'
import { UniversalFilterBar } from '@/components/filters/UniversalFilterBar'
import { PriorityBadge, Avatar } from '@/components/ui/Badge'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  frequency: string | null
  next_occurrence_date: string | null
  assignee_id: string | null
  approver_id?: string | null
  client_id: string | null
  assignee: { id: string; name: string } | null
  creator?: { id: string; name: string } | null
  project: { id: string; name: string; color: string } | null
  client: { id: string; name: string; color: string } | null
}

interface Member {
  id: string
  name: string
  role?: string | null
}

interface Props {
  tasks: Task[]
  members: Member[]
  projects: { id: string; name: string; color: string }[]
  clients: { id: string; name: string; color: string }[]
  currentUserId: string
  canManage: boolean
  userRole?: string
}

const BOARD_COLUMNS = [
  { key: 'daily', label: 'Daily', color: '#dc2626' },
  { key: 'weekly', label: 'Weekly', color: '#ea580c' },
  { key: 'monthly', label: 'Monthly', color: '#0d9488' },
  { key: 'quarterly', label: 'Quarterly', color: '#7c3aed' },
  { key: 'annual', label: 'Annual', color: '#0891b2' },
]

function normalizeFrequency(freq: string | null | undefined): string {
  if (!freq) return 'other'
  if (freq === 'daily') return 'daily'
  if (freq.startsWith('weekly_') || freq === 'bi_weekly' || freq === 'weekly') return 'weekly'
  if (freq.startsWith('monthly_') || freq === 'monthly') return 'monthly'
  if (freq === 'quarterly') return 'quarterly'
  if (freq === 'annual' || freq === 'yearly') return 'annual'
  return 'other'
}

export function RecurringView({
  tasks: initialTasks,
  members,
  projects,
  clients,
  currentUserId,
  canManage,
  userRole,
}: Props) {
  const router = useRouter()
  const [, startT] = useTransition()

  const [localTasks, setLocalTasks] = useState<Task[]>(initialTasks)
  const [viewTab, setViewTab] = useState<'List' | 'Board'>('List')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [subtaskMap, setSubtaskMap] = useState<Record<string, any[]>>({})
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [newSubInputs, setNewSubInputs] = useState<Record<string, string>>({})
  const [newSubAssignees, setNewSubAssignees] = useState<Record<string, string>>({})
  const [newSubDueDates, setNewSubDueDates] = useState<Record<string, string>>({})

  // Global filters
  const { clientId: clientFilter, priority: filterPriority, search: filterSearch, assigneeId: filterAssignee, creatorId: filterCreator } = useFilterStore()

  const visibleTasks = useMemo(() => {
    return localTasks.filter(t => {
      if (clientFilter  && t.client_id !== clientFilter && t.client?.id !== clientFilter) return false
      if (filterPriority && t.priority !== filterPriority) return false
      if (filterAssignee && (t.assignee_id ?? t.assignee?.id) !== filterAssignee) return false
      if (filterSearch   && !t.title.toLowerCase().includes(filterSearch.toLowerCase())) return false
      if (filterCreator  && t.creator?.id !== filterCreator) return false
      return true
    })
  }, [localTasks, clientFilter, filterPriority, filterSearch, filterAssignee, filterCreator])

  async function refreshSubs(taskId: string) {
    const r = await fetch(`/api/tasks?parent_id=${taskId}&limit=50`)
    const d = await r.json().catch(() => ({}))
    setSubtaskMap((prev) => ({ ...prev, [taskId]: d.data ?? [] }))
  }

  async function toggleSubExpand(taskId: string) {
    setExpandedSubs((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })

    if (!subtaskMap[taskId]) {
      await refreshSubs(taskId)
    }
  }

  async function toggleSubDone(taskId: string, subId: string, status: string) {
    const newStatus = status === 'completed' ? 'todo' : 'completed'

    if (newStatus === 'completed') {
      const sub = (subtaskMap[taskId] ?? []).find((s: any) => s.id === subId)
      const isComplianceSub = sub?.custom_fields?._compliance_subtask === true

      if (isComplianceSub) {
        const attRes = await fetch(`/api/tasks/${subId}/attachments`)
        const attData = await attRes.json().catch(() => ({ data: [] }))
        if ((attData.data ?? []).length === 0) {
          toast.error('📎 Upload the required document before completing this CA compliance subtask')
          return
        }
      }
    }

    setSubtaskMap((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] ?? []).map((s: any) =>
        s.id === subId ? { ...s, status: newStatus } : s,
      ),
    }))

    await fetch(`/api/tasks/${subId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      }),
    })

    await refreshSubs(taskId)
  }

  async function uploadSubAttachment(subId: string, file: File) {
    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch(`/api/tasks/${subId}/attachments`, {
      method: 'POST',
      body: fd,
    })

    if (res.ok) toast.success(`Uploaded: ${file.name}`)
    else toast.error('Upload failed')
  }

  async function addSubtask(taskId: string, title: string, assigneeId?: string, dueDate?: string) {
    if (!title.trim()) return

    const r = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        parent_task_id: taskId,
        status: 'todo',
        priority: 'medium',
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
      }),
    })

    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      toast.error(d.error ?? 'Could not create subtask')
      return
    }

    await refreshSubs(taskId)
    setNewSubInputs((prev) => ({ ...prev, [taskId]: '' }))
    setNewSubAssignees((prev) => ({ ...prev, [taskId]: '' }))
    setNewSubDueDates((prev) => ({ ...prev, [taskId]: '' }))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this recurring task? All future instances will stop being created.')) {
      return
    }

    const snapshot = localTasks.map((t) => ({ ...t }))
    setLocalTasks((prev) => prev.filter((t) => t.id !== id))

    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })

    if (res.ok) {
      toast.success('Deleted')
      startT(() => router.refresh())
    } else {
      setLocalTasks(snapshot)
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Failed')
    }
  }

  return (
    <div className="page-container">
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: 0,
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        {(['List', 'Board'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setViewTab(tab)}
            style={{
              padding: '10px 15px',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              marginBottom: -1,
              borderBottom: `2px solid ${viewTab === tab ? 'var(--brand)' : 'transparent'}`,
              color: viewTab === tab ? 'var(--brand)' : 'var(--text-muted)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {viewTab === 'Board' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Universal filter bar */}
          <UniversalFilterBar clients={clients} members={members} showSearch showPriority showAssignee showAssignor/>

          <div
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '14px 20px',
              background: 'var(--surface-subtle)',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            {BOARD_COLUMNS.map((col) => {
              const colTasks = localTasks.filter(
                (t) =>
                  normalizeFrequency(t.frequency) === col.key &&
                  (!clientFilter  || t.client_id === clientFilter  || t.client?.id === clientFilter) &&
                  (!filterPriority || t.priority === filterPriority) &&
                  (!filterAssignee || (t.assignee_id ?? t.assignee?.id) === filterAssignee) &&
                  (!filterSearch   || t.title.toLowerCase().includes(filterSearch.toLowerCase())) &&
                  (!filterCreator  || t.creator?.id === filterCreator),
              )

              return (
                <div
                  key={col.key}
                  style={{
                    minWidth: 220,
                    flex: '0 0 220px',
                    background: 'var(--surface)',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '11px 13px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: col.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {col.label}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                      {colTasks.length}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 7,
                      overflowY: 'auto',
                      flex: 1,
                    }}
                  >
                    {colTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                        style={{
                          background: 'var(--surface)',
                          borderRadius: 8,
                          padding: '10px 11px',
                          cursor: 'pointer',
                          border: `1px solid ${
                            selectedTask?.id === task.id ? 'var(--brand)' : 'var(--border)'
                          }`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        {task.client && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 1,
                                background: task.client.color ?? '#0d9488',
                                display: 'inline-block',
                              }}
                            />
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {task.client.name}
                            </span>
                          </div>
                        )}

                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            lineHeight: 1.4,
                          }}
                        >
                          {task.title}
                        </p>

                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 99,
                              background: `${col.color}18`,
                              color: col.color,
                              fontWeight: 600,
                            }}
                          >
                            {FREQ_LABEL[task.frequency ?? ''] ?? task.frequency ?? '—'}
                          </span>
                        </div>

                        {task.assignee && (
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            {task.assignee.name}
                          </p>
                        )}
                      </div>
                    ))}

                    {colTasks.length === 0 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          textAlign: 'center',
                          padding: '20px 0',
                          opacity: 0.5,
                        }}
                      >
                        No {col.label.toLowerCase()} tasks
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {viewTab === 'List' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Universal filter bar */}
          <UniversalFilterBar clients={clients} members={members} showSearch showPriority showAssignee showAssignor/>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderBottom: '1px solid var(--border-light)',
              background: 'var(--surface)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {visibleTasks.length} active · instances spawn automatically each morning at 7 AM IST
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 10rem 6rem 6rem 6rem 7rem 5rem 4.5rem',
              padding: '5px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-subtle)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            <span>Task</span>
            <span style={{ textAlign: 'center' }}>Frequency</span>
            <span style={{ textAlign: 'center' }}>Next due</span>
            <span style={{ textAlign: 'center' }}>Assignee</span>
            <span style={{ textAlign: 'center' }}>Approver</span>
            <span style={{ textAlign: 'center' }}>Assigned by</span>
            <span style={{ textAlign: 'center' }}>Client</span>
            <span />
          </div>

          {visibleTasks.length === 0 && !canManage && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <RefreshCw style={{ width: 36, height: 36, color: 'var(--border)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No recurring tasks yet</p>
            </div>
          )}
          {visibleTasks.length === 0 && canManage && (clientFilter || filterPriority || filterSearch || filterAssignee || filterCreator) && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 24px', color:'var(--text-muted)', textAlign:'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                style={{ marginBottom:12, opacity:0.3 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>No tasks match the active filters</div>
              <div style={{ fontSize:12 }}>Try clearing one or more filters above</div>
            </div>
          )}

          {visibleTasks.map((task) => {
            const isEditing = editingId === task.id
            const approver = members.find((m) => m.id === task.approver_id)

            if (isEditing) {
              return (
                <InlineRecurringTask
                  key={task.id}
                  members={members}
                  clients={clients}
                  currentUserId={currentUserId}
                  editTask={{
                    id: task.id,
                    title: task.title,
                    frequency: task.frequency ?? 'weekly_mon',
                    priority: task.priority,
                    assignee_id: task.assignee_id,
                    client_id: task.client_id,
                    approver_id: task.approver_id ?? null,
                  }}
                  onEdited={() => {
                    setEditingId(null)
                    startT(() => router.refresh())
                  }}
                  onCancelEdit={() => setEditingId(null)}
                />
              )
            }

            return (
              <div key={task.id} className="group" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 10rem 6rem 6rem 6rem 7rem 5rem 4.5rem',
                    alignItems: 'center',
                    padding: '0 18px',
                    minHeight: 38,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        await toggleSubExpand(task.id)
                      }}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        fontSize: 10,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {expandedSubs.has(task.id) ? '−' : '+'}
                    </button>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            flex: 1,
                          }}
                        >
                          {task.title}
                        </span>
                        <PriorityBadge priority={task.priority as any} />
                        {((task as any).custom_fields?._ca_compliance || (task as any).approval_required) && task.status !== 'completed' && (
                          <label
                            title={(task as any).custom_fields?._ca_compliance ? 'Upload compliance document' : 'Upload attachment'}
                            onClick={e => e.stopPropagation()}
                            style={{ flexShrink:0, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
                              width:18, height:18, borderRadius:4, opacity:0.5, transition:'opacity 0.15s, background 0.15s',
                              color:(task as any).custom_fields?._ca_compliance ? '#b45309' : 'var(--text-muted)' }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity='1'; el.style.background=(task as any).custom_fields?._ca_compliance?'rgba(234,179,8,0.15)':'var(--surface-subtle)' }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity='0.5'; el.style.background='transparent' }}
                          >
                            <input type="file" style={{ display:'none' }} onClick={e => e.stopPropagation()} onChange={async e => {
                              const file = e.target.files?.[0]; if (!file) return
                              const fd = new FormData(); fd.append('file', file)
                              const res = await fetch(`/api/tasks/${task.id}/attachments`, { method:'POST', body:fd })
                              if (res.ok) toast.success(`Uploaded: ${file.name} ✓`)
                              else toast.error('Upload failed')
                              e.target.value = ''
                            }}/>
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width:11, height:11 }}>
                              <path d="M8 10V3M5 6l3-3 3 3M3 13h10"/>
                            </svg>
                          </label>
                        )}
                      </div>

                      {task.project && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          <div
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 2,
                              background: task.project.color,
                            }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {task.project.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: 'var(--brand-light)',
                        color: 'var(--brand)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {FREQ_LABEL[task.frequency ?? ''] ?? task.frequency ?? '—'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    {task.next_occurrence_date ? fmtDate(task.next_occurrence_date) : '—'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {task.assignee ? (
                      <Avatar name={task.assignee.name} size="xs" />
                    ) : (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: '1.5px dashed var(--border)',
                        }}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {approver ? (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#7c3aed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 8,
                          fontWeight: 700,
                        }}
                        title={approver.name}
                      >
                        {approver.name?.[0]?.toUpperCase()}
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: '1.5px dashed var(--border)',
                        }}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' }}>
                    {task.creator ? (
                      <>
                        <User style={{ width: 10, height: 10, color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.creator.name}</span>
                      </>
                    ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    {task.client ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 2,
                            background: task.client.color,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            maxWidth: 60,
                          }}
                        >
                          {task.client.name}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                    {canManage && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingId(task.id)
                          }}
                          style={{
                            width: 26,
                            height: 26,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <Pencil style={{ width: 12, height: 12 }} />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(task.id)
                          }}
                          style={{
                            width: 26,
                            height: 26,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expandedSubs.has(task.id) && (
                  <div
                    style={{
                      background: 'var(--surface-subtle)',
                      borderTop: '1px solid var(--border-light)',
                    }}
                  >
                    {(subtaskMap[task.id] ?? []).map((sub: any) => (
                      <div
                        key={sub.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 18px 4px 60px',
                          borderBottom: '1px solid var(--border-light)',
                        }}
                      >
                        <button
                          onClick={() => toggleSubDone(task.id, sub.id, sub.status)}
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: '50%',
                            flexShrink: 0,
                            border: 'none',
                            background: sub.status === 'completed' ? 'var(--brand)' : 'transparent',
                            outline: `2px solid ${
                              sub.status === 'completed' ? 'var(--brand)' : 'var(--border)'
                            }`,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {sub.status === 'completed' && (
                            <svg viewBox="0 0 10 10" fill="none" style={{ width: 7, height: 7 }}>
                              <path
                                d="M1.5 5L4 7.5L8.5 2.5"
                                stroke="white"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </button>

                        <span
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color:
                              sub.status === 'completed'
                                ? 'var(--text-muted)'
                                : 'var(--text-primary)',
                            textDecoration:
                              sub.status === 'completed' ? 'line-through' : 'none',
                          }}
                        >
                          {sub.title}
                        </span>

                        {sub.status !== 'completed' && (
                          <label title="Upload document" style={{ cursor: 'pointer', flexShrink: 0 }}>
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                await uploadSubAttachment(sub.id, file)
                                e.target.value = ''
                              }}
                            />
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              style={{ width: 13, height: 13, color: 'var(--text-muted)' }}
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            >
                              <path d="M8 10V3M5 6l3-3 3 3M3 13h10" />
                            </svg>
                          </label>
                        )}
                      </div>
                    ))}

                    <div style={{ padding: '4px 18px 6px 60px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: '50%',
                            flexShrink: 0,
                            border: '1.5px dashed var(--brand)',
                            opacity: 0.5,
                          }}
                        />
                        <input
                          value={newSubInputs[task.id] ?? ''}
                          onChange={(e) =>
                            setNewSubInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                          }
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && (newSubInputs[task.id] ?? '').trim()) {
                              await addSubtask(task.id, newSubInputs[task.id], newSubAssignees[task.id], newSubDueDates[task.id])
                            }
                            if (e.key === 'Escape') {
                              setNewSubInputs((prev) => ({ ...prev, [task.id]: '' }))
                              setNewSubAssignees((prev) => ({ ...prev, [task.id]: '' }))
                              setNewSubDueDates((prev) => ({ ...prev, [task.id]: '' }))
                            }
                          }}
                          placeholder="Add subtask… (Enter)"
                          style={{
                            flex: 1,
                            fontSize: 12,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                      {(newSubInputs[task.id] ?? '').trim() && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, paddingLeft: 21 }}>
                        <select
                          value={newSubAssignees[task.id] ?? ''}
                          onChange={e => setNewSubAssignees(prev => ({ ...prev, [task.id]: e.target.value }))}
                          style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', background: 'var(--surface)', color: 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}
                        >
                          <option value=''>Assignee (optional)</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <input
                          type="date"
                          value={newSubDueDates[task.id] ?? ''}
                          onChange={e => setNewSubDueDates(prev => ({ ...prev, [task.id]: e.target.value }))}
                          style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', background: 'var(--surface)', color: 'var(--text-secondary)', fontFamily: 'inherit', colorScheme: 'light dark' }}
                        />
                        <button
                          onClick={async () => {
                            await addSubtask(task.id, newSubInputs[task.id], newSubAssignees[task.id], newSubDueDates[task.id])
                          }}
                          style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 6, border: 'none', background: 'var(--brand)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                        >Add</button>
                      </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {canManage && (
            <InlineRecurringTask
              members={members}
              clients={clients}
              currentUserId={currentUserId}
              onCreated={(newTask?: any) => {
                if (newTask) {
                  setLocalTasks((prev) => [...prev, newTask])
                }
                startT(() => router.refresh())
              }}
            />
          )}

          <p
            style={{
              fontSize: 11,
              textAlign: 'center',
              color: 'var(--text-muted)',
              marginTop: 8,
              padding: '0 0 12px',
            }}
          >
            ⏰ New instances are created each morning at 7:00 AM IST
          </p>

          <TaskDetailPanel
            task={selectedTask}
            members={members}
            clients={clients}
            currentUserId={currentUserId}
            userRole={userRole}
            onClose={() => setSelectedTask(null)}
            onUpdated={() => {
              setSelectedTask(null)
              startT(() => router.refresh())
            }}
          />
        </div>
      )}
    </div>
  )
}