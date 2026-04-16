import { createClient }     from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect }          from 'next/navigation'
import { Suspense }          from 'react'
import { ComplianceShell }   from './ComplianceShell'
import { UpgradeWall }       from '@/components/ui/UpgradeWall'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  // Gate: CA Compliance requires Pro plan or above
  const admin = createAdminClient()
  const { data: orgData } = await admin.from('organisations')
    .select('plan_tier, status, trial_ends_at').eq('id', mb.org_id).single()
  const plan = effectivePlan(orgData ?? { plan_tier: 'free', status: 'active' })
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
