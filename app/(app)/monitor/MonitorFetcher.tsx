import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { MonitorView }  from './MonitorView'
import { canDo }        from '@/lib/utils/permissionGate'
import { redirect }     from 'next/navigation'

// `description` is deliberately absent. Monitor never renders it — the only
// reader is TaskDetailPanel, which now fetches the single task it opens. It was
// the widest column here, shipped for every row on every 2-minute refresh.
/**
 * What Monitor actually reads.
 *
 * This used to carry four joined relations and six columns that nothing in
 * MonitorView ever looked at — `projects(id, name, color)`, `creator`,
 * `approver`, plus estimated_hours, is_billable, billable_amount,
 * approval_required, frequency and next_occurrence_date, all of which existed
 * only as fields on the MonTask interface. On a query that returns thousands
 * of rows, three unused joins is most of the wait.
 *
 * `assignee` is no longer joined either. The page already holds the full
 * member list and already resolves subtask assignees from it by id — so the
 * join was fetching, per task row, a name the page had in memory all along.
 * It is resolved the same way below, which keeps MonitorView's props
 * unchanged.
 *
 * custom_fields stays: `_ca_compliance` is read for the CA count.
 */
const TASK_COLS = 'id, title, status, priority, due_date, completed_at, assignee_id, approver_id, client_id, project_id, parent_task_id, parent_recurring_id, approval_status, is_recurring, custom_fields, created_at, updated_at'

export async function MonitorFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) return null

  const supabase = createAdminClient()

  const from90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  // Owner/admin always have monitor access — skip the DB round-trip for canDo.
  // For other roles run the permission check in parallel with the data fetches.
  const isOwnerOrAdmin = ['owner', 'admin'].includes(mb.role)

  // The 90-day cutoff is applied HERE, in the database. It used to run only on
  // the client, which meant every completed task the org had ever created was
  // still fetched, serialised into the RSC payload and shipped to the browser
  // before being thrown away — with two queries capped at 10,000 rows each,
  // that is up to 20,000 wide rows (description + custom_fields + four joins)
  // per page load, and again on every 30-second auto-refresh. That is what made
  // Monitor slow to open and prone to freezing.
  //
  // The OR is written so it can never exclude an ACTIVE task — the original
  // reason the filter was moved client-side. It keeps a row when ANY holds:
  //   status is not 'completed'   (every open task, whatever its dates)
  //   completed_at is null        (belt and braces for odd data)
  //   completed_at >= 90 days ago (recently finished work)
  const recentOrOpen = `status.neq.completed,completed_at.is.null,completed_at.gte.${from90}`

  // Kept beside the query so the view can tell whether the cap was hit.
  const DATED_CAP   = 4000

  /**
   * The filters that define "work Monitor is about".
   *
   * Applied to both the row query and the no-due-date count, from one place,
   * so the count can never describe a different population from the list.
   *
   * Typed `any` deliberately: Supabase's builder generics are deep enough
   * that parameterising this trips "type instantiation is excessively deep".
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyScope = (q: any): any => q
    .eq('org_id', mb.org_id)
    .neq('is_archived', true)
    .is('parent_task_id', null)
    // Recurring TEMPLATES are excluded. A template is the definition of a
    // schedule, not a piece of work: it has a due_date frozen at its first
    // occurrence that never advances, so it sat in Monitor looking months
    // overdue while spawning perfectly on time. The work it produces — the
    // occurrences — is still here and is what "Repeat" now counts.
    //
    // .or rather than .neq because is_recurring is NULL on older rows, and
    // `is_recurring <> true` is NULL for those, which would drop them.
    .or('is_recurring.is.null,is_recurring.eq.false')
    .or(recentOrOpen)

  const makeBase  = () => applyScope(supabase.from('tasks').select(TASK_COLS))
  const makeCount = () => applyScope(supabase.from('tasks').select('id', { count: 'exact', head: true }))

  const [
    hasRoleAccess,
    { data: datedTasks },
    { count: undatedCount },
    { data: members },
    { data: clientsData },
  ] = await Promise.all([
    isOwnerOrAdmin
      ? Promise.resolve(true)
      : canDo(supabase, mb.org_id, user.id, mb.role, 'monitor.view'),
    // The cap is a backstop against a runaway payload, not the working limit —
    // with the 90-day filter above, a realistic org lands far below it.
    // Ordered so that if the cap IS hit the truncation is deterministic
    // (soonest due first) rather than arbitrary, and the view shows a notice
    // rather than silently reporting partial stats.
    makeBase().not('due_date', 'is', null)
      .order('due_date', { ascending: true }).limit(DATED_CAP),
    // ── Tasks with NO due date are COUNTED, not fetched ──────────────────
    //
    // Up to 2000 of them used to be loaded on every visit and mixed into the
    // list. They are close to untrackable there: Monitor is organised around
    // when work is due, every stat tile is a slice of the current month, and
    // the overdue and trend figures cannot say anything about a task with no
    // date. So they padded the payload and the list without being actionable
    // in either.
    //
    // A count is one cheap query and keeps them honest: the view shows
    // "N tasks have no due date" with a link to the task list filtered to
    // them, so they are visible and fixable without being in the way.
    // OPEN work only. applyScope deliberately lets through anything completed
    // in the last 90 days, which is right for the list but wrong here: a
    // finished task does not need a due date, so counting it would make the
    // banner's number larger than the list that opens underneath it — the
    // on-demand panel drops completed and cancelled rows for the same reason.
    // Two numbers describing the same thing have to be the same number.
    makeCount().is('due_date', null).not('status', 'in', '(completed,cancelled)'),
    supabase.from('org_members')
      .select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
    supabase.from('clients').select('id, name, color, status').eq('org_id', mb.org_id).order('name'),
  ])

  const tasks = datedTasks ?? []

  const hasMemberAccess = mb.can_view_monitor === true
  if (!hasRoleAccess && !hasMemberAccess) {
    redirect('/dashboard?error=monitor_access_denied')
  }

  const clientMap: Record<string, { id: string; name: string; color: string }> = {}
  clientsData?.forEach(c => { clientMap[c.id] = { id: c.id, name: c.name, color: c.color } })
  const clientList = (clientsData ?? []).map(c => ({ id: c.id, name: c.name, color: c.color }))
  const memberList = (members ?? []).map((m: any) => ({
    id: (m.users as any)?.id ?? m.user_id,
    name: (m.users as any)?.name ?? 'Unknown',
  }))

  // Assignee resolved from the member list rather than a per-row join — see
  // TASK_COLS. Built as a lookup so this stays one pass over the tasks.
  const memberById: Record<string, { id: string; name: string }> = {}
  memberList.forEach(m => { memberById[m.id] = m })

  const taskList = (tasks ?? []).map((t: any) => ({
    ...t,
    // No `description` key at all: undefined tells the detail panel to fetch
    // it. Setting it to null here would read as "this task has no description".
    due_date: t.due_date ?? null, completed_at: t.completed_at ?? null,
    assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
    project_id: t.project_id ?? null, parent_task_id: t.parent_task_id ?? null,
    approval_status: t.approval_status ?? null,
    is_recurring: t.is_recurring ?? false,
    created_at: t.created_at ?? '',
    updated_at: t.updated_at ?? null,
    assignee: t.assignee_id ? (memberById[t.assignee_id] ?? null) : null,
    // Declared on MonTask but never read, so they are filled in rather than
    // fetched. Dropping them from the select removed two joins from a query
    // that returns thousands of rows.
    approver: null, creator: null, project: null,
    client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
  }))

  // The query hitting its cap means the stats bar below is computed over a
  // partial set. Surface it rather than showing a quietly wrong count.
  const truncated = (datedTasks?.length ?? 0) >= DATED_CAP

  return <MonitorView
    tasks={taskList as any}
    members={memberList}
    clients={clientList}
    currentUserId={user.id}
    userRole={mb.role}
    from90={from90}
    truncated={truncated}
    undatedCount={undatedCount ?? 0}
  />
}
