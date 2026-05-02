import { createClient }   from '@/lib/supabase/server'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'
import { createHmac }      from 'crypto'
import { dbError }         from '@/lib/api-error'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })

  // Verify Razorpay HMAC signature
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? ''
  const expected  = createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')
  if (expected !== razorpay_signature)
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!mb || !['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  try {
    const { error } = await supabase
      .from('organisations')
      .update({ setup_fee_paid: true })
      .eq('id', mb.org_id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'billing/setup-fee/verify'), { status: 500 })
  }
}
