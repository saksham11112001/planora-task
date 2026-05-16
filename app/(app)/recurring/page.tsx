import { Suspense }           from 'react'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }           from 'next/navigation'
import { RecurringFetcher }   from './RecurringFetcher'
import { RecurringSkeleton }  from './RecurringSkeleton'
import type { Metadata }      from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Repeat tasks' }

export default async function RecurringPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<RecurringSkeleton />}>
      <RecurringFetcher />
    </Suspense>
  )
}
