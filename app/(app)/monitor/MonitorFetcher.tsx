import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { MonitorView }  from './MonitorView'
import { canDo }        from '@/lib/utils/permissionGate'
import { redirect }     from 'next/navigation'

const TASK_COLS = 'id, title, status, priority, due_date, completed_at, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, is_recurring, custom_fields, created_at, updated_at, is_billable, billable_amount, assignee:users!tasks_assignee_id_fkey(id, name), approver:users!tasks_approver_id_fkey(id, name), creator:users!tasks_created_by_fkey(id, name), projects(id, name, color)'

export async function MonitorFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getOrgMembership(user.id)
  if (!mb) return null

  const supabase = await createClient()

  const hasRoleAccess    = await canDo(supabase, mb.org_id, mb.role, 'monitor.view')
  const hasMemberAccess  = mb.can_view_monitor === true
  if (!hasRoleAccess && !hasMemberAccess) {
    redirect('/dashboard?error=monitor_access_denied')
  }

  const from90 = new Date(Date.now() - 90 * 86400000).toISOString()

  const [{ data: tasks }, { data: members }, { data: clientsData }] = await Promise.all([
    supabase.from('tasks')
      .select(TASK_COLS)
      .eq('org_id', mb.org_id)
      .neq('is_archived', true)
      .is('parent_task_id', null)
      .or(`status.neq.completed,completed_at.gte.${from90}`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(1500),
    supabase.from('org_members')
      .select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
    supabase.from('clients').select('id, name, color, status').eq('org_id', mb.org_id).order('name'),
  ])

  const clientMap: Record<string, { id: string; name: string; color: string }> = {}
  clientsData?.forEach(c => { clientMap[c.id] = { id: c.id, name: c.name, color: c.color } })
  const clientList = (clientsData ?? []).map(c => ({ id: c.id, name: c.name, color: c.color }))
  const memberList = (members ?? []).map((m: any) => ({
    id: (m.users as any)?.id ?? m.user_id,
    name: (m.users as any)?.name ?? 'Unknown',
  }))

  const taskList = (tasks ?? []).map((t: any) => ({
    ...t,
    due_date: t.due_date ?? null, completed_at: t.completed_at ?? null,
    assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
    project_id: t.project_id ?? null, approval_status: t.approval_status ?? null,
    is_recurring: t.is_recurring ?? false, created_at: t.created_at ?? '',
    updated_at: t.updated_at ?? null, is_billable: t.is_billable ?? false,
    billable_amount: t.billable_amount ?? null,
    assignee: (t.assignee as any) ?? null, approver: (t.approver as any) ?? null,
    creator: (t.creator as any) ?? null,
    client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
    project: (t.projects as any) ?? null,
  }))

  return <MonitorView
    tasks={taskList as any}
    members={memberList}
    clients={clientList}
    currentUserId={user.id}
    userRole={mb.role}
  />
}
