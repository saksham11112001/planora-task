import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RecurringView } from './RecurringView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Repeat tasks' }


export default async function RecurringPage() {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role, can_view_all_tasks').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  // canViewAll: owner/admin always; others only if explicitly granted via Members settings
  const canViewAll = ['owner', 'admin'].includes(mb.role) || (mb as any).can_view_all_tasks === true
  const canManage  = ['owner','admin','manager'].includes(mb.role)

  const TASK_SELECT = 'id, title, status, priority, frequency, next_occurrence_date, assignee_id, approver_id, client_id, created_by, created_at, updated_at, assignee:users!tasks_assignee_id_fkey(id, name), approver:users!tasks_approver_id_fkey(id, name), creator:users!tasks_created_by_fkey(id, name), projects(id, name, color), clients(id, name, color)'

  // All 4 queries in parallel
  const [
    { data: tasks },
    { data: members },
    { data: projects },
    { data: clients },
  ] = await Promise.all([
    // Recurring templates:
    // canViewAll → all templates in the org
    // others    → only templates they are assignee OR approver of
    (() => {
      const q = supabase.from('tasks').select(TASK_SELECT)
        .eq('org_id', mb.org_id).eq('is_recurring', true).neq('is_archived', true)
        .order('next_occurrence_date', { ascending: true })
      // "Repeat Tasks" always scoped to current user — "My" means assigned to me.
      return q.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`).limit(2000)
    })(),
    supabase.from('org_members').select('user_id, role, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
    supabase.from('projects').select('id, name, color').eq('org_id', mb.org_id).neq('is_archived', true).order('name'),
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
  ])



  // Include roles so the approver selector can filter managers only
  const memberListWithRoles = (members ?? []).map(m => ({
    id: (m.users as any)?.id ?? m.user_id,
    name: (m.users as any)?.name ?? 'Unknown',
    role: (m as any).role ?? 'member',
  }))

  return (
    <RecurringView
      tasks={(tasks ?? []).map(t => ({ ...t, assignee: (t.assignee as any) ?? null, approver: (t as any).approver ?? null, creator: (t as any).creator ?? null, project: (t.projects as any) ?? null, client: (t.clients as any) ?? null, created_at: (t as any).created_at ?? '', updated_at: (t as any).updated_at ?? null }))}
      members={memberListWithRoles} projects={projects ?? []} clients={clients ?? []} currentUserId={user.id} canManage={canManage} userRole={mb.role}/>
  )
  } catch (err: any) {
    console.error('[RecurringPage crash]', err?.message ?? err)
    throw err
  }
}