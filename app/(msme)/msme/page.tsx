export const dynamic = 'force-dynamic'
import { getSessionUser }         from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }                from 'next/navigation'
import { MsmeView }                from '@/app/(app)/msme/MsmeView'

export default async function MsmePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?redirect=/msme')

  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    redirect('/dashboard')
  }

  return <MsmeView userRole={mb.role} />
}
