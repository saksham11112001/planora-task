// MSME vendor slot payment — creates a Razorpay order and, on verification, marks the slot as paid.
// Razorpay keys: RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (set in Vercel env vars when integrating)

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import crypto                       from 'crypto'

const AMOUNT_PAISE  = 9900  // ₹99 in paise
const RZP_KEY_ID    = process.env.RAZORPAY_KEY_ID
const RZP_KEY_SECRET= process.env.RAZORPAY_KEY_SECRET

// ── POST /api/msme/pay  { vendor_id }  → creates Razorpay order ──────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role, organisations(name)')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only owner/admin can initiate payments' }, { status: 403 })
  }

  const { vendor_id } = await req.json()
  if (!vendor_id) return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: vendor } = await admin
    .from('msme_vendors')
    .select('id, vendor_name, payment_status')
    .eq('id', vendor_id)
    .eq('org_id', mb.org_id)
    .maybeSingle()

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  if ((vendor as any).payment_status === 'free') {
    return NextResponse.json({ error: 'This vendor is in the free tier — no payment needed' }, { status: 400 })
  }
  if ((vendor as any).payment_status === 'paid') {
    return NextResponse.json({ error: 'This vendor slot is already paid' }, { status: 400 })
  }

  if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
    // Razorpay not yet configured — return a stub so the UI can show a "coming soon" message
    return NextResponse.json({
      error: 'Payment gateway not yet configured. Please contact support.',
      code:  'RAZORPAY_NOT_CONFIGURED',
    }, { status: 503 })
  }

  // Create Razorpay order
  const basicAuth = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64')
  const orderRes  = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basicAuth}` },
    body: JSON.stringify({
      amount:   AMOUNT_PAISE,
      currency: 'INR',
      receipt:  `msme_${vendor_id.slice(0, 12)}`,
      notes:    {
        vendor_id,
        org_id:       mb.org_id,
        vendor_name:  vendor.vendor_name,
        org_name:     (mb.organisations as any)?.name ?? '',
      },
    }),
  })
  const order = await orderRes.json()
  if (!orderRes.ok) return NextResponse.json({ error: order.error?.description ?? 'Order creation failed' }, { status: 500 })

  // Persist order record
  await admin.from('msme_payments').insert({
    vendor_id,
    org_id: mb.org_id,
    amount_paise: AMOUNT_PAISE,
    razorpay_order_id: order.id,
    status: 'created',
  })

  return NextResponse.json({
    order_id:    order.id,
    amount:      AMOUNT_PAISE,
    currency:    'INR',
    key_id:      RZP_KEY_ID,
    vendor_name: vendor.vendor_name,
    org_name:    (mb.organisations as any)?.name ?? '',
  })
}

// ── PUT /api/msme/pay  { vendor_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
//     Verify signature → mark vendor as paid ──────────────────────────────────
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const { vendor_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

  if (!vendor_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
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

  const admin = createAdminClient()

  // Mark vendor as paid
  await admin.from('msme_vendors').update({ payment_status: 'paid' }).eq('id', vendor_id).eq('org_id', mb.org_id)

  // Update payment record
  await admin.from('msme_payments').update({
    razorpay_payment_id,
    razorpay_signature,
    status: 'paid',
    paid_at: new Date().toISOString(),
  }).eq('razorpay_order_id', razorpay_order_id)

  return NextResponse.json({ ok: true })
}
