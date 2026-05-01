import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { MyTasksView } from './MyTasksView'

const TASK_COLS = 'id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, parent_task_id, approval_status, approval_required, estimated_hours, is_recurring, custom_fields, created_at, updated_at, is_billable, billable_amount, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), approver:users!tasks_approver_id_fkey(id, name), creator:users!tasks_created_by_fkey(id, name), projects(id, name, color)'

export async function TasksFetcher() {
  const user = await getSessionUser()
  if (!user) return null

  const mb = await getOrgMembership(user.id)
  if (!mb) return null

  const supabase = await createClient()

  const isOwnerAdmin = ['owner', 'admin'].includes(mb.role)

  const base = supabase.from('tasks').select(TASK_COLS)
    .eq('org_id', mb.org_id).neq('is_archived', true)
    .order('due_date', { ascending: true, nullsFirst: false })

  const scopedBase = base.eq('assignee_id', user.id)

  const [
    { data: tasks },
    { data: members },
    { data: clientsData },
    { data: assignedByMeRaw },
    { data: caAssignments },
    { data: caInstances },
  ] = await Promise.all([
    scopedBase.limit(500),

    supabase.from('org_members')
      .select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),

    supabase.from('clients').select('id, name, color, status').eq('org_id', mb.org_id).order('name'),

    isOwnerAdmin
      ? supabase.from('tasks').select(TASK_COLS)
          .eq('org_id', mb.org_id).eq('created_by', user.id)
          .neq('is_archived', true).is('parent_task_id', null)
          .or('custom_fields.is.null,custom_fields.not.cs.{"_ca_compliance":true}')
          .order('due_date', { ascending: true, nullsFirst: false }).limit(500)
      : Promise.resolve({ data: [] }),

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

  const taskList         = (tasks ?? []).filter(isVisible).map(enrich) as any[]
  const assignedByMeList = (assignedByMeRaw ?? []).filter(isVisible).map(enrich)

  // Context tasks: parents of subtasks assigned to the current user
  const subtaskParentIds = (tasks ?? [])
    .filter((t: any) => t.parent_task_id != null)
    .map((t: any) => t.parent_task_id as string)
  const uniqueParentIds = [...new Set(subtaskParentIds)]
    .filter(id => !taskList.some((t: any) => t.id === id))

  if (uniqueParentIds.length > 0) {
    const { data: parentRows } = await supabase.from('tasks')
      .select(TASK_COLS)
      .in('id', uniqueParentIds)
      .eq('org_id', mb.org_id)
      .neq('is_archived', true)
    ;(parentRows ?? []).forEach((t: any) => {
      taskList.push(enrich({
        ...t,
        custom_fields: { ...(t.custom_fields ?? {}), _context_task: true },
      }))
    })
  }

  const displayTaskList = taskList.filter((t: any) => !t.parent_task_id)

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

  return (
    <MyTasksView
      tasks={displayTaskList as any}
      assignedByMeTasks={assignedByMeList as any}
      isManager={isOwnerAdmin}
      members={memberList}
      clients={clientList}
      currentUserId={user.id}
      userRole={mb.role}
      canCreate={['owner', 'admin', 'manager', 'member'].includes(mb.role)}
      upcomingCATriggers={upcomingCATriggers}
    />
  )
}
