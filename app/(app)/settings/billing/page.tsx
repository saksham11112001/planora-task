export const dynamic = 'force-dynamic'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }     from 'next/navigation'
import { BillingView }  from './BillingView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Billing' }

export const revalidate = 20

export default async function BillingPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb || !['owner','admin'].includes(mb.role)) redirect('/settings')
  // org data (including subscription_id) comes from the cached membership join
  const org = mb.organisations as any
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Billing & Plan</h1>
      <BillingView orgName={org?.name} currentPlan={org?.plan_tier ?? 'free'} status={org?.status ?? 'active'} subscriptionId={org?.subscription_id ?? null} trialEndsAt={org?.trial_ends_at ?? null} setupFeePaid={org?.setup_fee_paid ?? false}/>
    </div>
  )
}
