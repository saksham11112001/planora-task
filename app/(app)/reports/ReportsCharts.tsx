'use client'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import { useFilterStore } from '@/store/appStore'
import { UniversalFilterBar } from '@/components/filters/UniversalFilterBar'

interface EmployeeStat {
  uid: string; name: string; email: string; role: string
  total: number; completed: number; overdue: number
  inReview: number
  onTimeRate: number | null; avgDays: number | null
  hoursLogged: number; urgentHigh: number
  completionRate: number
  weeklyTrend: { week: string; completed: number; assigned: number }[]
}

interface ComplianceDayData {
  date: string; dateKey: string
  addedC: number; completedC: number; noDueDateC: number; overdueC: number
  addedNC: number; completedNC: number; noDueDateNC: number; overdueNC: number
}

interface ComplianceSummary {
  date: string
  overdueC: number; overdueNC: number
  noDueDateC: number; noDueDateNC: number
  addedTodayC: number; addedTodayNC: number
  completedTodayC: number; completedTodayNC: number
  pendingC: number; pendingNC: number
}

interface ComplianceRawTask {
  id: string; title: string; status: string; priority: string
  due_date: string | null; created_at: string; completed_at: string | null
  custom_fields: Record<string, any> | null
  assignee_id: string | null; client_id: string | null
}

interface Props {
  clients?:       { id: string; name: string; color: string }[]
  currentUserId?: string
  userRole?:      string
  dailyData:       { date: string; created: number; completed: number }[]
  memberData:      { name: string; completed: number }[]
  priorityData:    { name: string; value: number; color: string }[]
  projectData:     { name: string; done: number; total: number; pct: number }[]
  timeByProject:   { name: string; hours: number; color: string }[]
  employeeStats:   EmployeeStat[]
  complianceRawTasks?:   ComplianceRawTask[]
  complianceMemberList?: { id: string; name: string }[]
  wipData?: {
    id: string; title: string; status: string; priority: string
    due_date: string | null; assignee_name: string | null
    client_id: string | null; client_name: string | null; client_color: string
    hours_logged: number; is_billable: boolean
  }[]
}

const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#0891b2','#16a34a']

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 99, fontSize: 10, fontWeight: 600, color, background: bg }}>
      {children}
    </span>
  )
}

function StatBox({ label, value, sub, color = 'var(--text-primary)', bg = 'var(--surface-subtle)' }: {
  label: string; value: string | number; sub?: string; color?: string; bg?: string
}) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 8, background: bg, textAlign: 'center', border: '1px solid var(--border)' }}>
      <p style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</p>
      {sub && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function EmployeeCard({ emp, rank }: { emp: EmployeeStat; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const scoreColor = emp.completionRate >= 80 ? '#16a34a' : emp.completionRate >= 50 ? '#ca8a04' : '#dc2626'
  const scoreBg    = emp.completionRate >= 80 ? '#f0fdf4' : emp.completionRate >= 50 ? '#fffbeb' : '#fef2f2'

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 12,
      background: 'var(--surface)', overflow: 'hidden',
      transition: 'box-shadow 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        {/* Rank + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: COLORS[(rank - 1) % COLORS.length],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
            {rank}
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: COLORS[(rank - 1) % COLORS.length] + '22',
            border: `2px solid ${COLORS[(rank - 1) % COLORS.length]}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: COLORS[(rank - 1) % COLORS.length], fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {emp.name[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.email}</p>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: 'center', minWidth: 44 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{emp.completed}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>done</p>
          </div>
          <div style={{ textAlign: 'center', minWidth: 44 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: emp.overdue > 0 ? '#dc2626' : 'var(--text-muted)', lineHeight: 1 }}>{emp.overdue}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>overdue</p>
          </div>
          <div style={{ textAlign: 'center', minWidth: 44 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>
              {emp.onTimeRate !== null ? `${emp.onTimeRate}%` : '—'}
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>on-time</p>
          </div>
          {/* Completion ring */}
          <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
            <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="22" cy="22" r="17" fill="none" stroke="var(--border)" strokeWidth="4"/>
              <circle cx="22" cy="22" r="17" fill="none" stroke={scoreColor} strokeWidth="4"
                strokeDasharray={`${(emp.completionRate / 100) * 106.8} 106.8`}
                strokeLinecap="round"/>
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 10, fontWeight: 700, color: scoreColor }}>
              {emp.completionRate}%
            </span>
          </div>

          {/* Expand chevron */}
          <svg viewBox="0 0 12 12" fill="none" style={{ width: 14, height: 14, color: 'var(--text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-light)', padding: '16px 16px 14px' }}>
          {/* Stat boxes row */}
          <div className="stat-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
            <StatBox label="Total assigned" value={emp.total} />
            <StatBox label="Completed" value={emp.completed} color="#16a34a" bg="#f0fdf4" />
            <StatBox label="Overdue" value={emp.overdue}
              color={emp.overdue > 0 ? '#dc2626' : 'var(--text-muted)'}
              bg={emp.overdue > 0 ? '#fef2f2' : 'var(--surface-subtle)'} />
            <StatBox label="Hours logged" value={`${emp.hoursLogged}h`} color="#7c3aed" bg="#f5f3ff" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Left: metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MetricRow label="On-time completion rate"
                value={emp.onTimeRate !== null ? `${emp.onTimeRate}%` : 'No due dates set'}
                color={emp.onTimeRate !== null ? (emp.onTimeRate >= 80 ? '#16a34a' : emp.onTimeRate >= 50 ? '#ca8a04' : '#dc2626') : 'var(--text-muted)'}
                bar={emp.onTimeRate ?? 0} barColor={emp.onTimeRate !== null ? (emp.onTimeRate >= 80 ? '#16a34a' : emp.onTimeRate >= 50 ? '#ca8a04' : '#dc2626') : '#94a3b8'} />
              <MetricRow label="Overall completion rate"
                value={`${emp.completionRate}%`}
                color={emp.completionRate >= 80 ? '#16a34a' : emp.completionRate >= 50 ? '#ca8a04' : '#dc2626'}
                bar={emp.completionRate}
                barColor={emp.completionRate >= 80 ? '#16a34a' : emp.completionRate >= 50 ? '#ca8a04' : '#dc2626'} />
              <MetricRow label="Avg days to complete"
                value={emp.avgDays !== null ? `${emp.avgDays} days` : 'N/A'}
                color={emp.avgDays !== null ? (emp.avgDays <= 3 ? '#16a34a' : emp.avgDays <= 7 ? '#ca8a04' : '#dc2626') : 'var(--text-muted)'}
                bar={emp.avgDays !== null ? Math.min(100, Math.round((1 - Math.min(emp.avgDays, 14) / 14) * 100)) : 0}
                barColor="#0d9488" />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <Badge color={COLORS[(rank-1) % COLORS.length]} bg={COLORS[(rank-1) % COLORS.length] + '15'}>
                  {emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}
                </Badge>
                {emp.urgentHigh > 0 && (
                  <Badge color="#ea580c" bg="#fff7ed">
                    {emp.urgentHigh} high-priority tasks
                  </Badge>
                )}
                {emp.inReview > 0 && (
                  <Badge color="#7c3aed" bg="#f5f3ff">
                    {emp.inReview} pending approval
                  </Badge>
                )}
              </div>
            </div>

            {/* Right: weekly trend chart */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Weekly activity (last 6 weeks)
              </p>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={emp.weeklyTrend} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${emp.uid}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid var(--border)' }}/>
                  <Area type="monotone" dataKey="completed" stroke="#0d9488" strokeWidth={2}
                    fill={`url(#grad-${emp.uid})`} name="Completed" dot={false}/>
                  <Area type="monotone" dataKey="assigned" stroke="#7c3aed" strokeWidth={1.5}
                    fill="none" strokeDasharray="3 2" name="Assigned" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricRow({ label, value, color, bar, barColor }: {
  label: string; value: string; color: string; bar: number; barColor: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{value}</span>
      </div>
      <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: 4, width: `${Math.min(100, bar)}%`, background: barColor, borderRadius: 99, transition: 'width 0.5s' }}/>
      </div>
    </div>
  )
}

function ComplianceTrendChart({ data, title, addedKey, completedKey, noDueDateKey, overdueKey }: {
  data: ComplianceDayData[]
  title: string
  addedKey: 'addedC' | 'addedNC'
  completedKey: 'completedC' | 'completedNC'
  noDueDateKey: 'noDueDateC' | 'noDueDateNC'
  overdueKey: 'overdueC' | 'overdueNC'
}) {
  return (
    <div className="card-elevated p-5">
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' }}/>
          <Legend wrapperStyle={{ fontSize: 11 }}/>
          <Line type="monotone" dataKey={addedKey}      stroke="#0891b2" strokeWidth={2} dot={false} name="Added Today"/>
          <Line type="monotone" dataKey={completedKey}  stroke="#16a34a" strokeWidth={2} dot={false} name="Completed Today"/>
          <Line type="monotone" dataKey={noDueDateKey}  stroke="#64748b" strokeWidth={2} dot={false} name="No Due Date"/>
          <Line type="monotone" dataKey={overdueKey}    stroke="#dc2626" strokeWidth={2} dot={false} name="Overdue"/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Client-side compliance aggregation ──────────────────────────────────────
function fmtDay(d: Date) {
  return `${d.getDate().toString().padStart(2,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getFullYear().toString().slice(2)}`
}

function buildComplianceData(
  rawTasks: ComplianceRawTask[],
  days: number,
  memberFilter: string,
): { daily: ComplianceDayData[]; summary: ComplianceSummary } {
  const filtered = memberFilter
    ? rawTasks.filter(t => t.assignee_id === memberFilter)
    : rawTasks
  const today = new Date().toISOString().split('T')[0]
  const caT = filtered.filter(t => t.custom_fields?._ca_compliance === true)
  const ncT = filtered.filter(t => !t.custom_fields?._ca_compliance)

  const daily = Array.from({ length: days }, (_, i) => {
    const d  = new Date(Date.now() - (days - 1 - i) * 86400000)
    const ds = d.toISOString().split('T')[0]
    return {
      date:       fmtDay(d),
      dateKey:    ds,
      addedC:     caT.filter(t => t.created_at?.startsWith(ds)).length,
      completedC: caT.filter(t => t.completed_at?.startsWith(ds)).length,
      noDueDateC: caT.filter(t => !t.due_date && t.created_at <= ds+'T23:59:59' && t.status !== 'completed').length,
      overdueC:   caT.filter(t => t.due_date && t.due_date < ds && t.status !== 'completed').length,
      addedNC:    ncT.filter(t => t.created_at?.startsWith(ds)).length,
      completedNC:ncT.filter(t => t.completed_at?.startsWith(ds)).length,
      noDueDateNC:ncT.filter(t => !t.due_date && t.created_at <= ds+'T23:59:59' && t.status !== 'completed').length,
      overdueNC:  ncT.filter(t => t.due_date && t.due_date < ds && t.status !== 'completed').length,
    }
  })

  const todayD = new Date()
  const summary: ComplianceSummary = {
    date:             todayD.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    overdueC:         caT.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length,
    overdueNC:        ncT.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length,
    noDueDateC:       caT.filter(t => !t.due_date && t.status !== 'completed').length,
    noDueDateNC:      ncT.filter(t => !t.due_date && t.status !== 'completed').length,
    addedTodayC:      caT.filter(t => t.created_at?.startsWith(today)).length,
    addedTodayNC:     ncT.filter(t => t.created_at?.startsWith(today)).length,
    completedTodayC:  caT.filter(t => t.completed_at?.startsWith(today)).length,
    completedTodayNC: ncT.filter(t => t.completed_at?.startsWith(today)).length,
    pendingC:         caT.filter(t => t.status !== 'completed').length,
    pendingNC:        ncT.filter(t => t.status !== 'completed').length,
  }
  return { daily, summary }
}
// ────────────────────────────────────────────────────────────────────────────

export function ReportsCharts({ dailyData, memberData, priorityData, projectData, timeByProject, employeeStats, currentUserId, userRole, clients = [], complianceRawTasks = [], complianceMemberList = [], wipData = [] }: Props) {
  const [activeTab,    setActiveTab]    = useState<'overview' | 'team' | 'compliance' | 'wip'>('overview')
  const [clientFilter, setClientFilter] = useState('')
  const [timeline,     setTimeline]     = useState<'30' | '60' | '90' | '365'>('90')
  const [empFilter,    setEmpFilter]    = useState('')

  // Compliance chart date-window filters (separate from universal task filters)
  const today90From = new Date(Date.now() - 89 * 86400000).toISOString().split('T')[0]
  const todayStr    = new Date().toISOString().split('T')[0]
  const [compDateFrom, setCompDateFrom] = useState(today90From)
  const [compDateTo,   setCompDateTo]   = useState(todayStr)

  const canViewAll = !userRole || ['owner','admin','manager'].includes(userRole)

  // Universal filter store — used to pre-filter compliance raw tasks
  const {
    search: uSearch, clientId: uClientId, priority: uPriority, status: uStatus,
    assigneeId: uAssigneeId, dueDateFrom: uDueDateFrom, dueDateTo: uDueDateTo,
  } = useFilterStore()

  // Pre-filter compliance raw tasks by universal filter state
  const filteredCompRaw = useMemo(() => complianceRawTasks.filter(t => {
    if (uSearch      && !t.title?.toLowerCase().includes(uSearch.toLowerCase())) return false
    if (uClientId.length  > 0 && !uClientId.includes(t.client_id ?? ''))        return false
    if (uPriority.length  > 0 && !uPriority.includes(t.priority))               return false
    if (uStatus.length    > 0 && !uStatus.includes(t.status))                   return false
    if (uAssigneeId.length > 0 && !uAssigneeId.includes(t.assignee_id ?? ''))   return false
    if (uDueDateFrom && t.due_date && t.due_date < uDueDateFrom)                 return false
    if (uDueDateTo   && t.due_date && t.due_date > uDueDateTo)                   return false
    return true
  }), [complianceRawTasks, uSearch, uClientId, uPriority, uStatus, uAssigneeId, uDueDateFrom, uDueDateTo])

  // Compute compliance chart data from filtered tasks + date window
  const compDays = Math.max(1, Math.round(
    (new Date(compDateTo).getTime() - new Date(compDateFrom).getTime()) / 86400000
  ) + 1)
  const { daily: rawCompDaily, summary: complianceSummary } = buildComplianceData(
    filteredCompRaw, compDays, ''
  )
  const complianceDailyData = rawCompDaily.filter(
    d => d.dateKey >= compDateFrom && d.dateKey <= compDateTo
  )

  // Role-based member list: members/viewers see only themselves
  // Timeline filter: slice weeklyTrend to match selected days
  const timelineDays = parseInt(timeline)
  const timelineWeeks = Math.ceil(timelineDays / 7)

  const baseStats = canViewAll ? employeeStats : employeeStats.filter(e => e.uid === currentUserId)

  const visibleStats = (empFilter
    ? baseStats.filter(e => e.uid === empFilter || e.name.toLowerCase().includes(empFilter.toLowerCase()))
    : baseStats
  ).map(e => {
    // For the default '90' view, use server-computed values directly (most accurate).
    // For other timelines, derive from weekly trend slices.
    if (timeline === '90') return { ...e }

    const slicedTrend      = e.weeklyTrend.slice(-Math.min(timelineWeeks, e.weeklyTrend.length))
    const filteredCompleted = slicedTrend.reduce((s: number, w: any) => s + w.completed, 0)
    const filteredAssigned  = slicedTrend.reduce((s: number, w: any) => s + w.assigned, 0)
    const filteredRate = filteredAssigned > 0
      ? Math.round((filteredCompleted / filteredAssigned) * 100)
      : 0
    return {
      ...e,
      weeklyTrend:    slicedTrend,
      completed:      filteredCompleted,
      total:          filteredAssigned,
      completionRate: filteredRate,
    }
  })

  return (
    <div>
      {/* Client filter */}
      {clients.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>Client:</span>
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
            style={{ padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', outline:'none',
              border: clientFilter ? '1px solid var(--brand)' : '1px solid var(--border)',
              background: clientFilter ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)',
              color: clientFilter ? 'var(--brand)' : 'var(--text-secondary)',
              fontWeight: clientFilter ? 600 : 400, fontFamily:'inherit', appearance:'none', paddingRight:20 }}>
            <option value=''>All clients</option>
            {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
          </select>
          {clientFilter && <button onClick={() => setClientFilter('')}
            style={{ fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>✕ Clear</button>}
        </div>
      )}
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, background: 'var(--surface)', borderRadius: '8px 8px 0 0' }}>
        {([
          { v: 'overview',   label: '📊 Overview' },
          { v: 'team',       label: '👤 Team Performance' },
          { v: 'compliance', label: '📋 Compliance Report' },
          { v: 'wip',        label: '🔄 WIP Report' },
        ] as const).map(({ v, label }) => (
          <button key={v} onClick={() => setActiveTab(v)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 500, border: 'none',
              background: 'transparent', cursor: 'pointer', marginBottom: -1,
              borderBottom: `2px solid ${activeTab === v ? 'var(--brand)' : 'transparent'}`,
              color: activeTab === v ? 'var(--brand)' : 'var(--text-muted)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Row 1: Task trend + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <div className="card-elevated p-5">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Task activity — last 14 days</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}/>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                  <Line type="monotone" dataKey="completed" stroke="#0d9488" strokeWidth={2} dot={false} name="Completed"/>
                  <Line type="monotone" dataKey="created" stroke="#7c3aed" strokeWidth={2} dot={false} strokeDasharray="4 2" name="Created"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card-elevated p-5">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Open tasks by priority</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={priorityData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name" paddingAngle={3}>
                    {priorityData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}/>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Team bar chart */}
          {memberData.length > 0 && (
            <div className="card-elevated p-5">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Team task completion (last 30 days)</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, memberData.length * 44)}>
                <BarChart data={memberData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}/>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                  <Bar dataKey="completed" name="Completed" fill="#0d9488" radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Row 3: Project + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card-elevated p-5">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Project completion</h3>
              {projectData.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No active projects</p>
                : projectData.map((p, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '70%' }}>{p.name}</span>
                      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{p.done}/{p.total} · {p.pct}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: 6, width: `${p.pct}%`, background: COLORS[i % COLORS.length], borderRadius: 99 }}/>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="card-elevated p-5">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Hours logged by project</h3>
              {timeByProject.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No time logged yet</p>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={timeByProject} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                        formatter={(v: number) => [`${v}h`, 'Hours']}/>
                      <Bar dataKey="hours" radius={[4,4,0,0]}>
                        {timeByProject.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>
        </div>
      )}

      {/* ── COMPLIANCE REPORT TAB ─────────────────────────── */}
      {activeTab === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Universal filter bar — client, priority, status, assignee, search, due date */}
          <UniversalFilterBar
            clients={clients}
            members={complianceMemberList}
            showSearch
            showPriority
            showStatus
            showAssignee
            showDueDate
            searchPlaceholder="Search compliance tasks…"
          />

          {/* Chart date-window picker (controls the trend period shown in charts) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '10px 16px' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>Chart period:</span>

            {/* Quick range buttons */}
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { label: '14d', days: 14 },
                { label: '30d', days: 30 },
                { label: '90d', days: 90 },
              ] as const).map(({ label, days }) => {
                const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0]
                const active = compDateFrom === from && compDateTo === todayStr
                return (
                  <button key={label}
                    onClick={() => { setCompDateFrom(from); setCompDateTo(todayStr) }}
                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
                      background: active ? 'var(--brand)' : 'var(--surface-subtle)',
                      color: active ? '#fff' : 'var(--text-secondary)' }}>
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Custom date from/to */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              From
              <input type="date" value={compDateFrom} max={compDateTo}
                onChange={e => setCompDateFrom(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  fontSize: 12, fontFamily: 'inherit', background: 'var(--surface-subtle)',
                  color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}/>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              To
              <input type="date" value={compDateTo} min={compDateFrom}
                onChange={e => setCompDateTo(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  fontSize: 12, fontFamily: 'inherit', background: 'var(--surface-subtle)',
                  color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}/>
            </label>

            {(compDateFrom !== today90From || compDateTo !== todayStr) && (
              <button onClick={() => { setCompDateFrom(today90From); setCompDateTo(todayStr) }}
                style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ✕ Reset
              </button>
            )}
          </div>

          {/* Two trend charts side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ComplianceTrendChart
              data={complianceDailyData}
              title={`Compliance${uAssigneeId.length === 1 ? ` — ${complianceMemberList.find(m=>m.id===uAssigneeId[0])?.name ?? ''}` : ''}`}
              addedKey="addedC" completedKey="completedC"
              noDueDateKey="noDueDateC" overdueKey="overdueC"
            />
            <ComplianceTrendChart
              data={complianceDailyData}
              title={`Non-Compliance${uAssigneeId.length === 1 ? ` — ${complianceMemberList.find(m=>m.id===uAssigneeId[0])?.name ?? ''}` : ''}`}
              addedKey="addedNC" completedKey="completedNC"
              noDueDateKey="noDueDateNC" overdueKey="overdueNC"
            />
          </div>

          {/* Today summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
              {/* Summary table */}
              <div className="card-elevated p-5">
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
                  Today's snapshot — {complianceSummary.date}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-subtle)' }}>
                      {['Date', 'Status', 'Compliance', 'Non-Compliance'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                          color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)',
                          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Overdue',         color: '#dc2626', bg: '#fef2f2', c: complianceSummary.overdueC,        nc: complianceSummary.overdueNC },
                      { label: 'No Due Date',      color: '#64748b', bg: '#f8fafc', c: complianceSummary.noDueDateC,      nc: complianceSummary.noDueDateNC },
                      { label: 'Added Today',      color: '#0891b2', bg: '#f0f9ff', c: complianceSummary.addedTodayC,     nc: complianceSummary.addedTodayNC },
                      { label: 'Completed Today',  color: '#16a34a', bg: '#f0fdf4', c: complianceSummary.completedTodayC, nc: complianceSummary.completedTodayNC },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>{complianceSummary.date}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                            color: row.color, background: row.bg }}>
                            {row.label}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: row.c > 0 ? row.color : 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
                          {row.c}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: row.nc > 0 ? row.color : 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
                          {row.nc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pending totals box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200 }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '20px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', textTransform: 'uppercase',
                    letterSpacing: '0.05em', marginBottom: 6 }}>Compliance Pending</p>
                  <p style={{ fontSize: 40, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>{complianceSummary.pendingC}</p>
                </div>
                <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 12, padding: '20px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#ea580c', textTransform: 'uppercase',
                    letterSpacing: '0.05em', marginBottom: 6 }}>Non-Compliance Pending</p>
                  <p style={{ fontSize: 40, fontWeight: 900, color: '#ea580c', lineHeight: 1 }}>{complianceSummary.pendingNC}</p>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* ── WIP REPORT TAB ───────────────────────────────── */}
      {activeTab === 'wip' && (() => {
        const PRIORITY_COLOR: Record<string, string> = {
          urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a',
        }
        const STATUS_COLOR: Record<string, string> = {
          todo: '#64748b', in_progress: '#0891b2', in_review: '#7c3aed',
        }
        const STATUS_LABEL: Record<string, string> = {
          todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review',
        }

        // Group by client
        const grouped: Record<string, typeof wipData> = {}
        wipData.forEach(t => {
          const key = t.client_name ?? '(No Client)'
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(t)
        })
        const groups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

        const totalTasks    = wipData.length
        const totalHours    = Math.round(wipData.reduce((s, t) => s + t.hours_logged, 0) * 10) / 10
        const unbilledHours = Math.round(wipData.filter(t => !t.is_billable).reduce((s, t) => s + t.hours_logged, 0) * 10) / 10

        const thStyle = {
          padding: '9px 12px', textAlign: 'left' as const, fontWeight: 600,
          color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)',
          fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
          background: 'var(--surface-subtle)', whiteSpace: 'nowrap' as const,
        }
        const tdStyle = {
          padding: '9px 12px', fontSize: 12, color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' as const,
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {wipData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)',
                background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No in-progress tasks</p>
                <p style={{ fontSize: 13 }}>Tasks with status todo, in_progress, or in_review will appear here</p>
              </div>
            ) : (
              <>
                {groups.map(([clientName, tasks]) => {
                  const clientColor = tasks[0].client_color ?? '#94a3b8'
                  const clientHours = Math.round(tasks.reduce((s, t) => s + t.hours_logged, 0) * 10) / 10
                  const hasUnbilled = tasks.some(t => !t.is_billable)
                  return (
                    <div key={clientName} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      {/* Client header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', background: clientColor + '12', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: clientColor, flexShrink: 0 }}/>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{clientName}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''} · {clientHours}h</span>
                        </div>
                        {hasUnbilled && (
                          <button style={{
                            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                            background: '#0891b2', color: '#fff',
                          }}>
                            Create Invoice
                          </button>
                        )}
                      </div>

                      {/* Task table */}
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Task</th>
                              <th style={thStyle}>Status</th>
                              <th style={thStyle}>Priority</th>
                              <th style={thStyle}>Assignee</th>
                              <th style={thStyle}>Due Date</th>
                              <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                              <th style={thStyle}>Billing</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tasks.map(t => {
                              const prColor = PRIORITY_COLOR[t.priority] ?? '#94a3b8'
                              const stColor = STATUS_COLOR[t.status] ?? '#94a3b8'
                              const isOverdue = t.due_date && t.due_date < new Date().toISOString().split('T')[0]
                              return (
                                <tr key={t.id} style={{ transition: 'background 0.1s' }}>
                                  <td style={{ ...tdStyle, maxWidth: 280 }}>
                                    <span style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: 500 }}>
                                      {t.title}
                                    </span>
                                  </td>
                                  <td style={tdStyle}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                                      borderRadius: 99, fontSize: 10, fontWeight: 600,
                                      color: stColor, background: stColor + '18' }}>
                                      {STATUS_LABEL[t.status] ?? t.status}
                                    </span>
                                  </td>
                                  <td style={tdStyle}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                                      borderRadius: 99, fontSize: 10, fontWeight: 600,
                                      color: prColor, background: prColor + '18' }}>
                                      {t.priority ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1) : 'None'}
                                    </span>
                                  </td>
                                  <td style={{ ...tdStyle, color: t.assignee_name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {t.assignee_name ?? '—'}
                                  </td>
                                  <td style={{ ...tdStyle, color: isOverdue ? '#dc2626' : 'var(--text-primary)', fontWeight: isOverdue ? 600 : 400 }}>
                                    {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                    {isOverdue && <span style={{ fontSize: 10, marginLeft: 4, color: '#dc2626' }}>Overdue</span>}
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#7c3aed' }}>
                                    {t.hours_logged}h
                                  </td>
                                  <td style={tdStyle}>
                                    {t.is_billable
                                      ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, color: '#16a34a', background: '#f0fdf4' }}>Billable</span>
                                      : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9' }}>Unbilled</span>
                                    }
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'var(--surface-subtle)' }}>
                              <td colSpan={5} style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Subtotal — {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                                {clientHours}h
                              </td>
                              <td style={tdStyle}/>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )
                })}

                {/* Bottom summary card */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                    Summary
                  </h3>
                  <div className="stat-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>In-Progress Tasks</p>
                      <p style={{ fontSize: 32, fontWeight: 900, color: '#0891b2', lineHeight: 1 }}>{totalTasks}</p>
                    </div>
                    <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Total Hours</p>
                      <p style={{ fontSize: 32, fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{totalHours}h</p>
                    </div>
                    <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Unbilled Hours</p>
                      <p style={{ fontSize: 32, fontWeight: 900, color: '#ea580c', lineHeight: 1 }}>{unbilledHours}h</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ── TEAM PERFORMANCE TAB ──────────────────────────── */}
      {activeTab === 'team' && (
        <div>
          {/* Timeline + filter toolbar */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:4, background:'var(--surface-subtle)', padding:4, borderRadius:8, border:'1px solid var(--border)' }}>
              {(['30','60','90','365'] as const).map(t => (
                <button key={t} onClick={() => setTimeline(t)}
                  style={{ padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer',
                    fontSize:12, fontWeight:500, fontFamily:'inherit',
                    background: timeline===t ? 'var(--brand)' : 'transparent',
                    color: timeline===t ? '#fff' : 'var(--text-muted)',
                    transition:'all 0.15s' }}>
                  {t === '365' ? '1 year' : `${t} days`}
                </button>
              ))}
            </div>
            {canViewAll && employeeStats.length > 1 && (
              <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
                style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)',
                  background:'var(--surface)', fontSize:12, color:'var(--text-primary)', cursor:'pointer' }}>
                <option value="">All members</option>
                {employeeStats.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)}
              </select>
            )}
            {!canViewAll && (
              <span style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}>
                Showing your performance only
              </span>
            )}
          </div>
          {/* Header summary */}
          <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: canViewAll ? 'Team members' : 'Your stats', value: visibleStats.length, color: '#0d9488', bg: '#f0fdfa' },
              { label: 'Avg completion rate', value: visibleStats.length ? `${Math.round(visibleStats.reduce((s, e) => s + e.completionRate, 0) / visibleStats.length)}%` : '—', color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Total overdue', value: visibleStats.reduce((s, e) => s + e.overdue, 0), color: '#dc2626', bg: '#fef2f2' },
              { label: 'Total hours logged', value: `${Math.round(visibleStats.reduce((s, e) => s + e.hoursLogged, 0))}h`, color: '#7c3aed', bg: '#f5f3ff' },
            ].map(k => (
              <div key={k.label} style={{ background: k.bg, borderRadius: 10, padding: '14px 16px', border: `1px solid ${k.color}22` }}>
                <p style={{ fontSize: 12, color: k.color, fontWeight: 500, marginBottom: 4 }}>{k.label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px', marginBottom: 14,
            background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Click any row to expand full details</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
              <span>🟢 ≥80% on-time</span>
              <span>🟡 50–79%</span>
              <span>🔴 &lt;50%</span>
            </span>
          </div>

          {employeeStats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No employee data yet</p>
              <p style={{ fontSize: 13 }}>Assign tasks to team members to start tracking performance</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleStats.map((emp, i) => (
                <EmployeeCard key={emp.uid} emp={emp} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}