import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { InvoicesView }       from './InvoicesView'

export async function InvoicesFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) return null

  const supabase = createAdminClient()

  const [{ data: invoices }, { data: clients }, { data: companyCodes }, { data: groups }] = await Promise.all([
    supabase.from('invoices')
      .select('*, client:clients(id, name, color)')
      .eq('org_id', mb.org_id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('clients')
      .select('id, name, color, status')
      .eq('org_id', mb.org_id)
      .order('name'),
    supabase.from('invoice_company_codes')
      .select('*')
      .eq('org_id', mb.org_id)
      .order('group_name', { nullsFirst: true })
      .order('label'),
    supabase.from('client_groups')
      .select('id, name, color')
      .eq('org_id', mb.org_id)
      .order('name'),
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
      groups={(groups ?? []).map(g => ({ id: g.id, name: g.name, color: g.color }))}
    />
  )
}
