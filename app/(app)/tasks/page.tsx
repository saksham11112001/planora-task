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

  const canApprove = ['owner', 'admin', 'manager'].includes(mb.role)

  const [
    { data: tasks },
    { data: members },
    { data: clients },
  ] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, estimated_hours, is_recurring, custom_fields, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), projects(id, name, color)')
      .eq('org_id', mb.org_id)
      .eq('assignee_id', user.id)
      .neq('is_archived', true)
      .is('parent_task_id', null)
      .order('due_date', { ascending: true, nullsFirst: false }),

    supabase.from('org_members')
      .select('user_id, users(id, name)')
      .eq('org_id', mb.org_id)
      .eq('is_active', true),

    supabase.from('clients')
      .select('id, name, color')
      .eq('org_id', mb.org_id)
      .eq('status', 'active')
      .order('name'),
  ])

  const memberList = (members ?? []).map(m => ({
    id:   (m.users as any)?.id   ?? m.user_id,
    name: (m.users as any)?.name ?? 'Unknown',
  }))

  const clientList = (clients ?? []).map(c => ({ id: c.id, name: c.name }))

  const taskList = (tasks ?? []).map(t => ({
    ...t,
    description:      t.description ?? null,
    due_date:         t.due_date ?? null,
    assignee_id:      t.assignee_id ?? null,
    client_id:        t.client_id ?? null,
    project_id:       t.project_id ?? null,
    approval_status:  t.approval_status ?? null,
    approval_required: (t as any).approval_required ?? false,
    estimated_hours:  (t as any).estimated_hours ?? null,
    is_recurring:     t.is_recurring ?? false,
    completed_at:     null,
    is_archived:      false,
    created_at:       '',
    approver_id:      (t as any).approver_id ?? null,
    assignee:         (t.assignee as any) ?? null,
    project:          (t.projects as any) ?? null,
    client:           null,
  }))

  return (
    <MyTasksView
      tasks={taskList as any}
      members={memberList}
      clients={clientList}
      currentUserId={user.id}
      orgId={mb.org_id}
      canApprove={canApprove}
    />
  )
}
