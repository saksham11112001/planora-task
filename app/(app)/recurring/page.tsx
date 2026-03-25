import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RecurringView } from './RecurringView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Recurring tasks' }

export const revalidate = 20

export default async function RecurringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')


  const { data: tasks } = await supabase.from('tasks')
    .select('id, title, status, priority, frequency, next_occurrence_date, assignee_id, assignee:users!tasks_assignee_id_fkey(id, name), projects(id, name, color)')
    .eq('org_id', mb.org_id).eq('is_recurring', true).neq('is_archived', true)
    .order('next_occurrence_date', { ascending: true })

  const { data: members } = await supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true)
  const { data: projects } = await supabase.from('projects').select('id, name, color').eq('org_id', mb.org_id).neq('is_archived', true).order('name')
  const canManage = ['owner','admin','manager'].includes(mb.role)

  const memberList = (members ?? []).map(m => ({ id: (m.users as any)?.id ?? m.user_id, name: (m.users as any)?.name ?? 'Unknown' }))

  return (
    <RecurringView
      tasks={(tasks ?? []).map(t => ({ ...t, assignee: (t.assignee as any) ?? null, project: (t.projects as any) ?? null }))}
      members={memberList} projects={projects ?? []} currentUserId={user.id} canManage={canManage}/>
  )
}
