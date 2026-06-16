// MSME pack-based payment — creates a Cashfree payment link or Razorpay order for a pack tier.
// On verification/confirmation, upserts org_feature_settings with the pack config.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { MSME_PACKS, getPackByTier } from '@/lib/msme/packs'
import crypto                       from 'crypto'

const RZP_KEY_ID     = process.env.RAZORPAY_KEY_ID
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const CF_APP_ID      = process.env.CASHFREE_APP_ID
const CF_SECRET_KEY  = process.env.CASHFREE_SECRET_KEY

// ── POST /api/msme/pay  { pack_tier }  → creates payment order/link ──────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role, organisations(name)')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only owner/admin can initiate payments' }, { status: 403 })
  }

  const { pack_tier } = await req.json()
  if (!pack_tier) return NextResponse.json({ error: 'pack_tier required' }, { status: 400 })

  const pack = getPackByTier(pack_tier)
  if (pack.tier === 'free') {
    return NextResponse.json({ error: 'Free tier does not require payment' }, { status: 400 })
  }

  const orgId      = mb.org_id
  const orgName    = (mb.organisations as any)?.name ?? 'Organisation'
  const userEmail  = user.email ?? 'noreply@planora.app'
  const { price_paise: pricePaise, label: packLabel, vendor_limit: vendorLimit } = pack

  // ── Cashfree ──────────────────────────────────────────────────────────────
  if (CF_APP_ID && CF_SECRET_KEY) {
    const linkId = `msme_${orgId.slice(0, 8)}_${pack_tier}_${Date.now()}`
    const cfRes  = await fetch('https://api.cashfree.com/pg/links', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-version':   '2023-08-01',
        'x-client-id':     CF_APP_ID,
        'x-client-secret': CF_SECRET_KEY,
      },
      body: JSON.stringify({
        link_id:       linkId,
        link_amount:   pricePaise / 100,
        link_currency: 'INR',
        link_purpose:  `MSME Tracker — ${packLabel} (${vendorLimit} vendors)`,
        customer_details: {
          customer_name:  orgName,
          customer_email: userEmail,
          customer_phone: '9999999999',
        },
        link_notify: { send_sms: false, send_email: false },
        link_meta:   { upi_intent: true },
      }),
    })
    const data = await cfRes.json()
    if (!cfRes.ok) return NextResponse.json({ error: data.message ?? 'Cashfree link creation failed' }, { status: 500 })

    return NextResponse.json({ gateway: 'cashfree', payment_link: data.link_url, amount: pricePaise, pack_tier })
  }

  // ── Razorpay ──────────────────────────────────────────────────────────────
  if (RZP_KEY_ID && RZP_KEY_SECRET) {
    const basicAuth = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64')
    const orderRes  = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basicAuth}` },
      body: JSON.stringify({
        amount:   pricePaise,
        currency: 'INR',
        receipt:  `msme_${orgId.slice(0, 8)}_${pack_tier}`,
        notes:    { org_id: orgId, pack_tier, org_name: orgName },
      }),
    })
    const order = await orderRes.json()
    if (!orderRes.ok) return NextResponse.json({ error: order.error?.description ?? 'Order creation failed' }, { status: 500 })

    return NextResponse.json({ gateway: 'razorpay', order_id: order.id, amount: pricePaise, key_id: RZP_KEY_ID, pack_tier })
  }

  // ── Neither configured ────────────────────────────────────────────────────
  return NextResponse.json({
    code: 'PAYMENT_NOT_CONFIGURED',
    payment_instructions: {
      message:  'Payment gateway is not yet configured. Please contact support to purchase a pack.',
      pack:     pack,
      bank_transfer: 'Contact support@planora.app for manual payment details.',
    },
  }, { status: 503 })
}

// ── PUT /api/msme/pay  { pack_tier, razorpay_order_id, razorpay_payment_id, razorpay_signature }
//     Verify Razorpay signature → upsert pack setting ─────────────────────────
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const { pack_tier, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

  if (!pack_tier || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!RZP_KEY_SECRET) {
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
  }

  // Verify Razorpay signature
  const expectedSig = crypto
    .createHmac('sha256', RZP_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSig !== razorpay_signature) {
    return NextResponse.json({ error: 'Payment verification failed — invalid signature' }, { status: 400 })
  }

  const pack    = getPackByTier(pack_tier)
  const paidAt  = new Date().toISOString()
  const admin   = createAdminClient()

  await admin.from('org_feature_settings').upsert(
    {
      org_id:      mb.org_id,
      feature_key: 'msme_pack',
      is_enabled:  true,
      config:      { tier: pack_tier, vendor_limit: pack.vendor_limit, paid_at: paidAt },
    },
    { onConflict: 'org_id,feature_key' }
  )

  await admin.from('msme_pack_payments').insert({
    org_id:              mb.org_id,
    pack_tier,
    vendor_limit:        pack.vendor_limit,
    amount_paise:        pack.price_paise,
    gateway:             'razorpay',
    gateway_order_id:    razorpay_order_id,
    gateway_payment_id:  razorpay_payment_id,
    status:              'paid',
    paid_at:             paidAt,
  })

  return NextResponse.json({ ok: true, pack_tier, vendor_limit: pack.vendor_limit })
}

// ── PATCH /api/msme/pay  { pack_tier, cashfree_payment_id }
//     Confirm Cashfree payment → upsert pack setting ───────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const { pack_tier, cashfree_payment_id } = await req.json()
  if (!pack_tier || !cashfree_payment_id) {
    return NextResponse.json({ error: 'pack_tier and cashfree_payment_id are required' }, { status: 400 })
  }

  const pack = getPackByTier(pack_tier)

  // Manual confirmation for testing: skip API verification
  if (!cashfree_payment_id.startsWith('manual_')) {
    // Verify via Cashfree API
    if (!CF_APP_ID || !CF_SECRET_KEY) {
      return NextResponse.json({ error: 'Cashfree not configured' }, { status: 503 })
    }

    const orgId  = mb.org_id
    // Reconstruct link_id pattern — we need to look it up or the caller passes it
    // For now, verify payment ID exists by fetching payment details
    const verifyRes = await fetch(`https://api.cashfree.com/pg/orders/payments/${cashfree_payment_id}`, {
      headers: {
        'x-api-version':   '2023-08-01',
        'x-client-id':     CF_APP_ID,
        'x-client-secret': CF_SECRET_KEY,
      },
    })
    if (!verifyRes.ok) {
      return NextResponse.json({ error: 'Cashfree payment verification failed' }, { status: 400 })
    }
    const verifyData = await verifyRes.json()
    if (verifyData.payment_status !== 'SUCCESS') {
      return NextResponse.json({ error: 'Payment not successful' }, { status: 400 })
    }
  }

  const paidAt = new Date().toISOString()
  const admin  = createAdminClient()

  await admin.from('org_feature_settings').upsert(
    {
      org_id:      mb.org_id,
      feature_key: 'msme_pack',
      is_enabled:  true,
      config:      { tier: pack_tier, vendor_limit: pack.vendor_limit, paid_at: paidAt },
    },
    { onConflict: 'org_id,feature_key' }
  )

  await admin.from('msme_pack_payments').insert({
    org_id:             mb.org_id,
    pack_tier,
    vendor_limit:       pack.vendor_limit,
    amount_paise:       pack.price_paise,
    gateway:            cashfree_payment_id.startsWith('manual_') ? 'manual' : 'cashfree',
    gateway_payment_id: cashfree_payment_id,
    status:             'paid',
    paid_at:            paidAt,
  })

  return NextResponse.json({ ok: true, pack_tier, vendor_limit: pack.vendor_limit })
}
