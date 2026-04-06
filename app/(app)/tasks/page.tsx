import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { MyTasksView }  from './MyTasksView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My tasks' }

export default async function MyTasksPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: mb } = await supabase.from('org_members')
      .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!mb) redirect('/onboarding')

    const isManager = ['owner','admin','manager'].includes(mb.role)

    // ── ALL data fetched in parallel ──────────────────────────────
    const [
      { data: tasks },
      { data: approvalTasks },
      { data: members },
      { data: allClients },
      { data: clientsData },
    ] = await Promise.all([
      // My tasks (all statuses for board view)
      supabase.from('tasks')
        .select('id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, estimated_hours, is_recurring, custom_fields, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), approver:users!tasks_approver_id_fkey(id, name), projects(id, name, color)')
        .eq('org_id', mb.org_id).eq('assignee_id', user.id).neq('is_archived', true).is('parent_task_id', null)
        .order('due_date', { ascending: true, nullsFirst: false }),

      // Tasks needing my approval
      supabase.from('tasks')
        .select('id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, estimated_hours, is_recurring, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), projects(id, name, color)')
        .eq('org_id', mb.org_id).eq('status', 'in_review').eq('approval_status', 'pending')
        .neq('is_archived', true).is('parent_task_id', null)
        .order('due_date', { ascending: true, nullsFirst: false }),

      // Team members
      supabase.from('org_members')
        .select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),

      // All active clients
      supabase.from('clients')
        .select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),

      // Client lookup map
      supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id),
    ])

    const clientMap: Record<string, { id: string; name: string; color: string }> = {}
    clientsData?.forEach(c => { clientMap[c.id] = c })

    const memberList = (members ?? []).map(m => ({
      id: (m.users as any)?.id ?? m.user_id,
      name: (m.users as any)?.name ?? 'Unknown',
    }))
    const clientList = (allClients ?? []).map(c => ({ id: c.id, name: c.name, color: c.color }))

    const enrich = (t: any) => ({
      ...t,
      description: t.description ?? null, due_date: t.due_date ?? null,
      assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
      project_id: t.project_id ?? null, approval_status: t.approval_status ?? null,
      approval_required: t.approval_required ?? false, estimated_hours: t.estimated_hours ?? null,
      is_recurring: t.is_recurring ?? false, completed_at: null,
      is_archived: false, created_at: '', approver_id: t.approver_id ?? null,
      approver: (t.approver as any) ?? null,
      assignee: (t.assignee as any) ?? null,
      client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
      project: (t.projects as any) ?? null,
    })

    // Tasks assigned by me to others (for managers)
    const { data: assignedByMeTasks } = isManager
      ? await supabase.from('tasks')
          .select('id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, estimated_hours, is_recurring, custom_fields, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), approver:users!tasks_approver_id_fkey(id, name), projects(id, name, color)')
          .eq('org_id', mb.org_id)
          .eq('created_by', user.id)
          .neq('assignee_id', user.id)
          .not('assignee_id', 'is', null)
          .neq('is_archived', true)
          .is('parent_task_id', null)
          .not('custom_fields', 'cs', '{"_ca_compliance":true}')
          .order('due_date', { ascending: true, nullsFirst: false })
      : { data: [] }

    const taskList     = (tasks ?? []).map(enrich)
    const approvalList = (approvalTasks ?? [])
      .filter(t => {
        const approverId = (t as any).approver_id
        if (approverId) return approverId === user.id
        return isManager
      })
      .map(enrich)
    const assignedByMeList = (assignedByMeTasks ?? []).map(enrich)

    return <MyTasksView
      tasks={taskList as any}
      pendingApprovalTasks={approvalList as any}
      assignedByMeTasks={assignedByMeList as any}
      isManager={isManager}
      members={memberList}
      clients={clientList}
      currentUserId={user.id}
      userRole={mb.role}
      canCreate={['owner','admin','manager','member'].includes(mb.role)}
    />
  } catch (err: any) {
    console.error('[MyTasksPage]', err?.message ?? err)
    throw err
  }
}
