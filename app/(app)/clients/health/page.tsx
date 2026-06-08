export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClientHealthView } from './ClientHealthView'

export default async function ClientHealthPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const canManage = ['owner', 'admin', 'manager'].includes(mb.role)

  // Fetch clients + their overdue task counts + DSC expiry + unpaid invoices
  const [
    { data: clients },
    { data: overdueTasks },
    { data: invoices },
  ] = await Promise.all([
    supabase.from('clients')
      .select('id, name, color, status, dsc_expiry_date, email, phone')
      .eq('org_id', mb.org_id)
      .order('name'),
    supabase.from('tasks')
      .select('client_id')
      .eq('org_id', mb.org_id)
      .not('status', 'in', '("completed","cancelled")')
      .not('due_date', 'is', null)
      .lt('due_date', today)
      .neq('is_archived', true),
    supabase.from('invoices')
      .select('client_id, status, total')
      .eq('org_id', mb.org_id)
      .in('status', ['sent', 'draft']),
  ])

  return (
    <ClientHealthView
      clients={clients ?? []}
      overdueTasks={overdueTasks ?? []}
      invoices={invoices ?? []}
      today={today}
      canManage={canManage}
    />
  )
}
