import { createClient }     from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }          from 'next/navigation'
import { Suspense }          from 'react'
import { ComplianceShell }   from './ComplianceShell'
import { UpgradeWall }       from '@/components/ui/UpgradeWall'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  // Use cached fetchers — layout already called these, so no extra DB round trips.
  // getOrgMembership joins organisations, eliminating the separate admin org query.
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()

  // Gate: CA Compliance requires Pro plan or above — org data comes from the cached membership join
  const plan = effectivePlan((mb.organisations as any) ?? { plan_tier: 'free', status: 'active' })
  if (!canUseFeature(plan, 'ca_compliance')) {
    return <UpgradeWall
      feature="CA Compliance Workflows"
      description="69 pre-built compliance task templates for GSTR, TDS, ITR, ROC and more — with automatic document subtasks and audit-ready checklists."
      requiredPlan="Pro"
      icon="🏛️"
    />
  }

  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
        <div style={{ width:24, height:24, border:'2px solid var(--brand)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ComplianceShell userRole={mb.role} currentUserId={user.id} />
    </Suspense>
  )
}
