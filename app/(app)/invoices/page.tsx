import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }       from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }           from 'next/navigation'
import { InvoicesView }       from './InvoicesView'
import type { Metadata }      from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: invoices }, { data: clients }, { data: companyCodes }] = await Promise.all([
    admin.from('invoices')
      .select('*, client:clients(id, name, color)')
      .eq('org_id', mb.org_id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('clients')
      .select('id, name, color, status')
      .eq('org_id', mb.org_id)
      .order('name'),
    admin.from('invoice_company_codes')
      .select('*')
      .eq('org_id', mb.org_id)
      .order('group_name', { nullsFirst: true })
      .order('label'),
  ])

  const clientList = (clients ?? []).map(c => ({ id: c.id, name: c.name, color: c.color }))

  return (
    <InvoicesView
      invoices={(invoices ?? []) as any[]}
      clients={clientList}
      canManage={['owner', 'admin', 'manager'].includes(mb.role)}
      userRole={mb.role}
      orgId={mb.org_id}
      companyCodes={(companyCodes ?? []) as any[]}
    />
  )
}
