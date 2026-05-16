import { Suspense }          from 'react'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }          from 'next/navigation'
import { CalendarFetcher }   from './CalendarFetcher'
import { CalendarSkeleton }  from './CalendarSkeleton'
import type { Metadata }     from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Calendar' }

export default async function CalendarPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarFetcher />
    </Suspense>
  )
}
