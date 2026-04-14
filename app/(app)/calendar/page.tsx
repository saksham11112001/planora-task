import { redirect }     from 'next/navigation'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { createClient } from '@/lib/supabase/server'
import { CalendarView } from './CalendarView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Calendar' }

export default async function CalendarPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()
  const orgId = mb.org_id

  // canViewAll: owner/admin always; others only if explicitly granted via Members settings
  const canViewAll = ['owner', 'admin'].includes(mb.role) || (mb as any).can_view_all_tasks === true

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

  // All roles see only tasks they are assignee OR approver of.
  // Owner/admin (or flag-granted) see every task in the org.
  const taskQuery = canViewAll
    ? base
    : base.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)

  const [{ data: tasks }, { data: clients }, { data: members }] = await Promise.all([
    taskQuery.limit(2000),
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
    supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
  ])

  const memberList = (members ?? []).map((m: any) => ({ id: m.users?.id ?? m.user_id, name: m.users?.name ?? 'Unknown' }))

  const clientMap: Record<string, { id: string; name: string; color: string }> = {}
  ;(clients ?? []).forEach((c: any) => { clientMap[c.id] = c })
  const enrichedTasks = (tasks ?? []).map((t: any) => ({
    ...t,
    client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
    approver: t.approver ?? null,
  }))

  return <CalendarView
    tasks={enrichedTasks as any}
    clients={clients ?? []}
    members={memberList}
    canViewAll={canViewAll}
    currentUserId={user.id}
    userRole={mb.role}
  />
}
