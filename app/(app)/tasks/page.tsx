import { Suspense }        from 'react'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }        from 'next/navigation'
import { TasksFetcher }    from './TasksFetcher'
import { TasksSkeleton }   from './TasksSkeleton'
import type { Metadata }   from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My tasks' }

export default async function MyTasksPage() {
  // Both calls hit the request-level cache populated by the layout — no DB round trips.
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<TasksSkeleton />}>
      <TasksFetcher />
    </Suspense>
  )
}
