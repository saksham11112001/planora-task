export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { AnnualCalendarView } from './AnnualCalendarView'

export default async function AnnualCalendarPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const admin = createAdminClient()
  const [{ data: clients }, { data: tasks }] = await Promise.all([
    admin.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
    admin.from('tasks')
      .select('id, title, status, priority, due_date, client_id')
      .eq('org_id', mb.org_id)
      .contains('custom_fields', { _ca_compliance: true })
      .neq('is_archived', true)
      .not('due_date', 'is', null)
      .order('due_date'),
  ])

  return <AnnualCalendarView clients={clients ?? []} tasks={tasks ?? []} />
}
