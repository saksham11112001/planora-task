import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { RecurringView } from './RecurringView'
import { nextOccurrence, shiftDays } from '@/lib/utils/recurringSchedule'

const TASK_SELECT = 'id, title, status, priority, frequency, next_occurrence_date, assignee_id, approver_id, client_id, created_by, created_at, updated_at, is_billable, billable_amount, custom_fields, assignee:users!tasks_assignee_id_fkey(id, name), approver:users!tasks_approver_id_fkey(id, name), creator:users!tasks_created_by_fkey(id, name), projects(id, name, color), clients(id, name, color)'

export async function RecurringFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) return null

  const supabase = createAdminClient()
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
      ).limit(10000)
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

  // Self-heal: fix any recurring tasks whose next_occurrence_date was miscalculated
  // by the old bug (monthly_days: falling through to the monthly_ branch and always
  // returning the 1st of the month). Run in background — doesn't block page render.
  const today = new Date().toISOString().split('T')[0]
  const tasksToFix = (tasks ?? []).filter((t: any) => {
    const granular = t.custom_fields?._granular_frequency as string | undefined
    if (!granular || !t.next_occurrence_date) return false
    const correct = nextOccurrence(granular, shiftDays(today, -1))
    // Fix if stored date is in the past (missed occurrence) OR simply wrong for the frequency
    return t.next_occurrence_date !== correct && t.next_occurrence_date < correct
  })
  if (tasksToFix.length > 0) {
    // Fire-and-forget — don't await so page loads immediately with fresh data on next visit
    Promise.all(tasksToFix.map((t: any) => {
      const granular = t.custom_fields?._granular_frequency as string
      const correct  = nextOccurrence(granular, shiftDays(today, -1))
      return supabase.from('tasks').update({ next_occurrence_date: correct }).eq('id', t.id)
    })).catch(() => {})
  }

  return (
    <RecurringView
      tasks={(tasks ?? []).map(t => ({ ...t, is_recurring: true, is_billable: (t as any).is_billable ?? false, billable_amount: (t as any).billable_amount ?? null, assignee: (t.assignee as any) ?? null, approver: (t as any).approver ?? null, creator: (t as any).creator ?? null, project: (t.projects as any) ?? null, client: (t.clients as any) ?? null, created_at: (t as any).created_at ?? '', updated_at: (t as any).updated_at ?? null }))}
      members={memberListWithRoles} projects={projects ?? []} clients={clients ?? []} currentUserId={user.id} canManage={canManage} userRole={mb.role}/>
  )
}
