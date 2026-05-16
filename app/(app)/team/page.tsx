import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }      from 'next/navigation'
import { TeamView }      from './TeamView'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = createAdminClient()

  const from30 = new Date(Date.now() - 30  * 86400000).toISOString()
  const from84 = new Date(Date.now() - 84  * 86400000).toISOString() // 12 weeks for heatmap

  const [{ data: members }, { data: taskData }] = await Promise.all([
    supabase.from('org_members')
      .select('user_id, role, joined_at, is_active, users(id, name, email, avatar_url, phone_number)')
      .eq('org_id', mb.org_id).eq('is_active', true).order('joined_at'),
    supabase.from('tasks')
      .select('assignee_id, status, completed_at, created_at')
      .eq('org_id', mb.org_id).gte('created_at', from84),
  ])

  const countMap:   Record<string, { total: number; completed: number }> = {}
  const heatmapMap: Record<string, Record<string, number>> = {}

  ;(taskData ?? []).forEach(t => {
    if (!t.assignee_id) return
    // 30-day task stats
    if (t.created_at >= from30) {
      if (!countMap[t.assignee_id]) countMap[t.assignee_id] = { total: 0, completed: 0 }
      countMap[t.assignee_id].total++
      if (t.status === 'completed') countMap[t.assignee_id].completed++
    }
    // Heatmap: per-day completions over last 12 weeks
    if (t.status === 'completed' && t.completed_at) {
      const date = t.completed_at.slice(0, 10)
      if (!heatmapMap[t.assignee_id]) heatmapMap[t.assignee_id] = {}
      heatmapMap[t.assignee_id][date] = (heatmapMap[t.assignee_id][date] ?? 0) + 1
    }
  })

  const memberList = (members ?? []).map(m => ({
    id:           (m.users as any)?.id   ?? m.user_id,
    name:         (m.users as any)?.name ?? 'Unknown',
    email:        (m.users as any)?.email ?? '',
    avatar_url:   (m.users as any)?.avatar_url ?? null,
    phone_number: (m.users as any)?.phone_number ?? null,
    role:         m.role,
    joined_at:    m.joined_at,
    tasks_30d:    countMap[(m.users as any)?.id]?.total    ?? 0,
    done_30d:     countMap[(m.users as any)?.id]?.completed ?? 0,
    inprog_30d:   0,
    heatmap:      heatmapMap[(m.users as any)?.id] ?? {},
  }))

  const canManage = ['owner','admin','manager'].includes(mb.role)
  return <TeamView members={memberList} canManage={canManage} currentUserId={user.id}/>
}
