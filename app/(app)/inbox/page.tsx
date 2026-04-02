import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { InboxView }       from './InboxView'
import type { Metadata }   from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'One-time tasks' }

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  const canViewAll = ['owner', 'admin', 'manager'].includes(mb.role)
  const canApprove = canViewAll

  const [tasksResult, membersResult, clientsResult] = await Promise.all([
    (() => {
      let q = supabase.from('tasks')
        .select('id, title, status, priority, due_date, approval_status, approval_required, client_id, assignee_id, approver_id, is_recurring, estimated_hours, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url)')
        .eq('org_id', mb.org_id)
        .is('project_id', null)
        .is('parent_task_id', null)
        .neq('is_archived', true)
        .order('created_at', { ascending: false })
      if (!canViewAll) q = q.eq('assignee_id', user.id)
      return q
    })(),
    supabase.from('org_members').select('user_id, users(id, name, avatar_url)').eq('org_id', mb.org_id).eq('is_active', true),
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
  ])

  const memberList = (membersResult.data ?? []).map(m => ({
    id:         (m.users as any)?.id ?? m.user_id,
    name:       (m.users as any)?.name ?? 'Unknown',
    avatar_url: (m.users as any)?.avatar_url ?? undefined,
  }))

  const clientList = (clientsResult.data ?? []).map(c => ({ id: c.id, name: c.name }))

  const enriched = (tasksResult.data ?? []).map(t => ({
    ...t,
    description:      null,
    project_id:       null,
    project:          null,
    is_archived:      false,
    created_at:       '',
    completed_at:     null,
    approval_required: (t as any).approval_required ?? false,
    is_recurring:     t.is_recurring ?? false,
    estimated_hours:  (t as any).estimated_hours ?? null,
    due_date:         t.due_date ?? null,
    assignee_id:      t.assignee_id ?? null,
    client_id:        t.client_id ?? null,
    approver_id:      (t as any).approver_id ?? null,
    approval_status:  t.approval_status ?? null,
    assignee:         (t.assignee as any) ?? null,
    client:           null,
  }))

  return (
    <InboxView
      tasks={enriched as any}
      members={memberList}
      clients={clientList}
      currentUserId={user.id}
      orgId={mb.org_id}
      canApprove={canApprove}
    />
  )
}
