import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { ReportsCharts }  from './ReportsCharts'
import { ReportsExport }  from './ReportsExport'
import { fmtHours }       from '@/lib/utils/format'
import type { Metadata }  from 'next'
export const metadata: Metadata = { title: 'Reports' }
export const revalidate = 60

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  const orgId  = mb.org_id
  const from30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const today  = new Date().toISOString().split('T')[0]

  // All parallel
  const [
    { data: allTasks },
    { data: timeLogs },
    { data: projects },
    { data: members },
  ] = await Promise.all([
    supabase.from('tasks')
      .select('id, status, priority, due_date, assignee_id, created_at, completed_at, project_id')
      .eq('org_id', orgId).eq('is_recurring', false).gte('created_at', from30),
    supabase.from('time_logs')
      .select('hours, is_billable, project_id, logged_date')
      .eq('org_id', orgId).gte('logged_date', from30.split('T')[0]),
    supabase.from('projects')
      .select('id, name, color').eq('org_id', orgId).eq('status', 'active').neq('is_archived', true),
    supabase.from('org_members')
      .select('user_id, users(id, name)').eq('org_id', orgId).eq('is_active', true),
  ])

  const tasks = allTasks ?? []
  const logs  = timeLogs ?? []

  // ── KPI numbers ────────────────────────────────────────────────────────────
  const totalTasks    = tasks.length
  const completed     = tasks.filter(t => t.status === 'completed').length
  const overdue       = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length
  const completionRate= totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0
  const totalHours    = logs.reduce((s, l) => s + (l.hours ?? 0), 0)
  const billableHours = logs.filter(l => l.is_billable).reduce((s, l) => s + (l.hours ?? 0), 0)

  // ── Daily trend (last 14 days) ─────────────────────────────────────────────
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const d  = new Date(Date.now() - (13 - i) * 86400000)
    const ds = d.toISOString().split('T')[0]
    const label = `${d.getDate()}/${d.getMonth() + 1}`
    return {
      date:      label,
      created:   tasks.filter(t => t.created_at?.startsWith(ds)).length,
      completed: tasks.filter(t => t.completed_at?.startsWith(ds)).length,
    }
  })

  // ── Priority breakdown ─────────────────────────────────────────────────────
  const open = tasks.filter(t => t.status !== 'completed')
  const priorityData = [
    { name: 'Urgent',  value: open.filter(t => t.priority === 'urgent').length,  color: '#dc2626' },
    { name: 'High',    value: open.filter(t => t.priority === 'high').length,    color: '#ea580c' },
    { name: 'Medium',  value: open.filter(t => t.priority === 'medium').length,  color: '#ca8a04' },
    { name: 'Low',     value: open.filter(t => t.priority === 'low').length,     color: '#16a34a' },
    { name: 'None',    value: open.filter(t => t.priority === 'none').length,    color:'var(--text-muted)' },
  ].filter(p => p.value > 0)

  // ── Team performance ───────────────────────────────────────────────────────
  const memberData = (members ?? []).map(m => {
    const uid  = (m.users as any)?.id ?? m.user_id
    const name = (m.users as any)?.name ?? 'Unknown'
    return {
      name,
      completed:  tasks.filter(t => t.assignee_id === uid && t.status === 'completed').length,
      inProgress: tasks.filter(t => t.assignee_id === uid && t.status === 'in_progress').length,
    }
  }).filter(m => m.completed + m.inProgress > 0)
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 8)

  // ── Project completion ─────────────────────────────────────────────────────
  const projectData = (projects ?? []).map(p => {
    const ptasks = tasks.filter(t => t.project_id === p.id)
    const done   = ptasks.filter(t => t.status === 'completed').length
    return { name: p.name.slice(0, 20), done, total: ptasks.length, pct: ptasks.length > 0 ? Math.round((done / ptasks.length) * 100) : 0 }
  }).filter(p => p.total > 0).sort((a, b) => b.pct - a.pct)

  // ── Time by project ────────────────────────────────────────────────────────
  const projMap = Object.fromEntries((projects ?? []).map(p => [p.id, p]))
  const timeByProjectMap: Record<string, { name: string; hours: number; color: string }> = {}
  logs.forEach(l => {
    if (!l.project_id) return
    const p = projMap[l.project_id]
    if (!p) return
    if (!timeByProjectMap[l.project_id]) timeByProjectMap[l.project_id] = { name: p.name.slice(0, 14), hours: 0, color: p.color }
    timeByProjectMap[l.project_id].hours += l.hours ?? 0
  })
  const timeByProject = Object.values(timeByProjectMap).sort((a, b) => b.hours - a.hours).slice(0, 6)

  const kpis = [
    { label: 'Tasks created',      value: totalTasks,       sub: 'last 30 days',      color: '#0d9488', bg: '#f0fdfa' },
    { label: 'Completed',          value: completed,         sub: `${completionRate}% rate`, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Overdue',            value: overdue,           sub: 'need attention',    color: overdue > 0 ? '#dc2626' : '#94a3b8', bg: overdue > 0 ? '#fef2f2' : '#f8fafc' },
    { label: 'Hours logged',       value: fmtHours(totalHours), sub: `${fmtHours(billableHours)} billable`, color: '#7c3aed', bg: '#f5f3ff' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background:'var(--surface-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: 22, gap: 12, flexWrap:'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color:'var(--text-primary)', marginBottom: 4 }}>Reports</h1>
            <p style={{ fontSize: 13, color:'var(--text-muted)' }}>Last 30 days · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <ReportsExport/>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 10, padding: '16px 18px', border: `1px solid ${k.color}22` }}>
              <p style={{ fontSize: 12, color: k.color, fontWeight: 500, marginBottom: 6 }}>{k.label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</p>
              <p style={{ fontSize: 11, color:'var(--text-muted)', marginTop: 4 }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <ReportsCharts
          dailyData={dailyData}
          memberData={memberData}
          priorityData={priorityData}
          projectData={projectData}
          timeByProject={timeByProject}
        />
      </div>
    </div>
  )
}
