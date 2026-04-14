import { redirect }         from 'next/navigation'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { createClient }      from '@/lib/supabase/server'
import { ApprovalsView }     from './ApprovalsView'
import type { Metadata }     from 'next'

export const dynamic   = 'force-dynamic'
export const metadata: Metadata = { title: 'Approvals | Planora' }

export default async function ApprovalsPage() {
  try {
    // Cached — if layout already fetched these, no extra RTT
    const user = await getSessionUser()
    if (!user) redirect('/login')

    const mb = await getOrgMembership(user.id)
    if (!mb) redirect('/onboarding')

    const supabase = await createClient()
    const since    = new Date(Date.now() - 7 * 86400000).toISOString()

    const TASK_SELECT_PENDING = `
      id, title, status, priority, due_date, created_at, created_by,
      assignee_id, approver_id, client_id, project_id,
      approval_status, approval_required, is_recurring, custom_fields,
      assignee:users!tasks_assignee_id_fkey(id, name),
      approver:users!tasks_approver_id_fkey(id, name),
      creator:users!tasks_created_by_fkey(id, name),
      projects(id, name, color)
    `
    const TASK_SELECT_HISTORY = `
      id, title, status, priority, due_date, completed_at, approved_at, created_by,
      assignee_id, approver_id, client_id, project_id,
      approval_status, is_recurring, custom_fields,
      assignee:users!tasks_assignee_id_fkey(id, name),
      approver:users!tasks_approver_id_fkey(id, name),
      creator:users!tasks_created_by_fkey(id, name),
      projects(id, name, color)
    `

    // All 4 queries fire in parallel — one round-trip instead of four
    const [pendingResult, historyResult, clientsResult, membersResult] = await Promise.all([
      supabase
        .from('tasks')
        .select(TASK_SELECT_PENDING)
        .eq('org_id', mb.org_id)
        .eq('status', 'in_review')
        .eq('approval_status', 'pending')
        .eq('approver_id', user.id)
        .neq('is_archived', true)
        .is('parent_task_id', null)
        .order('created_at', { ascending: false }),

      supabase
        .from('tasks')
        .select(TASK_SELECT_HISTORY)
        .eq('org_id', mb.org_id)
        .eq('approver_id', user.id)
        .in('approval_status', ['approved', 'rejected'])
        .gte('approved_at', since)
        .neq('is_archived', true)
        .is('parent_task_id', null)
        .order('approved_at', { ascending: false })
        .limit(30),

      supabase
        .from('clients')
        .select('id, name, color')
        .eq('org_id', mb.org_id),

      supabase
        .from('org_members')
        .select('user_id, users(id, name)')
        .eq('org_id', mb.org_id)
        .eq('is_active', true),
    ])

    const clientMap: Record<string, { id: string; name: string; color: string }> = {}
    clientsResult.data?.forEach(c => { clientMap[c.id] = c })

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

    const pending    = (pendingResult.data ?? []).map(enrichTask)
    const history    = (historyResult.data ?? []).map(enrichTask)
    const memberList = (membersResult.data ?? []).map(m => ({
      id:   (m.users as any)?.id   ?? m.user_id,
      name: (m.users as any)?.name ?? 'Unknown',
    }))

    return (
      <ApprovalsView
        pending={pending as any}
        history={history as any}
        members={memberList}
        clients={clientsResult.data ?? []}
        currentUserId={user.id}
        userRole={mb.role}
      />
    )
  } catch (err: any) {
    console.error('[ApprovalsPage crash]', err?.message ?? err)
    throw err
  }
}
