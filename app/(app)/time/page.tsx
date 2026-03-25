import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { TimeView }      from './TimeView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Time tracking' }

export const revalidate = 20

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp       = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  // Default: current month
  const now       = new Date()
  const fromDate  = sp.from ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const toDate    = sp.to   ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

  const canSeeAll = ['owner', 'admin', 'manager'].includes(mb.role)

  const [{ data: logs }, { data: projects }, { data: tasks }, { data: members }] = await Promise.all([
    supabase.from('time_logs')
      .select('id, hours, is_billable, description, logged_date, task_id, project_id, user_id, user:users!time_logs_user_id_fkey(name)')
      .eq('org_id', mb.org_id)
      .gte('logged_date', fromDate)
      .lte('logged_date', toDate)
      .match(canSeeAll ? {} : { user_id: user.id })
      .order('logged_date', { ascending: false }),
    supabase.from('projects').select('id, name, color').eq('org_id', mb.org_id).neq('is_archived', true).order('name'),
    supabase.from('tasks').select('id, title').eq('org_id', mb.org_id).neq('is_archived', true).in('status', ['todo','in_progress','in_review']).limit(100),
    canSeeAll
      ? supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true)
      : { data: null },
  ])

  const memberList = canSeeAll
    ? (members ?? []).map(m => ({ id: (m.users as any)?.id ?? m.user_id, name: (m.users as any)?.name ?? 'Unknown' }))
    : [{ id: user.id, name: 'Me' }]

  return (
    <TimeView
      logs={logs ?? []}
      projects={projects ?? []}
      tasks={tasks ?? []}
      members={memberList}
      currentUserId={user.id}
      canSeeAll={canSeeAll}
      fromDate={fromDate}
      toDate={toDate}
    />
  )
}
