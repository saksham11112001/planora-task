import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { TeamView }      from './TeamView'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  const from30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const [{ data: members }, { data: taskCounts }] = await Promise.all([
    supabase.from('org_members')
      .select('id, user_id, role, joined_at, is_active, users(id, name, email, avatar_url)')
      .eq('org_id', mb.org_id)
      .eq('is_active', true)
      .order('joined_at'),
    supabase.from('tasks')
      .select('assignee_id, status')
      .eq('org_id', mb.org_id)
      .gte('created_at', from30),
  ])

  const countMap: Record<string, { total: number; completed: number; inProgress: number }> = {}
  ;(taskCounts ?? []).forEach(t => {
    if (!t.assignee_id) return
    if (!countMap[t.assignee_id]) countMap[t.assignee_id] = { total: 0, completed: 0, inProgress: 0 }
    countMap[t.assignee_id].total++
    if (t.status === 'completed') countMap[t.assignee_id].completed++
    if (t.status === 'in_progress') countMap[t.assignee_id].inProgress++
  })

  // Shape data to match TeamView's Member interface exactly
  const memberList = (members ?? []).map(m => {
    const u = m.users as any
    const uid = u?.id ?? m.user_id
    return {
      id:         m.id,           // org_members row id (used for editingRole key)
      user_id:    m.user_id,      // auth user id (used for canManage / handleRemove)
      role:       m.role as 'admin' | 'manager' | 'member' | 'viewer',
      joined_at:  m.joined_at,
      users: {
        id:         uid,
        name:       u?.name  ?? 'Unknown',
        email:      u?.email ?? '',
        avatar_url: u?.avatar_url ?? undefined,
        phone_number: u?.phone_number ?? undefined,
      },
      // Extra stats passed through (TeamView ignores unknown props)
      tasks_30d:  countMap[uid]?.total     ?? 0,
      done_30d:   countMap[uid]?.completed  ?? 0,
    }
  })

  return (
    <TeamView
      members={memberList as any}
      currentUserId={user.id}
      currentRole={mb.role}
      orgId={mb.org_id}
    />
  )
}
