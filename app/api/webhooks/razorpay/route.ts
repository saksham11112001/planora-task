import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import crypto                 from 'crypto'

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''
  const body   = await request.text()
  const sig    = request.headers.get('x-razorpay-signature') ?? ''

  // Verify signature
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  if (expected !== sig) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  const event   = JSON.parse(body)
  const payload = event.payload
  const admin   = createAdminClient()

  const subId   = payload?.subscription?.entity?.id
  const custId  = payload?.subscription?.entity?.customer_id

  // Find org by customer ID
  const { data: org } = await admin.from('organisations')
    .select('id').eq('razorpay_customer_id', custId).maybeSingle()

  if (org) {
    let planTier = 'free'
    let status   = 'active'

    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged':
        // Determine plan from amount or plan_id mapping
        const planId = payload?.subscription?.entity?.plan_id ?? ''
        if (planId === process.env.RAZORPAY_STARTER_PLAN_ID)  planTier = 'starter'
        else if (planId === process.env.RAZORPAY_PRO_PLAN_ID) planTier = 'pro'
        else                                                   planTier = 'business'
        status = 'active'; break
      case 'subscription.cancelled':
      case 'subscription.expired':
        planTier = 'free'; status = 'cancelled'; break
      case 'subscription.pending':
        status = 'past_due'; break
    }

    await admin.from('organisations').update({ plan_tier: planTier, status, subscription_id: subId }).eq('id', org.id)

    // Log billing event
    await admin.from('billing_events').insert({
      org_id:         org.id,
      event_type:     event.event,
      subscription_id:subId,
      payment_id:     payload?.payment?.entity?.id ?? null,
      amount_paise:   payload?.payment?.entity?.amount ?? null,
      status:         payload?.subscription?.entity?.status ?? null,
      raw_payload:    event,
    })
  }

  return NextResponse.json({ received: true })
}
