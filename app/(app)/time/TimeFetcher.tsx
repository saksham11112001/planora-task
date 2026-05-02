import { createClient }  from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { TimeView }      from './TimeView'

interface Props {
  fromDate: string
  toDate:   string
}

export async function TimeFetcher({ fromDate, toDate }: Props) {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getOrgMembership(user.id)
  if (!mb) return null

  const supabase = await createClient()
  const canSeeAll = ['owner', 'admin', 'manager'].includes(mb.role)

  const [{ data: logs }, { data: projects }, { data: tasks }, { data: members }, { data: clients }] = await Promise.all([
    supabase.from('time_logs')
      .select('id, hours, is_billable, description, logged_date, task_id, project_id, user_id, user:users!time_logs_user_id_fkey(name), projects(name,color), tasks(title)')
      .eq('org_id', mb.org_id)
      .gte('logged_date', fromDate)
      .lte('logged_date', toDate)
      .match(canSeeAll ? {} : { user_id: user.id })
      .order('logged_date', { ascending: false }),
    supabase.from('projects').select('id, name, color, client_id').eq('org_id', mb.org_id).neq('is_archived', true).order('name'),
    supabase.from('tasks').select('id, title, project_id').eq('org_id', mb.org_id).neq('is_archived', true).in('status', ['todo','in_progress','in_review']).limit(500),
    canSeeAll
      ? supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true)
      : { data: null },
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
  ])

  const memberList = canSeeAll
    ? (members ?? []).map(m => ({ id: (m.users as any)?.id ?? m.user_id, name: (m.users as any)?.name ?? 'Unknown' }))
    : [{ id: user.id, name: 'Me' }]

  return (
    <TimeView
      logs={(logs ?? []) as any}
      projects={projects ?? []}
      tasks={tasks ?? []}
      clients={clients ?? []}
      members={memberList}
      currentUserId={user.id}
      canSeeAll={canSeeAll}
      fromDate={fromDate}
      toDate={toDate}
    />
  )
}
