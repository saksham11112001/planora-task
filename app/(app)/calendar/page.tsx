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

  const { data: mb } = await supabase.from('org_members').select('org_id, role, can_view_all_tasks').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  const orgId = mb.org_id
  // Owners/admins always see everything. Other users see all tasks only if explicitly granted.
  const canViewAll = ['owner','admin'].includes(mb.role) || (mb as any).can_view_all_tasks === true
  // Managers see tasks they're assigned to OR tasks where they're the approver.
  const isManager  = mb.role === 'manager'

  // Fetch 12 months of tasks with due dates — wide enough that navigating months always has data
  const from = new Date(); from.setMonth(from.getMonth() - 6)
  const to   = new Date(); to.setMonth(to.getMonth() + 6)

  const TASK_SELECT = 'id, title, status, priority, due_date, is_recurring, project_id, assignee_id, approver_id, approval_status, approval_required, client_id, frequency, custom_fields, projects(id,name,color), assignee:users!tasks_assignee_id_fkey(id,name), approver:users!tasks_approver_id_fkey(id,name)'
  const dateFrom = from.toISOString().split('T')[0]
  const dateTo   = to.toISOString().split('T')[0]

  const taskQuery = supabase.from('tasks')
    .select(TASK_SELECT)
    .eq('org_id', orgId).not('due_date', 'is', null).neq('is_archived', true).is('parent_task_id', null)
    .gte('due_date', dateFrom)
    .lte('due_date', dateTo)

  // Members see only their assigned tasks, but ALL CA compliance tasks should be
  // visible org-wide (matching what the CA module page shows).
  const complianceQuery = supabase.from('tasks')
    .select(TASK_SELECT)
    .eq('org_id', orgId).not('due_date', 'is', null).neq('is_archived', true).is('parent_task_id', null)
    .gte('due_date', dateFrom)
    .lte('due_date', dateTo)
    .contains('custom_fields', { _ca_compliance: true })

  // Determine the main task query scope:
  //   canViewAll → all tasks (owner/admin or flag-granted)
  //   isManager  → tasks assigned to them OR tasks they're approving
  //   else       → only tasks assigned to them
  const mainQuery = canViewAll
    ? taskQuery
    : isManager
      ? taskQuery.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)
      : taskQuery.eq('assignee_id', user.id)

  const [tasksResult, complianceResult, { data: clients }, { data: members }] = await Promise.all([
    mainQuery,
    canViewAll ? Promise.resolve({ data: [] as any[] }) : complianceQuery,
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status','active').order('name'),
    supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
  ])

  // Merge assigned tasks with compliance tasks (dedup by ID)
  const assignedTasks = tasksResult.data ?? []
  const complianceTasks = (complianceResult as any).data ?? []
  const assignedIds = new Set(assignedTasks.map((t: any) => t.id))
  const tasks = [...assignedTasks, ...complianceTasks.filter((t: any) => !assignedIds.has(t.id))]
  const memberList = (members ?? []).map((m: any) => ({ id: m.users?.id ?? m.user_id, name: m.users?.name ?? 'Unknown' }))

  // Build client map for task enrichment
  const clientMap: Record<string, { id: string; name: string; color: string }> = {}
  ;(clients ?? []).forEach((c: any) => { clientMap[c.id] = c })
  const enrichedTasks = (tasks ?? []).map((t: any) => ({ ...t, client: t.client_id ? (clientMap[t.client_id] ?? null) : null, approver: t.approver ?? null }))

  return <CalendarView tasks={enrichedTasks as any} clients={clients ?? []} members={memberList} canViewAll={canViewAll} currentUserId={user.id} userRole={mb.role}/>
}