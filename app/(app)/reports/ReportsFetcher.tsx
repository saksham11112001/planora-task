import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { ReportsCharts }  from './ReportsCharts'
import { ReportsExport }  from './ReportsExport'
import { fmtHours }       from '@/lib/utils/format'

export async function ReportsFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) return null

  const supabase = createAdminClient()
  const orgId  = mb.org_id
  const from30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const from90 = new Date(Date.now() - 90 * 86400000).toISOString()
  const today  = new Date().toISOString().split('T')[0]

  // Single unified task query — all columns needed by any tab, capped at 3000 rows.
  // Previously had 3 separate task queries (10k + 20k + 2k rows) — now one fetch, post-filtered in JS.
  const [
    { data: allTasksRaw },
    { count: overdueCount },
    { data: timeLogs },
    { data: projects },
    { data: members },
    { data: clients },
  ] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, status, priority, due_date, assignee_id, created_at, completed_at, project_id, client_id, is_billable, billable_amount, custom_fields')
      .eq('org_id', orgId).neq('is_archived', true).is('parent_task_id', null)
      .or(`status.neq.completed,completed_at.gte.${from90}`)
      .gte('created_at', from90).limit(3000),
    supabase.from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).neq('is_archived', true).is('parent_task_id', null)
      .not('status', 'in', '("completed","cancelled")')
      .not('due_date', 'is', null).lt('due_date', today),
    supabase.from('time_logs')
      .select('hours, is_billable, project_id, logged_date, user_id')
      .eq('org_id', orgId).gte('logged_date', from30.split('T')[0]),
    supabase.from('projects')
      .select('id, name, color').eq('org_id', orgId).eq('status', 'active').neq('is_archived', true),
    supabase.from('org_members')
      .select('user_id, role, users(id, name, email)').eq('org_id', orgId).eq('is_active', true),
    supabase.from('clients').select('id, name, color').eq('org_id', orgId).eq('status','active').order('name'),
  ])

  // Derived subsets — no extra DB round-trips
  const allTasks        = allTasksRaw ?? []
  const complianceTasksRaw = allTasks  // same data, compliance tab filters by custom_fields client-side
  const wipTasksRaw     = allTasks.filter(t => ['todo','in_progress','in_review'].includes(t.status) && !t.custom_fields?.is_recurring)

  const tasks   = allTasks
  const logs    = timeLogs ?? []

  // Single-pass aggregation over tasks — avoids repeated .filter() scans
  let totalTasks = 0, completed30 = 0
  const dailyCreated:   Record<string, number> = {}
  const dailyCompleted: Record<string, number> = {}
  const priorityCounts: Record<string, number> = {}
  const memberCompleted: Record<string, number> = {}
  const projectTotals:   Record<string, { total: number; done: number }> = {}
  const statusCounts:    Record<string, number> = {}

  for (const t of tasks) {
    const inLast30 = t.created_at >= from30
    if (inLast30) {
      totalTasks++
      if (t.status === 'completed') completed30++
    }
    // Daily chart (14-day window)
    const cd = t.created_at?.slice(0, 10)
    if (cd) dailyCreated[cd] = (dailyCreated[cd] ?? 0) + 1
    const cpd = t.completed_at?.slice(0, 10)
    if (cpd) dailyCompleted[cpd] = (dailyCompleted[cpd] ?? 0) + 1
    // Priority (open tasks in last 30 days)
    if (inLast30 && t.status !== 'completed' && t.status !== 'cancelled') {
      const p = t.priority ?? 'none'
      priorityCounts[p] = (priorityCounts[p] ?? 0) + 1
    }
    // Member completions (last 30 days)
    if (inLast30 && t.status === 'completed' && t.assignee_id) {
      memberCompleted[t.assignee_id] = (memberCompleted[t.assignee_id] ?? 0) + 1
    }
    // Project stats (last 30 days)
    if (inLast30 && t.project_id) {
      if (!projectTotals[t.project_id]) projectTotals[t.project_id] = { total: 0, done: 0 }
      projectTotals[t.project_id].total++
      if (t.status === 'completed') projectTotals[t.project_id].done++
    }
    // Status breakdown (full 90-day window)
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1
  }

  const overdue        = overdueCount ?? 0
  const completionRate = totalTasks > 0 ? Math.round((completed30 / totalTasks) * 100) : 0
  const completed      = completed30

  // Time aggregation (single pass)
  let totalHours = 0, billableHours = 0
  const timeByProjectMap: Record<string, { name: string; hours: number; color: string }> = {}
  const projMap = Object.fromEntries((projects ?? []).map(p => [p.id, p]))
  for (const l of logs) {
    totalHours   += l.hours ?? 0
    if (l.is_billable) billableHours += l.hours ?? 0
    if (l.project_id) {
      const p = projMap[l.project_id]
      if (p) {
        if (!timeByProjectMap[l.project_id]) timeByProjectMap[l.project_id] = { name: p.name.slice(0, 14), hours: 0, color: p.color }
        timeByProjectMap[l.project_id].hours += l.hours ?? 0
      }
    }
  }

  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d  = new Date(Date.now() - (13 - i) * 86400000)
    const ds = d.toISOString().split('T')[0]
    return { date: `${d.getDate()}/${d.getMonth() + 1}`, created: dailyCreated[ds] ?? 0, completed: dailyCompleted[ds] ?? 0 }
  })
  const dailyData = last14Days

  const PRIORITY_META: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent', color: '#dc2626' },
    high:   { label: 'High',   color: '#ea580c' },
    medium: { label: 'Medium', color: '#ca8a04' },
    low:    { label: 'Low',    color: '#16a34a' },
    none:   { label: 'None',   color: '#94a3b8' },
  }
  const priorityData = Object.entries(priorityCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: PRIORITY_META[k]?.label ?? k, value: v, color: PRIORITY_META[k]?.color ?? '#94a3b8' }))
    .sort((a, b) => b.value - a.value)

  const memberData = (members ?? []).map(m => {
    const uid  = (m.users as any)?.id ?? m.user_id
    const name = (m.users as any)?.name ?? 'Unknown'
    return { name, completed: memberCompleted[uid] ?? 0 }
  }).sort((a, b) => b.completed - a.completed).slice(0, 10)

  const projectData = (projects ?? []).map(p => {
    const s = projectTotals[p.id]
    if (!s || s.total === 0) return null
    return { name: p.name.slice(0, 20), done: s.done, total: s.total, pct: Math.round((s.done / s.total) * 100) }
  }).filter((p): p is NonNullable<typeof p> => p !== null).sort((a, b) => b.pct - a.pct)

  const timeByProject = Object.values(timeByProjectMap).sort((a, b) => b.hours - a.hours).slice(0, 6)

  // Pre-build indexes for O(1) lookups inside employeeStats
  const tasksByAssignee: Record<string, typeof tasks> = {}
  for (const t of tasks) {
    if (!t.assignee_id) continue
    if (!tasksByAssignee[t.assignee_id]) tasksByAssignee[t.assignee_id] = []
    tasksByAssignee[t.assignee_id].push(t)
  }
  const hoursByUser: Record<string, number> = {}
  for (const l of logs) {
    if (l.user_id) hoursByUser[l.user_id] = (hoursByUser[l.user_id] ?? 0) + (l.hours ?? 0)
  }

  const week6Ranges = Array.from({ length: 6 }, (_, i) => {
    const weekStart = new Date(Date.now() - (5 - i) * 7 * 86400000)
    return { label: `W${i + 1}`, ws: weekStart.toISOString().split('T')[0], we: new Date(weekStart.getTime() + 7 * 86400000).toISOString().split('T')[0] }
  })

  const employeeStats = (members ?? []).map(m => {
    const uid      = (m.users as any)?.id ?? m.user_id
    const name     = (m.users as any)?.name ?? 'Unknown'
    const email    = (m.users as any)?.email ?? ''
    const role     = m.role ?? 'member'
    const assigned = tasksByAssignee[uid] ?? []
    const done     = assigned.filter(t => t.status === 'completed')
    const overdueT = assigned.filter(t => t.due_date && t.due_date < today && t.status !== 'completed')
    const inReview = assigned.filter(t => t.status === 'in_review')
    const withDue  = done.filter(t => t.due_date)
    const onTime   = withDue.filter(t => t.completed_at && t.due_date && new Date(t.completed_at).setHours(0,0,0,0) <= new Date(t.due_date).getTime())
    const onTimeRate = withDue.length > 0 ? Math.round((onTime.length / withDue.length) * 100) : null
    const completionTimes = done
      .filter(t => t.created_at && t.completed_at)
      .map(t => Math.max(0, (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / 86400000))
    const avgDays = completionTimes.length > 0
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length * 10) / 10 : null
    const urgentHigh = assigned.filter(t => ['urgent','high'].includes(t.priority)).length
    const weeklyTrend = week6Ranges.map(({ label, ws, we }) => ({
      week:      label,
      completed: done.filter(t => t.completed_at && t.completed_at >= ws && t.completed_at < we).length,
      assigned:  assigned.filter(t => t.created_at >= ws && t.created_at < we).length,
    }))
    return {
      uid, name, email, role,
      total: assigned.length, completed: done.length, overdue: overdueT.length,
      inReview: inReview.length, onTimeRate, avgDays,
      hoursLogged: Math.round((hoursByUser[uid] ?? 0) * 10) / 10,
      urgentHigh, weeklyTrend,
      completionRate: assigned.length > 0 ? Math.round((done.length / assigned.length) * 100) : 0,
    }
  }).sort((a, b) => b.completed - a.completed)

  // ── WIP data — use pre-built indexes to avoid O(n²) scans ──────────────
  const memberById: Record<string, any> = {}
  ;(members ?? []).forEach((m: any) => { memberById[(m.users as any)?.id ?? m.user_id] = m })
  const clientById: Record<string, any> = {}
  ;(clients ?? []).forEach(c => { clientById[c.id] = c })
  // timeByProjectMap already built in single-pass loop above
  const wipData = (wipTasksRaw ?? []).map(t => {
    const memberHours = timeByProjectMap[t.project_id ?? '']?.hours ?? 0
    const member    = t.assignee_id ? memberById[t.assignee_id] : null
    const clientObj = t.client_id   ? clientById[t.client_id]   : null
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      assignee_name: (member?.users as any)?.name ?? null,
      client_id: t.client_id,
      client_name: clientObj?.name ?? null,
      client_color: clientObj?.color ?? '#94a3b8',
      project_id: t.project_id ?? null,
      hours_logged: Math.round(memberHours * 10) / 10,
      is_billable: t.is_billable,
    }
  })
  // ── end WIP data ────────────────────────────────────────────────────────

  // ── Compliance raw tasks — aggregation done client-side for filtering ──
  const complianceRawTasks = (complianceTasksRaw ?? []) as {
    id: string; title: string; status: string; priority: string
    due_date: string | null; created_at: string; completed_at: string | null
    custom_fields: Record<string, any> | null
    assignee_id: string | null; client_id: string | null
  }[]
  const complianceMemberList = (members ?? []).map((m: any) => ({
    id:   (m.users as any)?.id   ?? m.user_id,
    name: (m.users as any)?.name ?? 'Unknown',
  }))
  // ── end compliance data ─────────────────────────────────────────────────

  // ── Company trajectory — 12 weeks, using pre-built daily maps (no re-scan) ──
  const trajectoryData = Array.from({ length: 12 }, (_, i) => {
    const weekEndMs   = Date.now() - (11 - i) * 7 * 86400000
    const weekStartMs = weekEndMs - 7 * 86400000
    const ws = new Date(weekStartMs).toISOString().split('T')[0]
    const we = new Date(weekEndMs).toISOString().split('T')[0]
    const d  = new Date(weekStartMs)
    let added = 0, completedW = 0
    for (const [day, count] of Object.entries(dailyCreated))   { if (day >= ws && day <= we) added      += count }
    for (const [day, count] of Object.entries(dailyCompleted)) { if (day >= ws && day <= we) completedW += count }
    return { week: `${d.getDate()}/${d.getMonth() + 1}`, added, completed: completedW }
  })

  // ── Task status breakdown — from single-pass statusCounts map ────────────
  const statusBreakdown = [
    { name: 'To Do',       value: statusCounts['todo']        ?? 0, color: '#64748b' },
    { name: 'In Progress', value: statusCounts['in_progress'] ?? 0, color: '#0891b2' },
    { name: 'In Review',   value: statusCounts['in_review']   ?? 0, color: '#7c3aed' },
    { name: 'Completed',   value: statusCounts['completed']   ?? 0, color: '#16a34a' },
    { name: 'Cancelled',   value: statusCounts['cancelled']   ?? 0, color: '#f87171' },
  ].filter(s => s.value > 0)

  // ── Action items — overdue, pending approval, unassigned urgent ───────────
  const memberMap: Record<string, string> = {}
  ;(members ?? []).forEach((m: any) => {
    const uid  = (m.users as any)?.id ?? m.user_id
    const name = (m.users as any)?.name ?? 'Unknown'
    memberMap[uid] = name
  })

  const actionItems = {
    overdue: tasks
      .filter(t => t.due_date && t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled')
      .map(t => ({
        id:            t.id,
        title:         t.title,
        priority:      t.priority,
        due_date:      t.due_date!,
        assignee_name: t.assignee_id ? (memberMap[t.assignee_id] ?? 'Unknown') : null,
        days_overdue:  Math.floor((Date.now() - new Date(t.due_date!).getTime()) / 86400000),
      }))
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .slice(0, 25),
    pending_approval: tasks
      .filter(t => t.status === 'in_review')
      .map(t => ({
        id:            t.id,
        title:         t.title,
        priority:      t.priority,
        assignee_name: t.assignee_id ? (memberMap[t.assignee_id] ?? 'Unknown') : null,
        days_waiting:  Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000),
        due_date:      t.due_date ?? null,
      }))
      .sort((a, b) => b.days_waiting - a.days_waiting)
      .slice(0, 25),
    unassigned_urgent: tasks
      .filter(t => !t.assignee_id && ['urgent', 'high'].includes(t.priority) && t.status !== 'completed' && t.status !== 'cancelled')
      .map(t => ({
        id:       t.id,
        title:    t.title,
        priority: t.priority,
        due_date: t.due_date ?? null,
      }))
      .slice(0, 15),
  }

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

        <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
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
          complianceRawTasks={complianceRawTasks}
          complianceMemberList={complianceMemberList}
          wipData={wipData}
          trajectoryData={trajectoryData}
          statusBreakdown={statusBreakdown}
          actionItems={actionItems}
        />
      </div>
    </div>
  )
}
