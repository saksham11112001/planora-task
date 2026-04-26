import { createClient }   from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }        from 'next/navigation'
import { ApprovalsView }   from './ApprovalsView'
import { UpgradeWall }     from '@/components/ui/UpgradeWall'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'
import type { Metadata }   from 'next'

export const dynamic   = 'force-dynamic'
export const metadata: Metadata = { title: 'Approvals | Taska' }

export default async function ApprovalsPage() {
  try {
  // Use cached fetchers — layout already called these, so no extra DB round trips.
  // getOrgMembership joins organisations, eliminating the separate admin org query.
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()

  // Gate: Approvals requires Starter plan or above — org data comes from the cached membership join
  const plan = effectivePlan((mb.organisations as any) ?? { plan_tier: 'free', status: 'active' })
  if (!canUseFeature(plan, 'approvals')) {
    return <UpgradeWall
      feature="Approval Workflows"
      description="Assign approvers to tasks and track sign-offs with a full approval audit trail. Upgrade to unlock."
      requiredPlan="Starter"
      icon="✍️"
    />
  }

  // Only fetch tasks where this user is the designated approver
  // (any role can be an approver; non-approvers see an empty list)

  // Fetch tasks pending approval where current user is the assigned approver
  const { data: pendingRaw } = await supabase
    .from('tasks')
    .select(`
      id, title, status, priority, due_date, created_at, created_by,
      assignee_id, approver_id, client_id, project_id,
      approval_status, approval_required, is_recurring, custom_fields,
      assignee:users!tasks_assignee_id_fkey(id, name),
      approver:users!tasks_approver_id_fkey(id, name),
      creator:users!tasks_created_by_fkey(id, name),
      projects(id, name, color)
    `)
    .eq('org_id', mb.org_id)
    .eq('status', 'in_review')
    .eq('approval_status', 'pending')
    .eq('approver_id', user.id)
    .neq('is_archived', true)
    .is('parent_task_id', null)
    .order('created_at', { ascending: false })

  // Fetch recently approved/rejected (last 7 days) by this user only
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: historyRaw } = await supabase
    .from('tasks')
    .select(`
      id, title, status, priority, due_date, completed_at, created_by,
      assignee_id, approver_id, client_id, project_id,
      approval_status, is_recurring, custom_fields,
      assignee:users!tasks_assignee_id_fkey(id, name),
      approver:users!tasks_approver_id_fkey(id, name),
      creator:users!tasks_created_by_fkey(id, name),
      projects(id, name, color)
    `)
    .eq('org_id', mb.org_id)
    .eq('approver_id', user.id)
    .in('approval_status', ['approved','rejected'])
    .gte('completed_at', since)
    .neq('is_archived', true)
    .is('parent_task_id', null)
    .order('completed_at', { ascending: false })
    .limit(30)

  // Fetch clients + members for display
  const { data: clientsRaw } = await supabase
    .from('clients').select('id, name, color').eq('org_id', mb.org_id)
  const { data: members } = await supabase
    .from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true)

  const clientMap: Record<string, { id: string; name: string; color: string }> = {}
  clientsRaw?.forEach(c => { clientMap[c.id] = c })

  function enrichTask(t: any) {
    return {
      ...t,
      assignee: t.assignee ?? null,
      approver: t.approver ?? null,
      creator:  t.creator  ?? null,
      project:  t.projects ?? null,
      client:   t.client_id ? (clientMap[t.client_id] ?? null) : null,
    }
  }

  const pending = (pendingRaw ?? []).map(enrichTask)

  const history = (historyRaw ?? []).map(enrichTask)
  const memberList = (members ?? []).map(m => ({ id: (m.users as any)?.id ?? m.user_id, name: (m.users as any)?.name ?? 'Unknown' }))

  return (
    <ApprovalsView
      pending={pending as any}
      history={history as any}
      members={memberList}
      clients={clientsRaw ?? []}
      currentUserId={user.id}
      userRole={mb.role}
    />
  )
  } catch (err: any) {
    console.error('[ApprovalsPage crash]', err?.message ?? err)
    throw err
  }
}
