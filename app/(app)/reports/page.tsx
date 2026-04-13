import { createClient }   from '@/lib/supabase/server'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'
import { redirect }       from 'next/navigation'
import { ReportsCharts }  from './ReportsCharts'
import { UpgradeWall }    from '@/components/ui/UpgradeWall'
import { ReportsExport }  from './ReportsExport'
import { fmtHours }       from '@/lib/utils/format'
import type { Metadata }  from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  // Reports is a paid feature (Starter+)
  const { data: orgData } = await supabase.from('organisations')
    .select('plan_tier, status, trial_ends_at').eq('id', mb.org_id).maybeSingle()
  const plan = effectivePlan(orgData ?? { plan_tier: 'free', status: 'active' })
  if (!canUseFeature(plan, 'reports')) {
    return <UpgradeWall
      feature="Reports"
      description="Get detailed insights on task completion, team performance, time logs, overdue work, and billing summaries — all in one place."
      requiredPlan="Starter"
      icon="📊"
    />
  }

  const orgId  = mb.org_id
  const from30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const from90 = new Date(Date.now() - 90 * 86400000).toISOString()
  const today  = new Date().toISOString().split('T')[0]

  const [
    { data: allTasks },
    { data: timeLogs },
    { data: projects },
    { data: members },
    { data: clients },
  ] = await Promise.all([
    // Fetch all active (non-completed) tasks with no date limit so in_progress /
    // overdue / in_review counts are accurate regardless of when the task was created.
    // Also fetch completed tasks from the last 90 days for trend + completion stats.
    // .limit(5000) prevents Supabase's silent 1000-row default from truncating results.
    supabase.from('tasks')
      .select('id, title, status, priority, due_date, assignee_id, created_at, completed_at, project_id')
      .eq('org_id', orgId).eq('is_recurring', false).neq('is_archived', true).is('parent_task_id', null)
      .or(`status.neq.completed,completed_at.gte.${from90}`)
      .limit(5000),
    supabase.from('time_logs')
      .select('hours, is_billable, project_id, logged_date, user_id')
      .eq('org_id', orgId).gte('logged_date', from30.split('T')[0]),
    supabase.from('projects')
      .select('id, name, color').eq('org_id', orgId).eq('status', 'active').neq('is_archived', true),
    supabase.from('org_members')
      .select('user_id, role, users(id, name, email)').eq('org_id', orgId).eq('is_active', true),
    supabase.from('clients').select('id, name, color').eq('org_id', orgId).eq('status','active').order('name'),
  ])

  const tasks   = allTasks ?? []
  const logs    = timeLogs ?? []
  const tasks30 = tasks.filter(t => t.created_at >= from30)

  // ── KPIs (last 30 days) ───────────────────────────────────────
  const totalTasks     = tasks30.length
  const completed      = tasks30.filter(t => t.status === 'completed').length
  const overdue        = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length
  const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0
  const totalHours     = logs.reduce((s, l) => s + (l.hours ?? 0), 0)
  const billableHours  = logs.filter(l => l.is_billable).reduce((s, l) => s + (l.hours ?? 0), 0)

  // ── Daily trend ───────────────────────────────────────────────
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const d  = new Date(Date.now() - (13 - i) * 86400000)
    const ds = d.toISOString().split('T')[0]
    return {
      date:      `${d.getDate()}/${d.getMonth() + 1}`,
      created:   tasks.filter(t => t.created_at?.startsWith(ds)).length,
      completed: tasks.filter(t => t.completed_at?.startsWith(ds)).length,
    }
  })

  // ── Priority breakdown ────────────────────────────────────────
  const open = tasks30.filter(t => t.status !== 'completed')
  const priorityData = [
    { name: 'Urgent',  value: open.filter(t => t.priority === 'urgent').length,  color: '#dc2626' },
    { name: 'High',    value: open.filter(t => t.priority === 'high').length,    color: '#ea580c' },
    { name: 'Medium',  value: open.filter(t => t.priority === 'medium').length,  color: '#ca8a04' },
    { name: 'Low',     value: open.filter(t => t.priority === 'low').length,     color: '#16a34a' },
    { name: 'None',    value: open.filter(t => t.priority === 'none').length,    color: '#94a3b8' },
  ].filter(p => p.value > 0)

  // ── Team chart (bar chart) ────────────────────────────────────
  const memberData = (members ?? []).map(m => {
    const uid  = (m.users as any)?.id ?? m.user_id
    const name = (m.users as any)?.name ?? 'Unknown'
    return {
      name,
      completed:  tasks30.filter(t => t.assignee_id === uid && t.status === 'completed').length,
      inProgress: tasks30.filter(t => t.assignee_id === uid && t.status === 'in_progress').length,
    }
  }).sort((a, b) => b.completed - a.completed).slice(0, 10)

  // ── Project completion ────────────────────────────────────────
  const projectData = (projects ?? []).map(p => {
    const ptasks = tasks30.filter(t => t.project_id === p.id)
    const done   = ptasks.filter(t => t.status === 'completed').length
    return { name: p.name.slice(0, 20), done, total: ptasks.length, pct: ptasks.length > 0 ? Math.round((done / ptasks.length) * 100) : 0 }
  }).filter(p => p.total > 0).sort((a, b) => b.pct - a.pct)

  // ── Time by project ───────────────────────────────────────────
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

  // ── Employee Performance (last 90 days for richer data) ───────
  const employeeStats = (members ?? []).map(m => {
    const uid   = (m.users as any)?.id ?? m.user_id
    const name  = (m.users as any)?.name ?? 'Unknown'
    const email = (m.users as any)?.email ?? ''
    const role  = m.role ?? 'member'

    const assigned = tasks.filter(t => t.assignee_id === uid)
    const done     = assigned.filter(t => t.status === 'completed')
    const overdueT = assigned.filter(t => t.due_date && t.due_date < today && t.status !== 'completed')
    const inProg   = assigned.filter(t => t.status === 'in_progress')
    const inReview = assigned.filter(t => t.status === 'in_review')

    // On-time: completed before or on due_date
    const withDue       = done.filter(t => t.due_date)
    const onTime        = withDue.filter(t => t.completed_at && t.due_date && t.completed_at.split('T')[0] <= t.due_date)
    const onTimeRate    = withDue.length > 0 ? Math.round((onTime.length / withDue.length) * 100) : null

    // Avg completion time in days
    const completionTimes = done
      .filter(t => t.created_at && t.completed_at)
      .map(t => {
        const created   = new Date(t.created_at).getTime()
        const completedAt = new Date(t.completed_at!).getTime()
        return Math.max(0, (completedAt - created) / 86400000)
      })
    const avgDays = completionTimes.length > 0
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length * 10) / 10
      : null

    // Hours logged
    const hoursLogged = logs.filter(l => l.user_id === uid).reduce((s, l) => s + (l.hours ?? 0), 0)

    // Priority distribution of assigned tasks
    const urgentHigh = assigned.filter(t => ['urgent','high'].includes(t.priority)).length

    // Weekly trend (last 6 weeks)
    const weeklyTrend = Array.from({ length: 6 }, (_, i) => {
      const weekStart = new Date(Date.now() - (5 - i) * 7 * 86400000)
      const weekEnd   = new Date(weekStart.getTime() + 7 * 86400000)
      const ws = weekStart.toISOString().split('T')[0]
      const we = weekEnd.toISOString().split('T')[0]
      return {
        week: `W${i + 1}`,
        completed: done.filter(t => t.completed_at && t.completed_at >= ws && t.completed_at < we).length,
        assigned:  assigned.filter(t => t.created_at >= ws && t.created_at < we).length,
      }
    })

    return {
      uid, name, email, role,
      total:      assigned.length,
      completed:  done.length,
      overdue:    overdueT.length,
      inProgress: inProg.length,
      inReview:   inReview.length,
      onTimeRate,
      avgDays,
      hoursLogged: Math.round(hoursLogged * 10) / 10,
      urgentHigh,
      weeklyTrend,
      completionRate: assigned.length > 0 ? Math.round((done.length / assigned.length) * 100) : 0,
    }
  }).sort((a, b) => b.completed - a.completed)

  const kpis = [
    { label: 'Tasks created',    value: totalTasks,           sub: 'last 30 days',           color: '#0d9488', bg: '#f0fdfa' },
    { label: 'Completed',        value: completed,            sub: `${completionRate}% rate`, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Overdue',          value: overdue,              sub: 'need attention',          color: overdue > 0 ? '#dc2626' : '#94a3b8', bg: overdue > 0 ? '#fef2f2' : '#f8fafc' },
    { label: 'Hours logged',     value: fmtHours(totalHours), sub: `${fmtHours(billableHours)} billable`, color: '#7c3aed', bg: '#f5f3ff' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--surface-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Reports</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Last 30 days · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <ReportsExport/>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 10, padding: '16px 18px', border: `1px solid ${k.color}22` }}>
              <p style={{ fontSize: 12, color: k.color, fontWeight: 500, marginBottom: 6 }}>{k.label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{k.sub}</p>
            </div>
          ))}
        </div>

        <ReportsCharts
          dailyData={dailyData}
          memberData={memberData}
          priorityData={priorityData}
          projectData={projectData}
          timeByProject={timeByProject}
          employeeStats={employeeStats}
          currentUserId={user.id}
          clients={clients ?? []}
          userRole={mb.role}
        />
      </div>
    </div>
  )
}
