import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { CalendarView } from './CalendarView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Calendar' }
export const revalidate = 30

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  const orgId = mb.org_id
  const canViewAll = ['owner','admin','manager'].includes(mb.role)

  // Fetch 3 months of tasks with due dates
  const from = new Date(); from.setMonth(from.getMonth() - 1)
  const to   = new Date(); to.setMonth(to.getMonth() + 2)

  const q = supabase.from('tasks')
    .select('id, title, status, priority, due_date, is_recurring, project_id, assignee_id, frequency, projects(id,name,color), assignee:users!tasks_assignee_id_fkey(id,name)')
    .eq('org_id', orgId).not('due_date', 'is', null)
    .gte('due_date', from.toISOString().split('T')[0])
    .lte('due_date', to.toISOString().split('T')[0])

  const { data: tasks } = canViewAll ? await q : await q.eq('assignee_id', user.id)

  return <CalendarView tasks={(tasks ?? []) as any} canViewAll={canViewAll} currentUserId={user.id}/>
}
