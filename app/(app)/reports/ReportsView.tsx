'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'

interface Task { id:string; status:string; priority:string; due_date:string|null; created_at:string; completed_at:string|null; assignee_id:string|null; assignee?:any }
interface Log  { id:string; hours:number; is_billable:boolean; logged_date:string; user_id:string; project_id:string|null; projects?:any }
interface Props { tasks:Task[]; timeLogs:Log[]; members:{id:string;name:string}[]; projects:{id:string;name:string;color:string;status:string}[] }

const TEAL   = '#0d9488'
const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#16a34a','#0891b2','#db2777','#ea580c']

function kpiCard(label: string, value: string | number, sub?: string, color = '#0f172a') {
  return (
    <div className="card-elevated p-5 text-center">
      <p className="text-3xl font-bold mb-1" style={{ color }}>{value}</p>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function ReportsView({ tasks, timeLogs, members, projects }: Props) {
  const total     = tasks.length
  const completed = tasks.filter(t => t.status === 'completed').length
  const overdue   = tasks.filter(t => t.due_date && t.due_date < new Date().toISOString().split('T')[0] && !['completed','cancelled'].includes(t.status)).length
  const rate      = total ? Math.round((completed / total) * 100) : 0
  const totalH    = timeLogs.reduce((s, l) => s + l.hours, 0)
  const billableH = timeLogs.filter(l => l.is_billable).reduce((s, l) => s + l.hours, 0)
  const fmtH      = (h: number) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`

  // Tasks by day (last 14 days)
  const dayMap: Record<string, { date:string; created:number; completed:number }> = {}
  const days14 = [...Array(14)].map((_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i))
    const k = d.toISOString().split('T')[0]
    dayMap[k] = { date: d.toLocaleDateString('en-IN', { day:'numeric', month:'short' }), created:0, completed:0 }
    return k
  })
  tasks.forEach(t => {
    const ck = t.created_at.split('T')[0]; if (dayMap[ck]) dayMap[ck].created++
    if (t.completed_at) { const dk = t.completed_at.split('T')[0]; if (dayMap[dk]) dayMap[dk].completed++ }
  })
  const trendData = days14.map(k => dayMap[k])

  // Status breakdown
  const statusCounts: Record<string,number> = {}
  tasks.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1 })
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace('_',' '), value }))

  // Priority breakdown
  const priCounts: Record<string,number> = {}
  tasks.forEach(t => { priCounts[t.priority] = (priCounts[t.priority] ?? 0) + 1 })
  const priData = Object.entries(priCounts).map(([name, value]) => ({ name, value }))

  // Time by project
  const projHours: Record<string, { name:string; color:string; hours:number; billable:number }> = {}
  timeLogs.forEach(l => {
    if (!l.project_id || !l.projects) return
    if (!projHours[l.project_id]) projHours[l.project_id] = { name: l.projects.name, color: l.projects.color, hours: 0, billable: 0 }
    projHours[l.project_id].hours   += l.hours
    projHours[l.project_id].billable += l.is_billable ? l.hours : 0
  })
  const projData = Object.values(projHours).sort((a,b) => b.hours - a.hours).slice(0,8)

  // Top contributors (tasks completed)
  const memberComp: Record<string,{ name:string; completed:number; total:number }> = {}
  tasks.forEach(t => {
    const a = t.assignee as any
    if (!a?.id) return
    if (!memberComp[a.id]) memberComp[a.id] = { name: a.name, completed: 0, total: 0 }
    memberComp[a.id].total++
    if (t.status === 'completed') memberComp[a.id].completed++
  })
  const contribs = Object.values(memberComp).sort((a,b) => b.completed - a.completed).slice(0,6)

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--surface-subtle)' }}>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reports</h1>
        <p className="text-sm text-gray-400 mb-6">Last 30 days</p>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {kpiCard('Total tasks',      total,          'last 30 days')}
          {kpiCard('Completed',        completed,      `${rate}% rate`, '#16a34a')}
          {kpiCard('Overdue',          overdue,        'still open',   overdue > 0 ? '#dc2626' : '#94a3b8')}
          {kpiCard('Hours logged',     fmtH(totalH),   `${fmtH(billableH)} billable`)}
        </div>

        {/* Task trend */}
        <div className="card-elevated p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Task activity — last 14 days</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Line type="monotone" dataKey="created"   stroke="#94a3b8" strokeWidth={2} dot={false} name="Created"/>
              <Line type="monotone" dataKey="completed" stroke={TEAL}    strokeWidth={2} dot={false} name="Completed"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Status pie */}
          <div className="card-elevated p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Tasks by status</h2>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  dataKey="value" nameKey="name" paddingAngle={2}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}/>
                <Legend wrapperStyle={{ fontSize: 11 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Priority pie */}
          <div className="card-elevated p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Tasks by priority</h2>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={priData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  dataKey="value" nameKey="name" paddingAngle={2}>
                  {priData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}/>
                <Legend wrapperStyle={{ fontSize: 11 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time by project */}
        {projData.length > 0 && (
          <div className="card-elevated p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Hours by project</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={projData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false}/>
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v: any) => [`${v}h`, '']}/>
                <Bar dataKey="hours"   name="Total"    fill="#e2e8f0" radius={[4,4,0,0]}/>
                <Bar dataKey="billable" name="Billable" fill={TEAL}   radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top contributors */}
        {contribs.length > 0 && (
          <div className="card-elevated p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Team performance</h2>
            <div className="space-y-3">
              {contribs.map(m => (
                <div key={m.name} className="flex items-center gap-4">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: TEAL, fontSize: 11 }}>{m.name[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">{m.name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{m.completed}/{m.total} tasks</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${m.total ? (m.completed/m.total)*100 : 0}%`, background: TEAL }}/>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                    {m.total ? Math.round((m.completed/m.total)*100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
