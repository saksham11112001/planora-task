'use client'
import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, RefreshCw, Trash2, SortAsc, MessageCircle } from 'lucide-react'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { fmtDate, isOverdue } from '@/lib/utils/format'
import { toast } from '@/store/appStore'

/* ── Types ─────────────────────────────────────────────────────── */
interface CATask {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  approval_status: string | null
  assignee_id: string | null
  approver_id: string | null
  client_id: string | null
  created_by: string | null
  custom_fields?: Record<string, any> | null
  created_at: string
  updated_at?: string | null
  assignee: { id: string; name: string } | null
  client: { id: string; name: string; color: string } | null
  creator?: { id: string; name: string } | null
}

interface Props {
  userRole: string
  currentUserId: string
  members: { id: string; name: string; role?: string }[]
  clients: { id: string; name: string; color: string }[]
}

/* ── Constants ─────────────────────────────────────────────────── */
const PRIORITY_COLOR: Record<string, { bg: string; color: string }> = {
  urgent: { bg: '#fef2f2', color: '#dc2626' },
  high:   { bg: '#fff7ed', color: '#ea580c' },
  medium: { bg: '#fefce8', color: '#b45309' },
  low:    { bg: '#f0fdf4', color: '#16a34a' },
  none:   { bg: '#f1f5f9', color: '#64748b' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  todo:        { label: 'To do',           color: '#64748b', bg: '#f1f5f9' },
  in_progress: { label: 'In progress',     color: '#2563eb', bg: '#eff6ff' },
  in_review:   { label: 'Pending approval',color: '#7c3aed', bg: '#fdf4ff' },
  completed:   { label: 'Completed',       color: '#16a34a', bg: '#f0fdf4' },
  cancelled:   { label: 'Cancelled',       color: '#94a3b8', bg: '#f8fafc' },
}

const BOARD_COLS = [
  { key: 'todo',        label: 'To do',            color: '#64748b' },
  { key: 'in_progress', label: 'In progress',      color: '#2563eb' },
  { key: 'in_review',   label: 'Pending approval', color: '#7c3aed' },
  { key: 'completed',   label: 'Completed',        color: '#16a34a' },
]

/* ── Helper ────────────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().slice(0, 10) }

const SORT_OPTIONS: Array<['due_date' | 'created_at', string]> = [
  ['due_date',   'Due date'],
  ['created_at', 'Created date'],
]

export function CATasksView({ userRole, currentUserId, members, clients }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()

  const [tasks,       setTasks]       = useState<CATask[]>([])
  const [loading,     setLoading]     = useState(true)
  const [viewTab,     setViewTab]     = useState<'List' | 'Board'>('List')
  const [search,      setSearch]      = useState('')
  const [selTask,     setSelTask]     = useState<CATask | null>(null)
  const [checked,     setChecked]     = useState<Set<string>>(new Set())
  const [sortBy,      setSortBy]      = useState<'due_date' | 'created_at'>('due_date')
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('asc')
  const [sortOpen,    setSortOpen]    = useState(false)
  const [filterPrio,     setFilterPrio]     = useState('')
  const [filterClient,   setFilterClient]   = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')   // '' | 'unassigned' | memberId

  const [masterUpdatePrompt, setMasterUpdatePrompt] = useState<{
    assignmentClientId: string
    masterTaskTitle: string
    clientName: string
    newAssigneeId: string
    newAssigneeName: string
  } | null>(null)
  const [masterUpdating,  setMasterUpdating]  = useState(false)

  // Propagate assignee/approver/client changes to existing pending/todo instances
  const [propInstanceModal, setPropInstanceModal] = useState<{
    taskTitle: string
    clientId: string
    clientName: string
    fields: { assignee_id?: string | null; approver_id?: string | null; client_id?: string | null }
  } | null>(null)
  const [propInstanceUpdating, setPropInstanceUpdating] = useState(false)
  const [bulkAssignId,    setBulkAssignId]    = useState('')   // member id to bulk-assign to
  const [bulkAssigning,   setBulkAssigning]   = useState(false)
  const [filterQuick,     setFilterQuick]     = useState<'overdue' | 'week' | 'pending' | ''>('')  // quick health filter
  const [inlineEdit,      setInlineEdit]      = useState<{ taskId: string; field: string } | null>(null)

  const canManage = ['owner', 'admin', 'manager'].includes(userRole)

  /* ── Fetch CA compliance tasks ─────────────────────────────── */
  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all top-level tasks and filter for CA compliance on client side
      const res = await fetch('/api/tasks?top_level=true&limit=2000')
      const json = await res.json().catch(() => ({}))
      const all: any[] = json.data ?? json ?? []
      const caTasks = all.filter((t: any) => t.custom_fields?._ca_compliance === true)

      // Enrich with client data
      const clientMap: Record<string, { id: string; name: string; color: string }> = {}
      clients.forEach(c => { clientMap[c.id] = c })
      const memberMap: Record<string, { id: string; name: string }> = {}
      members.forEach(m => { memberMap[m.id] = m })

      const enriched: CATask[] = caTasks.map((t: any) => ({
        id:               t.id,
        title:            t.title ?? 'Untitled',
        status:           t.status ?? 'todo',
        priority:         t.priority ?? 'medium',
        due_date:         t.due_date ?? null,
        approval_status:  t.approval_status ?? null,
        assignee_id:      t.assignee_id ?? null,
        approver_id:      t.approver_id ?? null,
        client_id:        t.client_id ?? null,
        created_by:       t.created_by ?? null,
        custom_fields:    t.custom_fields ?? null,
        created_at:       t.created_at ?? '',
        updated_at:       t.updated_at ?? null,
        assignee:         t.assignee ?? (t.assignee_id ? (memberMap[t.assignee_id] ?? null) : null),
        client:           t.client ?? (t.client_id ? (clientMap[t.client_id] ?? null) : null),
        creator:          t.creator ?? null,
      }))
      setTasks(enriched)
    } catch (e) {
      console.error('[CATasksView] loadTasks failed:', e)
      toast.error('Failed to load compliance tasks — please refresh')
    }
    setLoading(false)
  }, [clients, members])

  useEffect(() => { loadTasks() }, [loadTasks])

  /* ── Optimistic status patch ───────────────────────────────── */
  async function patchStatus(taskId: string, newStatus: string) {
    const prevTasks   = tasks
    const prevSelTask = selTask
    setTasks(p => p.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    if (selTask?.id === taskId) setSelTask(p => p ? { ...p, status: newStatus } : null)
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setTasks(prevTasks)
      if (prevSelTask?.id === taskId) setSelTask(prevSelTask)
      toast.error(d.error ?? 'Update failed')
    }
    else startT(() => router.refresh())
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this CA compliance task?')) return
    const snap = [...tasks]
    setTasks(p => p.filter(t => t.id !== id))
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) { setTasks(snap); toast.error('Failed to delete') }
    else { toast.success('Deleted'); startT(() => router.refresh()) }
  }

  async function patchField(taskId: string, field: string, value: unknown) {
    setInlineEdit(null)
    const snap = [...tasks]
    const updates: Partial<CATask> = { [field]: value as any }
    if (field === 'assignee_id') {
      updates.assignee = value ? (members.find(m => m.id === value) ?? null) : null
    }
    setTasks(p => p.map(t => t.id === taskId ? { ...t, ...updates } : t))
    if (selTask?.id === taskId) setSelTask(p => p ? { ...p, ...updates } : null)
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    })
    if (!res.ok) {
      setTasks(snap)
      toast.error('Could not update task')
    }
  }

  async function bulkDelete() {
    const ids = [...checked]
    if (!ids.length || !confirm(`Delete ${ids.length} task${ids.length !== 1 ? 's' : ''}?`)) return
    setChecked(new Set())
    setTasks(p => p.filter(t => !ids.includes(t.id)))
    await Promise.all(ids.map(id => fetch(`/api/tasks/${id}`, { method: 'DELETE' })))
    toast.success(`${ids.length} task${ids.length !== 1 ? 's' : ''} deleted`)
    startT(() => router.refresh())
  }

  async function bulkAssign() {
    if (!bulkAssignId || !checked.size) return
    const ids = [...checked]
    const assignee = members.find(m => m.id === bulkAssignId)
    if (!assignee) return
    setBulkAssigning(true)
    // Optimistic update
    setTasks(p => p.map(t => checked.has(t.id)
      ? { ...t, assignee_id: bulkAssignId, assignee: { id: bulkAssignId, name: assignee.name } }
      : t
    ))
    const results = await Promise.allSettled(
      ids.map(id => fetch(`/api/tasks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: bulkAssignId }),
      }))
    )
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed > 0) toast.error(`${failed} task${failed !== 1 ? 's' : ''} could not be assigned`)
    else toast.success(`${ids.length} task${ids.length !== 1 ? 's' : ''} assigned to ${assignee.name}`)
    setChecked(new Set())
    setBulkAssignId('')
    setBulkAssigning(false)
    startT(() => router.refresh())
  }

  /* ── Update master (ca_client_assignments) after assignee change ── */
  async function doMasterUpdate(data: {
    assignmentClientId: string
    masterTaskTitle: string
    newAssigneeId: string
    newAssigneeName: string
  }) {
    setMasterUpdating(true)
    try {
      // Fetch all assignments for this client — response includes master_task.name join
      const res = await fetch(`/api/ca/assignments?client_id=${data.assignmentClientId}`)
      const json = await res.json().catch(() => ({}))
      const assignment = (json.data ?? []).find(
        (a: any) => a.master_task?.name?.toLowerCase() === data.masterTaskTitle.toLowerCase()
      )
      if (!assignment) {
        toast.error('Could not find the recurring assignment — please update it manually in Client Setup')
        setMasterUpdating(false)
        return
      }
      const patch = await fetch(`/api/ca/assignments/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: data.newAssigneeId }),
      })
      if (!patch.ok) {
        const d = await patch.json().catch(() => ({}))
        toast.error(d.error ?? 'Failed to update recurring assignment')
      } else {
        toast.success(`Recurring assignment updated — future "${data.masterTaskTitle}" tasks → ${data.newAssigneeName}`)
      }
    } catch {
      toast.error('Failed to update recurring assignment')
    }
    setMasterUpdating(false)
  }

  // Called from the confirmation popup (for reassignment of already-assigned tasks)
  async function updateMasterAssignment() {
    if (!masterUpdatePrompt) return
    const data = { ...masterUpdatePrompt }
    setMasterUpdatePrompt(null)
    await doMasterUpdate(data)
  }

  /* ── Propagate assignee/approver to all pending/todo instances ── */
  async function handlePropagateInstances() {
    if (!propInstanceModal) return
    setPropInstanceUpdating(true)
    try {
      const res = await fetch('/api/ca/propagate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_name:  propInstanceModal.taskTitle,
          client_id: propInstanceModal.clientId,
          fields:    propInstanceModal.fields,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to propagate changes')
      } else {
        const n = json.updated ?? 0
        toast.success(`Updated ${n} pending task${n !== 1 ? 's' : ''}`)
      }
    } catch {
      toast.error('Failed to propagate changes')
    }
    setPropInstanceUpdating(false)
    setPropInstanceModal(null)
  }

  /* ── Urgency chip helper ──────────────────────────────────── */
  function urgencyChip(due_date: string | null, status: string): { label: string; bg: string; color: string } | null {
    if (!due_date || status === 'completed' || status === 'cancelled') return null
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const due = new Date(due_date); due.setHours(0, 0, 0, 0)
    const diff = Math.round((due.getTime() - now.getTime()) / 86400000)
    if (diff < 0)  return { label: `Overdue ${Math.abs(diff)}d`, bg: '#fef2f2', color: '#dc2626' }
    if (diff === 0) return { label: 'Due today',                  bg: '#f0fdf4', color: '#0d9488' }
    if (diff <= 7)  return { label: `${diff}d left`,              bg: '#fefce8', color: '#b45309' }
    return null
  }

  /* ── Filtering + sorting ───────────────────────────────────── */
  const today = todayStr()

  /* ── Health stats (across all tasks, ignoring current filters) ── */
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const healthStats = {
    total:           tasks.length,
    overdue:         tasks.filter(t => t.due_date && t.due_date < today && !['completed', 'cancelled'].includes(t.status)).length,
    dueThisWeek:     tasks.filter(t => t.due_date && t.due_date >= today && t.due_date <= weekFromNow && t.status !== 'completed').length,
    pendingApproval: tasks.filter(t => t.status === 'in_review').length,
  }

  const visible = tasks
    .filter(t => {
      if (filterPrio   && t.priority  !== filterPrio)   return false
      if (filterClient && t.client_id !== filterClient) return false
      if (filterStatus && t.status    !== filterStatus) return false
      if (filterAssignee === 'unassigned' && t.assignee_id !== null) return false
      if (filterAssignee && filterAssignee !== 'unassigned' && t.assignee_id !== filterAssignee) return false
      // Quick health filters from stat tiles
      if (filterQuick === 'overdue'  && !(t.due_date && t.due_date < today && !['completed','cancelled'].includes(t.status))) return false
      if (filterQuick === 'week'     && !(t.due_date && t.due_date >= today && t.due_date <= weekFromNow && t.status !== 'completed')) return false
      if (filterQuick === 'pending'  && t.status !== 'in_review') return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const av = sortBy === 'due_date' ? (a.due_date ?? '9') : a.created_at
      const bv = sortBy === 'due_date' ? (b.due_date ?? '9') : b.created_at
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })

  const activeFilters = [filterPrio, filterClient, filterStatus, filterAssignee, search, filterQuick].filter(Boolean).length

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

      {/* TaskDetailPanel */}
      <TaskDetailPanel
        task={selTask as any}
        members={members}
        clients={clients}
        currentUserId={currentUserId}
        userRole={userRole}
        onClose={() => setSelTask(null)}
        onUpdated={fields => {
          if (fields && selTask) {
            // Enrich nested objects so the list updates immediately
            const enriched: Record<string, unknown> = { ...fields }
            if ('assignee_id' in fields) {
              const m = members.find(mb => mb.id === fields.assignee_id)
              enriched.assignee = m ? { id: m.id, name: m.name } : null
            }
            if ('client_id' in fields) {
              const c = clients.find(cl => cl.id === fields.client_id)
              enriched.client = c ? { id: c.id, name: c.name, color: c.color } : null
            }

            // ── Recurring-assignment prompt (update future tasks) ──
            // Only offered when the assignee changes on a CA task that has a client
            if (
              canManage &&
              'assignee_id' in fields &&
              fields.assignee_id &&
              fields.assignee_id !== selTask.assignee_id &&
              selTask.client_id
            ) {
              const assigneeMember = members.find(m => m.id === (fields.assignee_id as string))
              if (assigneeMember) {
                const promptData = {
                  assignmentClientId: selTask.client_id,
                  masterTaskTitle:    selTask.title,
                  clientName:         selTask.client?.name ?? 'this client',
                  newAssigneeId:      fields.assignee_id as string,
                  newAssigneeName:    assigneeMember.name,
                }
                if (selTask.assignee_id === null) {
                  // Task was unassigned — auto-update master assignment immediately (no popup)
                  doMasterUpdate(promptData)
                } else {
                  // Task was already assigned to someone — ask before overwriting master
                  setMasterUpdatePrompt(promptData)
                }
              }
            }

            // ── Propagation prompt (update existing pending/todo instances) ──
            // Offered when assignee, approver, OR client changes on a CA task that has a client
            if (canManage && selTask.client_id) {
              const assigneeChanged = 'assignee_id' in fields && fields.assignee_id !== selTask.assignee_id
              const approverChanged = 'approver_id' in fields && (fields.approver_id as any) !== selTask.approver_id
              const clientChanged   = 'client_id'   in fields && fields.client_id   !== selTask.client_id
              if (assigneeChanged || approverChanged || clientChanged) {
                const propFields: { assignee_id?: string | null; approver_id?: string | null; client_id?: string | null } = {}
                if (assigneeChanged) propFields.assignee_id = fields.assignee_id as string | null
                if (approverChanged) propFields.approver_id = fields.approver_id as string | null
                if (clientChanged)   propFields.client_id   = fields.client_id   as string | null
                setPropInstanceModal({
                  taskTitle:  selTask.title,
                  clientId:   selTask.client_id,
                  clientName: selTask.client?.name ?? 'this client',
                  fields:     propFields,
                })
              }
            }

            setTasks(p => p.map(t => t.id === selTask.id ? { ...t, ...enriched } as CATask : t))
            setSelTask(p => p ? { ...p, ...enriched } as CATask : null)
          }
          startT(() => router.refresh())
        }}
      />

      {/* ── Health stats bar — clickable to filter ── */}
      {!loading && tasks.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 18px',
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          flexShrink: 0, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {([
            { key: '',        label: 'Total tasks',      value: healthStats.total,           activeBg: 'var(--surface-subtle)', color: 'var(--text-primary)',  border: 'var(--border)' },
            { key: 'overdue', label: '🔴 Overdue',       value: healthStats.overdue,         activeBg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
            { key: 'week',    label: '⚠️ Due this week', value: healthStats.dueThisWeek,     activeBg: '#fefce8', color: '#b45309', border: '#fde68a' },
            { key: 'pending', label: '🔵 Pending approval', value: healthStats.pendingApproval, activeBg: '#fdf4ff', color: '#7c3aed', border: '#e9d5ff' },
          ] as { key: '' | 'overdue' | 'week' | 'pending'; label: string; value: number; activeBg: string; color: string; border: string }[]).map(stat => {
            const isActive = filterQuick === stat.key || (stat.key === '' && filterQuick === '')
            const hasValue = stat.value > 0 || stat.key === ''
            return (
              <button key={stat.label}
                onClick={() => setFilterQuick(stat.key === filterQuick ? '' : stat.key)}
                disabled={stat.key !== '' && stat.value === 0}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '6px 14px', borderRadius: 10, cursor: stat.key !== '' && stat.value === 0 ? 'default' : 'pointer',
                  background: isActive && hasValue ? stat.activeBg : 'var(--surface-subtle)',
                  border: `1.5px solid ${isActive && hasValue ? stat.color : 'var(--border)'}`,
                  boxShadow: isActive && hasValue ? `0 0 0 2px ${stat.color}22` : 'none',
                  minWidth: 90, gap: 2, fontFamily: 'inherit',
                  opacity: stat.key !== '' && stat.value === 0 ? 0.5 : 1,
                  transition: 'all 0.12s',
                }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: isActive && hasValue ? stat.color : 'var(--text-primary)', lineHeight: 1 }}>
                  {stat.value}
                </span>
                <span style={{ fontSize: 10, color: isActive && hasValue ? stat.color : 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {stat.label}
                </span>
              </button>
            )
          })}
          {filterQuick && (
            <button onClick={() => setFilterQuick('')}
              style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
              ✕ Clear filter
            </button>
          )}
        </div>
      )}

      {/* ── View toggle + toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 18px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* List / Board tabs */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {(['List', 'Board'] as const).map(tab => (
            <button key={tab} onClick={() => setViewTab(tab)}
              style={{
                padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: viewTab === tab ? 'var(--brand)' : 'transparent',
                color: viewTab === tab ? '#fff' : 'var(--text-muted)',
                fontFamily: 'inherit',
              }}>{tab}</button>
          ))}
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 160px', maxWidth: 240,
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '4px 10px',
        }}>
          <Search style={{ width: 12, height: 12, color: 'var(--text-muted)', flexShrink: 0 }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
            style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontFamily: 'inherit' }}/>
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}>×</button>}
        </div>

        {/* Priority filter */}
        <select value={filterPrio} onChange={e => setFilterPrio(e.target.value)}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: filterPrio ? '1px solid var(--brand)' : '1px solid var(--border)', background: filterPrio ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)', color: filterPrio ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer', fontWeight: filterPrio ? 600 : 400 }}>
          <option value=''>All priorities</option>
          {['urgent','high','medium','low','none'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>

        {/* Client filter */}
        {clients.length > 0 && (
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: filterClient ? '1px solid var(--brand)' : '1px solid var(--border)', background: filterClient ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)', color: filterClient ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer', fontWeight: filterClient ? 600 : 400 }}>
            <option value=''>All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: filterStatus ? '1px solid var(--brand)' : '1px solid var(--border)', background: filterStatus ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)', color: filterStatus ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer', fontWeight: filterStatus ? 600 : 400 }}>
          <option value=''>All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Assignee filter */}
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: filterAssignee ? '1px solid var(--brand)' : '1px solid var(--border)', background: filterAssignee ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)', color: filterAssignee ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer', fontWeight: filterAssignee ? 600 : 400 }}>
          <option value=''>All assignees</option>
          <option value='unassigned'>⊘ Unassigned</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {/* Sort */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setSortOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--surface-subtle)', fontFamily: 'inherit' }}>
            <SortAsc style={{ width: 12, height: 12 }}/>
            {sortBy === 'due_date' ? 'Due date' : 'Created'} {sortDir === 'asc' ? '↑' : '↓'}
          </button>
          {sortOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, padding: 8, minWidth: 150 }}
              onClick={e => e.stopPropagation()}>
              {SORT_OPTIONS.map(([val, label]) => (
                <button key={val}
                  onClick={() => { if (sortBy === val) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(val); setSortDir('asc') } setSortOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left', background: sortBy === val ? 'var(--brand-light)' : 'transparent', color: sortBy === val ? 'var(--brand)' : 'var(--text-primary)', fontSize: 12, fontWeight: sortBy === val ? 600 : 400, fontFamily: 'inherit' }}>
                  {label}{sortBy === val && <span style={{ fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear filters */}
        {activeFilters > 0 && (
          <button onClick={() => { setFilterPrio(''); setFilterClient(''); setFilterStatus(''); setFilterAssignee(''); setSearch(''); setFilterQuick('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, border: '1px solid #dc2626', background: 'rgba(220,38,38,0.06)', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Clear ({activeFilters})
          </button>
        )}

        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
          {visible.length} task{visible.length !== 1 ? 's' : ''}
        </span>

        <button onClick={loadTasks}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-subtle)', cursor: 'pointer', color: 'var(--text-muted)' }}
          title="Refresh">
          <RefreshCw style={{ width: 13, height: 13 }}/>
        </button>
      </div>

      {/* ── Bulk action bar ── */}
      {checked.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 18px', background: 'rgba(124,58,237,0.06)', borderBottom: '1px solid rgba(124,58,237,0.2)', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#5b21b6' }}>{checked.size} selected</span>

          {/* Bulk assign */}
          {canManage && members.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <select value={bulkAssignId} onChange={e => setBulkAssignId(e.target.value)}
                style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value=''>Assign to…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={bulkAssign} disabled={!bulkAssignId || bulkAssigning}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: bulkAssignId ? '#0d9488' : 'var(--border)', color: bulkAssignId ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: bulkAssignId ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                {bulkAssigning ? '…' : '✓ Assign'}
              </button>
            </div>
          )}

          {/* WhatsApp — per-client grouped messages */}
          <button
            onClick={() => {
              const selectedTasks = tasks.filter(t => checked.has(t.id))
              // Group by client
              const byClient = new Map<string, { clientName: string; tasks: CATask[] }>()
              selectedTasks.forEach(t => {
                const key = t.client_id ?? '__no_client__'
                const name = t.client?.name ?? 'General'
                if (!byClient.has(key)) byClient.set(key, { clientName: name, tasks: [] })
                byClient.get(key)!.tasks.push(t)
              })
              if (byClient.size === 1) {
                // Single client — one message
                const [{ clientName, tasks: ct }] = [...byClient.values()]
                const lines = ct.map(t => {
                  const due = t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD'
                  return `• ${t.title} — due ${due}`
                })
                const msg = `Dear ${clientName},\n\nThis is a reminder for the following pending compliance tasks:\n\n${lines.join('\n')}\n\nKindly arrange the required documents at the earliest.\n\nRegards`
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
              } else {
                // Multiple clients — open one tab per client (up to 5)
                const entries = [...byClient.values()].slice(0, 5)
                entries.forEach(({ clientName, tasks: ct }) => {
                  const lines = ct.map(t => {
                    const due = t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD'
                    return `• ${t.title} — due ${due}`
                  })
                  const msg = `Dear ${clientName},\n\nThis is a reminder for the following pending compliance tasks:\n\n${lines.join('\n')}\n\nKindly arrange the required documents at the earliest.\n\nRegards`
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                })
                if (byClient.size > 5) toast.info(`Opened 5 of ${byClient.size} client chats — deselect some and retry for the rest`)
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <MessageCircle style={{ width: 13, height: 13 }}/> WhatsApp
          </button>

          {canManage && (
            <button onClick={bulkDelete}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: 'none', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Trash2 style={{ width: 12, height: 12 }}/> Delete
            </button>
          )}

          <button onClick={() => setChecked(new Set(visible.map(t => t.id)))}
            style={{ background: 'transparent', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Select all
          </button>
          <button onClick={() => { setChecked(new Set()); setBulkAssignId('') }}
            style={{ padding: '4px 10px', background: 'transparent', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Cancel
          </button>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: '#d97706', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
          Loading CA compliance tasks…
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ─────────────── LIST VIEW ─────────────── */}
      {!loading && viewTab === 'List' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 80px 80px 80px 80px 60px',
            padding: '5px 18px', borderBottom: '1px solid var(--border)',
            background: 'var(--surface-subtle)', flexShrink: 0,
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <input type="checkbox"
              checked={visible.length > 0 && visible.every(t => checked.has(t.id))}
              onChange={e => setChecked(e.target.checked ? new Set(visible.map(t => t.id)) : new Set())}
              style={{ width: 13, height: 13, accentColor: 'var(--brand)', cursor: 'pointer' }}/>
            <span>Task</span>
            <span style={{ textAlign: 'center' }}>Status</span>
            <span style={{ textAlign: 'center' }}>Priority</span>
            <span style={{ textAlign: 'center' }}>Assignee</span>
            <span style={{ textAlign: 'center' }}>Due date</span>
            <span/>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {visible.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', color: 'var(--text-muted)', textAlign: 'center' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.3 }}>
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                  {activeFilters > 0 ? 'No tasks match the active filters' : 'No CA compliance tasks found'}
                </div>
                <div style={{ fontSize: 12 }}>CA compliance tasks are auto-created by the system</div>
              </div>
            )}

            {visible.map(task => {
              const ov = isOverdue(task.due_date, task.status)
              const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo
              const pc = PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.none
              return (
                <div key={task.id} className="group"
                  style={{
                    display: 'grid', gridTemplateColumns: '28px 1fr 80px 80px 80px 80px 60px',
                    alignItems: 'center', padding: '0 18px', minHeight: 38,
                    borderBottom: '1px solid var(--border-light)', cursor: 'pointer',
                    background: checked.has(task.id) ? 'var(--brand-light)' : 'rgba(234,179,8,0.04)',
                    borderLeft: '3px solid rgba(217,119,6,0.5)',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => setSelTask(task)}>

                  <input type="checkbox" checked={checked.has(task.id)}
                    onChange={() => setChecked(p => { const s = new Set(p); s.has(task.id) ? s.delete(task.id) : s.add(task.id); return s })}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 13, height: 13, accentColor: 'var(--brand)', cursor: 'pointer' }}/>

                  {/* Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '6px 0' }}>
                    {/* Status circle */}
                    <button
                      onClick={e => { e.stopPropagation(); patchStatus(task.id, task.status === 'completed' ? 'todo' : 'completed') }}
                      title={task.status === 'completed' ? 'Mark as to do' : 'Mark as completed'}
                      style={{
                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: task.status === 'completed' ? '#0d9488' : 'transparent',
                        outline: `2px solid ${task.status === 'completed' ? '#0d9488' : 'var(--border)'}`,
                      }}>
                      {task.status === 'completed' && (
                        <svg viewBox="0 0 10 10" fill="none" style={{ width: 7, height: 7 }}>
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>

                    {/* CA badge */}
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#d97706', flexShrink: 0, letterSpacing: '0.04em' }}>CA</span>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 500, margin: 0,
                        color: task.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{task.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                        {task.client && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 1, background: task.client.color, display: 'inline-block', flexShrink: 0 }}/>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{task.client.name}</span>
                          </div>
                        )}
                        {(() => { const chip = urgencyChip(task.due_date, task.status); return chip && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: chip.bg, color: chip.color, flexShrink: 0 }}>
                            {chip.label}
                          </span>
                        )})()}
                      </div>
                    </div>
                  </div>

                  {/* Status pill */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <select
                      value={task.status}
                      onChange={e => { e.stopPropagation(); patchStatus(task.id, e.target.value) }}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, border: 'none', cursor: 'pointer', background: sc.bg, color: sc.color, fontFamily: 'inherit', appearance: 'none', textAlign: 'center' }}>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>

                  {/* Priority */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: pc.bg, color: pc.color }}>
                      {task.priority}
                    </span>
                  </div>

                  {/* Assignee — inline editable */}
                  <div style={{ display: 'flex', justifyContent: 'center', cursor: canManage ? 'pointer' : 'default' }}
                    onClick={e => { e.stopPropagation(); if (canManage) setInlineEdit({ taskId: task.id, field: 'assignee_id' }) }}>
                    {inlineEdit?.taskId === task.id && inlineEdit.field === 'assignee_id' ? (
                      <select autoFocus defaultValue={task.assignee_id ?? ''}
                        onChange={e => patchField(task.id, 'assignee_id', e.target.value || null)}
                        onBlur={() => setInlineEdit(null)}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, padding: '2px 5px', borderRadius: 6, border: '1px solid var(--brand)',
                          background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none',
                          fontFamily: 'inherit', maxWidth: 80, cursor: 'pointer' }}>
                        <option value="">Unassigned</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>)}
                      </select>
                    ) : task.assignee ? (
                      <span title={canManage ? 'Click to reassign' : undefined}
                        style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: 'var(--surface-subtle)', border: '1px solid var(--border)', color: 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 74 }}>
                        {task.assignee.name.split(' ')[0]}
                      </span>
                    ) : (
                      <div title={canManage ? 'Click to assign' : undefined}
                        style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed var(--border)' }}/>
                    )}
                  </div>

                  {/* Due date — inline editable */}
                  <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: ov ? '#dc2626' : 'var(--text-muted)', cursor: canManage ? 'pointer' : 'default' }}
                    onClick={e => { e.stopPropagation(); if (canManage) setInlineEdit({ taskId: task.id, field: 'due_date' }) }}>
                    {inlineEdit?.taskId === task.id && inlineEdit.field === 'due_date' ? (
                      <input autoFocus type="date" defaultValue={task.due_date ?? ''}
                        onChange={e => patchField(task.id, 'due_date', e.target.value || null)}
                        onBlur={() => setInlineEdit(null)}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, padding: '1px 4px', borderRadius: 5, border: '1px solid var(--brand)',
                          background: 'var(--surface)', outline: 'none', colorScheme: 'light dark', fontFamily: 'inherit' }}/>
                    ) : task.due_date ? (
                      <span title={canManage ? 'Click to change due date' : undefined}
                        style={{ padding: '2px 6px', borderRadius: 6, background: ov ? '#fef2f2' : 'transparent' }}>
                        {fmtDate(task.due_date)}
                      </span>
                    ) : (
                      <span title={canManage ? 'Click to set due date' : undefined}>—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {canManage && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(task.id) }}
                        style={{ opacity: 0, width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }}
                        className="group-hover:opacity-100"
                        title="Delete">
                        <Trash2 style={{ width: 12, height: 12 }}/>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─────────────── UPDATE MASTER POPUP ─────────────── */}
      {masterUpdatePrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => !masterUpdating && setMasterUpdatePrompt(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              padding: '28px 28px 22px', maxWidth: 420, width: '90%',
              border: '1px solid var(--border)',
            }}>
            {/* Icon + heading */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'rgba(217,119,6,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                  Update recurring assignment?
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  You assigned <strong style={{ color: 'var(--text-primary)' }}>{masterUpdatePrompt.newAssigneeName}</strong> to this task.
                  Would you also like to update the recurring CA assignment for{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{masterUpdatePrompt.clientName}</strong> so all future{' '}
                  <em>"{masterUpdatePrompt.masterTaskTitle}"</em> tasks are assigned to them too?
                </p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', margin: '0 0 18px' }}/>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMasterUpdatePrompt(null)}
                disabled={masterUpdating}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: masterUpdating ? 0.5 : 1,
                }}>
                No, just this task
              </button>
              <button
                onClick={updateMasterAssignment}
                disabled={masterUpdating}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#d97706', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: masterUpdating ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                  opacity: masterUpdating ? 0.7 : 1,
                }}>
                {masterUpdating && (
                  <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
                )}
                Yes, update assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────── PROPAGATE-TO-INSTANCES MODAL ─────────────── */}
      {propInstanceModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 210,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => !propInstanceUpdating && setPropInstanceModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              padding: '28px 28px 22px', maxWidth: 440, width: '90%',
              border: '1px solid var(--border)',
            }}>
            {/* Icon + heading */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'rgba(13,148,136,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                  Update pending tasks?
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {(() => {
                    const f = propInstanceModal.fields
                    const parts: string[] = []
                    if (f.assignee_id !== undefined && f.approver_id !== undefined) parts.push('the assignee and approver')
                    else if (f.assignee_id !== undefined) parts.push('the assignee')
                    else if (f.approver_id !== undefined) parts.push('the approver')
                    if (f.client_id !== undefined) parts.push('the client')
                    const changed = parts.length > 0
                      ? parts.join(' and ') + (parts.length === 1 ? ' was' : ' were') + ' changed.'
                      : 'Fields were changed.'
                    return changed.charAt(0).toUpperCase() + changed.slice(1)
                  })()}
                  {' '}Would you like to apply this to all pending &amp; in-progress{' '}
                  <em>&quot;{propInstanceModal.taskTitle}&quot;</em> tasks for{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{propInstanceModal.clientName}</strong>?
                </p>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '0 0 18px' }}/>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPropInstanceModal(null)}
                disabled={propInstanceUpdating}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: propInstanceUpdating ? 0.5 : 1,
                }}>
                No, just this task
              </button>
              <button
                onClick={handlePropagateInstances}
                disabled={propInstanceUpdating}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#0d9488', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: propInstanceUpdating ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                  opacity: propInstanceUpdating ? 0.7 : 1,
                }}>
                {propInstanceUpdating && (
                  <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
                )}
                Yes, update pending tasks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────── BOARD VIEW ─────────────── */}
      {!loading && viewTab === 'Board' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            flex: 1, display: 'flex', gap: 12, padding: '14px 18px',
            overflowX: 'auto', overflowY: 'hidden',
            background: 'var(--surface-subtle)', alignItems: 'flex-start',
          }}>
            {BOARD_COLS.map(col => {
              const colTasks = visible.filter(t => {
                if (col.key === 'todo') return t.status === 'todo' || t.status === 'cancelled'
                return t.status === col.key
              }).filter(t => col.key !== 'todo' || t.status !== 'cancelled')
                // cancelled in its own bucket? Actually let's just group cancelled with todo for simplicity
              // Re-do: each status in its own column exactly
              const exactTasks = visible.filter(t => t.status === col.key)
              return exactTasks
            }).map((colTasks, ci) => {
              const col = BOARD_COLS[ci]
              return (
                <div key={col.key} style={{
                  minWidth: 230, flex: '0 0 240px', background: 'var(--surface)',
                  borderRadius: 12, border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', maxHeight: '100%',
                }}>
                  {/* Column header */}
                  <div style={{ padding: '11px 13px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0, display: 'inline-block' }}/>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{col.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {visible.filter(t => t.status === col.key).length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', flex: 1 }}>
                    {visible.filter(t => t.status === col.key).length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', opacity: 0.5 }}>
                        No tasks
                      </div>
                    ) : visible.filter(t => t.status === col.key).map(task => {
                      const ov = isOverdue(task.due_date, task.status)
                      const pc = PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.none
                      return (
                        <div key={task.id}
                          onClick={() => setSelTask(task)}
                          style={{
                            background: 'var(--surface)', borderRadius: 8, padding: '9px 10px',
                            cursor: 'pointer', border: '1px solid var(--border)',
                            borderLeft: '3px solid rgba(217,119,6,0.5)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'box-shadow 0.12s',
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 10px rgba(0,0,0,0.1)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}>

                          {/* Client chip */}
                          {task.client && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: 1, background: task.client.color, flexShrink: 0, display: 'inline-block' }}/>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{task.client.name}</span>
                            </div>
                          )}

                          {/* Title */}
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.title}
                          </p>

                          {/* Meta row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: pc.bg, color: pc.color }}>
                              {task.priority}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#d97706' }}>CA</span>
                            {task.due_date && (
                              <span style={{ fontSize: 10, color: ov ? '#dc2626' : 'var(--text-muted)', marginLeft: 'auto', fontWeight: ov ? 700 : 400 }}>
                                {fmtDate(task.due_date)}
                              </span>
                            )}
                          </div>

                          {/* Assignee */}
                          {task.assignee && (
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '5px 0 0' }}>
                              {task.assignee.name.split(' ')[0]}
                            </p>
                          )}

                          {/* Status selector */}
                          <select
                            value={task.status}
                            onChange={e => { e.stopPropagation(); patchStatus(task.id, e.target.value) }}
                            onClick={e => e.stopPropagation()}
                            style={{ marginTop: 7, width: '100%', fontSize: 10, fontWeight: 700, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
