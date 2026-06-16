'use client'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import { useFilterStore } from '@/store/appStore'
import { localDayStr } from '@/lib/utils/format'
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

interface ActionItems {
  overdue:           { id: string; title: string; priority: string; due_date: string; assignee_name: string | null; days_overdue: number }[]
  pending_approval:  { id: string; title: string; priority: string; assignee_name: string | null; days_waiting: number; due_date: string | null }[]
  unassigned_urgent: { id: string; title: string; priority: string; due_date: string | null }[]
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
    project_id: string | null
    hours_logged: number; is_billable: boolean
  }[]
  trajectoryData?:  { week: string; added: number; completed: number }[]
  statusBreakdown?: { name: string; value: number; color: string }[]
  actionItems?:     ActionItems
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
    const ds = localDayStr(d)
    return {
      date:       fmtDay(d),
      dateKey:    ds,
      addedC:     caT.filter(t => t.created_at?.startsWith(ds)).length,
      completedC: caT.filter(t => t.completed_at?.startsWith(ds)).length,
      noDueDateC: caT.filter(t => !t.due_date && t.created_at <= ds+'T23:59:59' && !['completed','cancelled'].includes(t.status)).length,
      overdueC:   caT.filter(t => t.due_date && t.due_date < ds && !['completed','cancelled'].includes(t.status)).length,
      addedNC:    ncT.filter(t => t.created_at?.startsWith(ds)).length,
      completedNC:ncT.filter(t => t.completed_at?.startsWith(ds)).length,
      noDueDateNC:ncT.filter(t => !t.due_date && t.created_at <= ds+'T23:59:59' && !['completed','cancelled'].includes(t.status)).length,
      overdueNC:  ncT.filter(t => t.due_date && t.due_date < ds && !['completed','cancelled'].includes(t.status)).length,
    }
  })

  const todayD = new Date()
  const summary: ComplianceSummary = {
    date:             todayD.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    overdueC:         caT.filter(t => t.due_date && t.due_date < today && !['completed','cancelled'].includes(t.status)).length,
    overdueNC:        ncT.filter(t => t.due_date && t.due_date < today && !['completed','cancelled'].includes(t.status)).length,
    noDueDateC:       caT.filter(t => !t.due_date && !['completed','cancelled'].includes(t.status)).length,
    noDueDateNC:      ncT.filter(t => !t.due_date && !['completed','cancelled'].includes(t.status)).length,
    addedTodayC:      caT.filter(t => t.created_at?.startsWith(today)).length,
    addedTodayNC:     ncT.filter(t => t.created_at?.startsWith(today)).length,
    completedTodayC:  caT.filter(t => t.completed_at?.startsWith(today)).length,
    completedTodayNC: ncT.filter(t => t.completed_at?.startsWith(today)).length,
    pendingC:         caT.filter(t => !['completed','cancelled'].includes(t.status)).length,
    pendingNC:        ncT.filter(t => !['completed','cancelled'].includes(t.status)).length,
  }
  return { daily, summary }
}
// ────────────────────────────────────────────────────────────────────────────

export function ReportsCharts({ dailyData, memberData, priorityData, projectData, timeByProject, employeeStats, currentUserId, userRole, clients = [], complianceRawTasks = [], complianceMemberList = [], wipData = [], trajectoryData = [], statusBreakdown = [], actionItems }: Props) {
  const [activeTab,    setActiveTab]    = useState<'overview' | 'actions' | 'team' | 'compliance' | 'wip'>('overview')
  const [clientFilter, setClientFilter] = useState('')
  const [timeline,     setTimeline]     = useState<'30' | '60' | '90' | '365'>('90')
  const [empFilter,    setEmpFilter]    = useState('')

  // Compliance chart date-window filters (separate from universal task filters)
  const today90From = localDayStr(new Date(Date.now() - 89 * 86400000))
  const todayStr    = localDayStr(new Date())
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
    if (uAssigneeId.length > 0) {
      const matchById = uAssigneeId.includes(t.assignee_id ?? '')
      // Fallback: CA compliance tasks embed assignee name in title as "(Name)" — match by that too
      const matchByTitle = !matchById && uAssigneeId.some(id => {
        const name = complianceMemberList.find(m => m.id === id)?.name
        return name && t.title?.includes(`(${name})`)
      })
      if (!matchById && !matchByTitle) return false
    }
    if (uDueDateFrom && t.due_date && t.due_date < uDueDateFrom)                 return false
    if (uDueDateTo   && t.due_date && t.due_date > uDueDateTo)                   return false
    return true
  }), [complianceRawTasks, uSearch, uClientId, uPriority, uStatus, uAssigneeId, uDueDateFrom, uDueDateTo, complianceMemberList])

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
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, background: 'var(--surface)', borderRadius: '8px 8px 0 0', flexWrap: 'wrap' }}>
        {([
          { v: 'overview',   label: '📊 Overview',        show: true },
          { v: 'actions',    label: '⚡ Action Items',     show: canViewAll },
          { v: 'team',       label: '👤 Team Performance', show: true },
          { v: 'compliance', label: '📋 Compliance Report',show: true },
          { v: 'wip',        label: '🔄 WIP Report',       show: true },
        ] as const).filter(t => t.show).map(({ v, label }) => (
          <button key={v} onClick={() => setActiveTab(v)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 500, border: 'none',
              background: 'transparent', cursor: 'pointer', marginBottom: -1,
              borderBottom: `2px solid ${activeTab === v ? 'var(--brand)' : 'transparent'}`,
              color: activeTab === v ? 'var(--brand)' : 'var(--text-muted)',
              position: 'relative',
            }}>
            {label}
            {v === 'actions' && actionItems && (actionItems.overdue.length + actionItems.pending_approval.length) > 0 && (
              <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 99,
                background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {actionItems.overdue.length + actionItems.pending_approval.length}
              </span>
            )}
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

          {/* Row 1b: Company trajectory + Status breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
            <div className="card-elevated p-5">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Company trajectory — last 12 weeks</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                Tasks added vs completed per week. A rising gap means workload is growing faster than output.
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trajectoryData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-traj-added" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="grad-traj-done" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0d9488" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' }}/>
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                  <Area type="monotone" dataKey="added"     stroke="#7c3aed" strokeWidth={2} fill="url(#grad-traj-added)" name="Tasks added"    dot={false}/>
                  <Area type="monotone" dataKey="completed" stroke="#0d9488" strokeWidth={2} fill="url(#grad-traj-done)"  name="Tasks completed" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card-elevated p-5">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Task status breakdown</h3>
              {statusBreakdown.length === 0
                ? <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No task data</p>
                : (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                          {statusBreakdown.map((s, i) => <Cell key={i} fill={s.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' }}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                      {statusBreakdown.map(s => (
                        <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'inline-block' }}/>
                            <span style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: s.color }}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              }
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

      {/* ── ACTION ITEMS TAB — smart executive summary ────── */}
      {activeTab === 'actions' && canViewAll && (() => {
        const ai = actionItems ?? { overdue: [], pending_approval: [], unassigned_urgent: [] }
        const PRIORITY_COLOR: Record<string, string> = {
          urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a', none: '#94a3b8',
        }

        const totalIssues = ai.overdue.length + ai.pending_approval.length + ai.unassigned_urgent.length

        // Group overdue by assignee
        const overdueByPerson: Record<string, { name: string; tasks: typeof ai.overdue }> = {}
        ai.overdue.forEach(t => {
          const key  = t.assignee_name ?? '__unassigned__'
          const name = t.assignee_name ?? 'Unassigned'
          if (!overdueByPerson[key]) overdueByPerson[key] = { name, tasks: [] }
          overdueByPerson[key].tasks.push(t)
        })
        const overdueGroups = Object.values(overdueByPerson).sort((a, b) => b.tasks.length - a.tasks.length)

        // Group pending approvals by urgency
        const urgentPending  = ai.pending_approval.filter(t => ['urgent', 'high'].includes(t.priority))
        const normalPending  = ai.pending_approval.filter(t => !['urgent', 'high'].includes(t.priority))
        const oldestPending  = ai.pending_approval.reduce((max, t) => t.days_waiting > max ? t.days_waiting : max, 0)

        // Team capacity snapshot from employeeStats
        const atCapacity  = employeeStats.filter(e => e.overdue > 2 || e.completionRate < 40)
        const hasCapacity = employeeStats.filter(e => e.overdue === 0 && e.total < 5)

        if (totalIssues === 0 && atCapacity.length === 0) {
          return (
            <div style={{ textAlign: 'center', padding: '70px 24px', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 40, marginBottom: 10 }}>✅</p>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>All clear — great work!</p>
              <p style={{ fontSize: 13 }}>No overdue tasks, no pending approvals, and no unassigned urgent work right now.</p>
            </div>
          )
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* ── Top alert strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                {
                  count: ai.overdue.length,
                  label: 'Tasks Overdue',
                  sub:   ai.overdue.length > 0 ? `${overdueGroups.length} team member${overdueGroups.length !== 1 ? 's' : ''} affected` : 'All tasks on track',
                  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5',
                  action: ai.overdue.length > 0 ? 'Reassign or extend deadlines below' : null,
                },
                {
                  count: ai.pending_approval.length,
                  label: 'Awaiting Your Approval',
                  sub:   urgentPending.length > 0 ? `${urgentPending.length} urgent/high priority` : oldestPending > 0 ? `Oldest: ${oldestPending} days waiting` : 'No approvals pending',
                  color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
                  action: ai.pending_approval.length > 0 ? 'Review and approve or return below' : null,
                },
                {
                  count: ai.unassigned_urgent.length,
                  label: 'Urgent & Unassigned',
                  sub:   hasCapacity.length > 0 ? `${hasCapacity.length} team member${hasCapacity.length !== 1 ? 's' : ''} have capacity` : 'Assign to available team member',
                  color: '#ea580c', bg: '#fff7ed', border: '#fdba74',
                  action: ai.unassigned_urgent.length > 0 ? 'Assign ownership immediately' : null,
                },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 40, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.count}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                  </div>
                  <p style={{ fontSize: 12, color: s.color + 'cc', marginBottom: s.action ? 8 : 0 }}>{s.sub}</p>
                  {s.action && (
                    <p style={{ fontSize: 11, color: s.color, fontWeight: 600, padding: '4px 8px', background: s.color + '15', borderRadius: 6, display: 'inline-block' }}>
                      → {s.action}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* ── Overdue by team member (grouped) ── */}
            {overdueGroups.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid #fca5a5', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', background: '#fef2f2', borderBottom: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>🔴 Overdue — by Team Member</span>
                  <span style={{ fontSize: 11, color: '#dc262688', marginLeft: 4 }}>Click a name in Team Performance tab to see full task history</span>
                </div>
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {overdueGroups.map(group => {
                    const urgentCount  = group.tasks.filter(t => t.priority === 'urgent').length
                    const highCount    = group.tasks.filter(t => t.priority === 'high').length
                    const maxOverdue   = Math.max(...group.tasks.map(t => t.days_overdue))
                    const criticalFlag = urgentCount > 0 || maxOverdue > 7
                    return (
                      <div key={group.name} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                        background: criticalFlag ? '#fef2f2' : 'var(--surface-subtle)',
                        border: `1px solid ${criticalFlag ? '#fca5a5' : 'var(--border)'}`,
                        borderRadius: 10,
                      }}>
                        {/* Avatar */}
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#dc262618', border: '2px solid #fca5a5',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>
                          {group.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{group.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{group.tasks.length} overdue task{group.tasks.length !== 1 ? 's' : ''}</span>
                            {urgentCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>{urgentCount} urgent</span>}
                            {highCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#fff7ed', color: '#ea580c', border: '1px solid #fdba74' }}>{highCount} high</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                            Oldest overdue: <strong style={{ color: maxOverdue > 7 ? '#dc2626' : 'var(--text-secondary)' }}>{maxOverdue} day{maxOverdue !== 1 ? 's' : ''}</strong>
                            {group.tasks.slice(0, 2).map(t => ` · ${t.title.slice(0, 30)}${t.title.length > 30 ? '…' : ''}`).join('')}
                            {group.tasks.length > 2 && ` · +${group.tasks.length - 2} more`}
                          </div>
                        </div>
                        {/* Action hint */}
                        <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>
                          {criticalFlag ? '⚠ Escalate' : '📋 Review'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Pending approvals — grouped by urgency ── */}
            {ai.pending_approval.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid #ddd6fe', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', background: '#f5f3ff', borderBottom: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#7c3aed' }}>🟣 Pending Your Approval</span>
                  <span style={{ fontSize: 11, color: '#7c3aed88', marginLeft: 4 }}>Review these in My Tasks → Needs Approval tab</span>
                </div>
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {urgentPending.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Urgent / High Priority — review first</p>
                      {urgentPending.slice(0, 5).map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                            color: PRIORITY_COLOR[t.priority] ?? '#94a3b8', background: (PRIORITY_COLOR[t.priority] ?? '#94a3b8') + '18', flexShrink: 0 }}>
                            {t.priority.toUpperCase()}
                          </span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{t.title}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>by {t.assignee_name ?? '—'}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>{t.days_waiting}d waiting</span>
                        </div>
                      ))}
                      {urgentPending.length > 5 && <p style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 4 }}>+{urgentPending.length - 5} more urgent/high — open Needs Approval tab</p>}
                    </div>
                  )}
                  {normalPending.length > 0 && (
                    <div>
                      {urgentPending.length > 0 && <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Other Pending</p>}
                      {normalPending.slice(0, 4).map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 5 }}>
                          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{t.title}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>by {t.assignee_name ?? '—'}</span>
                          <span style={{ fontSize: 11, color: '#7c3aed', flexShrink: 0 }}>{t.days_waiting}d</span>
                        </div>
                      ))}
                      {normalPending.length > 4 && <p style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 4 }}>+{normalPending.length - 4} more in Needs Approval tab</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Unassigned urgent + capacity hint ── */}
            {(ai.unassigned_urgent.length > 0 || hasCapacity.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: ai.unassigned_urgent.length > 0 && hasCapacity.length > 0 ? '1fr 1fr' : '1fr', gap: 14 }}>

                {ai.unassigned_urgent.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid #fdba74', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#fff7ed', borderBottom: '1px solid #fdba74' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#ea580c' }}>🟠 Urgent & Unassigned ({ai.unassigned_urgent.length})</span>
                    </div>
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {ai.unassigned_urgent.slice(0, 5).map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--surface-subtle)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                            color: PRIORITY_COLOR[t.priority] ?? '#94a3b8', background: (PRIORITY_COLOR[t.priority] ?? '#94a3b8') + '18', flexShrink: 0 }}>
                            {t.priority.toUpperCase()}
                          </span>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{t.title}</span>
                          {t.due_date && <span style={{ fontSize: 10, color: t.due_date < new Date().toISOString().split('T')[0] ? '#dc2626' : 'var(--text-muted)', flexShrink: 0 }}>
                            {new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>}
                        </div>
                      ))}
                      {ai.unassigned_urgent.length > 5 && <p style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 4 }}>+{ai.unassigned_urgent.length - 5} more unassigned</p>}
                    </div>
                  </div>
                )}

                {hasCapacity.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid #bbf7d0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>✅ Available to Take Work ({hasCapacity.length})</span>
                    </div>
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {hasCapacity.slice(0, 5).map(emp => (
                        <div key={emp.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface-subtle)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#16a34a18', border: '1.5px solid #16a34a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>
                            {emp.name[0]?.toUpperCase()}
                          </div>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.total} task{emp.total !== 1 ? 's' : ''} assigned</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )
      })()}

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
                const from = localDayStr(new Date(Date.now() - (days - 1) * 86400000))
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
                    letterSpacing: '0.05em', marginBottom: 6 }}>Compliance Active</p>
                  <p style={{ fontSize: 40, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>{complianceSummary.pendingC}</p>
                  <p style={{ fontSize: 11, color: '#dc2626', opacity: 0.7, marginTop: 4 }}>{complianceSummary.overdueC} overdue</p>
                </div>
                <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 12, padding: '20px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#ea580c', textTransform: 'uppercase',
                    letterSpacing: '0.05em', marginBottom: 6 }}>Non-Compliance Active</p>
                  <p style={{ fontSize: 40, fontWeight: 900, color: '#ea580c', lineHeight: 1 }}>{complianceSummary.pendingNC}</p>
                  <p style={{ fontSize: 11, color: '#ea580c', opacity: 0.7, marginTop: 4 }}>{complianceSummary.overdueNC} overdue</p>
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
        // Deduplicate by project so tasks sharing a project don't inflate the sum
        const seenProj = new Set<string>()
        const totalHours = Math.round(wipData.reduce((s, t) => {
          if (!t.project_id || seenProj.has(t.project_id)) return s
          seenProj.add(t.project_id)
          return s + t.hours_logged
        }, 0) * 10) / 10
        const unbilledTasks = wipData.filter(t => !t.is_billable).length

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
                  const seenProjForClient = new Set<string>()
                  const clientHours = Math.round(tasks.reduce((s, t) => {
                    if (!t.project_id || seenProjForClient.has(t.project_id)) return s
                    seenProjForClient.add(t.project_id)
                    return s + t.hours_logged
                  }, 0) * 10) / 10
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
                              <th style={{ ...thStyle, textAlign: 'right' }}>Project Hours</th>
                              <th style={thStyle}>Billing</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tasks.map(t => {
                              const prColor = PRIORITY_COLOR[t.priority] ?? '#94a3b8'
                              const stColor = STATUS_COLOR[t.status] ?? '#94a3b8'
                              const isOverdue = t.due_date && t.due_date < new Date().toISOString().split('T')[0]
                              return (
                                <tr key={t.id} style={{ transition: 'background 0.1s', background: t.assignee_name ? undefined : '#fef2f2' }}>
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
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Project Hours Logged</p>
                      <p style={{ fontSize: 32, fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{totalHours}h</p>
                    </div>
                    <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Unbilled Tasks</p>
                      <p style={{ fontSize: 32, fontWeight: 900, color: '#ea580c', lineHeight: 1 }}>{unbilledTasks}</p>
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

          {/* Top 3 / Bottom 3 performer spotlight — only for managers+ with 4+ team members */}
          {canViewAll && visibleStats.length >= 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Star Performers */}
              <div style={{ background: 'var(--surface)', border: '1px solid #bbf7d0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>🏆</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>Star Performers — Top 3</span>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...visibleStats].sort((a, b) => b.completionRate - a.completionRate).slice(0, 3).map((emp, i) => (
                    <div key={emp.uid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: ['#f59e0b','#94a3b8','#b45309'][i] + '22',
                        border: `2px solid ${['#f59e0b','#94a3b8','#b45309'][i]}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: ['#b45309','#64748b','#78350f'][i], flexShrink: 0 }}>
                        {['🥇','🥈','🥉'][i]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.name}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#16a34a', flexShrink: 0, marginLeft: 8 }}>{emp.completionRate}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                          <div style={{ height: 4, width: `${emp.completionRate}%`, background: '#16a34a', borderRadius: 99 }}/>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{emp.completed} tasks · {emp.onTimeRate !== null ? `${emp.onTimeRate}% on-time` : 'no due dates'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Needs Attention */}
              <div style={{ background: 'var(--surface)', border: '1px solid #fecaca', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>Needs Attention — Bottom 3</span>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...visibleStats].sort((a, b) => a.completionRate - b.completionRate).slice(0, 3).map((emp, i) => (
                    <div key={emp.uid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#dc262615', border: '2px solid #fca5a5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{emp.name}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: emp.completionRate < 50 ? '#dc2626' : '#ca8a04', flexShrink: 0, marginLeft: 8 }}>{emp.completionRate}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                          <div style={{ height: 4, width: `${emp.completionRate}%`, background: emp.completionRate < 50 ? '#dc2626' : '#ca8a04', borderRadius: 99 }}/>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{emp.overdue > 0 ? `${emp.overdue} overdue · ` : ''}{emp.completed} completed · {emp.total} assigned</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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