import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { ProjectsView } from './ProjectsView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  const [{ data: projects }, { data: taskCounts }, { data: clients }] = await Promise.all([
    supabase.from('projects').select('*, clients(id, name, color)')
      .eq('org_id', mb.org_id).neq('is_archived', true).order('updated_at', { ascending: false }),
    supabase.from('tasks').select('project_id, status').eq('org_id', mb.org_id).not('project_id', 'is', null),
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
    />
  )
}
