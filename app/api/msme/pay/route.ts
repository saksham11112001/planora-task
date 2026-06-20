// MSME pack payment — creates a Razorpay order and verifies payment signature.
// On verification, upserts org_feature_settings with the pack config.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { MSME_PACKS, getPackByTier } from '@/lib/msme/packs'
import { sendInvoiceEmail }         from '@/lib/email/send'
import crypto                       from 'crypto'

const RZP_KEY_ID     = process.env.RAZORPAY_KEY_ID
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

// ── POST /api/msme/pay  { pack_tier }  → creates Razorpay order ───────────────
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

  if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
    return NextResponse.json({
      code: 'PAYMENT_NOT_CONFIGURED',
      message: 'Payment gateway is not yet configured. Contact support@upfloat.co to purchase a pack.',
    }, { status: 503 })
  }

  const orgId   = mb.org_id
  const orgName = (mb.organisations as any)?.name ?? 'Organisation'
  const { price_paise: basePaise, label: packLabel, vendor_limit: vendorLimit } = pack

  // Charge GST-inclusive amount on Razorpay; the UI shows the base (ex-GST) price.
  const chargeablePaise = Math.round(basePaise * 1.18)

  const basicAuth = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64')
  const orderRes  = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basicAuth}` },
    body: JSON.stringify({
      amount:   chargeablePaise,
      currency: 'INR',
      receipt:  `msme_${orgId.slice(0, 8)}_${pack_tier}_${Date.now()}`,
      notes:    { org_id: orgId, pack_tier, org_name: orgName },
    }),
  })
  const order = await orderRes.json()
  if (!orderRes.ok) {
    return NextResponse.json({ error: order.error?.description ?? 'Order creation failed' }, { status: 500 })
  }

  // Record pending payment — store base (pre-GST) amount for internal records
  const admin = createAdminClient()
  await admin.from('msme_pack_payments').upsert(
    {
      org_id:           orgId,
      pack_tier,
      vendor_limit:     vendorLimit,
      amount_paise:     basePaise,
      gateway:          'razorpay',
      gateway_order_id: order.id,
      status:           'pending',
    },
    { onConflict: 'gateway_order_id' }
  )

  return NextResponse.json({
    gateway:  'razorpay',
    order_id: order.id,
    amount:   chargeablePaise,
    key_id:   RZP_KEY_ID,
    pack_tier,
    org_name: orgName,
    email:    user.email ?? '',
  })
}

// ── PUT /api/msme/pay  { pack_tier, razorpay_order_id, razorpay_payment_id, razorpay_signature }
//     Verify Razorpay signature → activate pack ───────────────────────────────
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

  // Idempotency: if this payment was already processed, return success without re-activating
  const { data: alreadyPaid } = await admin
    .from('msme_pack_payments')
    .select('id')
    .eq('gateway_payment_id', razorpay_payment_id)
    .eq('status', 'paid')
    .maybeSingle()
  if (alreadyPaid) return NextResponse.json({ ok: true, pack_tier, vendor_limit: pack.vendor_limit })

  await admin.from('org_feature_settings').upsert(
    {
      org_id:      mb.org_id,
      feature_key: 'msme_pack',
      is_enabled:  true,
      config:      { tier: pack_tier, vendor_limit: pack.vendor_limit, paid_at: paidAt },
    },
    { onConflict: 'org_id,feature_key' }
  )

  await admin.from('msme_pack_payments').upsert(
    {
      org_id:             mb.org_id,
      pack_tier,
      vendor_limit:       pack.vendor_limit,
      amount_paise:       pack.price_paise,
      gateway:            'razorpay',
      gateway_order_id:   razorpay_order_id,
      gateway_payment_id: razorpay_payment_id,
      status:             'paid',
      paid_at:            paidAt,
    },
    { onConflict: 'gateway_order_id' }
  )

  // Send tax invoice email (best-effort)
  try {
    const [{ data: gstRow }, { data: orgRow }] = await Promise.all([
      admin.from('org_feature_settings').select('config')
        .eq('org_id', mb.org_id).eq('feature_key', 'billing_gst').maybeSingle(),
      admin.from('organisations').select('name').eq('id', mb.org_id).maybeSingle(),
    ])
    const gstDetails    = gstRow?.config as any ?? null
    const orgName       = orgRow?.name ?? ''
    const chargeablePaise = Math.round(pack.price_paise * 1.18)
    const invoiceNum    = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`

    await sendInvoiceEmail({
      invoiceNumber:   invoiceNum,
      invoiceDate:     new Date().toISOString().slice(0, 10),
      customerEmail:   user.email!,
      orgName,
      gstDetails,
      itemDescription: `MSME Tracker — ${pack.label} Pack (${pack.vendor_limit} vendors)`,
      amountPaise:     chargeablePaise,
      paymentId:       razorpay_payment_id,
    })
  } catch { /* never block payment success */ }

  return NextResponse.json({ ok: true, pack_tier, vendor_limit: pack.vendor_limit })
}
