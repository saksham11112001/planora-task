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

  const [{ data: clients }, { data: groups }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, color, status, email, company, industry, group_id')
      .eq('org_id', mb.org_id)
      .order('name'),
    supabase
      .from('client_groups')
      .select('id, name, color, notes, created_at, updated_at')
      .eq('org_id', mb.org_id)
      .order('name'),
  ])

  const canManage = ['owner', 'admin', 'manager'].includes(mb.role)

  return (
    <ClientsView
      initialClients={clients ?? []}
      initialGroups={groups ?? []}
      canManage={canManage}
    />
  )
}
