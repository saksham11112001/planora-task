import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code param required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: coupon } = await admin
    .from('coupons')
    .select('id, code, discount_type, discount_percent, plan_tier, max_uses, uses_count, expires_at, is_active, one_time_use, msme_only')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (!coupon) return NextResponse.json({ error: 'Invalid or expired coupon code' }, { status: 404 })

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This coupon has expired' }, { status: 410 })
  }

  // Check max uses
  if (coupon.max_uses != null && (coupon.uses_count ?? 0) >= coupon.max_uses) {
    return NextResponse.json({ error: 'This coupon has reached its usage limit' }, { status: 410 })
  }

  // Check one-time use per org
  if (coupon.one_time_use) {
    const { data: existing } = await admin
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('org_id', mb.org_id)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: 'Your organisation has already used this coupon' }, { status: 409 })
  }

  // Only percent coupons are supported in the MSME payment flow
  if (coupon.discount_type !== 'percent' || !coupon.discount_percent) {
    return NextResponse.json({ error: 'This coupon is not valid for MSME packs' }, { status: 422 })
  }

  return NextResponse.json({
    code:             coupon.code,
    discount_percent: coupon.discount_percent,
    plan_tier:        coupon.plan_tier ?? null,
    valid:            true,
  })
}
