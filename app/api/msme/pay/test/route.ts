// HIDDEN test-payment endpoint — lets the platform owner run a small REAL
// Razorpay charge (₹50 / ₹100) to verify the live payment pipeline end-to-end.
//
// Safety properties:
//  - Gated to SUPER_ADMIN_EMAIL only (same guard as /api/admin/*) — invisible
//    to every other user (plain 404, indistinguishable from a missing route).
//  - Amount is whitelisted server-side to exactly ₹50 or ₹100.
//  - Order notes carry order_type:'test' and NO pack_tier, so the payment
//    webhook ignores it entirely — nothing activates, nothing is written to
//    msme_pack_payments (which also keeps partner-commission maths clean).
//  - PUT verifies the Razorpay signature so you can confirm the full
//    order → checkout → signature loop works, again with zero DB writes.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { getAuthUser }               from '@/lib/supabase/authUser'
import crypto                        from 'crypto'

const RZP_KEY_ID     = process.env.RAZORPAY_KEY_ID
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const ALLOWED_PAISE  = new Set([5000, 10000])   // ₹50, ₹100

async function superAdminOnly(): Promise<{ email: string } | null> {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  const superEmail = process.env.SUPER_ADMIN_EMAIL
  if (!user?.email || !superEmail) return null
  if (user.email.toLowerCase() !== superEmail.toLowerCase()) return null
  return { email: user.email }
}

// POST { amount_paise } → creates a real Razorpay order for ₹50/₹100
export async function POST(req: NextRequest) {
  const admin = await superAdminOnly()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
    return NextResponse.json({ error: 'Razorpay keys not configured' }, { status: 503 })
  }

  const { amount_paise } = await req.json()
  if (!ALLOWED_PAISE.has(amount_paise)) {
    return NextResponse.json({ error: 'Amount must be ₹50 or ₹100' }, { status: 400 })
  }

  const basicAuth = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64')
  const orderRes  = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basicAuth}` },
    body: JSON.stringify({
      amount:   amount_paise,
      currency: 'INR',
      receipt:  `test_${Date.now()}`,
      // order_type 'test' + no pack_tier → webhook skips this order entirely
      notes:    { order_type: 'test', purpose: 'pipeline verification', by: admin.email },
    }),
  })
  if (!orderRes.ok) {
    const errBody = await orderRes.json().catch(() => ({}))
    return NextResponse.json({ error: (errBody as any).error?.description ?? 'Order creation failed' }, { status: 502 })
  }
  const order = await orderRes.json()
  return NextResponse.json({ order_id: order.id, amount: amount_paise, key_id: RZP_KEY_ID })
}

// PUT { razorpay_order_id, razorpay_payment_id, razorpay_signature } → verify only
export async function PUT(req: NextRequest) {
  const admin = await superAdminOnly()
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!RZP_KEY_SECRET) return NextResponse.json({ error: 'Razorpay keys not configured' }, { status: 503 })

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const expected = crypto.createHmac('sha256', RZP_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex')
  const sigBuf = Buffer.from(razorpay_signature, 'hex')
  const expBuf = Buffer.from(expected, 'hex')
  const valid  = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)

  return NextResponse.json({
    verified: valid,
    payment_id: razorpay_payment_id,
    note: valid
      ? 'Signature valid — payment pipeline works end-to-end. Refund this payment from the Razorpay dashboard.'
      : 'Signature INVALID — investigate before launch.',
  }, { status: valid ? 200 : 400 })
}
