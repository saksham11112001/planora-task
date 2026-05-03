import { Suspense }            from 'react'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }            from 'next/navigation'
import { ApprovalsFetcher }    from './ApprovalsFetcher'
import { ApprovalsSkeleton }   from './ApprovalsSkeleton'
import { UpgradeWall }         from '@/components/ui/UpgradeWall'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'
import type { Metadata }       from 'next'

export const dynamic   = 'force-dynamic'
export const metadata: Metadata = { title: 'Approvals | Floatup' }

export default async function ApprovalsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const plan = effectivePlan((mb.organisations as any) ?? { plan_tier: 'free', status: 'active' })
  if (!canUseFeature(plan, 'approvals')) {
    return <UpgradeWall
      feature="Approval Workflows"
      description="Assign approvers to tasks and track sign-offs with a full approval audit trail. Upgrade to unlock."
      requiredPlan="Starter"
      icon="✍️"
    />
  }

  return (
    <Suspense fallback={<ApprovalsSkeleton />}>
      <ApprovalsFetcher />
    </Suspense>
  )
}
