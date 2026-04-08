import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { InboxView }       from './InboxView'
import type { Metadata }   from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'One-time tasks' }

export default async function InboxPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: mb } = await supabase.from('org_members')
      .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!mb) redirect('/onboarding')

    const canViewAll = ['owner', 'admin', 'manager'].includes(mb.role)

    // ── All fetches in parallel ───────────────────────────────────
    const [tasksResult, membersResult, clientsResult, allClientsResult] = await Promise.all([
      // Tasks query (role-filtered)
      (() => {
        let q = supabase.from('tasks')
          .select('id, title, status, priority, due_date, approval_status, approval_required, client_id, assignee_id, created_by, is_recurring, estimated_hours, custom_fields, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), creator:users!tasks_created_by_fkey(id, name)')
          .eq('org_id', mb.org_id).is('project_id', null).is('parent_task_id', null).neq('is_archived', true)
          .or('is_recurring.is.null,is_recurring.eq.false')
          .order('created_at', { ascending: false })
        if (!canViewAll) q = q.eq('assignee_id', user.id)
        return q
      })(),
      // Members
      supabase.from('org_members').select('user_id, role, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
      // Clients map
      supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id),
      // All active clients for filter
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
        const cf = (t as any).custom_fields
        // Show compliance tasks only if properly cron/manually triggered (_triggered: true).
        // Old direct-import tasks (no _triggered flag) are hidden from inbox.
        if (cf?._ca_compliance === true) return cf?._triggered === true
        return true
      })
      .map(t => ({
      ...t, description: null, project_id: null, project: null, is_archived: false, created_at: '',
      approval_required: (t as any).approval_required ?? false, completed_at: null,
      is_recurring: t.is_recurring ?? false, estimated_hours: t.estimated_hours ?? null,
      due_date: t.due_date ?? null, assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
      approval_status: t.approval_status ?? null, assignee: (t.assignee as any) ?? null,
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
