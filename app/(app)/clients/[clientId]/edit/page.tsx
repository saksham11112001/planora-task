import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { ClientEditForm } from './ClientEditForm'
import type { Metadata }  from 'next'
export const metadata: Metadata = { title: 'Edit Client' }

export const revalidate = 20

export default async function ClientEditPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')
  if (!['owner','admin','manager'].includes(mb.role)) redirect(`/clients/${clientId}`)
  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).eq('org_id', mb.org_id).single()
  if (!client) redirect('/clients')
  return <ClientEditForm client={client}/>
}
