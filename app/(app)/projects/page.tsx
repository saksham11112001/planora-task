import { Suspense }          from 'react'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }          from 'next/navigation'
import { ProjectsFetcher }   from './ProjectsFetcher'
import { ProjectsSkeleton }  from './ProjectsSkeleton'
import type { Metadata }     from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      <ProjectsFetcher />
    </Suspense>
  )
}
