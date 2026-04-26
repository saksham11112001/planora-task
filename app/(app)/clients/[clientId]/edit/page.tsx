import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }     from 'next/navigation'
import { ClientEditForm } from './ClientEditForm'
import type { Metadata }  from 'next'
export const metadata: Metadata = { title: 'Edit Client' }

export const revalidate = 20

export default async function ClientEditPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()
  if (!['owner','admin','manager'].includes(mb.role)) redirect(`/clients/${clientId}`)
  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).eq('org_id', mb.org_id).single()
  if (!client) redirect('/clients')
  return <ClientEditForm client={client}/>
}
