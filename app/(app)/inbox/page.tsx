import { createClient }   from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }        from 'next/navigation'
import { InboxView }       from './InboxView'
import type { Metadata }   from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Quick tasks' }

export default async function InboxPage() {
  try {
    const user = await getSessionUser()
    if (!user) redirect('/login')

    const mb = await getOrgMembership(user.id)
    if (!mb) redirect('/onboarding')

    const supabase = await createClient()

    // canViewAll: owner/admin always; others only if explicitly granted via Members settings
    const canViewAll = ['owner', 'admin'].includes(mb.role) || (mb as any).can_view_all_tasks === true

    const TASK_SELECT = 'id, title, status, priority, due_date, approval_status, approval_required, approver_id, client_id, assignee_id, created_by, is_recurring, estimated_hours, custom_fields, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), approver:users!tasks_approver_id_fkey(id, name), creator:users!tasks_created_by_fkey(id, name)'

    // ── All fetches in parallel ───────────────────────────────────
    const [tasksResult, membersResult, clientsResult, allClientsResult] = await Promise.all([
      // Tasks query:
      // canViewAll → all one-time org tasks
      // others    → only tasks they are assignee OR approver of
      (() => {
        const q = supabase.from('tasks')
          .select(TASK_SELECT)
          .eq('org_id', mb.org_id).is('project_id', null).is('parent_task_id', null)
          .neq('is_archived', true).or('is_recurring.is.null,is_recurring.eq.false')
          .order('created_at', { ascending: false })
        return (canViewAll
          ? q
          : q.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)
        ).limit(500)
      })(),

      // Members
      supabase.from('org_members').select('user_id, role, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),

      // Clients map
      supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id),

      // All active clients for filter bar
      supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
    ])

    const { data: tasks, error } = tasksResult
    if (error) console.error('[inbox]', error.message)

    const clientMap: Record<string, { name: string; color: string }> = {}
    clientsResult.data?.forEach(c => { clientMap[c.id] = { name: c.name, color: c.color } })

    const memberList = (membersResult.data ?? []).map(m => ({
      id: (m.users as any)?.id ?? m.user_id,
      name: (m.users as any)?.name ?? 'Unknown',
      role: (m as any).role ?? 'member',
    }))
    const clientList = (allClientsResult.data ?? []).map(c => ({ id: c.id, name: c.name, color: c.color }))
    const canCreate  = ['owner','admin','manager','member'].includes(mb.role)

    const enriched = (tasks ?? [])
      .filter(t => {
        // CA compliance tasks live exclusively in the CA Compliance module — never show here
        if ((t as any).custom_fields?._ca_compliance === true) return false
        return true
      })
      .map(t => ({
        ...t, description: null, project_id: null, project: null, is_archived: false,
        created_at: (t as any).created_at ?? '',
        updated_at: (t as any).updated_at ?? null,
        approval_required: (t as any).approval_required ?? false, completed_at: null,
        is_recurring: t.is_recurring ?? false, estimated_hours: t.estimated_hours ?? null,
        due_date: t.due_date ?? null, assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
        approver_id: (t as any).approver_id ?? null, approval_status: t.approval_status ?? null,
        assignee: (t.assignee as any) ?? null, approver: (t as any).approver ?? null,
        creator: (t as any).creator ?? null,
        client: t.client_id ? (clientMap[t.client_id] ? { id: t.client_id, ...clientMap[t.client_id] } : null) : null,
      }))

    return <InboxView
      tasks={enriched as any}
      members={memberList}
      clients={clientList}
      currentUserId={user.id}
      userRole={mb.role}
      canCreate={canCreate}
      canViewAllTasks={canViewAll}
    />
  } catch (err: any) {
    console.error('[InboxPage crash]', err?.message ?? err)
    throw err
  }
}
