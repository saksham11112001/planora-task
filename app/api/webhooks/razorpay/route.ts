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
      case 'subscription.charged': {
        // Map Razorpay plan_id → our plan tier.
        // SAFETY: unknown plan IDs log a warning and keep existing tier rather
        // than silently upgrading the org to 'business'.
        const planId = payload?.subscription?.entity?.plan_id ?? ''
        if      (planId === process.env.RAZORPAY_STARTER_PLAN_ID)  planTier = 'starter'
        else if (planId === process.env.RAZORPAY_PRO_PLAN_ID)      planTier = 'pro'
        else if (planId === process.env.RAZORPAY_BUSINESS_PLAN_ID) planTier = 'business'
        else {
          // Unknown plan ID — keep current tier, log for investigation
          console.error('[razorpay] Unknown plan_id in webhook:', planId, '— not changing plan tier')
          // Still mark as active + update subscription_id, but don't change plan
          await admin.from('organisations').update({ status: 'active', subscription_id: subId }).eq('id', org.id)
          await admin.from('billing_events').insert({
            org_id: org.id, event_type: event.event, subscription_id: subId,
            payment_id: payload?.payment?.entity?.id ?? null,
            amount_paise: payload?.payment?.entity?.amount ?? null,
            status: 'unknown_plan_id',
            raw_payload: event,
          })
          return NextResponse.json({ received: true, warning: 'unknown_plan_id' })
        }
        status = 'active'; break
      }
      case 'subscription.cancelled':
      case 'subscription.expired':
        planTier = 'free'; status = 'cancelled'; break
      case 'subscription.pending':
        status = 'past_due'; break
    }

    const { error: updateErr } = await admin
      .from('organisations')
      .update({ plan_tier: planTier, status, subscription_id: subId })
      .eq('id', org.id)

    if (updateErr) {
      // Return 500 so Razorpay retries the webhook
      console.error('[razorpay] Failed to update org plan:', updateErr.message)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

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
