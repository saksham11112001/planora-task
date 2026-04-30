import { createClient }  from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }       from 'next/navigation'
import { InvoicesView }   from './InvoicesView'
import type { Metadata }  from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()
  const orgId    = mb.org_id

  const [{ data: invoices }, { data: clients }] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, clients(id,name,color)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id,name,color,email')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('name'),
  ])

  return (
    <InvoicesView
      invoices={invoices ?? []}
      clients={clients ?? []}
      canManage={['owner','admin','manager'].includes(mb.role)}
      currentUserId={user.id}
    />
  )
}
