import { Suspense }          from 'react'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'
import { redirect }          from 'next/navigation'
import { ReportsFetcher }    from './ReportsFetcher'
import { ReportsSkeleton }   from './ReportsSkeleton'
import { UpgradeWall }       from '@/components/ui/UpgradeWall'
import type { Metadata }     from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const orgData = mb.organisations as any
  const plan = effectivePlan(orgData ?? { plan_tier: 'free', status: 'active' })
  if (!canUseFeature(plan, 'reports')) {
    return <UpgradeWall
      feature="Reports"
      description="Get detailed insights on task completion, team performance, time logs, overdue work, and billing summaries — all in one place."
      requiredPlan="Starter"
      icon="📊"
    />
  }

  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsFetcher />
    </Suspense>
  )
}
