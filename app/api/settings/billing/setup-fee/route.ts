import { createClient }   from '@/lib/supabase/server'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError }         from '@/lib/api-error'

const SETUP_FEE_PAISE = 500000 // ₹5,000 in paise

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role, organisations(name, razorpay_customer_id, setup_fee_paid)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
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
        receipt:  `setup_${mb.org_id}`,
        notes:    { org_id: mb.org_id, type: 'setup_fee' },
      }),
    })
    const order = await orderRes.json()
    if (!order.id) throw new Error(order.error?.description ?? 'Order creation failed')

    return NextResponse.json({ order_id: order.id, key_id: keyId })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'billing/setup-fee'), { status: 500 })
  }
}
