import { redirect }               from 'next/navigation'
import { getSessionUser }         from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import MissedTasksView            from './MissedTasksView'
import type { Metadata }          from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Missed tasks' }

export default async function MissedTasksPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  // Mirrors the API's own check, so the page cannot render a shell that then
  // fails its first fetch.
  if (!['owner', 'admin', 'manager'].includes(mb.role)) redirect('/compliance')

  return <MissedTasksView canSpawn={['owner', 'admin'].includes(mb.role)} />
}
