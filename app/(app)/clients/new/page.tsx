import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewClientForm } from './NewClientForm'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'New client' }

export const revalidate = 20

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin','manager'].includes(mb.role)) redirect('/clients')
  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New client</h1>
      <NewClientForm/>
    </div>
  )
}
