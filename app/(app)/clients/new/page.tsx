import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewClientForm } from './NewClientForm'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'New client' }
export const dynamic = 'force-dynamic'

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb || !['owner','admin','manager'].includes(mb.role)) redirect('/clients')

  const { data: rawMembers } = await supabase
    .from('org_members')
    .select('user_id, role, users(id,name)')
    .eq('org_id', mb.org_id).eq('is_active', true)

  const members = (rawMembers ?? []).map((m: any) => ({
    id:   m.users?.id   ?? m.user_id,
    name: m.users?.name ?? 'Unknown',
    role: m.role,
  }))

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New client</h1>
      <NewClientForm members={members}/>
    </div>
  )
}
