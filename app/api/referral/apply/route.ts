import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { normaliseCode } from '@/lib/utils/codeGen'

const MAX_EXTENSION_DAYS = 42
const EXTENSION_PER_REFERRAL = 7

export async function POST(request: NextRequest) {
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const { createClient } = await import('@/lib/supabase/server')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await request.json()
    const { code: rawCode } = body
    if (!rawCode?.trim()) return NextResponse.json({ error: 'Code required' }, { status: 400 })

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get calling user's org
    const { data: myMembership } = await admin
      .from('org_members')
      .select('org_id, organisations(id, trial_ends_at, trial_extension_days, status, referral_code)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!myMembership) return NextResponse.json({ error: 'No active organisation' }, { status: 400 })

    const myOrg = (myMembership as any).organisations
    if (!myOrg) return NextResponse.json({ error: 'Organisation not found' }, { status: 400 })

    // Check if already redeemed
    const { data: existing } = await admin
      .from('referral_redemptions')
      .select('id')
      .eq('redeemer_org_id', myOrg.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: 'Your organisation has already redeemed a referral code' }, { status: 400 })

    const inputCode = normaliseCode(rawCode)

    // Find referrer org — use generic error to prevent enumeration
    const { data: referrerOrg } = await admin
      .from('organisations')
      .select('id, trial_ends_at, trial_extension_days, status')
      .eq('referral_code', inputCode)
      .single()

    // Generic error regardless of reason (code not found / same org / not trialing / capped)
    if (!referrerOrg || referrerOrg.id === myOrg.id) {
      return NextResponse.json({ error: 'Invalid or ineligible referral code' }, { status: 400 })
    }

    if (referrerOrg.status !== 'trialing') {
      return NextResponse.json({ error: 'Invalid or ineligible referral code' }, { status: 400 })
    }

    const alreadyExtended = referrerOrg.trial_extension_days ?? 0
    if (alreadyExtended >= MAX_EXTENSION_DAYS) {
      return NextResponse.json({ error: 'Invalid or ineligible referral code' }, { status: 400 })
    }

    // Check the referrer org has no member overlap with the redeemer org
    const { data: referrerMembers } = await admin
      .from('org_members')
      .select('user_id')
      .eq('org_id', referrerOrg.id)
      .eq('is_active', true)

    const { data: myMembers } = await admin
      .from('org_members')
      .select('user_id')
      .eq('org_id', myOrg.id)
      .eq('is_active', true)

    const referrerIds = new Set((referrerMembers ?? []).map((m: any) => m.user_id))
    const overlap = (myMembers ?? []).some((m: any) => referrerIds.has(m.user_id))
    if (overlap) {
      return NextResponse.json({ error: 'Invalid or ineligible referral code' }, { status: 400 })
    }

    const extensionDays = Math.min(EXTENSION_PER_REFERRAL, MAX_EXTENSION_DAYS - alreadyExtended)
    const newTrialEnds  = new Date(
      Math.max(new Date(referrerOrg.trial_ends_at).getTime(), Date.now()) +
      extensionDays * 24 * 60 * 60 * 1000
    ).toISOString()

    await Promise.all([
      admin.from('organisations').update({
        trial_ends_at:        newTrialEnds,
        trial_extension_days: alreadyExtended + extensionDays,
      }).eq('id', referrerOrg.id),
      admin.from('referral_redemptions').insert({
        referrer_org_id: referrerOrg.id,
        redeemer_org_id: myOrg.id,
        extension_days:  extensionDays,
      }),
    ])

    return NextResponse.json({ success: true, extension_days: extensionDays })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'referral/apply'), { status: 500 })
  }
}
