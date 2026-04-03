import { createClient }  from '@/lib/supabase/server'
import { NextResponse }   from 'next/server'
import type { NextRequest } from 'next/server'

const PLAN_IDS: Record<string, string> = {
  starter:  process.env.RAZORPAY_STARTER_PLAN_ID  ?? '',
  pro:      process.env.RAZORPAY_PRO_PLAN_ID       ?? '',
  business: process.env.RAZORPAY_BUSINESS_PLAN_ID  ?? '',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role, organisations(name, razorpay_customer_id, plan_tier)').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { plan_tier } = await request.json()
  const planId = PLAN_IDS[plan_tier]
  if (!planId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const org  = mb.organisations as any
  const keyId     = process.env.RAZORPAY_KEY_ID     ?? ''
  const keySecret = process.env.RAZORPAY_KEY_SECRET  ?? ''
  const auth  = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  try {
    // Create or reuse customer
    let customerId = org?.razorpay_customer_id
    if (!customerId) {
      const custRes = await fetch('https://api.razorpay.com/v1/customers', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: org?.name ?? 'Customer', email: user.email }),
      })
      const cust = await custRes.json()
      if (!cust.id) throw new Error(cust.error?.description ?? 'Customer creation failed')
      customerId = cust.id
      await supabase.from('organisations').update({ razorpay_customer_id: customerId }).eq('id', mb.org_id)
    }

    // Create subscription
    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, customer_id: customerId, quantity: 1, total_count: 12, customer_notify: 1 }),
    })
    const sub = await subRes.json()
    if (!sub.id) throw new Error(sub.error?.description ?? 'Subscription creation failed')

    return NextResponse.json({ subscription_id: sub.id, key_id: keyId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
