import { createAdminClient }                from '@/lib/supabase/admin'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }                         from 'next/navigation'
import { ActivityView }                     from './ActivityView'
import type { Metadata }                    from 'next'

export const dynamic  = 'force-dynamic'
export const metadata: Metadata = { title: 'Activity log' }

export default async function ActivityPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  if (!['owner', 'admin'].includes(mb.role)) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: logs } = await admin.from('activity_log')
    .select('*')
    .eq('org_id', mb.org_id)
    .order('created_at', { ascending: false })
    .limit(200)

  return <ActivityView logs={logs ?? []} />
}
