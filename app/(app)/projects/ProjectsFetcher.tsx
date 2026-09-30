import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { ProjectsView } from './ProjectsView'

export async function ProjectsFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) return null

  const supabase = createAdminClient()
  const isOwner = mb.role === 'owner'

  let projectsQuery = supabase.from('projects').select('*, clients(id, name, color), member_ids')
    .eq('org_id', mb.org_id).neq('is_archived', true).order('updated_at', { ascending: false })
  if (!isOwner) {
    projectsQuery = projectsQuery.or(`member_ids.is.null,member_ids.cs.{${user.id}}`)
  }

  const [{ data: projects }, { data: clients }] = await Promise.all([
    projectsQuery,
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
  ])

  // Task tallies for the project cards.
  //
  // This was two exact counts PER PROJECT, issued in a loop: thirty projects
  // meant sixty count queries on every load of this page, a hundred meant two
  // hundred. Classic N+1 — the cost grew with the number of projects, which is
  // exactly the thing a growing firm adds more of.
  //
  // One read instead, returning two narrow columns for the org's top-level
  // project tasks, tallied in memory. Every filter stays in SQL exactly as the
  // counts had it, so the numbers cannot drift — the only thing done here is
  // grouping by project and testing status.
  //
  // Paged via fetchAllRows because PostgREST truncates at 1000 rows in silence,
  // which would quietly under-report every card past the cut-off.
  const counts: Record<string, { total: number; done: number }> = {}
  if (projects && projects.length > 0) {
    const { data: taskRows } = await fetchAllRows<{ project_id: string | null; status: string | null }>(
      (from, to) => supabase.from('tasks')
        .select('project_id, status')
        .eq('org_id', mb.org_id)
        .neq('is_archived', true)
        .is('parent_task_id', null)
        .not('project_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
      { maxRows: 20_000 },
    )
    for (const p of projects) counts[p.id] = { total: 0, done: 0 }
    for (const row of taskRows ?? []) {
      const bucket = row.project_id ? counts[row.project_id] : undefined
      if (!bucket) continue                    // task on a project this user cannot see
      bucket.total += 1
      if (row.status === 'completed') bucket.done += 1
    }
  }

  return (
    <ProjectsView
      projects={(projects ?? []).map(p => ({ ...p, client: p.clients as any }))}
      counts={counts}
      clients={clients ?? []}
      canManage={['owner','admin','manager'].includes(mb.role)}
      currentUserId={user.id}
    />
  )
}
