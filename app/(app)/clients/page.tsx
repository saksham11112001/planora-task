import { createClient }  from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }      from 'next/navigation'
import type { Metadata } from 'next'
import { ClientsView }   from './ClientsView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients').select('id, name, color, status, email, company, industry')
    .eq('org_id', mb.org_id).order('name')

  const canManage = ['owner', 'admin', 'manager'].includes(mb.role)

  return (
    <ClientsView
      initialClients={clients ?? []}
      canManage={canManage}
    />
  )
}
