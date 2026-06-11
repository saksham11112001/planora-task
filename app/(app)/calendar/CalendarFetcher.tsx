import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { CalendarView } from './CalendarView'
import { shiftDays } from '@/lib/utils/recurringSchedule'

const TASK_SELECT = 'id, title, status, priority, due_date, next_occurrence_date, is_recurring, parent_task_id, parent_recurring_id, project_id, assignee_id, approver_id, approval_status, approval_required, client_id, frequency, custom_fields, is_billable, billable_amount, projects(id,name,color), assignee:users!tasks_assignee_id_fkey(id,name), approver:users!tasks_approver_id_fkey(id,name)'

export async function CalendarFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) return null

  const supabase = createAdminClient()
  const isOwnerAdmin = ['owner', 'admin'].includes(mb.role)
  const isManager    = ['owner', 'admin', 'manager'].includes(mb.role)
  const canViewAll   = isManager || (mb as any).can_view_all_tasks === true

  const from = new Date(); from.setMonth(from.getMonth() - 6)
  const to   = new Date(); to.setMonth(to.getMonth() + 6)
  const dateFrom = from.toISOString().split('T')[0]
  const dateTo   = to.toISOString().split('T')[0]

  const baseQuery = supabase.from('tasks')
    .select(TASK_SELECT)
    .eq('org_id', mb.org_id).not('due_date', 'is', null).neq('is_archived', true)
    .gte('due_date', dateFrom).lte('due_date', dateTo)

  // Org-wide view (managers/admins): top-level tasks only to avoid subtask flooding.
  // Personal view: include subtasks the user is directly assigned to or approving.
  const taskQuery = canViewAll
    ? baseQuery.is('parent_task_id', null)
    : baseQuery.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)

  // Second query: fetch recurring templates by next_occurrence_date so future
  // occurrences appear on the calendar even when due_date is null on the template.
  const recurringTemplateQuery = supabase.from('tasks')
    .select(TASK_SELECT)
    .eq('org_id', mb.org_id).eq('is_recurring', true).neq('is_archived', true)
    .not('next_occurrence_date', 'is', null)
    .gte('next_occurrence_date', dateFrom).lte('next_occurrence_date', dateTo)
    .is('parent_task_id', null)
    .limit(2000)

  const [{ data: tasks }, { data: recurringTemplates }, { data: clients }, { data: members }, { data: caAssignments }, { data: caInstances }] = await Promise.all([
    taskQuery.limit(10000),
    recurringTemplateQuery,
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
    supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
    isOwnerAdmin
      ? supabase.from('ca_client_assignments')
          .select('id, client_id, assignee_id, master_task:ca_master_tasks(id, name, priority, dates, days_before_due)')
          .eq('org_id', mb.org_id).eq('is_active', true)
      : Promise.resolve({ data: [] as any[] }),
    isOwnerAdmin
      ? supabase.from('ca_task_instances').select('assignment_id, due_date').eq('org_id', mb.org_id)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const memberList = (members ?? []).map((m: any) => ({ id: m.users?.id ?? m.user_id, name: m.users?.name ?? 'Unknown' }))

  const clientMap: Record<string, { id: string; name: string; color: string }> = {}
  ;(clients ?? []).forEach((c: any) => { clientMap[c.id] = c })

  const enrich = (t: any) => ({
    ...t,
    // Templates may have due_date=null — fall back to next_occurrence_date so
    // the calendar expansion logic has a valid starting date.
    due_date: t.due_date ?? t.next_occurrence_date ?? null,
    client:   t.client_id ? (clientMap[t.client_id] ?? null) : null,
    approver: t.approver ?? null,
  })

  // Merge regular tasks + recurring templates, deduplicate by ID
  const seenIds = new Set<string>()
  const allTasks = [...(tasks ?? []), ...(recurringTemplates ?? [])]
  const enrichedTasks = allTasks
    .filter((t: any) => { if (seenIds.has(t.id)) return false; seenIds.add(t.id); return true })
    .map(enrich)
    .filter((t: any) => !!t.due_date)  // skip any that still have no date

  type UpcomingCATrigger = {
    id: string; title: string; triggerDate: string; dueDate: string
    clientId: string | null; clientName: string | null; clientColor: string | null
    assigneeId: string | null; priority: string
  }
  const upcomingCATriggers: UpcomingCATrigger[] = []
  if (isOwnerAdmin && caAssignments) {
    const todayD = new Date()
    const todayS = todayD.toISOString().slice(0, 10)
    const limitD = new Date(todayD); limitD.setDate(todayD.getDate() + 3)
    const limitS = limitD.toISOString().slice(0, 10)
    const existingSet = new Set((caInstances ?? []).map((i: any) => `${i.assignment_id}__${i.due_date}`))
    for (const asgn of (caAssignments as any[])) {
      const mt = asgn.master_task
      if (!mt?.dates) continue
      for (const [, dueDateStr] of Object.entries(mt.dates as Record<string, string>)) {
        if (typeof dueDateStr !== 'string') continue
        const daysBeforeDue = (mt.days_before_due as number) ?? 7
        const triggerS = shiftDays(dueDateStr, -daysBeforeDue)
        if (triggerS >= todayS && triggerS <= limitS && !existingSet.has(`${asgn.id}__${dueDateStr}`)) {
          const cl = clientMap[asgn.client_id]
          upcomingCATriggers.push({
            id: `upcoming-${asgn.id}-${dueDateStr}`,
            title: mt.name as string,
            triggerDate: triggerS,
            dueDate: dueDateStr,
            clientId: asgn.client_id ?? null,
            clientName: cl?.name ?? null,
            clientColor: cl?.color ?? null,
            assigneeId: asgn.assignee_id ?? null,
            priority: (mt.priority as string) ?? 'medium',
          })
        }
      }
    }
  }

  return <CalendarView
    tasks={enrichedTasks as any}
    clients={clients ?? []}
    members={memberList}
    canViewAll={canViewAll}
    currentUserId={user.id}
    userRole={mb.role}
    upcomingCATriggers={upcomingCATriggers}
  />
}
