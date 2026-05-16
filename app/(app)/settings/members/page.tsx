export const dynamic = 'force-dynamic'
import { Suspense }          from 'react'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }          from 'next/navigation'
import { MembersFetcher }    from './MembersFetcher'
import { PageLoader }        from '@/components/ui/PageLoader'
import type { Metadata }     from 'next'
export const metadata: Metadata = { title: 'Team members' }

export default async function MembersPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<PageLoader />}>
      <MembersFetcher />
    </Suspense>
  )
}
