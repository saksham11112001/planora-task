export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { PendingDocsView } from './PendingDocsView'

export default async function PendingDocsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Fetch CA compliance tasks that are open and have no attachments yet
  const [{ data: tasks }, { data: attachments }, { data: clients }] = await Promise.all([
    admin.from('tasks')
      .select('id, title, status, priority, due_date, client_id, assignee_id')
      .eq('org_id', mb.org_id)
      .contains('custom_fields', { _ca_compliance: true })
      .not('status', 'in', '("completed","cancelled")')
      .neq('is_archived', true)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(2000),
    admin.from('task_attachments')
      .select('task_id')
      .eq('org_id', mb.org_id),
    admin.from('clients')
      .select('id, name, color')
      .eq('org_id', mb.org_id)
      .eq('status', 'active'),
  ])

  const attachedTaskIds = new Set((attachments ?? []).map(a => a.task_id))
  const pendingTasks = (tasks ?? []).filter(t => !attachedTaskIds.has(t.id))

  const clientMap = Object.fromEntries((clients ?? []).map(c => [c.id, c]))

  return <PendingDocsView pendingTasks={pendingTasks} clientMap={clientMap} today={today} />
}
