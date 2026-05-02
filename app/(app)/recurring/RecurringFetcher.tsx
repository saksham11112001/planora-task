import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { RecurringView } from './RecurringView'

const TASK_SELECT = 'id, title, status, priority, frequency, next_occurrence_date, assignee_id, approver_id, client_id, created_by, created_at, updated_at, is_billable, billable_amount, assignee:users!tasks_assignee_id_fkey(id, name), approver:users!tasks_approver_id_fkey(id, name), creator:users!tasks_created_by_fkey(id, name), projects(id, name, color), clients(id, name, color)'

export async function RecurringFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getOrgMembership(user.id)
  if (!mb) return null

  const supabase = await createClient()
  const canViewAll = ['owner', 'admin'].includes(mb.role) || (mb as any).can_view_all_tasks === true
  const canManage  = ['owner','admin','manager'].includes(mb.role)

  const [{ data: tasks }, { data: members }, { data: projects }, { data: clients }] = await Promise.all([
    (() => {
      const q = supabase.from('tasks').select(TASK_SELECT)
        .eq('org_id', mb.org_id).eq('is_recurring', true).neq('is_archived', true)
        .order('next_occurrence_date', { ascending: true })
      return (canViewAll
        ? q
        : q.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)
      ).limit(2000)
    })(),
    supabase.from('org_members').select('user_id, role, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
    supabase.from('projects').select('id, name, color').eq('org_id', mb.org_id).neq('is_archived', true).order('name'),
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
  ])

  const memberListWithRoles = (members ?? []).map(m => ({
    id: (m.users as any)?.id ?? m.user_id,
    name: (m.users as any)?.name ?? 'Unknown',
    role: (m as any).role ?? 'member',
  }))

  return (
    <RecurringView
      tasks={(tasks ?? []).map(t => ({ ...t, is_recurring: true, is_billable: (t as any).is_billable ?? false, billable_amount: (t as any).billable_amount ?? null, assignee: (t.assignee as any) ?? null, approver: (t as any).approver ?? null, creator: (t as any).creator ?? null, project: (t.projects as any) ?? null, client: (t.clients as any) ?? null, created_at: (t as any).created_at ?? '', updated_at: (t as any).updated_at ?? null }))}
      members={memberListWithRoles} projects={projects ?? []} clients={clients ?? []} currentUserId={user.id} canManage={canManage} userRole={mb.role}/>
  )
}
