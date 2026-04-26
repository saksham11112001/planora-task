import { createClient }  from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }      from 'next/navigation'
import { TeamView }      from './TeamView'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()

  const from30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const [{ data: members }, { data: taskCounts }] = await Promise.all([
    supabase.from('org_members')
      .select('user_id, role, joined_at, is_active, users(id, name, email, avatar_url, phone_number)')
      .eq('org_id', mb.org_id).eq('is_active', true).order('joined_at'),
    supabase.from('tasks')
      .select('assignee_id, status').eq('org_id', mb.org_id).gte('created_at', from30),
  ])

  const countMap: Record<string, { total: number; completed: number; inProgress: number }> = {}
  ;(taskCounts ?? []).forEach(t => {
    if (!t.assignee_id) return
    if (!countMap[t.assignee_id]) countMap[t.assignee_id] = { total: 0, completed: 0, inProgress: 0 }
    countMap[t.assignee_id].total++
    if (t.status === 'completed') countMap[t.assignee_id].completed++
    if (t.status === 'in_progress') countMap[t.assignee_id].inProgress++
  })

  const memberList = (members ?? []).map(m => ({
    id:           (m.users as any)?.id   ?? m.user_id,
    name:         (m.users as any)?.name ?? 'Unknown',
    email:        (m.users as any)?.email ?? '',
    avatar_url:   (m.users as any)?.avatar_url ?? null,
    phone_number: (m.users as any)?.phone_number ?? null,
    role:         m.role,
    joined_at:    m.joined_at,
    tasks_30d:    countMap[(m.users as any)?.id]?.total     ?? 0,
    done_30d:     countMap[(m.users as any)?.id]?.completed  ?? 0,
    inprog_30d:   countMap[(m.users as any)?.id]?.inProgress ?? 0,
  }))

  const canManage = ['owner','admin','manager'].includes(mb.role)
  return <TeamView members={memberList} canManage={canManage} currentUserId={user.id}/>
}
