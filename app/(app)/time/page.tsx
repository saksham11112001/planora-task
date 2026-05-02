import { Suspense }        from 'react'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'
import { redirect }        from 'next/navigation'
import { TimeFetcher }     from './TimeFetcher'
import { TimeSkeleton }    from './TimeSkeleton'
import { UpgradeWall }     from '@/components/ui/UpgradeWall'
import type { Metadata }   from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Time tracking' }

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp   = await searchParams
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const plan = effectivePlan((mb.organisations as any) ?? { plan_tier: 'free', status: 'active' })
  if (!canUseFeature(plan, 'time_tracking')) {
    return <UpgradeWall
      feature="Time Tracking"
      description="Log billable and non-billable hours against tasks and projects. Track team productivity and generate time reports for client billing."
      requiredPlan="Starter"
      icon="⏱️"
    />
  }

  const now      = new Date()
  const fromDate = sp.from ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const toDate   = sp.to   ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

  return (
    <Suspense fallback={<TimeSkeleton />}>
      <TimeFetcher fromDate={fromDate} toDate={toDate} />
    </Suspense>
  )
}
