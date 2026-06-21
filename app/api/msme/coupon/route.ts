import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

// Coupon codes are stored in MSME_COUPON_CODES env var.
// Format: CODE1:20,CODE2:50  (code:discount_percent)
// Example: EARLYBIRD:20,PARTNER50:50

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code param required' }, { status: 400 })

  const raw = process.env.MSME_COUPON_CODES ?? ''
  const coupons = Object.fromEntries(
    raw.split(',').flatMap(c => {
      const [k, v] = c.split(':')
      const pct = parseInt(v ?? '0', 10)
      return k?.trim() && !isNaN(pct) && pct > 0 ? [[k.trim().toUpperCase(), pct]] : []
    })
  )

  const discount = coupons[code]
  if (!discount) return NextResponse.json({ error: 'Invalid or expired coupon code' }, { status: 404 })

  return NextResponse.json({ code, discount_percent: discount, valid: true })
}
