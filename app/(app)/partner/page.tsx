export const dynamic = 'force-dynamic'
import { getSessionUser }         from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }               from 'next/navigation'
import { PartnerView }            from './PartnerView'

export default async function PartnerPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  // Only org owners and admins access the partner portal
  if (!['owner', 'admin'].includes(mb.role)) redirect('/dashboard')

  return <PartnerView />
}
