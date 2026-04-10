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

  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  const orgId = mb.org_id
  const canViewAll = ['owner','admin','manager'].includes(mb.role)

  // Fetch 3 months of tasks with due dates — parallel with clients
  const from = new Date(); from.setMonth(from.getMonth() - 1)
  const to   = new Date(); to.setMonth(to.getMonth() + 2)

  const taskQuery = supabase.from('tasks')
    .select('id, title, status, priority, due_date, is_recurring, project_id, assignee_id, approver_id, approval_status, approval_required, client_id, frequency, custom_fields, projects(id,name,color), assignee:users!tasks_assignee_id_fkey(id,name), approver:users!tasks_approver_id_fkey(id,name)')
    .eq('org_id', orgId).not('due_date', 'is', null).neq('is_archived', true).is('parent_task_id', null)
    .gte('due_date', from.toISOString().split('T')[0])
    .lte('due_date', to.toISOString().split('T')[0])

  const [tasksResult, { data: clients }, { data: members }] = await Promise.all([
    canViewAll ? taskQuery : taskQuery.eq('assignee_id', user.id),
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status','active').order('name'),
    supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
  ])
  const { data: tasks } = tasksResult
  const memberList = (members ?? []).map((m: any) => ({ id: m.users?.id ?? m.user_id, name: m.users?.name ?? 'Unknown' }))

  // Build client map for task enrichment
  const clientMap: Record<string, { id: string; name: string; color: string }> = {}
  ;(clients ?? []).forEach((c: any) => { clientMap[c.id] = c })
  const enrichedTasks = (tasks ?? []).map((t: any) => ({ ...t, client: t.client_id ? (clientMap[t.client_id] ?? null) : null, approver: t.approver ?? null }))

  return <CalendarView tasks={enrichedTasks as any} clients={clients ?? []} members={memberList} canViewAll={canViewAll} currentUserId={user.id} userRole={mb.role}/>
}