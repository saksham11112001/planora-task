export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { DSCExpiryView } from './DSCExpiryView'

export default async function DSCExpiryPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = createAdminClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, color, email, phone, dsc_expiry_date, dsc_holder_name, gstin, status')
    .eq('org_id', mb.org_id)
    .not('dsc_expiry_date', 'is', null)
    .order('dsc_expiry_date', { ascending: true })

  const today = new Date().toISOString().split('T')[0]
  const canManage = ['owner', 'admin', 'manager'].includes(mb.role)

  return <DSCExpiryView clients={clients ?? []} today={today} canManage={canManage} />
}
