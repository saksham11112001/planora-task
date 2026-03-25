import { Suspense }       from 'react'
import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { NewProjectForm } from './NewProjectForm'
import type { Metadata }  from 'next'
export const metadata: Metadata = { title: 'New project' }

export const revalidate = 20

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin','manager'].includes(mb.role)) redirect('/projects')
  const [{ data: clients }, { data: members }] = await Promise.all([
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
    supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
  ])
  const memberList = (members ?? []).map(m => ({ id: (m.users as any)?.id ?? m.user_id, name: (m.users as any)?.name ?? 'Unknown' }))
  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New project</h1>
      <Suspense fallback={<div className="card p-6 animate-pulse h-64"/>}>
        <NewProjectForm clients={clients ?? []} members={memberList}/>
      </Suspense>
    </div>
  )
}
