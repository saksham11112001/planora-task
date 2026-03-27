import { redirect }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayStr }     from '@/lib/utils/format'
import { DashboardClient } from './DashboardClient'
import type { Metadata }   from 'next'
export const metadata: Metadata = { title: 'Home' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Get membership
    const { data: mb } = await supabase
      .from('org_members')
      .select('org_id, role, organisations(id, name)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!mb) redirect('/onboarding')

    // Get profile safely
    const { data: profile } = await supabase
      .from('users')
      .select('id, name, email, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    const orgId    = mb.org_id
    const today    = todayStr()
    const hour     = new Date().getHours()
    const name     = profile?.name?.split(' ')[0] ?? user.email?.split('@')[0]?.split('.')[0] ?? 'there'
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    const from30   = new Date(Date.now() - 30 * 86400000).toISOString()

    // Use Promise.allSettled — never crashes even if individual queries fail
    const results = await Promise.allSettled([
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).eq('assignee_id', user.id)
        .in('status', ['todo','in_progress']).lt('due_date', today),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).eq('assignee_id', user.id)
        .in('status', ['todo','in_progress']).eq('due_date', today),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).eq('assignee_id', user.id).eq('approval_status', 'pending'),
      supabase.from('tasks')
        .select('id, title, status, due_date, project_id, projects(id, name, color)')
        .eq('org_id', orgId).eq('assignee_id', user.id)
        .in('status', ['todo','in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false }).limit(7),
      supabase.from('projects')
        .select('id, name, color, status, due_date, client_id, clients(id, name, color)')
        .eq('org_id', orgId).eq('status', 'active').neq('is_archived', true)
        .order('updated_at', { ascending: false }).limit(4),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).eq('status', 'completed').gte('completed_at', from30),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).gte('created_at', from30),
      supabase.from('clients').select('id, name, color')
        .eq('org_id', orgId).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(5),
    ])

    const get = (i: number, key: 'count' | 'data', def: any) =>
      results[i].status === 'fulfilled' ? ((results[i] as any).value?.[key] ?? def) : def

    return (
      <DashboardClient
        greeting={greeting} name={name} today={today}
        overdueCount={get(0,'count',0)}
        todayCount={get(1,'count',0)}
        pendingCount={get(2,'count',0)}
        completedThisMonth={get(5,'count',0)}
        totalThisMonth={get(6,'count',0)}
        completionRate={get(6,'count',0) > 0
          ? Math.round((get(5,'count',0) / get(6,'count',0)) * 100) : 0}
        myTasks={get(3,'data',[]) as any}
        activeProjects={get(4,'data',[]) as any}
        recentClients={get(7,'data',[])}
      />
    )
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
    console.error('[Dashboard] crash:', err?.message ?? err)
    redirect('/login')
  }
}
