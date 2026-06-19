import { createClient }   from '@/lib/supabase/server'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError }         from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

const SETUP_FEE_PAISE = 49900 // ₹499 in paise

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, _req, 'org_id, role, organisations(name, razorpay_customer_id, setup_fee_paid)')
  if (!mb || !['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const org = mb.organisations as any
  if (org?.setup_fee_paid)
    return NextResponse.json({ error: 'Setup fee already paid' }, { status: 400 })

  const keyId     = process.env.RAZORPAY_KEY_ID     ?? ''
  const keySecret = process.env.RAZORPAY_KEY_SECRET  ?? ''
  const auth      = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  try {
    // Create a one-time Razorpay order (not a subscription)
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount:   SETUP_FEE_PAISE,
        currency: 'INR',
        receipt:  `setup_${mb.org_id}_${Date.now()}`,
        notes:    { org_id: mb.org_id, type: 'setup_fee' },
      }),
    })
    const order = await orderRes.json()
    if (!order.id) return NextResponse.json({ error: 'Payment session could not be created. Please try again.' }, { status: 502 })

    return NextResponse.json({ order_id: order.id, key_id: keyId })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'billing/setup-fee'), { status: 500 })
  }
}
