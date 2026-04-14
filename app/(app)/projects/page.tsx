import { redirect }     from 'next/navigation'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { createClient } from '@/lib/supabase/server'
import { ProjectsView } from './ProjectsView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  try {
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
  const [{ data: projects }, { data: taskCounts }, { data: clients }] = await Promise.all([
    projectsQuery,
    supabase.from('tasks').select('project_id, status').eq('org_id', mb.org_id).not('project_id', 'is', null).neq('is_archived', true).is('parent_task_id', null).limit(5000),
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
  ])

  const counts: Record<string, { total: number; done: number }> = {}
  taskCounts?.forEach(t => {
    if (!t.project_id) return
    if (!counts[t.project_id]) counts[t.project_id] = { total: 0, done: 0 }
    counts[t.project_id].total++
    if (t.status === 'completed') counts[t.project_id].done++
  })

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