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
      .select('org_id, role, can_view_all_tasks').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!mb) redirect('/onboarding')

    // canViewAll: owner/admin always; others only if explicitly granted via Members settings
    const isOwnerAdmin = ['owner', 'admin'].includes(mb.role)
    const canViewAll   = isOwnerAdmin || (mb as any).can_view_all_tasks === true

    const TASK_COLS = 'id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, estimated_hours, is_recurring, custom_fields, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), approver:users!tasks_approver_id_fkey(id, name), creator:users!tasks_created_by_fkey(id, name), projects(id, name, color)'

    // ── Shared base (all non-archived top-level tasks for this org) ──────────
    const base = supabase.from('tasks').select(TASK_COLS)
      .eq('org_id', mb.org_id).neq('is_archived', true)
      .order('due_date', { ascending: true, nullsFirst: false })

    // ── Scope: all roles see only tasks they are assignee OR approver of.
    //    Owner/admin (or flag-granted) see every task in the org.
    const scopedBase = canViewAll
      ? base
      : base.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)

    const [
      { data: tasks },
      { data: approvalTasks },
      { data: members },
      { data: clientsData },
      { data: assignedByMeRaw },
    ] = await Promise.all([
      // Main task list — scoped by role
      scopedBase.is('parent_task_id', null).limit(2000),

      // Pending approval tasks — tasks in review waiting on this user's approval.
      // Owner/admin: all pending-approval tasks in the org.
      // Others: only tasks where they are explicitly the approver.
      (() => {
        const q = supabase.from('tasks').select(TASK_COLS)
          .eq('org_id', mb.org_id).eq('status', 'in_review').eq('approval_status', 'pending')
          .neq('is_archived', true).is('parent_task_id', null)
          .order('due_date', { ascending: true, nullsFirst: false })
        return (canViewAll ? q : q.eq('approver_id', user.id)).limit(2000)
      })(),

      // Team members for filter/assignee dropdowns
      supabase.from('org_members')
        .select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),

      // Clients — full fetch; filter active client-side for filter bar
      supabase.from('clients').select('id, name, color, status').eq('org_id', mb.org_id).order('name'),

      // "Assigned by me" — only fetched for owner/admin; query is a no-op for others
      isOwnerAdmin
        ? supabase.from('tasks').select(TASK_COLS)
            .eq('org_id', mb.org_id).eq('created_by', user.id)
            .neq('is_archived', true).is('parent_task_id', null)
            .or('custom_fields.is.null,custom_fields.not.cs.{"_ca_compliance":true}')
            .order('due_date', { ascending: true, nullsFirst: false }).limit(2000)
        : Promise.resolve({ data: [] }),
    ])

    const clientMap: Record<string, { id: string; name: string; color: string }> = {}
    clientsData?.forEach(c => { clientMap[c.id] = { id: c.id, name: c.name, color: c.color } })
    const clientList = (clientsData ?? []).filter(c => (c as any).status === 'active')
      .map(c => ({ id: c.id, name: c.name, color: c.color }))

    const memberList = (members ?? []).map(m => ({
      id: (m.users as any)?.id ?? m.user_id,
      name: (m.users as any)?.name ?? 'Unknown',
    }))

    // Only show compliance tasks that were properly triggered (_triggered: true).
    const isVisible = (t: any) => {
      const cf = t.custom_fields
      if (cf?._ca_compliance === true) return cf?._triggered === true
      return true
    }

    const enrich = (t: any) => ({
      ...t,
      description: t.description ?? null, due_date: t.due_date ?? null,
      assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
      project_id: t.project_id ?? null, approval_status: t.approval_status ?? null,
      approval_required: t.approval_required ?? false, estimated_hours: t.estimated_hours ?? null,
      is_recurring: t.is_recurring ?? false, completed_at: null,
      is_archived: false, created_at: t.created_at ?? '', updated_at: t.updated_at ?? null,
      approver_id: t.approver_id ?? null,
      approver: (t.approver as any) ?? null,
      assignee: (t.assignee as any) ?? null,
      creator: (t.creator as any) ?? null,
      client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
      project: (t.projects as any) ?? null,
    })

    const taskList        = (tasks ?? []).filter(isVisible).map(enrich)
    const approvalList    = (approvalTasks ?? []).filter(isVisible).map(enrich)
    const assignedByMeList = (assignedByMeRaw ?? []).filter(isVisible).map(enrich)

    return <MyTasksView
      tasks={taskList as any}
      pendingApprovalTasks={approvalList as any}
      assignedByMeTasks={assignedByMeList as any}
      // isManager controls "Assigned by me" tab — now limited to owner/admin only
      isManager={isOwnerAdmin}
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
