import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { InboxView }       from './InboxView'
import type { Metadata }   from 'next'
export const metadata: Metadata = { title: 'One-time tasks' }

export const revalidate = 15

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  // Fetch tasks NOT in any project — no clients() join
  const { data: tasks, error } = await supabase.from('tasks')
    .select('id, title, status, priority, due_date, approval_status, client_id, assignee_id, is_recurring, estimated_hours, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url)')
    .eq('org_id', mb.org_id).is('project_id', null).neq('is_archived', true)
    .order('created_at', { ascending: false })

  if (error) console.error('[inbox]', error.message)

  // Clients fetched separately
  const { data: clientsData } = await supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id)
  const clientMap: Record<string, { name: string; color: string }> = {}
  clientsData?.forEach(c => { clientMap[c.id] = { name: c.name, color: c.color } })

  const { data: members }    = await supabase.from('org_members').select('user_id, role, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true)
  const { data: allClients } = await supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name')

  const memberList = (members ?? []).map(m => ({ id: (m.users as any)?.id ?? m.user_id, name: (m.users as any)?.name ?? 'Unknown', role: (m as any).role ?? 'member' }))
  const clientList = (allClients ?? []).map(c => ({ id: c.id, name: c.name, color: c.color }))
  const canCreate  = ['owner','admin','manager','member'].includes(mb.role)

  const enriched = (tasks ?? []).map(t => ({
    ...t, description: null, project_id: null, project: null, is_archived: false, created_at: '',
    approval_required: false, completed_at: null, is_recurring: t.is_recurring ?? false,
    estimated_hours: t.estimated_hours ?? null, due_date: t.due_date ?? null,
    assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
    approval_status: t.approval_status ?? null,
    assignee: (t.assignee as any) ?? null,
    client: t.client_id ? (clientMap[t.client_id] ? { id: t.client_id, ...clientMap[t.client_id] } : null) : null,
  }))

  return <InboxView tasks={enriched as any} members={memberList} clients={clientList} currentUserId={user.id} userRole={mb.role} canCreate={canCreate}/>
}
