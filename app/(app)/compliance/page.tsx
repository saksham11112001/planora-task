import { redirect } from 'next/navigation'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { ComplianceShell } from './ComplianceShell'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')
  return <ComplianceShell userRole={mb.role} currentUserId={user.id} />
}
