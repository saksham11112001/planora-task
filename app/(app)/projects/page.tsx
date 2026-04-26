import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }     from 'next/navigation'
import { ProjectsView } from './ProjectsView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  try {
  // Use cached fetchers — layout already called these, so no extra DB round trips
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()

  const isOwner = mb.role === 'owner'
  let projectsQuery = supabase.from('projects').select('*, clients(id, name, color), member_ids')
    .eq('org_id', mb.org_id).neq('is_archived', true).order('updated_at', { ascending: false })
  // Strict visibility: every user (including admins/managers) can only see projects where:
  // - member_ids is NULL (visible to whole org), OR they are listed in member_ids
  // Exception: org owners see all projects regardless (safety net for billing/admin)
  if (!isOwner) {
    projectsQuery = projectsQuery.or(`member_ids.is.null,member_ids.cs.{${user.id}}`)
  }

  // Fetch projects and clients in parallel first
  const [{ data: projects }, { data: clients }] = await Promise.all([
    projectsQuery,
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
  ])

  // Build task counts with parallel HEAD queries — zero row transfer, correct for any task volume
  const counts: Record<string, { total: number; done: number }> = {}
  if (projects && projects.length > 0) {
    const countResults = await Promise.all(
      projects.map(p => Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true })
          .eq('org_id', mb.org_id).eq('project_id', p.id).neq('is_archived', true).is('parent_task_id', null),
        supabase.from('tasks').select('*', { count: 'exact', head: true })
          .eq('org_id', mb.org_id).eq('project_id', p.id).eq('status', 'completed').neq('is_archived', true).is('parent_task_id', null),
      ]))
    )
    projects.forEach((p, i) => {
      counts[p.id] = { total: countResults[i][0].count ?? 0, done: countResults[i][1].count ?? 0 }
    })
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
  } catch (err: any) {
    console.error('[ProjectsPage crash]', err?.message ?? err)
    throw err
  }
}