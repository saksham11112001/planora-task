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

  // Only org owners access the partner portal
  if (mb.role !== 'owner') redirect('/dashboard')

  return <PartnerView />
}
