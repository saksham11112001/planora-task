export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }     from 'next/navigation'
import { MembersView }  from './MembersView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Team members' }

export const revalidate = 20

export default async function MembersPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()

  const { data: members } = await supabase.from('org_members')
    .select('id, role, joined_at, user_id, can_view_all_tasks, can_view_monitor, users(id, name, email, avatar_url)')
    .eq('org_id', mb.org_id).eq('is_active', true).order('joined_at')

  const isAdmin = ['owner','admin'].includes(mb.role)
  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Team members</h1>
      <MembersView members={(members ?? []).map(m => ({ ...m, users: m.users as any }))} currentUserId={user.id} isAdmin={isAdmin}/>
    </div>
  )
}
