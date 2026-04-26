import { createClient }    from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }        from 'next/navigation'
import { ProjectEditForm } from './ProjectEditForm'
import type { Metadata }   from 'next'
export const metadata: Metadata = { title: 'Edit Project' }

export const revalidate = 20

export default async function ProjectEditPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()
  if (!['owner','admin','manager'].includes(mb.role)) redirect(`/projects/${projectId}`)
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).eq('org_id', mb.org_id).single()
  if (!project) redirect('/projects')
  const [{ data: clients }, { data: members }] = await Promise.all([
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
    supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
  ])
  const memberList = (members ?? []).map(m => ({ id: (m.users as any)?.id ?? m.user_id, name: (m.users as any)?.name ?? 'Unknown' }))
  return <ProjectEditForm project={project} clients={clients ?? []} members={memberList}/>
}
