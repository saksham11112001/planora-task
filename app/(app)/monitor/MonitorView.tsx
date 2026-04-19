'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Filter, BarChart2, Download, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { isOverdue, fmtDate } from '@/lib/utils/format'
import type { Task } from '@/types'

interface MonTask {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  is_recurring: boolean
  project_id: string | null
  client_id: string | null
  assignee_id: string | null
  approver_id: string | null
  approval_status: string | null
  custom_fields?: Record<string, any> | null
  created_at: string
  completed_at?: string | null
  updated_at?: string | null
  assignee: { id: string; name: string } | null
  approver: { id: string; name: string } | null
  creator: { id: string; name: string } | null
  client: { id: string; name: string; color: string } | null
  project: { id: string; name: string; color: string } | null
}

interface Props {
  tasks: MonTask[]
  members: { id: string; name: string }[]
  clients: { id: string; name: string; color: string }[]
  currentUserId: string
  userRole: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  todo:        { label: 'To do',            color: '#64748b', bg: '#f1f5f9' },
  in_progress: { label: 'In progress',      color: '#2563eb', bg: '#eff6ff' },
  in_review:   { label: 'Pending approval', color: '#7c3aed', bg: '#fdf4ff' },
  completed:   { label: 'Completed',        color: '#16a34a', bg: '#f0fdf4' },
  cancelled:   { label: 'Cancelled',        color: '#94a3b8', bg: '#f8fafc' },
}
const PRIORITY_DOT: Record<string, string> = {
  urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a', none: '#94a3b8',
}

function typeAccent(t: MonTask): string {
  if (t.custom_fields?._ca_compliance) return '#d97706'
  if (t.is_recurring)                  return '#0d9488'
  if (t.project_id)                    return '#7c3aed'
  return '#0891b2'
}
function typeBg(t: MonTask): string {
  if (t.custom_fields?._ca_compliance) return 'rgba(234,179,8,0.06)'
  if (t.is_recurring)                  return 'rgba(13,148,136,0.05)'
  if (t.project_id)                    return 'rgba(124,58,237,0.05)'
  return 'rgba(8,145,178,0.05)'
}
function typeLabel(t: MonTask): string {
  if (t.custom_fields?._ca_compliance) return 'CA'
  if (t.is_recurring)                  return 'Repeat'
  if (t.project_id)                    return 'Project'
  return 'Quick'
}

function todayStr()       { return new Date().toISOString().slice(0, 10) }
function addDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function subDays(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

const DUE_PRESETS = [
  { value: '1d',  label: 'Due today',  from: () => todayStr(),   to: () => addDays(1)  },
  { value: '3d',  label: 'Due in 3d', from: () => todayStr(),   to: () => addDays(3)  },
  { value: '1w',  label: 'Due in 1w', from: () => todayStr(),   to: () => addDays(7)  },
  { value: '15d', label: 'Due in 15d',from: () => todayStr(),   to: () => addDays(15) },
]
const PAST_PRESETS = [
  { value: 'today', label: 'Today',    from: () => todayStr(),   to: () => todayStr()  },
  { value: '7d',    label: 'Last 7d',  from: () => subDays(7),   to: () => todayStr()  },
  { value: '30d',   label: 'Last 30d', from: () => subDays(30),  to: () => todayStr()  },
  { value: '90d',   label: 'Last 90d', from: () => subDays(90),  to: () => todayStr()  },
]

// Shared dropdown style helper
function selectStyle(active: boolean) {
  return {
    fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
    border: active ? '1px solid var(--brand)' : '1px solid var(--border)',
    background: active ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)',
    color: active ? 'var(--brand)' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 400,
  } as React.CSSProperties
}

export function MonitorView({ tasks, members, clients, currentUserId, userRole }: Props) {
  const today = todayStr()

  // ── Filter state ──
  const [search,         setSearch]         = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterPrio,     setFilterPrio]     = useState('')
  const [filterClient,   setFilterClient]   = useState('')
  const [filterMember,   setFilterMember]   = useState('')
  const [filterType,     setFilterType]     = useState('')
  // ── Date filter state ──
  const [dateOpen,          setDateOpen]          = useState(false)
  const [duePreset,         setDuePreset]          = useState('')
  const [dueDateFrom,       setDueDateFrom]        = useState('')
  const [dueDateTo,         setDueDateTo]          = useState('')
  const [createdPreset,     setCreatedPreset]      = useState('')
  const [createdFrom,       setCreatedFrom]        = useState('')
  const [createdTo,         setCreatedTo]          = useState('')
  const [updatedPreset,     setUpdatedPreset]      = useState('')
  const [updatedFrom,       setUpdatedFrom]        = useState('')
  const [updatedTo,         setUpdatedTo]          = useState('')
  const [showCustomDue,     setShowCustomDue]      = useState(false)
  const [showCustomCreated, setShowCustomCreated]  = useState(false)
  const [showCustomUpdated, setShowCustomUpdated]  = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dateOpen) return
    function h(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [dateOpen])

  const hasDateFilter = !!(duePreset || dueDateFrom || createdPreset || createdFrom || updatedPreset || updatedFrom)
  const activeDateLabel = duePreset
    ? DUE_PRESETS.find(p => p.value === duePreset)?.label ?? 'Date'
    : dueDateFrom    ? 'Due: custom'
    : createdPreset  ? `Created: ${PAST_PRESETS.find(p => p.value === createdPreset)?.label ?? ''}`
    : createdFrom    ? 'Created: custom'
    : updatedPreset  ? `Modified: ${PAST_PRESETS.find(p => p.value === updatedPreset)?.label ?? ''}`
    : updatedFrom    ? 'Modified: custom'
    : 'Date'

  function clearDateFilters() {
    setDuePreset(''); setDueDateFrom(''); setDueDateTo(''); setShowCustomDue(false)
    setCreatedPreset(''); setCreatedFrom(''); setCreatedTo(''); setShowCustomCreated(false)
    setUpdatedPreset(''); setUpdatedFrom(''); setUpdatedTo(''); setShowCustomUpdated(false)
  }

  // ── UI state ──
  const [showChart,       setShowChart]       = useState(false)
  const [panelTask,       setPanelTask]       = useState<Task | null>(null)
  const [panelLoading,    setPanelLoading]    = useState(false)
  const [groupBy,         setGroupBy]         = useState<'status' | 'assignee' | 'client' | 'type' | 'none'>('status')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(k: string) {
    setCollapsedGroups(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s })
  }

  async function openTask(id: string) {
    setPanelLoading(true)
    try {
      const res  = await fetch(`/api/tasks/${id}`)
      const data = await res.json()
      if (data?.data) setPanelTask(data.data as Task)
    } finally { setPanelLoading(false) }
  }

  // ── Export ──
  function exportToExcel() {
    const headers = ['Title', 'Status', 'Priority', 'Type', 'Assignee', 'Client', 'Due Date', 'Created', 'Updated']
    const rows = visible.map(t => [
      `"${(t.title ?? '').replace(/"/g, '""')}"`,
      STATUS_CONFIG[t.status]?.label ?? t.status,
      t.priority,
      typeLabel(t),
      t.assignee?.name ?? '',
      t.client?.name ?? '',
      t.due_date ?? '',
      t.created_at?.slice(0, 10) ?? '',
      (t.updated_at ?? t.created_at)?.slice(0, 10) ?? '',
    ].join(','))
    const csv  = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'application/vnd.ms-excel' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `monitor_export_${today}.xls`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filtering ──
  const visible = useMemo(() => {
    return tasks.filter(t => {
      if (search        && !t.title.toLowerCase().includes(search.toLowerCase()))         return false
      if (filterStatus  && t.status    !== filterStatus)                                  return false
      if (filterPrio    && t.priority  !== filterPrio)                                    return false
      if (filterClient  && t.client_id !== filterClient)                                  return false
      if (filterMember  && t.assignee_id !== filterMember)                                return false
      if (filterType === 'ca'        && !t.custom_fields?._ca_compliance)                return false
      if (filterType === 'recurring' && !t.is_recurring)                                  return false
      if (filterType === 'project'   && !t.project_id)                                   return false
      if (filterType === 'quick'     && (t.project_id || t.is_recurring || t.custom_fields?._ca_compliance)) return false
      // Due date range
      if (dueDateFrom && (!t.due_date || t.due_date < dueDateFrom)) return false
      if (dueDateTo   && (!t.due_date || t.due_date > dueDateTo))   return false
      // Created date range
      const createdDate = t.created_at?.slice(0, 10) ?? ''
      if (createdFrom && createdDate < createdFrom) return false
      if (createdTo   && createdDate > createdTo)   return false
      // Modified date range
      const updatedDate = (t.updated_at ?? t.created_at)?.slice(0, 10) ?? ''
      if (updatedFrom && updatedDate < updatedFrom) return false
      if (updatedTo   && updatedDate > updatedTo)   return false
      return true
    })
  }, [tasks, search, filterStatus, filterPrio, filterClient, filterMember, filterType,
      dueDateFrom, dueDateTo, createdFrom, createdTo, updatedFrom, updatedTo])

  // ── Stats ──
  const stats = useMemo(() => {
    const all = tasks
    return {
      total:      all.length,
      todo:       all.filter(t => t.status === 'todo').length,
      inProgress: all.filter(t => t.status === 'in_progress').length,
      inReview:   all.filter(t => t.status === 'in_review').length,
      completed:  all.filter(t => t.status === 'completed').length,
      overdue:    all.filter(t => !!t.due_date && t.due_date < today && !['completed', 'cancelled'].includes(t.status)).length,
      ca:         all.filter(t => t.custom_fields?._ca_compliance).length,
      recurring:  all.filter(t => t.is_recurring).length,
      unassigned: all.filter(t => !t.assignee_id).length,
    }
  }, [tasks, today])

  // ── Trend data (last 14 days, derived from full task list) ──
  const trendData = useMemo(() => {
    const DAYS = 14
    const result = []
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const label   = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      result.push({
        date:      label,
        created:   tasks.filter(t => t.created_at?.slice(0, 10) === dateStr).length,
        completed: tasks.filter(t => t.completed_at?.slice(0, 10) === dateStr).length,
      })
    }
    return result
  }, [tasks])

  // ── Grouping ──
  const groups = useMemo<{ key: string; label: string; color: string; tasks: MonTask[] }[]>(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All tasks', color: 'var(--brand)', tasks: visible }]
    if (groupBy === 'status') {
      return ['todo', 'in_progress', 'in_review', 'completed', 'cancelled']
        .map(s => ({ key: s, label: STATUS_CONFIG[s]?.label ?? s, color: STATUS_CONFIG[s]?.color ?? '#94a3b8', tasks: visible.filter(t => t.status === s) }))
        .filter(g => g.tasks.length > 0)
    }
    if (groupBy === 'assignee') {
      const map: Record<string, MonTask[]> = {}
      visible.forEach(t => { const k = t.assignee?.name ?? '⊘ Unassigned'; (map[k] ??= []).push(t) })
      return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
        .map(([k, ts]) => ({ key: k, label: k, color: '#0d9488', tasks: ts }))
    }
    if (groupBy === 'client') {
      const map: Record<string, MonTask[]> = {}
      visible.forEach(t => { const k = t.client?.name ?? '⊘ No client'; (map[k] ??= []).push(t) })
      return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
        .map(([k, ts]) => ({ key: k, label: k, color: ts[0]?.client?.color ?? '#94a3b8', tasks: ts }))
    }
    if (groupBy === 'type') {
      return [
        { key: 'ca',        label: 'CA Compliance', color: '#d97706', tasks: visible.filter(t => t.custom_fields?._ca_compliance) },
        { key: 'recurring', label: 'Repeat tasks',  color: '#0d9488', tasks: visible.filter(t => t.is_recurring && !t.custom_fields?._ca_compliance) },
        { key: 'project',   label: 'Project tasks', color: '#7c3aed', tasks: visible.filter(t => !!t.project_id && !t.is_recurring && !t.custom_fields?._ca_compliance) },
        { key: 'quick',     label: 'Quick tasks',   color: '#0891b2', tasks: visible.filter(t => !t.project_id && !t.is_recurring && !t.custom_fields?._ca_compliance) },
      ].filter(g => g.tasks.length > 0)
    }
    return [{ key: 'all', label: 'All tasks', color: 'var(--brand)', tasks: visible }]
  }, [visible, groupBy])

  const activeFilters = [
    search, filterStatus, filterPrio, filterClient, filterMember, filterType,
    duePreset || dueDateFrom, createdPreset || createdFrom, updatedPreset || updatedFrom,
  ].filter(Boolean).length

  function clearFilters() {
    setSearch(''); setFilterStatus(''); setFilterPrio(''); setFilterClient('')
    setFilterMember(''); setFilterType('')
    clearDateFilters()
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden', height: '100%' }}>

      {/* ── Page header ── */}
      <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(13,148,136,0.12)',
            border: '1px solid rgba(13,148,136,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 style={{ width: 18, height: 18, color: '#0d9488' }}/>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Monitor</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Read-only view of all tasks across the organisation</p>
          </div>
          {/* Chart toggle */}
          <button onClick={() => setShowChart(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
              border: showChart ? '1px solid var(--brand)' : '1px solid var(--border)',
              background: showChart ? 'rgba(13,148,136,0.1)' : 'var(--surface-subtle)',
              color: showChart ? 'var(--brand)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: showChart ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            <BarChart2 style={{ width: 13, height: 13 }}/>
            {showChart ? 'Hide chart' : 'Show chart'}
          </button>
          {/* Export */}
          <button onClick={exportToExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
              border: '1px solid var(--brand)', background: 'rgba(13,148,136,0.1)',
              color: 'var(--brand)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Download style={{ width: 13, height: 13 }}/> Export Excel
          </button>
        </div>

        {/* ── Stats bar ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',       value: stats.total,      color: '#0d9488', bg: 'rgba(13,148,136,0.1)',  border: 'rgba(13,148,136,0.25)' },
            { label: 'To do',       value: stats.todo,       color: '#64748b', bg: 'var(--surface-subtle)', border: 'var(--border)'         },
            { label: 'In progress', value: stats.inProgress, color: '#2563eb', bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.25)'  },
            { label: 'In review',   value: stats.inReview,   color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)' },
            { label: 'Completed',   value: stats.completed,  color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.25)'  },
            { label: 'Overdue',     value: stats.overdue,    color: stats.overdue > 0 ? '#dc2626' : '#94a3b8', bg: stats.overdue > 0 ? 'rgba(220,38,38,0.08)' : 'var(--surface-subtle)', border: stats.overdue > 0 ? 'rgba(220,38,38,0.25)' : 'var(--border)' },
            { label: 'Unassigned',  value: stats.unassigned, color: stats.unassigned > 0 ? '#d97706' : '#94a3b8', bg: stats.unassigned > 0 ? 'rgba(234,179,8,0.08)' : 'var(--surface-subtle)', border: stats.unassigned > 0 ? 'rgba(234,179,8,0.25)' : 'var(--border)' },
            { label: 'CA',          value: stats.ca,         color: '#d97706', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.25)'  },
          ].map(s => (
            <div key={s.label} style={{ padding: '6px 12px', borderRadius: 8, background: s.bg, border: `1px solid ${s.border}` }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: s.color, display: 'block', lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginTop: 1 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Chart (collapsible) ── */}
        {showChart && (
          <div style={{ marginTop: 16, padding: '12px 0 4px', borderTop: '1px solid var(--border-light)' }}>

            {/* ── Distribution bar charts ── */}
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task distribution</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>By status</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={[
                    { name: 'To do',       value: stats.todo,       fill: '#64748b' },
                    { name: 'In progress', value: stats.inProgress, fill: '#2563eb' },
                    { name: 'In review',   value: stats.inReview,   fill: '#7c3aed' },
                    { name: 'Completed',   value: stats.completed,  fill: '#16a34a' },
                  ]} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={32}/>
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false}/>
                    <Tooltip contentStyle={{ fontSize: 11 }}/>
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {[{ fill: '#64748b' }, { fill: '#2563eb' }, { fill: '#7c3aed' }, { fill: '#16a34a' }]
                        .map((e, i) => <Cell key={i} fill={e.fill}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>By type</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={[
                    { name: 'CA',      value: stats.ca,        fill: '#d97706' },
                    { name: 'Repeat',  value: stats.recurring, fill: '#0d9488' },
                    { name: 'Project', value: tasks.filter(t => !!t.project_id && !t.is_recurring && !t.custom_fields?._ca_compliance).length, fill: '#7c3aed' },
                    { name: 'Quick',   value: tasks.filter(t => !t.project_id && !t.is_recurring && !t.custom_fields?._ca_compliance).length,  fill: '#0891b2' },
                    { name: 'Overdue', value: stats.overdue,   fill: '#dc2626' },
                  ]} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }}/>
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false}/>
                    <Tooltip contentStyle={{ fontSize: 11 }}/>
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {[{ fill: '#d97706' }, { fill: '#0d9488' }, { fill: '#7c3aed' }, { fill: '#0891b2' }, { fill: '#dc2626' }]
                        .map((e, i) => <Cell key={i} fill={e.fill}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Activity trend line graphs (last 14 days) ── */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity trends — last 14 days</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Tasks created per day */}
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Tasks created</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} interval={1} angle={-30} textAnchor="end" height={36}/>
                      <YAxis tick={{ fontSize: 9 }} allowDecimals={false}/>
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        formatter={(v: number) => [v, 'Created']}
                      />
                      <Line
                        type="monotone" dataKey="created" stroke="#0d9488" strokeWidth={2}
                        dot={{ r: 3, fill: '#0d9488', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Tasks completed per day */}
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Tasks completed</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} interval={1} angle={-30} textAnchor="end" height={36}/>
                      <YAxis tick={{ fontSize: 9 }} allowDecimals={false}/>
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        formatter={(v: number) => [v, 'Completed']}
                      />
                      <Line
                        type="monotone" dataKey="completed" stroke="#16a34a" strokeWidth={2}
                        dot={{ r: 3, fill: '#16a34a', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

              </div>

              {/* Combined created vs completed */}
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Created vs completed</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 8 }} interval={1} angle={-30} textAnchor="end" height={36}/>
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false}/>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}/>
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }}/>
                    <Line type="monotone" dataKey="created"   name="Created"   stroke="#0d9488" strokeWidth={2} dot={{ r: 2.5, fill: '#0d9488', strokeWidth: 0 }} activeDot={{ r: 4 }}/>
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#16a34a" strokeWidth={2} dot={{ r: 2.5, fill: '#16a34a', strokeWidth: 0 }} activeDot={{ r: 4 }} strokeDasharray="4 2"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Filters & group-by bar ── */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-subtle)',
          border: '1px solid var(--border)', borderRadius: 20, padding: '4px 10px', flex: '1 1 160px', maxWidth: 240 }}>
          <Search style={{ width: 12, height: 12, color: 'var(--text-muted)', flexShrink: 0 }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
            style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontFamily: 'inherit' }}/>
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}>×</button>}
        </div>

        {/* Status */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle(!!filterStatus)}>
          <option value=''>All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Priority */}
        <select value={filterPrio} onChange={e => setFilterPrio(e.target.value)} style={selectStyle(!!filterPrio)}>
          <option value=''>All priorities</option>
          {['urgent', 'high', 'medium', 'low', 'none'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>

        {/* Assignee */}
        {members.length > 0 && (
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)} style={selectStyle(!!filterMember)}>
            <option value=''>All members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}

        {/* Client */}
        {clients.length > 0 && (
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={selectStyle(!!filterClient)}>
            <option value=''>All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {/* Type */}
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle(!!filterType)}>
          <option value=''>All types</option>
          <option value='ca'>CA Compliance</option>
          <option value='recurring'>Repeat tasks</option>
          <option value='project'>Project tasks</option>
          <option value='quick'>Quick tasks</option>
        </select>

        {/* Date filter — single button with dropdown panel */}
        <div ref={dateRef} style={{ position: 'relative' }}>
          <button onClick={() => setDateOpen(o => !o)}
            style={{ ...selectStyle(hasDateFilter), display: 'flex', alignItems: 'center', gap: 5, paddingRight: hasDateFilter ? 28 : 10 }}>
            <Calendar style={{ width: 11, height: 11, flexShrink: 0 }}/>
            {activeDateLabel}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.6 }}>
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          {hasDateFilter && (
            <button onClick={e => { e.stopPropagation(); clearDateFilters() }}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                width: 14, height: 14, borderRadius: '50%', border: 'none', background: 'var(--brand)',
                color: '#fff', fontSize: 9, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}
              title="Clear date filter">×</button>
          )}

          {dateOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)', padding: '10px 12px', minWidth: 260 }}>

              {/* Due date */}
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.07em', marginBottom: 6 }}>Due date</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {DUE_PRESETS.map(p => (
                    <button key={p.value}
                      onClick={() => {
                        if (duePreset === p.value) { setDuePreset(''); setDueDateFrom(''); setDueDateTo('') }
                        else { setDuePreset(p.value); setDueDateFrom(p.from()); setDueDateTo(p.to()); setShowCustomDue(false) }
                      }}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
                        fontFamily: 'inherit', fontWeight: duePreset === p.value ? 700 : 400,
                        background: duePreset === p.value ? 'var(--brand)' : 'var(--surface-subtle)',
                        color: duePreset === p.value ? '#fff' : 'var(--text-secondary)' }}>
                      {p.label}
                    </button>
                  ))}
                  <button onClick={() => { setShowCustomDue(o => !o); setDuePreset('') }}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: showCustomDue ? 700 : 400,
                      background: showCustomDue ? 'rgba(13,148,136,0.15)' : 'var(--surface-subtle)',
                      color: showCustomDue ? 'var(--brand)' : 'var(--text-secondary)' }}>Custom…</button>
                </div>
                {showCustomDue && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <input type="date" value={dueDateFrom} onChange={e => setDueDateFrom(e.target.value)}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)', color: 'var(--text-primary)', fontFamily: 'inherit', colorScheme: 'light dark' as any }}/>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
                    <input type="date" value={dueDateTo} onChange={e => setDueDateTo(e.target.value)}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)', color: 'var(--text-primary)', fontFamily: 'inherit', colorScheme: 'light dark' as any }}/>
                  </div>
                )}
              </div>

              {/* Created date */}
              <div style={{ marginBottom: 12, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.07em', marginBottom: 6 }}>Created date</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {PAST_PRESETS.map(p => (
                    <button key={p.value}
                      onClick={() => {
                        if (createdPreset === p.value) { setCreatedPreset(''); setCreatedFrom(''); setCreatedTo('') }
                        else { setCreatedPreset(p.value); setCreatedFrom(p.from()); setCreatedTo(p.to()); setShowCustomCreated(false) }
                      }}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
                        fontFamily: 'inherit', fontWeight: createdPreset === p.value ? 700 : 400,
                        background: createdPreset === p.value ? 'var(--brand)' : 'var(--surface-subtle)',
                        color: createdPreset === p.value ? '#fff' : 'var(--text-secondary)' }}>
                      {p.label}
                    </button>
                  ))}
                  <button onClick={() => { setShowCustomCreated(o => !o); setCreatedPreset('') }}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: showCustomCreated ? 700 : 400,
                      background: showCustomCreated ? 'rgba(13,148,136,0.15)' : 'var(--surface-subtle)',
                      color: showCustomCreated ? 'var(--brand)' : 'var(--text-secondary)' }}>Custom…</button>
                </div>
                {showCustomCreated && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <input type="date" value={createdFrom} onChange={e => setCreatedFrom(e.target.value)}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)', color: 'var(--text-primary)', fontFamily: 'inherit', colorScheme: 'light dark' as any }}/>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
                    <input type="date" value={createdTo} onChange={e => setCreatedTo(e.target.value)}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)', color: 'var(--text-primary)', fontFamily: 'inherit', colorScheme: 'light dark' as any }}/>
                  </div>
                )}
              </div>

              {/* Modified date */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.07em', marginBottom: 6 }}>Modified date</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {PAST_PRESETS.map(p => (
                    <button key={p.value}
                      onClick={() => {
                        if (updatedPreset === p.value) { setUpdatedPreset(''); setUpdatedFrom(''); setUpdatedTo('') }
                        else { setUpdatedPreset(p.value); setUpdatedFrom(p.from()); setUpdatedTo(p.to()); setShowCustomUpdated(false) }
                      }}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
                        fontFamily: 'inherit', fontWeight: updatedPreset === p.value ? 700 : 400,
                        background: updatedPreset === p.value ? 'var(--brand)' : 'var(--surface-subtle)',
                        color: updatedPreset === p.value ? '#fff' : 'var(--text-secondary)' }}>
                      {p.label}
                    </button>
                  ))}
                  <button onClick={() => { setShowCustomUpdated(o => !o); setUpdatedPreset('') }}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: showCustomUpdated ? 700 : 400,
                      background: showCustomUpdated ? 'rgba(13,148,136,0.15)' : 'var(--surface-subtle)',
                      color: showCustomUpdated ? 'var(--brand)' : 'var(--text-secondary)' }}>Custom…</button>
                </div>
                {showCustomUpdated && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <input type="date" value={updatedFrom} onChange={e => setUpdatedFrom(e.target.value)}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)', color: 'var(--text-primary)', fontFamily: 'inherit', colorScheme: 'light dark' as any }}/>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
                    <input type="date" value={updatedTo} onChange={e => setUpdatedTo(e.target.value)}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)', color: 'var(--text-primary)', fontFamily: 'inherit', colorScheme: 'light dark' as any }}/>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Clear */}
        {activeFilters > 0 && (
          <button onClick={clearFilters}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20,
              border: '1px solid #dc2626', background: 'rgba(220,38,38,0.06)', color: '#dc2626',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Clear ({activeFilters})
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }}/>

        {/* Result count */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {visible.length} task{visible.length !== 1 ? 's' : ''}
        </span>

        {/* Group by */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Group by</span>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as typeof groupBy)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value='status'>Status</option>
            <option value='assignee'>Assignee</option>
            <option value='client'>Client</option>
            <option value='type'>Type</option>
            <option value='none'>None</option>
          </select>
        </div>
      </div>

      {/* ── Table header ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 100px 90px 80px',
        gap: 0, padding: '6px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-subtle)', flexShrink: 0 }}>
        {['Task', 'Type', 'Priority', 'Status', 'Assignee', 'Due date'].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
        ))}
      </div>

      {/* ── Task list ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 24px', color: 'var(--text-muted)', textAlign: 'center' }}>
            <Filter style={{ width: 36, height: 36, opacity: 0.3, marginBottom: 12 }}/>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No tasks match the active filters</p>
            <p style={{ fontSize: 12 }}>Try clearing one or more filters above</p>
          </div>
        ) : groups.map(grp => (
          <div key={grp.key}>
            {/* Group header */}
            <button onClick={() => toggleGroup(grp.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '6px 24px',
                background: 'var(--surface-subtle)', border: 'none', borderBottom: '1px solid var(--border-light)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {collapsedGroups.has(grp.key) ? '▸' : '▾'}
              </span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: grp.color, flexShrink: 0 }}/>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{grp.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>({grp.tasks.length})</span>
            </button>

            {/* Group rows */}
            {!collapsedGroups.has(grp.key) && grp.tasks.map(task => {
              const accent = typeAccent(task)
              const bg     = typeBg(task)
              const sc     = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo
              const ov     = isOverdue(task.due_date, task.status)
              return (
                <div key={task.id}
                  onClick={() => openTask(task.id)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 100px 90px 80px',
                    alignItems: 'center', padding: '0 24px', minHeight: 38, cursor: 'pointer',
                    borderBottom: '1px solid var(--border-light)', borderLeft: `3px solid ${accent}`,
                    background: bg, transition: 'filter 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.filter = 'brightness(0.97)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.filter = 'none'}>

                  {/* Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '7px 0' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                    {task.client && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10,
                        color: 'var(--text-muted)', flexShrink: 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: task.client.color }}/>
                        {task.client.name}
                      </span>
                    )}
                  </div>

                  {/* Type */}
                  <span style={{ fontSize: 10, fontWeight: 700, color: accent }}>{typeLabel(task)}</span>

                  {/* Priority */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_DOT[task.priority] ?? '#94a3b8', flexShrink: 0 }}/>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                  </div>

                  {/* Status */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600,
                    padding: '2px 7px', borderRadius: 99, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                    {sc.label}
                  </span>

                  {/* Assignee */}
                  <span style={{ fontSize: 11, color: task.assignee ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontStyle: task.assignee ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.assignee?.name ?? '—'}
                  </span>

                  {/* Due date */}
                  <span style={{ fontSize: 11, fontWeight: ov ? 700 : 400, color: ov ? '#dc2626' : 'var(--text-secondary)' }}>
                    {fmtDate(task.due_date)}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Task detail panel */}
      <TaskDetailPanel
        task={panelTask}
        members={members}
        clients={clients}
        currentUserId={currentUserId}
        userRole="viewer"
        onClose={() => setPanelTask(null)}
        onUpdated={() => setPanelTask(null)}
      />
    </div>
  )
}
