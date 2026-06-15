// Partner portal — returns referral stats, tier, referred orgs list, and earnings summary.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { generateCode }             from '@/lib/utils/codeGen'

const COMMISSION_RATES: Record<string, number> = {
  bronze: 10,
  silver: 15,
  gold:   20,
}

function partnerTier(activeReferrals: number): 'bronze' | 'silver' | 'gold' {
  if (activeReferrals >= 10) return 'gold'
  if (activeReferrals >= 5)  return 'silver'
  return 'bronze'
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role, organisations(id, name, referral_code)')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only the org owner or admin can access the Partner Portal' }, { status: 403 })
  }

  const admin = createAdminClient()
  const org   = (mb.organisations as any)
  const orgId = mb.org_id
  let refCode = org.referral_code as string | null

  // Auto-generate a referral code if the org doesn't have one yet
  if (!refCode) {
    refCode = generateCode(8)
    await admin.from('organisations').update({ referral_code: refCode }).eq('id', orgId)
  }

  // Fetch all redemptions where this org is the referrer
  const { data: redemptions } = await admin
    .from('referral_redemptions')
    .select('redeemer_org_id, created_at, organisations!referral_redemptions_redeemer_org_id_fkey(id, name, plan_tier, status, created_at)')
    .eq('referrer_org_id', orgId)
    .order('created_at', { ascending: false })

  const referred = (redemptions ?? []).map((r: any) => {
    const refOrg = r.organisations
    return {
      org_id:    refOrg?.id ?? r.redeemer_org_id,
      name:      refOrg?.name ?? 'Unknown',
      plan_tier: refOrg?.plan_tier ?? 'free',
      status:    refOrg?.status ?? 'active',
      joined_at: r.created_at,
      is_paying: refOrg?.plan_tier && refOrg.plan_tier !== 'free',
    }
  })

  const activeCount = referred.filter(r => r.status === 'active' || r.status === 'trialing').length
  const payingCount = referred.filter(r => r.is_paying).length
  const tier        = partnerTier(activeCount)
  const ratePercent = COMMISSION_RATES[tier]

  // Fetch commissions for this partner
  const { data: commissions } = await admin
    .from('partner_commissions')
    .select('id, referred_org_id, event, plan_tier, commission_paise, status, created_at')
    .eq('partner_org_id', orgId)
    .order('created_at', { ascending: false })

  const totalEarned  = (commissions ?? []).filter(c => c.status === 'paid').reduce((s, c) => s + c.commission_paise, 0)
  const pendingPaise = (commissions ?? []).filter(c => c.status !== 'paid').reduce((s, c) => s + c.commission_paise, 0)
  const thisMonth    = (() => {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
    return (commissions ?? [])
      .filter(c => new Date(c.created_at) >= start)
      .reduce((s, c) => s + c.commission_paise, 0)
  })()

  // Pending payout requests
  const { data: payouts } = await admin
    .from('partner_payouts')
    .select('id, amount_paise, status, created_at, processed_at')
    .eq('partner_org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(10)

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://floatup.app'

  return NextResponse.json({
    referral_code: refCode,
    referral_link: `${APP_URL}/login?ref=${refCode}`,
    tier,
    rate_percent: ratePercent,
    next_tier: tier === 'gold' ? null : tier === 'silver' ? { name: 'gold', at: 10, current: activeCount } : { name: 'silver', at: 5, current: activeCount },
    stats: {
      total_referred: referred.length,
      active_referred: activeCount,
      paying_referred: payingCount,
      total_earned_paise: totalEarned,
      pending_paise: pendingPaise,
      this_month_paise: thisMonth,
    },
    referred,
    commissions: (commissions ?? []).slice(0, 20),
    payouts: payouts ?? [],
  })
}
