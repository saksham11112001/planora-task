import { createClient }    from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export const maxDuration = 60 // seconds — report export can be slow on large orgs

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id')
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Reports requires Starter+ plan
  const adminC = createAdminClient()
  const { data: orgData } = await adminC.from('organisations')
    .select('plan_tier, status, trial_ends_at').eq('id', mb.org_id).single()
  const plan = effectivePlan(orgData ?? { plan_tier: 'free', status: 'active' })
  if (!canUseFeature(plan, 'reports')) {
    return NextResponse.json({ error: 'Reports require Starter plan or above.' }, { status: 403 })
  }

  const sp           = req.nextUrl.searchParams
  const type         = sp.get('type') ?? 'tasks'
  const format       = sp.get('format') ?? 'csv'     // 'csv' | 'xlsx'
  const assigneeIds  = sp.getAll('assigneeId')        // optional filter
  const clientIds    = sp.getAll('clientId')
  const priorities   = sp.getAll('priority')
  const statuses     = sp.getAll('status')
  const dueDateFrom  = sp.get('dueDateFrom') ?? null
  const dueDateTo    = sp.get('dueDateTo')   ?? null
  const from30       = new Date(Date.now() - 30 * 86400000).toISOString()

  if (type === 'tasks') {
    let q = adminC.from('tasks')
      .select('title, status, priority, due_date, completed_at, assignee:users!tasks_assignee_id_fkey(name), project:projects(name), client:clients(name)')
      .eq('org_id', mb.org_id).gte('created_at', from30).neq('is_archived', true)
      .order('created_at', { ascending: false })

    // Apply optional filters
    if (assigneeIds.length)  q = q.in('assignee_id', assigneeIds)
    if (clientIds.length)    q = q.in('client_id', clientIds)
    if (priorities.length)   q = q.in('priority', priorities)
    if (statuses.length)     q = q.in('status', statuses)
    if (dueDateFrom)         q = (q as any).gte('due_date', dueDateFrom)
    if (dueDateTo)           q = (q as any).lte('due_date', dueDateTo)

    const { data: tasks } = await q
    const header = ['Title', 'Status', 'Priority', 'Assignee', 'Project', 'Client', 'Due date', 'Completed at']
    const rows = (tasks ?? []).map(t => [
      t.title, t.status, t.priority,
      (t.assignee as any)?.name ?? '', (t.project as any)?.name ?? '', (t.client as any)?.name ?? '',
      t.due_date ?? '', t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-IN') : '',
    ])
    const date = new Date().toISOString().split('T')[0]

    if (format === 'xlsx') {
      const XLSX = (await import('xlsx')).default
      const wb   = XLSX.utils.book_new()
      const ws   = XLSX.utils.aoa_to_sheet([header, ...rows])
      XLSX.utils.book_append_sheet(wb, ws, 'Tasks')
      const rawBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as number[]
      const buf    = new Blob([new Uint8Array(rawBuf)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      return new NextResponse(buf, { headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="tasks-${date}.xlsx"`,
      }})
    }

    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    return new NextResponse(csv, { headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="tasks-${date}.csv"`,
    }})
  }

  if (type === 'time') {
    const logDateFrom = dueDateFrom ?? from30.split('T')[0]
    const logDateTo   = dueDateTo   ?? undefined

    let q = adminC.from('time_logs')
      .select('hours, is_billable, description, logged_date, user:users!time_logs_user_id_fkey(name), project:projects(name), task:tasks(title)')
      .eq('org_id', mb.org_id).gte('logged_date', logDateFrom)
      .order('logged_date', { ascending: false })

    if (logDateTo) q = (q as any).lte('logged_date', logDateTo)

    const { data: logs } = await q
    const header = ['Date', 'Hours', 'Billable', 'Description', 'Project', 'Task', 'Team member']
    const rows = (logs ?? []).map(l => [
      l.logged_date, l.hours, l.is_billable ? 'Yes' : 'No', l.description ?? '',
      (l.project as any)?.name ?? '', (l.task as any)?.title ?? '', (l.user as any)?.name ?? '',
    ])
    const date = new Date().toISOString().split('T')[0]

    if (format === 'xlsx') {
      const XLSX = (await import('xlsx')).default
      const wb   = XLSX.utils.book_new()
      const ws   = XLSX.utils.aoa_to_sheet([header, ...rows])
      XLSX.utils.book_append_sheet(wb, ws, 'Time Logs')
      const rawBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as number[]
      const buf    = new Blob([new Uint8Array(rawBuf)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      return new NextResponse(buf, { headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="time-logs-${date}.xlsx"`,
      }})
    }

    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    return new NextResponse(csv, { headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="time-logs-${date}.csv"`,
    }})
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
