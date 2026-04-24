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

    const TASK_COLS = 'id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, parent_task_id, approval_status, approval_required, estimated_hours, is_recurring, custom_fields, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), approver:users!tasks_approver_id_fkey(id, name), creator:users!tasks_created_by_fkey(id, name), projects(id, name, color)'

    // ── Shared base (all non-archived top-level tasks for this org) ──────────
    const base = supabase.from('tasks').select(TASK_COLS)
      .eq('org_id', mb.org_id).neq('is_archived', true)
      .order('due_date', { ascending: true, nullsFirst: false })

    // ── "My Tasks" always scoped to the current user regardless of role.
    //    Owner/admin see all org tasks in Reports; here "My" means assigned to me.
    const scopedBase = base.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)

    const [
      { data: tasks },
      { data: approvalTasks },
      { data: members },
      { data: clientsData },
      { data: assignedByMeRaw },
      { data: caAssignments },
      { data: caInstances },
    ] = await Promise.all([
      // Main task list — includes subtasks directly assigned to me
      scopedBase.limit(500),

      // Pending approval tasks — tasks in review waiting on this user's approval decision.
      // Always scoped to the current user as approver, regardless of role.
      // Owners/admins can see all org-wide pending tasks on the /approvals page instead.
      (() => {
        const q = supabase.from('tasks').select(TASK_COLS)
          .eq('org_id', mb.org_id).eq('status', 'in_review').eq('approval_status', 'pending')
          .neq('is_archived', true).is('parent_task_id', null)
          .eq('approver_id', user.id)
          .order('due_date', { ascending: true, nullsFirst: false })
        return q.limit(500)
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
            .order('due_date', { ascending: true, nullsFirst: false }).limit(500)
        : Promise.resolve({ data: [] }),
      // CA upcoming triggers — owner/admin only
      isOwnerAdmin
        ? supabase.from('ca_client_assignments')
            .select('id, client_id, assignee_id, master_task:ca_master_tasks(id, name, priority, dates, days_before_due)')
            .eq('org_id', mb.org_id)
        : Promise.resolve({ data: [] as any[] }),
      isOwnerAdmin
        ? supabase.from('ca_task_instances').select('assignment_id, due_date').eq('org_id', mb.org_id)
        : Promise.resolve({ data: [] as any[] }),
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

    // taskList is mutable so the context-task loop can push into it below
    const taskList        = (tasks ?? []).filter(isVisible).map(enrich) as any[]
    const approvalList    = (approvalTasks ?? []).filter(isVisible).map(enrich)
    const assignedByMeList = (assignedByMeRaw ?? []).filter(isVisible).map(enrich)

    // ── Context tasks: parent tasks whose subtasks are assigned to the current user ──
    // When a user is only assigned to a subtask, the parent task won't appear in their
    // My Tasks (since it's assigned to someone else). Fetch those parents and show them
    // as read-only "context" so the user can see the backstory and manage their subtask.
    const subtaskParentIds = (tasks ?? [])
      .filter((t: any) => t.parent_task_id != null)
      .map((t: any) => t.parent_task_id as string)
    const uniqueParentIds = [...new Set(subtaskParentIds)]
      .filter(id => !taskList.some((t: any) => t.id === id)) // skip if already in list

    if (uniqueParentIds.length > 0) {
      const { data: parentRows } = await supabase.from('tasks')
        .select(TASK_COLS)
        .in('id', uniqueParentIds)
        .eq('org_id', mb.org_id)
        .neq('is_archived', true)
      ;(parentRows ?? []).forEach((t: any) => {
        taskList.push(enrich({
          ...t,
          // _context_task signals the UI that this task is shown for context only —
          // the current user is NOT the assignee of this parent task.
          custom_fields: { ...(t.custom_fields ?? {}), _context_task: true },
        }))
      })
    }

    // Remove raw subtasks from My Tasks view.
    // Users assigned only to a subtask should see the PARENT task (as a context task)
    // rather than the isolated subtask row — they manage their work via the parent's panel.
    const displayTaskList = taskList.filter((t: any) => !t.parent_task_id)

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
          if (triggerS > todayS && triggerS <= limitS && !existingSet.has(`${asgn.id}__${dueDateStr}`)) {
            upcomingCATriggers.push({
              id: `upcoming-${asgn.id}-${dueDateStr}`,
              title: mt.name as string,
              triggerDate: triggerS,
              dueDate: dueDateStr,
              clientId: asgn.client_id ?? null,
              clientName: clientMap[asgn.client_id]?.name ?? null,
              clientColor: clientMap[asgn.client_id]?.color ?? null,
              assigneeId: asgn.assignee_id ?? null,
              priority: (mt.priority as string) ?? 'medium',
            })
          }
        }
      }
    }

    return <MyTasksView
      tasks={displayTaskList as any}
      pendingApprovalTasks={approvalList as any}
      assignedByMeTasks={assignedByMeList as any}
      // isManager controls "Assigned by me" tab — now limited to owner/admin only
      isManager={isOwnerAdmin}
      members={memberList}
      clients={clientList}
      currentUserId={user.id}
      userRole={mb.role}
      canCreate={['owner','admin','manager','member'].includes(mb.role)}
      upcomingCATriggers={upcomingCATriggers}
    />
  } catch (err: any) {
    console.error('[MyTasksPage]', err?.message ?? err)
    throw err
  }
}
