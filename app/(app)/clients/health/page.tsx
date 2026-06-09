export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { ClientHealthShell } from './ClientHealthShell'

export default async function ClientHealthPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const canManage = ['owner', 'admin', 'manager'].includes(mb.role)

  return <ClientHealthShell canManage={canManage} />
}
