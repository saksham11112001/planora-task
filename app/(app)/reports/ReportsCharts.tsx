'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'

interface Props {
  dailyData:       { date: string; created: number; completed: number }[]
  memberData:      { name: string; completed: number; inProgress: number }[]
  priorityData:    { name: string; value: number; color: string }[]
  projectData:     { name: string; done: number; total: number; pct: number }[]
  timeByProject:   { name: string; hours: number; color: string }[]
}

const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#0891b2','#16a34a']

export function ReportsCharts({ dailyData, memberData, priorityData, projectData, timeByProject }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Row 1: Task trend + Priority distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

        {/* Task completion trend */}
        <div className="card-elevated p-5">
          <h3 style={{ fontSize: 13, fontWeight: 600, color:'var(--text-primary)', marginBottom: 16 }}>
            Task activity — last 30 days
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border:'1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}/>
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}/>
              <Line type="monotone" dataKey="completed" stroke="#0d9488" strokeWidth={2} dot={false} name="Completed"/>
              <Line type="monotone" dataKey="created"   stroke="#7c3aed" strokeWidth={2} dot={false} strokeDasharray="4 2" name="Created"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Priority breakdown pie */}
        <div className="card-elevated p-5">
          <h3 style={{ fontSize: 13, fontWeight: 600, color:'var(--text-primary)', marginBottom: 16 }}>
            Open tasks by priority
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={priorityData} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                dataKey="value" nameKey="name" paddingAngle={3}>
                {priorityData.map((entry, i) => (
                  <Cell key={i} fill={entry.color}/>
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border:'1px solid var(--border)' }}/>
              <Legend wrapperStyle={{ fontSize: 11 }}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Team performance */}
      {memberData.length > 0 && (
        <div className="card-elevated p-5">
          <h3 style={{ fontSize: 13, fontWeight: 600, color:'var(--text-primary)', marginBottom: 16 }}>
            Team task completion
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(200, memberData.length * 44)}>
            <BarChart data={memberData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border:'1px solid var(--border)' }}/>
              <Legend wrapperStyle={{ fontSize: 11 }}/>
              <Bar dataKey="completed"  name="Completed"   fill="#0d9488" radius={[0,4,4,0]}/>
              <Bar dataKey="inProgress" name="In progress" fill="#7c3aed" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Row 3: Project progress + Time by project */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Project progress bars */}
        <div className="card-elevated p-5">
          <h3 style={{ fontSize: 13, fontWeight: 600, color:'var(--text-primary)', marginBottom: 16 }}>
            Project completion
          </h3>
          {projectData.length === 0
            ? <p style={{ fontSize: 13, color:'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No active projects</p>
            : projectData.map((p, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color:'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '70%' }}>{p.name}</span>
                  <span style={{ color:'var(--text-secondary)', flexShrink: 0 }}>{p.done}/{p.total} · {p.pct}%</span>
                </div>
                <div style={{ height: 6, background:'var(--border-light)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: 6, width: `${p.pct}%`, background: COLORS[i % COLORS.length], borderRadius: 99, transition: 'width 0.6s' }}/>
                </div>
              </div>
            ))
          }
        </div>

        {/* Time by project */}
        <div className="card-elevated p-5">
          <h3 style={{ fontSize: 13, fontWeight: 600, color:'var(--text-primary)', marginBottom: 16 }}>
            Hours logged by project
          </h3>
          {timeByProject.length === 0
            ? <p style={{ fontSize: 13, color:'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No time logged yet</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={timeByProject} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border:'1px solid var(--border)' }}
                    formatter={(v: number) => [`${v}h`, 'Hours']}/>
                  {timeByProject.map((entry, i) => null)}
                  <Bar dataKey="hours" radius={[4,4,0,0]}>
                    {timeByProject.map((entry, i) => (
                      <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>
    </div>
  )
}
