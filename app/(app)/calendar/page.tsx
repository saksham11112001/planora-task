import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { CalendarView } from './CalendarView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Calendar' }

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role, can_view_all_tasks').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  const orgId = mb.org_id
  const isOwnerAdmin = ['owner', 'admin'].includes(mb.role)

  // canViewAll: owner/admin always; others only if explicitly granted via Members settings
  const canViewAll = isOwnerAdmin || (mb as any).can_view_all_tasks === true

  // Fetch 12 months of tasks with due dates — wide enough that navigating months always has data
  const from = new Date(); from.setMonth(from.getMonth() - 6)
  const to   = new Date(); to.setMonth(to.getMonth() + 6)

  const TASK_SELECT = 'id, title, status, priority, due_date, is_recurring, project_id, assignee_id, approver_id, approval_status, approval_required, client_id, frequency, custom_fields, projects(id,name,color), assignee:users!tasks_assignee_id_fkey(id,name), approver:users!tasks_approver_id_fkey(id,name)'
  const dateFrom = from.toISOString().split('T')[0]
  const dateTo   = to.toISOString().split('T')[0]

  const base = supabase.from('tasks')
    .select(TASK_SELECT)
    .eq('org_id', orgId).not('due_date', 'is', null).neq('is_archived', true).is('parent_task_id', null)
    .gte('due_date', dateFrom)
    .lte('due_date', dateTo)

  const taskQuery = canViewAll
    ? base
    : base.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id},created_by.eq.${user.id}`)

  const [{ data: tasks }, { data: clients }, { data: members }, { data: caAssignments }, { data: caInstances }] = await Promise.all([
    taskQuery.limit(2000),
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
    supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
    // CA upcoming triggers — owner/admin only
    isOwnerAdmin
      ? supabase.from('ca_client_assignments')
          .select('id, client_id, assignee_id, master_task:ca_master_tasks(id, name, priority, dates, days_before_due)')
          .eq('org_id', orgId)
          .eq('is_active', true)
      : Promise.resolve({ data: [] as any[] }),
    isOwnerAdmin
      ? supabase.from('ca_task_instances').select('assignment_id, due_date').eq('org_id', orgId)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const memberList = (members ?? []).map((m: any) => ({ id: m.users?.id ?? m.user_id, name: m.users?.name ?? 'Unknown' }))

  const clientMap: Record<string, { id: string; name: string; color: string }> = {}
  ;(clients ?? []).forEach((c: any) => { clientMap[c.id] = c })
  const enrichedTasks = (tasks ?? []).map((t: any) => ({
    ...t,
    client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
    approver: t.approver ?? null,
  }))

  // Compute CA triggers firing in the next 3 days (not yet spawned)
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
        const dueD = new Date(dueDateStr + 'T00:00:00')
        const triggerD = new Date(dueD)
        triggerD.setDate(dueD.getDate() - daysBeforeDue)
        const triggerS = triggerD.toISOString().slice(0, 10)
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
