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
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  const [{ data: projects }, { data: members }, { data: clients }] = await Promise.all([
    supabase.from('projects')
      .select('*, clients(id, name, color)')
      .eq('org_id', mb.org_id)
      .neq('is_archived', true)
      .order('updated_at', { ascending: false }),

    supabase.from('org_members')
      .select('user_id, role, users(id, name, avatar_url)')
      .eq('org_id', mb.org_id)
      .eq('is_active', true),

    supabase.from('clients')
      .select('id, name, color')
      .eq('org_id', mb.org_id)
      .eq('status', 'active')
      .order('name'),
  ])

  const memberList = (members ?? []).map(m => ({
    id:         (m.users as any)?.id ?? m.user_id,
    name:       (m.users as any)?.name ?? 'Unknown',
    avatar_url: (m.users as any)?.avatar_url ?? undefined,
    role:       m.role,
  }))

  return (
    <ProjectsView
      projects={(projects ?? []).map(p => ({ ...p, client: p.clients as any }))}
      clients={clients ?? []}
      members={memberList}
      currentUserId={user.id}
      canManage={['owner', 'admin', 'manager'].includes(mb.role)}
      orgId={mb.org_id}
    />
  )
}
