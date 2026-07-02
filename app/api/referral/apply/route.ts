import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { normaliseCode } from '@/lib/utils/codeGen'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

const MAX_EXTENSION_DAYS  = 42
const EXTENSION_PER_REFERRAL = 7
// Post-signup apply: org must be this many hours old (prevents instant create → redeem)
const MIN_ORG_AGE_HOURS   = 48

export async function POST(request: NextRequest) {
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const { createClient } = await import('@/lib/supabase/server')

    const supabase = await createClient()
    const user = await getAuthUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await request.json()
    const { code: rawCode } = body
    if (!rawCode?.trim()) return NextResponse.json({ error: 'Code required' }, { status: 400 })

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get calling user's org — include created_at for age gate
    const myMembership = await getApiOrgMembership(
      admin, user.id, request,
      'org_id, organisations(id, trial_ends_at, trial_extension_days, status, referral_code, created_at)'
    )

    if (!myMembership) return NextResponse.json({ error: 'No active organisation' }, { status: 400 })
    const myOrg = (myMembership as any).organisations
    if (!myOrg)   return NextResponse.json({ error: 'Organisation not found' }, { status: 400 })

    // ── Guard 1: org must be ≥ 48 h old ───────────────────────────────────────
    // Prevents the "create a throwaway org and instantly redeem" pattern.
    const orgAgeHours = (Date.now() - new Date(myOrg.created_at).getTime()) / 3_600_000
    if (orgAgeHours < MIN_ORG_AGE_HOURS) {
      return NextResponse.json({
        error: `Your organisation must be at least ${MIN_ORG_AGE_HOURS} hours old to apply a referral code`,
      }, { status: 400 })
    }

    // ── Guard 2: each org redeems at most once (DB unique constraint backs this) ──
    const { data: existing } = await admin
      .from('referral_redemptions')
      .select('id')
      .eq('redeemer_org_id', myOrg.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: 'Your organisation has already redeemed a referral code' }, { status: 400 })

    const inputCode = normaliseCode(rawCode)

    // ── Resolve referrer org ───────────────────────────────────────────────────
    const { data: referrerOrg } = await admin
      .from('organisations')
      .select('id, trial_ends_at, trial_extension_days, status')
      .eq('referral_code', inputCode)
      .single()

    // Generic error — never reveal why a code is ineligible to prevent enumeration
    const INELIGIBLE = NextResponse.json({ error: 'Invalid or ineligible referral code' }, { status: 400 })

    if (!referrerOrg || referrerOrg.id === myOrg.id)    return INELIGIBLE
    if (referrerOrg.status !== 'trialing')               return INELIGIBLE
    const alreadyExtended = referrerOrg.trial_extension_days ?? 0
    if (alreadyExtended >= MAX_EXTENSION_DAYS)           return INELIGIBLE

    // ── Fetch ALL members of both orgs (active + past) for overlap checks ─────
    const [{ data: referrerMemberRows }, { data: myMemberRows }] = await Promise.all([
      admin.from('org_members').select('user_id').eq('org_id', referrerOrg.id),
      admin.from('org_members').select('user_id').eq('org_id', myOrg.id),
    ])
    const referrerUserIds = (referrerMemberRows ?? []).map((m: any) => m.user_id as string)
    const myUserIds       = (myMemberRows       ?? []).map((m: any) => m.user_id as string)

    // ── Guard 3: user-ID overlap (same account was ever in both orgs) ──────────
    const referrerIdSet = new Set(referrerUserIds)
    if (myUserIds.some(id => referrerIdSet.has(id))) return INELIGIBLE

    // ── Guard 4: phone-number overlap (same person, different email accounts) ──
    // Fetch phone numbers for all users in BOTH orgs in parallel
    const [{ data: referrerUsers }, { data: myUsers }] = await Promise.all([
      referrerUserIds.length > 0
        ? admin.from('users').select('phone_number').in('id', referrerUserIds).not('phone_number', 'is', null)
        : Promise.resolve({ data: [] as { phone_number: string }[] }),
      myUserIds.length > 0
        ? admin.from('users').select('phone_number').in('id', myUserIds).not('phone_number', 'is', null)
        : Promise.resolve({ data: [] as { phone_number: string }[] }),
    ])

    const referrerPhones = new Set((referrerUsers ?? []).map((u: any) => u.phone_number).filter(Boolean))
    const myPhones       = (myUsers ?? []).map((u: any) => u.phone_number as string).filter(Boolean)

    if (myPhones.some(p => referrerPhones.has(p))) return INELIGIBLE

    // ── Guard 5: circular ring (A refers B AND B refers A) ────────────────────
    const { data: circularCheck } = await admin
      .from('referral_redemptions')
      .select('id')
      .eq('referrer_org_id', myOrg.id)
      .eq('redeemer_org_id', referrerOrg.id)
      .maybeSingle()
    if (circularCheck) return INELIGIBLE

    // ── Guard 6: network ring — a phone from THIS redeemer org has already appeared
    //    in another org that redeemed from the SAME referrer ────────────────────
    // Example blocked: Alice in org A, Alice creates org B that already redeemed
    // referrer's code, and now tries via org C as well.
    if (myPhones.length > 0) {
      const { data: prevRedeemers } = await admin
        .from('referral_redemptions')
        .select('redeemer_org_id')
        .eq('referrer_org_id', referrerOrg.id)

      if (prevRedeemers && prevRedeemers.length > 0) {
        const prevOrgIds = prevRedeemers.map((r: any) => r.redeemer_org_id as string)
        const { data: prevMemberRows } = await admin
          .from('org_members')
          .select('user_id')
          .in('org_id', prevOrgIds)

        const prevUserIds = (prevMemberRows ?? []).map((m: any) => m.user_id as string)
        if (prevUserIds.length > 0) {
          const { data: prevPhoneRows } = await admin
            .from('users')
            .select('phone_number')
            .in('id', prevUserIds)
            .not('phone_number', 'is', null)

          const prevPhoneSet = new Set((prevPhoneRows ?? []).map((u: any) => u.phone_number).filter(Boolean))
          if (myPhones.some(p => prevPhoneSet.has(p))) return INELIGIBLE
        }
      }
    }

    // ── Guard 7: calling user must have a phone (phone required to participate) ─
    const { data: callerProfile } = await admin
      .from('users')
      .select('phone_number')
      .eq('id', user.id)
      .maybeSingle()
    if (!callerProfile?.phone_number) {
      return NextResponse.json({ error: 'Please add a phone number to your profile before applying a referral code' }, { status: 400 })
    }

    // ── All guards passed — apply extension ───────────────────────────────────
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
        referrer_org_id:      referrerOrg.id,
        redeemer_org_id:      myOrg.id,
        extension_days:       extensionDays,
        redeemer_owner_phone: callerProfile.phone_number,
      }),
    ])

    return NextResponse.json({ success: true, extension_days: extensionDays })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'referral/apply'), { status: 500 })
  }
}
