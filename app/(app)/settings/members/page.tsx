import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { MembersView }  from './MembersView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Team members' }

export const revalidate = 20

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  const { data: members } = await supabase.from('org_members')
    .select('id, role, joined_at, user_id, users(id, name, email, avatar_url)')
    .eq('org_id', mb.org_id).eq('is_active', true).order('joined_at')

  const isAdmin = ['owner','admin'].includes(mb.role)
  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Team members</h1>
      <MembersView members={(members ?? []).map(m => ({ ...m, users: m.users as any }))} currentUserId={user.id} isAdmin={isAdmin}/>
    </div>
  )
}
