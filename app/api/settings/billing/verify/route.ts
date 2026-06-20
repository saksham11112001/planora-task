// POST /api/settings/billing/verify
// Called after a discounted first-month Razorpay order is paid.
// Verifies signature → activates plan → records coupon redemption.

import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { createHmac }         from 'crypto'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { sendInvoiceEmail }   from '@/lib/email/send'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb || !['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    razorpay_subscription_id,
    plan_tier, coupon_code, billing_cycle,
    amount_paise,
  } = await req.json()

  if (!razorpay_payment_id || !razorpay_signature || !plan_tier)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const isSubscription = !!razorpay_subscription_id

  if (!isSubscription && !razorpay_order_id)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  // Verify Razorpay HMAC signature
  // Subscription: HMAC(payment_id|subscription_id)  Order: HMAC(order_id|payment_id)
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? ''
  const sigPayload = isSubscription
    ? `${razorpay_payment_id}|${razorpay_subscription_id}`
    : `${razorpay_order_id}|${razorpay_payment_id}`
  const expected  = createHmac('sha256', keySecret)
    .update(sigPayload)
    .digest('hex')
  if (expected !== razorpay_signature)
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })

  const admin = createAdminClient()

  // Idempotency: if this payment_id was already processed, return success without re-activating
  const { data: existing } = await admin
    .from('billing_events')
    .select('id')
    .eq('payment_id', razorpay_payment_id)
    .maybeSingle()
  if (existing) return NextResponse.json({ success: true, plan_tier })

  // Access duration: subscriptions are perpetual (managed via webhook); one-time orders get 365 or 30 days
  const orgUpdate: Record<string, any> = { plan_tier, status: 'active' }
  if (isSubscription) {
    orgUpdate.subscription_id = razorpay_subscription_id
    // trial_ends_at is intentionally not set for subscriptions — webhook handles renewal
  } else {
    const daysAccess = billing_cycle === 'annual' ? 365 : 30
    orgUpdate.trial_ends_at = new Date(Date.now() + daysAccess * 24 * 60 * 60 * 1000).toISOString()
  }
  await admin.from('organisations').update(orgUpdate).eq('id', mb.org_id)

  // Log billing event
  await admin.from('billing_events').insert({
    org_id:      mb.org_id,
    event_type:  isSubscription ? 'subscription.first_payment' : 'discounted_order.paid',
    payment_id:  razorpay_payment_id,
    status:      'paid',
    raw_payload: isSubscription
      ? { subscription_id: razorpay_subscription_id, plan_tier }
      : { order_id: razorpay_order_id, plan_tier, coupon_code },
  })

  // Record coupon redemption if a discount coupon was used
  if (coupon_code) {
    const { data: coupon } = await admin
      .from('coupons')
      .select('id, uses_count, max_uses')
      .eq('code', (coupon_code as string).toUpperCase())
      .maybeSingle()

    if (coupon) {
      // Atomic increment: optimistic lock prevents race condition if two payments
      // somehow complete simultaneously for the same coupon.
      await admin.from('coupons')
        .update({ uses_count: (coupon.uses_count ?? 0) + 1 })
        .eq('id', coupon.id)
        .eq('uses_count', coupon.uses_count)

      // DB unique constraint on (coupon_id, org_id) handles duplicate prevention
      await admin.from('coupon_redemptions').insert({
        coupon_id: coupon.id,
        org_id:    mb.org_id,
      }).select().maybeSingle() // ignore duplicate errors gracefully
    }
  }

  // Send tax invoice email (best-effort — never block payment success)
  try {
    const [{ data: gstRow }, { data: orgRow }] = await Promise.all([
      admin.from('org_feature_settings').select('config')
        .eq('org_id', mb.org_id).eq('feature_key', 'billing_gst').maybeSingle(),
      admin.from('organisations').select('name').eq('id', mb.org_id).maybeSingle(),
    ])
    const gstDetails = gstRow?.config as any ?? null
    const orgName    = orgRow?.name ?? ''
    const planLabel  = `upFloat ${(plan_tier as string).charAt(0).toUpperCase() + (plan_tier as string).slice(1)} Plan`
    const cycle      = isSubscription ? 'Monthly (autopay)' : billing_cycle === 'annual' ? 'Annual' : 'Monthly'
    const invoiceNum = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`

    await sendInvoiceEmail({
      invoiceNumber:   invoiceNum,
      invoiceDate:     new Date().toISOString().slice(0, 10),
      customerEmail:   user.email!,
      orgName,
      gstDetails,
      itemDescription: `${planLabel} — ${cycle}`,
      amountPaise:     amount_paise ?? 0,
      paymentId:       razorpay_payment_id,
    })
  } catch { /* invoice failure must never block the payment success response */ }

  return NextResponse.json({ success: true, plan_tier })
}
