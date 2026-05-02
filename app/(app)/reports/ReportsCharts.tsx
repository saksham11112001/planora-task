'use client'
import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'

interface EmployeeStat {
  uid: string; name: string; email: string; role: string
  total: number; completed: number; overdue: number
  inProgress: number; inReview: number
  onTimeRate: number | null; avgDays: number | null
  hoursLogged: number; urgentHigh: number
  completionRate: number
  weeklyTrend: { week: string; completed: number; assigned: number }[]
}

interface Props {
  clients?:       { id: string; name: string; color: string }[]
  currentUserId?: string
  userRole?:      string
  dailyData:       { date: string; created: number; completed: number }[]
  memberData:      { name: string; completed: number; inProgress: number }[]
  priorityData:    { name: string; value: number; color: string }[]
  projectData:     { name: string; done: number; total: number; pct: number }[]
  timeByProject:   { name: string; hours: number; color: string }[]
  employeeStats:   EmployeeStat[]
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
            <StatBox label="Total assigned" value={emp.total} />
            <StatBox label="Completed" value={emp.completed} color="#16a34a" bg="#f0fdf4" />
            <StatBox label="In progress" value={emp.inProgress} color="#0d9488" bg="#f0fdfa" />
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

export function ReportsCharts({ dailyData, memberData, priorityData, projectData, timeByProject, employeeStats, currentUserId, userRole, clients = [] }: Props) {
  const [activeTab,    setActiveTab]    = useState<'overview' | 'team'>('overview')
  const [clientFilter, setClientFilter] = useState('')
  const [timeline,     setTimeline]     = useState<'30' | '60' | '90' | '365'>('90')
  const [empFilter,    setEmpFilter]    = useState('')
  const canViewAll = !userRole || ['owner','admin','manager'].includes(userRole)

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
        {(['overview', 'team'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 500, border: 'none',
              background: 'transparent', cursor: 'pointer', marginBottom: -1,
              borderBottom: `2px solid ${activeTab === tab ? 'var(--brand)' : 'transparent'}`,
              color: activeTab === tab ? 'var(--brand)' : 'var(--text-muted)',
              textTransform: 'capitalize',
            }}>
            {tab === 'team' ? '👤 Team Performance' : '📊 Overview'}
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
                  <Bar dataKey="inProgress" name="In progress" fill="#7c3aed" radius={[0,4,4,0]}/>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
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