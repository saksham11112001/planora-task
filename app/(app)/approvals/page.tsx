import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { ApprovalsView }   from './ApprovalsView'
import type { Metadata }   from 'next'

export const dynamic   = 'force-dynamic'
export const metadata: Metadata = { title: 'Approvals | Planora' }

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  // Only managers+ can see approvals
  const canApprove = ['owner','admin','manager'].includes(mb.role)
  if (!canApprove) redirect('/dashboard')

  // Fetch ALL tasks currently pending approval in this org
  const { data: pendingRaw } = await supabase
    .from('tasks')
    .select(`
      id, title, status, priority, due_date, created_at,
      assignee_id, approver_id, client_id, project_id,
      approval_status, approval_required, is_recurring, custom_fields,
      assignee:users!tasks_assignee_id_fkey(id, name),
      projects(id, name, color)
    `)
    .eq('org_id', mb.org_id)
    .eq('status', 'in_review')
    .eq('approval_status', 'pending')
    .neq('is_archived', true)
    .is('parent_task_id', null)
    .order('created_at', { ascending: false })

  // Fetch recently approved/rejected (last 7 days) for history
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: historyRaw } = await supabase
    .from('tasks')
    .select(`
      id, title, status, priority, due_date, completed_at,
      assignee_id, approver_id, client_id, project_id,
      approval_status, is_recurring,
      assignee:users!tasks_assignee_id_fkey(id, name),
      projects(id, name, color)
    `)
    .eq('org_id', mb.org_id)
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
      project:  t.projects ?? null,
      client:   t.client_id ? (clientMap[t.client_id] ?? null) : null,
    }
  }

  const pending = (pendingRaw ?? [])
    .filter(t => {
      const approverId = (t as any).approver_id
      if (approverId) return approverId === user.id
      return true // managers see all unassigned approvals
    })
    .map(enrichTask)

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
}
