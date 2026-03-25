import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { BillingView }  from './BillingView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Billing' }

export const revalidate = 20

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role, organisations(name, plan_tier, status, subscription_id)').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin'].includes(mb.role)) redirect('/settings')
  const org = mb.organisations as any
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Billing & Plan</h1>
      <BillingView orgName={org?.name} currentPlan={org?.plan_tier ?? 'free'} status={org?.status ?? 'active'} subscriptionId={org?.subscription_id ?? null}/>
    </div>
  )
}
