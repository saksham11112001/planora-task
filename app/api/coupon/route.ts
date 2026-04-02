export const dynamic = 'force-dynamic'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

// Built-in special access coupons — stored in env or DB
const HARDCODED_COUPONS: Record<string, { plan: string; months: number; description: string }> = {
  'SGNG2025FREE': { plan: 'pro',     months: 12, description: '1 year Pro — SNG internal'   },
  'BETAUSER':     { plan: 'starter', months: 6,  description: '6 months Starter — Beta user' },
  'PARTNER50':    { plan: 'pro',     months: 3,  description: '3 months Pro — Partner'       },
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb || !['owner','admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { code } = await request.json()
  if (!code?.trim()) return NextResponse.json({ error: 'Enter a coupon code' }, { status: 400 })

  const admin    = createAdminClient()
  const upperCode = code.trim().toUpperCase()

  // Check hardcoded coupons first
  const hardcoded = HARDCODED_COUPONS[upperCode]
  if (hardcoded) {
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + hardcoded.months)
    await admin.from('organisations').update({
      plan_tier:      hardcoded.plan,
      status:         'active',
      trial_ends_at:  expiresAt.toISOString(),
    }).eq('id', mb.org_id)
    return NextResponse.json({
      success: true,
      plan: hardcoded.plan,
      months: hardcoded.months,
      description: hardcoded.description,
      expires_at: expiresAt.toISOString(),
    })
  }

  // Check DB coupons table
  const { data: coupon } = await admin.from('coupons')
    .select('*').eq('code', upperCode).eq('is_active', true).maybeSingle()

  if (!coupon) return NextResponse.json({ error: 'Invalid or expired coupon code' }, { status: 400 })
  if (coupon.max_uses && coupon.uses_count >= coupon.max_uses)
    return NextResponse.json({ error: 'This coupon has reached its usage limit' }, { status: 400 })
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
    return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 })

  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + (coupon.duration_months ?? 1))

  await admin.from('organisations').update({
    plan_tier:     coupon.plan_tier,
    status:        'active',
    trial_ends_at: expiresAt.toISOString(),
  }).eq('id', mb.org_id)

  await admin.from('coupons').update({ uses_count: (coupon.uses_count ?? 0) + 1 }).eq('id', coupon.id)

  return NextResponse.json({
    success: true, plan: coupon.plan_tier,
    months: coupon.duration_months,
    expires_at: expiresAt.toISOString(),
  })
}
