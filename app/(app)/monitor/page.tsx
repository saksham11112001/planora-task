import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { MonitorView }  from './MonitorView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Monitor' }

export default async function MonitorPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: mb } = await supabase.from('org_members')
      .select('org_id, role, can_view_all_tasks').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!mb) redirect('/onboarding')

    const TASK_COLS = 'id, title, status, priority, due_date, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, is_recurring, custom_fields, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, name), approver:users!tasks_approver_id_fkey(id, name), creator:users!tasks_created_by_fkey(id, name), projects(id, name, color)'

    // Monitor page always fetches ALL org tasks — that is its purpose
    const [
      { data: tasks },
      { data: members },
      { data: clientsData },
    ] = await Promise.all([
      supabase.from('tasks')
        .select(TASK_COLS)
        .eq('org_id', mb.org_id)
        .neq('is_archived', true)
        .is('parent_task_id', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(3000),
      supabase.from('org_members')
        .select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
      supabase.from('clients').select('id, name, color, status').eq('org_id', mb.org_id).order('name'),
    ])

    const clientMap: Record<string, { id: string; name: string; color: string }> = {}
    clientsData?.forEach(c => { clientMap[c.id] = { id: c.id, name: c.name, color: c.color } })
    const clientList = (clientsData ?? []).map(c => ({ id: c.id, name: c.name, color: c.color }))

    const memberList = (members ?? []).map((m: any) => ({
      id: (m.users as any)?.id ?? m.user_id,
      name: (m.users as any)?.name ?? 'Unknown',
    }))

    const taskList = (tasks ?? []).map((t: any) => ({
      ...t,
      due_date: t.due_date ?? null,
      assignee_id: t.assignee_id ?? null,
      client_id: t.client_id ?? null,
      project_id: t.project_id ?? null,
      approval_status: t.approval_status ?? null,
      is_recurring: t.is_recurring ?? false,
      created_at: t.created_at ?? '',
      updated_at: t.updated_at ?? null,
      assignee: (t.assignee as any) ?? null,
      approver: (t.approver as any) ?? null,
      creator: (t.creator as any) ?? null,
      client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
      project: (t.projects as any) ?? null,
    }))

    return <MonitorView
      tasks={taskList as any}
      members={memberList}
      clients={clientList}
      currentUserId={user.id}
      userRole={mb.role}
    />
  } catch (err: any) {
    console.error('[MonitorPage]', err?.message ?? err)
    throw err
  }
}
