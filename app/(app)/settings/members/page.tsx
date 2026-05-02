export const dynamic = 'force-dynamic'
import { Suspense }          from 'react'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }          from 'next/navigation'
import { MembersFetcher }    from './MembersFetcher'
import { PageLoader }        from '@/components/ui/PageLoader'
import type { Metadata }     from 'next'
export const metadata: Metadata = { title: 'Team members' }

export default async function MembersPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<PageLoader />}>
      <MembersFetcher />
    </Suspense>
  )
}
