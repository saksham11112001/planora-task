// Razorpay webhook — fires when an MSME pack order is paid.
// Verifies the Razorpay signature, then activates the org's pack.
//
// Razorpay sends POST with header:
//   x-razorpay-signature — hex( HMAC-SHA256( rawBody, RAZORPAY_WEBHOOK_SECRET ) )
//
// Register this URL in your Razorpay dashboard:
//   Account & Settings → Webhooks → Add New Webhook
//   URL: https://msme.upfloat.co/api/msme/pay/webhook   (or your primary domain)
//   Events: order.paid

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { getPackByTier }             from '@/lib/msme/packs'
import crypto                        from 'crypto'

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  const rawBody  = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  if (!WEBHOOK_SECRET) {
    console.error('[msme/webhook] RAZORPAY_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  // Verify signature
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  if (expected !== signature) {
    console.warn('[msme/webhook] Signature mismatch — possible spoofed request')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: Record<string, any>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle order.paid
  if (event.event !== 'order.paid') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const order      = event.payload?.order?.entity   as Record<string, any> | undefined
  const payment    = event.payload?.payment?.entity as Record<string, any> | undefined
  const orderId    = order?.id    as string | undefined
  const paymentId  = payment?.id  as string | undefined
  const notes      = order?.notes as Record<string, string> | undefined
  const pack_tier  = notes?.pack_tier
  const orgId      = notes?.org_id

  if (!orderId || !orgId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const admin  = createAdminClient()
  const paidAt = new Date().toISOString()
  const orderType   = notes?.order_type
  const addonSlots  = notes?.addon_slots ? parseInt(notes.addon_slots, 10) : NaN

  // ── Add-on order webhook ───────────────────────────────────────────────────
  if (orderType === 'addon' && !isNaN(addonSlots) && addonSlots > 0) {
    const { data: existing } = await admin
      .from('org_feature_settings').select('config')
      .eq('org_id', orgId).eq('feature_key', 'msme_addon_slots').maybeSingle()
    const currentExtra: number = (existing?.config as any)?.extra_slots ?? 0
    await admin.from('org_feature_settings').upsert(
      { org_id: orgId, feature_key: 'msme_addon_slots', is_enabled: true, config: { extra_slots: currentExtra + addonSlots } },
      { onConflict: 'org_id,feature_key' }
    )
    console.log('[msme/webhook] Addon slots activated', { orgId, addonSlots, total: currentExtra + addonSlots })
    return NextResponse.json({ ok: true })
  }

  // ── Pack upgrade webhook ───────────────────────────────────────────────────
  if (!pack_tier) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const pack = getPackByTier(pack_tier)

  // Activate the pack (idempotent — safe to run even if client already verified)
  await admin.from('org_feature_settings').upsert(
    {
      org_id:      orgId,
      feature_key: 'msme_pack',
      is_enabled:  true,
      config:      { tier: pack_tier, vendor_limit: pack.vendor_limit, paid_at: paidAt },
    },
    { onConflict: 'org_id,feature_key' }
  )

  // Mark payment row as paid
  await admin.from('msme_pack_payments').upsert(
    {
      org_id:             orgId,
      pack_tier,
      vendor_limit:       pack.vendor_limit,
      amount_paise:       pack.price_paise,
      gateway:            'razorpay',
      gateway_order_id:   orderId,
      gateway_payment_id: paymentId ?? '',
      status:             'paid',
      paid_at:            paidAt,
    },
    { onConflict: 'gateway_order_id' }
  )

  console.log('[msme/webhook] Pack activated via webhook', { orgId, pack_tier, vendor_limit: pack.vendor_limit })
  return NextResponse.json({ ok: true })
}
