// POST /api/settings/billing/verify
// Called after a discounted first-month Razorpay order is paid.
// Verifies signature → activates plan → records coupon redemption.

import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { createHmac }         from 'crypto'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb || !['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_tier, coupon_code } = await req.json()

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan_tier)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  // Verify Razorpay HMAC signature
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? ''
  const expected  = createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')
  if (expected !== razorpay_signature)
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })

  const admin  = createAdminClient()
  const paidAt = new Date().toISOString()

  // Activate the plan (first month paid — set trial_ends_at to 30 days from now
  // so the user has access; subscription billing picks up after that)
  const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await admin.from('organisations').update({
    plan_tier,
    status:        'active',
    trial_ends_at: trialEnd,
  }).eq('id', mb.org_id)

  // Log billing event
  await admin.from('billing_events').insert({
    org_id:      mb.org_id,
    event_type:  'discounted_order.paid',
    payment_id:  razorpay_payment_id,
    status:      'paid',
    raw_payload: { order_id: razorpay_order_id, plan_tier, coupon_code },
  })

  // Record coupon redemption if a discount coupon was used
  if (coupon_code) {
    const { data: coupon } = await admin
      .from('coupons')
      .select('id, uses_count')
      .eq('code', (coupon_code as string).toUpperCase())
      .maybeSingle()

    if (coupon) {
      await admin.from('coupons')
        .update({ uses_count: (coupon.uses_count ?? 0) + 1 })
        .eq('id', coupon.id)

      await admin.from('coupon_redemptions').insert({
        coupon_id: coupon.id,
        org_id:    mb.org_id,
      }).select().maybeSingle() // ignore duplicate errors gracefully
    }
  }

  return NextResponse.json({ success: true, plan_tier })
}
