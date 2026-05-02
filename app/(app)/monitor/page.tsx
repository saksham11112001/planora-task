import { Suspense }          from 'react'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }          from 'next/navigation'
import { MonitorFetcher }    from './MonitorFetcher'
import { MonitorSkeleton }   from './MonitorSkeleton'
import type { Metadata }     from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Monitor' }

export default async function MonitorPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<MonitorSkeleton />}>
      <MonitorFetcher />
    </Suspense>
  )
}
