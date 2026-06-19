import { createClient }      from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { dbError }            from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

const PLAN_IDS: Record<string, string> = {
  starter:  process.env.RAZORPAY_STARTER_PLAN_ID  ?? '',
  pro:      process.env.RAZORPAY_PRO_PLAN_ID       ?? '',
  business: process.env.RAZORPAY_BUSINESS_PLAN_ID  ?? '',
}

// Full price in paise for each plan (monthly)
const PLAN_PAISE: Record<string, number> = {
  starter:  99900,
  pro:      249900,
  business: 499900,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role, organisations(name, razorpay_customer_id, plan_tier)')
  if (!mb || !['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { plan_tier, billing_cycle, coupon_code } = await request.json()
  const planId = PLAN_IDS[plan_tier]
  if (!planId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const org       = mb.organisations as any
  const keyId     = process.env.RAZORPAY_KEY_ID    ?? ''
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? ''
  const auth      = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  // ── Validate discount coupon if provided ────────────────────────────────────
  let discountCoupon: {
    id: string; code: string; discount_type: string
    discount_percent?: number | null; discount_inr?: number | null
    uses_count: number; max_uses?: number | null
  } | null = null

  if (coupon_code) {
    const admin = createAdminClient()
    const { data: c } = await admin
      .from('coupons')
      .select('id, code, discount_type, discount_percent, discount_inr, uses_count, max_uses, expires_at, is_active')
      .eq('code', (coupon_code as string).trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle()

    if (!c) return NextResponse.json({ error: 'Invalid or expired coupon code' }, { status: 400 })
    if (c.expires_at && new Date(c.expires_at) < new Date())
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 })
    if (c.max_uses != null && c.uses_count >= c.max_uses)
      return NextResponse.json({ error: 'Coupon has reached its usage limit' }, { status: 400 })

    // Confirm org hasn't already used it
    const { data: existing } = await admin
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', c.id)
      .eq('org_id', mb.org_id)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: 'Your organisation has already used this coupon' }, { status: 400 })

    if (c.discount_type === 'percent' || c.discount_type === 'fixed_inr') {
      discountCoupon = c
    }
  }

  try {
    // ── Create or reuse Razorpay customer ──────────────────────────────────────
    const admin = createAdminClient()
    let customerId = org?.razorpay_customer_id
    if (!customerId) {
      const custRes = await fetch('https://api.razorpay.com/v1/customers', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: org?.name ?? 'Customer', email: user.email, fail_existing: 0 }),
      })
      const cust = await custRes.json()
      // Razorpay returns existing customer (200) or an error object — handle both
      if (!cust.id) {
        console.error('[billing] Razorpay customer creation failed. HTTP status:', custRes.status, 'Response:', JSON.stringify(cust))
        const rzpMsg = cust?.error?.description ?? cust?.error?.code ?? 'unknown'
        const isAuth = custRes.status === 401 || rzpMsg.toLowerCase().includes('auth') || rzpMsg.toLowerCase().includes('key')
        return NextResponse.json({
          error: isAuth
            ? 'Payment gateway authentication failed. Please check Razorpay API keys in environment variables.'
            : 'Payment setup failed. Please try again or contact support.',
        }, { status: 502 })
      }
      customerId = cust.id
      await admin.from('organisations').update({ razorpay_customer_id: customerId }).eq('id', mb.org_id)
    }

    // ── Discounted first-month order ───────────────────────────────────────────
    // When a percent/fixed_inr coupon is applied, charge the discounted amount
    // as a one-time order. Regular subscription billing starts from month 2.
    if (discountCoupon) {
      const basePaise = PLAN_PAISE[plan_tier] ?? 99900
      let discountedPaise = basePaise
      if (discountCoupon.discount_type === 'percent' && discountCoupon.discount_percent) {
        discountedPaise = Math.round(basePaise * (1 - discountCoupon.discount_percent / 100))
      } else if (discountCoupon.discount_type === 'fixed_inr' && discountCoupon.discount_inr) {
        discountedPaise = Math.max(100, basePaise - discountCoupon.discount_inr * 100)
      }

      const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:   discountedPaise,
          currency: 'INR',
          receipt:  `disc_${mb.org_id.slice(0, 8)}_${plan_tier}_${Date.now()}`,
          notes: {
            org_id:      mb.org_id,
            plan_tier,
            coupon_code: discountCoupon.code,
            type:        'discounted_first_month',
          },
        }),
      })
      const order = await orderRes.json()
      if (!order.id) {
        console.error('[billing] Razorpay discounted order creation failed:', JSON.stringify(order))
        return NextResponse.json({ error: 'Payment session could not be created. Please try again.' }, { status: 502 })
      }

      return NextResponse.json({
        type:             'discounted_order',
        order_id:         order.id,
        amount:           discountedPaise,
        original_amount:  basePaise,
        key_id:           keyId,
        plan_tier,
        coupon_code:      discountCoupon.code,
        org_name:         org?.name ?? '',
        email:            user.email ?? '',
      })
    }

    // ── One-time order (subscriptions require Razorpay account activation) ────
    // When subscriptions are enabled on the account, this can be changed back
    // to POST /v1/subscriptions with the plan_id.
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount:   PLAN_PAISE[plan_tier] ?? 99900,
        currency: 'INR',
        receipt:  `plan_${mb.org_id.slice(0, 8)}_${plan_tier}_${Date.now()}`,
        notes: { org_id: mb.org_id, plan_tier, type: 'plan_upgrade' },
      }),
    })
    const orderSub = await orderRes.json()
    if (!orderSub.id) {
      console.error('[billing] Razorpay order creation failed:', JSON.stringify(orderSub))
      return NextResponse.json({ error: 'Payment session could not be created. Please try again.' }, { status: 502 })
    }

    return NextResponse.json({
      type:     'discounted_order',
      order_id: orderSub.id,
      amount:   PLAN_PAISE[plan_tier] ?? 99900,
      key_id:   keyId,
      plan_tier,
      org_name: org?.name ?? '',
      email:    user.email ?? '',
    })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'settings/billing'), { status: 500 })
  }
}
