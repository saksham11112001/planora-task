import { createClient }    from '@/lib/supabase/server'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const type   = req.nextUrl.searchParams.get('type') ?? 'tasks'
  const from30 = new Date(Date.now() - 30 * 86400000).toISOString()

  if (type === 'tasks') {
    const { data: tasks } = await supabase.from('tasks')
      .select('title, status, priority, due_date, completed_at, assignee:users!tasks_assignee_id_fkey(name), project:projects(name), client:clients(name)')
      .eq('org_id', mb.org_id).gte('created_at', from30).neq('is_archived', true)
      .order('created_at', { ascending: false })
    const rows = [
      ['Title','Status','Priority','Assignee','Project','Client','Due date','Completed at'],
      ...(tasks ?? []).map(t => [
        t.title, t.status, t.priority,
        (t.assignee as any)?.name ?? '', (t.project as any)?.name ?? '', (t.client as any)?.name ?? '',
        t.due_date ?? '', t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-IN') : '',
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    return new NextResponse(csv, { headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="tasks-${new Date().toISOString().split('T')[0]}.csv"`,
    }})
  }

  if (type === 'time') {
    const { data: logs } = await supabase.from('time_logs')
      .select('hours, is_billable, description, logged_date, user:users!time_logs_user_id_fkey(name), project:projects(name), task:tasks(title)')
      .eq('org_id', mb.org_id).gte('logged_date', from30.split('T')[0]).order('logged_date', { ascending: false })
    const rows = [
      ['Date','Hours','Billable','Description','Project','Task','Team member'],
      ...(logs ?? []).map(l => [
        l.logged_date, l.hours, l.is_billable ? 'Yes' : 'No', l.description ?? '',
        (l.project as any)?.name ?? '', (l.task as any)?.title ?? '', (l.user as any)?.name ?? '',
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    return new NextResponse(csv, { headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="time-logs-${new Date().toISOString().split('T')[0]}.csv"`,
    }})
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
