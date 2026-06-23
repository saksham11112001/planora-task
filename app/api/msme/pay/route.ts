// MSME pack payment — creates a Razorpay order and verifies payment signature.
// On verification, upserts org_feature_settings with the pack config.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { MSME_PACKS, getPackByTier, MSME_ADDON_PACKS } from '@/lib/msme/packs'
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

  const body = await req.json()
  const { pack_tier, addon_slots, coupon_code } = body as { pack_tier?: string; addon_slots?: number; coupon_code?: string }

  if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
    return NextResponse.json({
      code: 'PAYMENT_NOT_CONFIGURED',
      message: 'Payment gateway is not yet configured. Contact support@upfloat.co to purchase a pack.',
    }, { status: 503 })
  }

  const orgId   = mb.org_id
  const orgName = (mb.organisations as any)?.name ?? 'Organisation'
  const basicAuth = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64')

  // Resolve coupon discount (validates server-side regardless of client claim)
  let discountPct = 0
  if (coupon_code) {
    const raw = process.env.MSME_COUPON_CODES ?? ''
    const coupons = Object.fromEntries(
      raw.split(',').flatMap(c => {
        const [k, v] = c.split(':')
        const pct = parseInt(v ?? '0', 10)
        return k?.trim() && !isNaN(pct) ? [[k.trim().toUpperCase(), pct]] : []
      })
    )
    discountPct = coupons[coupon_code.trim().toUpperCase()] ?? 0
  }

  // ── Add-on order ──────────────────────────────────────────────────────────
  if (addon_slots !== undefined) {
    const addonPack = MSME_ADDON_PACKS.find(a => a.slots === addon_slots)
    if (!addonPack) return NextResponse.json({ error: 'Invalid addon_slots value' }, { status: 400 })

    const basePaise      = addonPack.price_paise
    const chargeablePaise = Math.round(basePaise * 1.18 * (1 - discountPct / 100))

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basicAuth}` },
      body: JSON.stringify({
        amount:   chargeablePaise,
        currency: 'INR',
        receipt:  `msme_addon_${orgId.slice(0, 8)}_${addon_slots}_${Date.now()}`,
        notes:    { org_id: orgId, order_type: 'addon', addon_slots: String(addon_slots), org_name: orgName },
      }),
    })
    const order = await orderRes.json()
    if (!orderRes.ok) return NextResponse.json({ error: order.error?.description ?? 'Order creation failed' }, { status: 500 })

    const admin = createAdminClient()
    await admin.from('msme_pack_payments').upsert(
      {
        org_id:           orgId,
        pack_tier:        `addon_${addon_slots}`,
        vendor_limit:     addon_slots,
        amount_paise:     addonPack.price_paise,
        gateway:          'razorpay',
        gateway_order_id: order.id,
        status:           'pending',
      },
      { onConflict: 'gateway_order_id' }
    )

    return NextResponse.json({
      gateway:    'razorpay',
      order_id:   order.id,
      amount:     chargeablePaise,
      key_id:     RZP_KEY_ID,
      order_type: 'addon',
      addon_slots,
      org_name:   orgName,
      email:      user.email ?? '',
    })
  }

  // ── Pack upgrade order ────────────────────────────────────────────────────
  if (!pack_tier) return NextResponse.json({ error: 'pack_tier required' }, { status: 400 })

  const pack = getPackByTier(pack_tier)
  if (pack.tier === 'free') {
    return NextResponse.json({ error: 'Free tier does not require payment' }, { status: 400 })
  }

  const { price_paise: basePaise, label: packLabel, vendor_limit: vendorLimit } = pack
  const chargeablePaise = Math.round(basePaise * 1.18 * (1 - discountPct / 100))

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

  const { pack_tier, addon_slots, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!pack_tier && addon_slots === undefined) {
    return NextResponse.json({ error: 'pack_tier or addon_slots required' }, { status: 400 })
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

  const paidAt = new Date().toISOString()
  const admin  = createAdminClient()

  // ── Add-on verification ───────────────────────────────────────────────────
  if (addon_slots !== undefined) {
    // Verify the order belongs to this org and wasn't already processed
    const { data: addonPayment } = await admin
      .from('msme_pack_payments')
      .select('id, org_id, status, amount_paise')
      .eq('gateway_order_id', razorpay_order_id)
      .maybeSingle()
    if (!addonPayment) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (addonPayment.org_id !== mb.org_id) {
      return NextResponse.json({ error: 'Order does not belong to your organisation' }, { status: 403 })
    }
    // Idempotency: already processed
    if (addonPayment.status === 'paid') {
      const { data: existingSlots } = await admin
        .from('org_feature_settings').select('config')
        .eq('org_id', mb.org_id).eq('feature_key', 'msme_addon_slots').maybeSingle()
      const extra: number = (existingSlots?.config as any)?.extra_slots ?? 0
      return NextResponse.json({ ok: true, addon_slots_added: addon_slots, extra_slots: extra })
    }

    const { data: existing } = await admin
      .from('org_feature_settings').select('config')
      .eq('org_id', mb.org_id).eq('feature_key', 'msme_addon_slots').maybeSingle()
    const currentExtra: number = (existing?.config as any)?.extra_slots ?? 0
    await admin.from('org_feature_settings').upsert(
      { org_id: mb.org_id, feature_key: 'msme_addon_slots', is_enabled: true, config: { extra_slots: currentExtra + addon_slots } },
      { onConflict: 'org_id,feature_key' }
    )
    await admin.from('msme_pack_payments').upsert(
      {
        org_id:             mb.org_id,
        pack_tier:          `addon_${addon_slots}`,
        vendor_limit:       addon_slots,
        amount_paise:       addonPayment.amount_paise ?? 0,
        gateway:            'razorpay',
        gateway_order_id:   razorpay_order_id,
        gateway_payment_id: razorpay_payment_id,
        status:             'paid',
        paid_at:            paidAt,
      },
      { onConflict: 'gateway_order_id' }
    )
    return NextResponse.json({ ok: true, addon_slots_added: addon_slots, extra_slots: currentExtra + addon_slots })
  }

  // ── Pack upgrade verification ─────────────────────────────────────────────
  const pack = getPackByTier(pack_tier)
  if (pack.tier === 'free') {
    return NextResponse.json({ error: 'Cannot downgrade to free tier via payment verification' }, { status: 400 })
  }

  // Verify the order belongs to this org (prevents cross-org replay)
  const { data: packPayment } = await admin
    .from('msme_pack_payments')
    .select('id, org_id, status')
    .eq('gateway_order_id', razorpay_order_id)
    .maybeSingle()
  if (packPayment && packPayment.org_id !== mb.org_id) {
    return NextResponse.json({ error: 'Order does not belong to your organisation' }, { status: 403 })
  }

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
