import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { MyTasksView }  from './MyTasksView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My tasks' }


export default async function MyTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  // Fetch tasks assigned to me — NO clients() join to avoid FK issues
  const { data: clients } = await supabase
    .from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name')

  const { data: tasks } = await supabase.from('tasks')
    .select('id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, estimated_hours, is_recurring, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), approver:users!tasks_approver_id_fkey(id, name), projects(id, name, color)')
    .eq('org_id', mb.org_id).eq('assignee_id', user.id).neq('status', 'completed').neq('is_archived', true).is('parent_task_id', null)
    .order('due_date', { ascending: true, nullsFirst: false })

  // Fetch clients separately
  const { data: clientsData } = await supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id)
  const clientMap: Record<string, { id: string; name: string; color: string }> = {}
  clientsData?.forEach(c => { clientMap[c.id] = c })

  // Fetch tasks where this user is the designated approver AND they are in_review
  // For managers with no specific approver set, fetch all org tasks in_review
  const isManager = ['owner','admin','manager'].includes(mb.role)
  const { data: approvalTasks } = await supabase.from('tasks')
    .select('id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, estimated_hours, is_recurring, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), approver:users!tasks_approver_id_fkey(id, name), projects(id, name, color)')
    .eq('org_id', mb.org_id)
    .eq('status', 'in_review')
    .eq('approval_status', 'pending')
    .neq('is_archived', true)
    .is('parent_task_id', null)
    .order('due_date', { ascending: true, nullsFirst: false })

  const { data: members } = await supabase.from('org_members')
    .select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true)
  const { data: allClients } = await supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name')

  const memberList = (members ?? []).map(m => ({ id: (m.users as any)?.id ?? m.user_id, name: (m.users as any)?.name ?? 'Unknown' }))
  const clientList = (allClients ?? []).map(c => ({ id: c.id, name: c.name, color: c.color }))

  const taskList = (tasks ?? []).map(t => ({
    ...t,
    description: t.description ?? null, due_date: t.due_date ?? null,
    assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
    project_id: t.project_id ?? null, approval_status: t.approval_status ?? null,
    approval_required: t.approval_required ?? false, estimated_hours: t.estimated_hours ?? null,
    is_recurring: t.is_recurring ?? false, completed_at: null,
    is_archived: false, created_at: '',
    assignee: (t.assignee as any) ?? null,
    approver: (t.approver as any) ?? null,
    approver_id: (t as any).approver_id ?? null,
    client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
    project: (t.projects as any) ?? null,
  }))

  const approvalList = (approvalTasks ?? [])
    .filter(t => {
      // Only show to the designated approver, or any manager if no approver set
      const approverId = (t as any).approver_id
      if (approverId) return approverId === user.id
      return isManager
    })
    .map(t => ({
      ...t,
      description: t.description ?? null, due_date: t.due_date ?? null,
      assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
      project_id: t.project_id ?? null, approval_status: t.approval_status ?? null,
      approval_required: t.approval_required ?? true, estimated_hours: t.estimated_hours ?? null,
      is_recurring: t.is_recurring ?? false, completed_at: null,
      is_archived: false, created_at: '',
      assignee: (t.assignee as any) ?? null,
      approver: (t.approver as any) ?? null,
      approver_id: (t as any).approver_id ?? null,
      client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
      project: (t.projects as any) ?? null,
    }))

  return <MyTasksView tasks={taskList as any} pendingApprovalTasks={approvalList as any} members={memberList} clients={clientList} currentUserId={user.id} userRole={mb.role}/>
}
