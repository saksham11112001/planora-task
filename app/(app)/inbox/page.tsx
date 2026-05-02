import { Suspense }       from 'react'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }       from 'next/navigation'
import { InboxFetcher }   from './InboxFetcher'
import { InboxSkeleton }  from './InboxSkeleton'
import type { Metadata }  from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Quick tasks' }

export default async function InboxPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxFetcher />
    </Suspense>
  )
}
