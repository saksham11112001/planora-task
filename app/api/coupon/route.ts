import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { code } = await request.json() as { code?: string }
  if (!code?.trim()) return NextResponse.json({ error: 'Enter a coupon code' }, { status: 400 })

  const admin      = createAdminClient()
  const upperCode  = code.trim().toUpperCase()

  // Look up coupon from DB
  const { data: coupon } = await admin
    .from('coupons')
    .select('*')
    .eq('code', upperCode)
    .eq('is_active', true)
    .maybeSingle()

  if (!coupon) return NextResponse.json({ error: 'Invalid or expired coupon code' }, { status: 400 })

  // Check usage limit
  if (coupon.max_uses && coupon.uses_count >= coupon.max_uses)
    return NextResponse.json({ error: 'This coupon has reached its usage limit' }, { status: 400 })

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
    return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 })

  // Check if this org already redeemed this coupon
  const { data: existing } = await admin
    .from('coupon_redemptions')
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('org_id', mb.org_id)
    .maybeSingle()

  if (existing)
    return NextResponse.json({ error: 'Your organisation has already used this coupon' }, { status: 400 })

  // Handle free_plan type — grant free plan access
  if (coupon.discount_type === 'free_plan') {
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + (coupon.duration_months ?? 1))

    await admin.from('organisations').update({
      plan_tier:     coupon.plan_tier,
      status:        'active',
      trial_ends_at: expiresAt.toISOString(),
    }).eq('id', mb.org_id)

    await admin.from('coupons')
      .update({ uses_count: (coupon.uses_count ?? 0) + 1 })
      .eq('id', coupon.id)

    await admin.from('coupon_redemptions').insert({
      coupon_id: coupon.id,
      org_id:    mb.org_id,
    })

    return NextResponse.json({
      success:     true,
      type:        'free_plan',
      plan:        coupon.plan_tier,
      months:      coupon.duration_months,
      description: coupon.description,
      expires_at:  expiresAt.toISOString(),
    })
  }

  // Handle percent / fixed_inr type — return discount info for Razorpay (future use)
  if (coupon.discount_type === 'percent' || coupon.discount_type === 'fixed_inr') {
    // Record redemption intent (increment uses_count, record redemption)
    await admin.from('coupons')
      .update({ uses_count: (coupon.uses_count ?? 0) + 1 })
      .eq('id', coupon.id)

    await admin.from('coupon_redemptions').insert({
      coupon_id: coupon.id,
      org_id:    mb.org_id,
    })

    return NextResponse.json({
      success:          true,
      type:             coupon.discount_type,
      discount_percent: coupon.discount_percent,
      description:      coupon.description,
      message:          coupon.discount_type === 'percent'
        ? `${coupon.discount_percent}% discount will be applied at checkout`
        : `₹${coupon.discount_inr} discount will be applied at checkout`,
    })
  }

  return NextResponse.json({ error: 'Unknown coupon type' }, { status: 400 })
}
