import { redirect }     from 'next/navigation'
import { getSessionUser, getOrgMembership, getUserProfile } from '@/lib/supabase/cached'
import { createClient } from '@/lib/supabase/server'
import { todayStr }     from '@/lib/utils/format'
import { DashboardClient } from './DashboardClient'
import type { Metadata }   from 'next'
export const metadata: Metadata = { title: 'Home' }
export const revalidate = 30

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [mb, profile] = await Promise.all([
    getOrgMembership(user.id),
    getUserProfile(user.id),
  ])
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()
  const orgId    = mb.org_id
  const today    = todayStr()
  const hour     = new Date().getHours()
  const name     = profile?.name?.split(' ')[0] ?? user.email?.split('@')[0]?.split('.')[0] ?? 'there'
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const from30   = new Date(Date.now() - 30 * 86400000).toISOString()

  const results = await Promise.allSettled([
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('assignee_id', user.id).in('status', ['todo','in_progress']).lt('due_date', today),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('assignee_id', user.id).in('status', ['todo','in_progress']).eq('due_date', today),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('assignee_id', user.id).eq('approval_status', 'pending'),
    supabase.from('tasks')
      .select('id, title, status, due_date, project_id, projects(id, name, color)')
      .eq('org_id', orgId).eq('assignee_id', user.id).in('status', ['todo','in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false }).limit(7),
    supabase.from('projects')
      .select('id, name, color, status, due_date, client_id, clients(id, name, color)')
      .eq('org_id', orgId).eq('status', 'active').neq('is_archived', true)
      .order('updated_at', { ascending: false }).limit(4),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'completed').gte('completed_at', from30),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).gte('created_at', from30),
    supabase.from('clients').select('id, name, color').eq('org_id', orgId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(5),
  ])

  const overdueCount       = results[0].status === 'fulfilled' ? (results[0].value as any).count ?? 0 : 0
  const todayCount         = results[1].status === 'fulfilled' ? (results[1].value as any).count ?? 0 : 0
  const pendingCount       = results[2].status === 'fulfilled' ? (results[2].value as any).count ?? 0 : 0
  const myTasks            = results[3].status === 'fulfilled' ? (results[3].value as any).data ?? [] : []
  const activeProjects     = results[4].status === 'fulfilled' ? (results[4].value as any).data ?? [] : []
  const completedThisMonth = results[5].status === 'fulfilled' ? (results[5].value as any).count ?? 0 : 0
  const totalThisMonth     = results[6].status === 'fulfilled' ? (results[6].value as any).count ?? 0 : 0
  const recentClients      = results[7].status === 'fulfilled' ? (results[7].value as any).data ?? [] : []

  const completionRate = totalThisMonth
    ? Math.round(((completedThisMonth ?? 0) / totalThisMonth) * 100)
    : 0

  return (
    <DashboardClient
      greeting={greeting} name={name} today={today}
      overdueCount={overdueCount ?? 0}
      todayCount={todayCount ?? 0}
      pendingCount={pendingCount ?? 0}
      completedThisMonth={completedThisMonth ?? 0}
      totalThisMonth={totalThisMonth ?? 0}
      completionRate={completionRate}
      myTasks={(myTasks ?? []) as any}
      activeProjects={(activeProjects ?? []) as any}
      recentClients={recentClients ?? []}
    />
  )
}
