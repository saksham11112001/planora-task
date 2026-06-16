// Cashfree webhook — fires when a MSME pack payment link is paid.
// Verifies the Cashfree signature, then activates the org's pack.
//
// Cashfree sends POST with headers:
//   x-webhook-timestamp   — Unix timestamp (seconds) as a string
//   x-webhook-signature   — base64( HMAC-SHA256( timestamp + "\n" + rawBody, CF_SECRET_KEY ) )
//
// Register this URL in your Cashfree dashboard under:
//   Developers → Webhooks → Add endpoint: https://<your-domain>/api/msme/pay/webhook
//   Events: PAYMENT_LINK_EVENT

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { getPackByTier }             from '@/lib/msme/packs'
import crypto                        from 'crypto'

const CF_SECRET_KEY = process.env.CASHFREE_SECRET_KEY

export async function POST(req: NextRequest) {
  const timestamp = req.headers.get('x-webhook-timestamp') ?? ''
  const signature = req.headers.get('x-webhook-signature') ?? ''
  const rawBody   = await req.text()

  // ── Verify signature ──────────────────────────────────────────────────────
  if (!CF_SECRET_KEY) {
    console.error('[msme/webhook] CASHFREE_SECRET_KEY not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const expected = crypto
    .createHmac('sha256', CF_SECRET_KEY)
    .update(timestamp + rawBody)
    .digest('base64')

  if (expected !== signature) {
    console.warn('[msme/webhook] Signature mismatch — possible spoofed request')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type    = body.type as string | undefined
  const data    = body.data as Record<string, unknown> | undefined
  const link    = data?.link    as Record<string, unknown> | undefined
  const payment = data?.payment as Record<string, unknown> | undefined

  // Only handle successful payment link events
  if (type !== 'PAYMENT_LINK_EVENT') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const linkStatus    = link?.link_status    as string | undefined
  const paymentStatus = payment?.payment_status as string | undefined
  const linkId        = link?.link_id        as string | undefined
  const cfPaymentId   = payment?.cf_payment_id as string | number | undefined

  if (linkStatus !== 'PAID' || paymentStatus !== 'SUCCESS' || !linkId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // ── Look up the pending payment row by link_id ─────────────────────────────
  const admin = createAdminClient()
  const { data: paymentRow, error: lookupErr } = await admin
    .from('msme_pack_payments')
    .select('id, org_id, pack_tier, vendor_limit, amount_paise')
    .eq('gateway_order_id', linkId)
    .maybeSingle()

  if (lookupErr || !paymentRow) {
    console.error('[msme/webhook] No pending payment found for link_id', linkId, lookupErr)
    // Return 200 so Cashfree doesn't retry indefinitely — the link may not be ours
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { id: rowId, org_id, pack_tier } = paymentRow
  const pack   = getPackByTier(pack_tier)
  const paidAt = new Date().toISOString()

  // ── Activate the pack ─────────────────────────────────────────────────────
  await admin.from('org_feature_settings').upsert(
    {
      org_id,
      feature_key: 'msme_pack',
      is_enabled:  true,
      config:      { tier: pack_tier, vendor_limit: pack.vendor_limit, paid_at: paidAt },
    },
    { onConflict: 'org_id,feature_key' }
  )

  // ── Mark payment row as paid ──────────────────────────────────────────────
  await admin
    .from('msme_pack_payments')
    .update({
      status:             'paid',
      gateway_payment_id: String(cfPaymentId ?? ''),
      paid_at:            paidAt,
    })
    .eq('id', rowId)

  console.log('[msme/webhook] Pack activated', { org_id, pack_tier, vendor_limit: pack.vendor_limit })
  return NextResponse.json({ ok: true })
}
