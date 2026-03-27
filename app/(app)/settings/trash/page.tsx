export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { TrashView }    from './TrashView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Trash & Recovery' }

export default async function TrashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role, organisations(plan_tier, status, trial_ends_at)')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  const org       = mb.organisations as any
  const planTier  = org?.plan_tier ?? 'free'
  const orgStatus = org?.status ?? 'active'
  const trialEnds = org?.trial_ends_at

  // Paid = starter / pro / business and not expired
  const trialActive  = orgStatus === 'trialing' && trialEnds && new Date(trialEnds) > new Date()
  const isPaid       = trialActive || ['starter','pro','business'].includes(planTier)
  const canManage    = ['owner','admin','manager'].includes(mb.role)

  return (
    <div className="page-container" style={{ maxWidth: 700 }}>
      <TrashView canManage={canManage} isPaid={isPaid} planTier={planTier}/>
    </div>
  )
}
