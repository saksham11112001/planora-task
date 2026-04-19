import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest }  from 'next/server'
import { dbError } from '@/lib/api-error'

async function ownerGuard(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner', 'admin'].includes(mb.role)) return null
  return mb
}

// GET /api/admin/coupons — list all coupons with redemption counts
export async function GET() {
  const supabase = await createClient()
  const mb = await ownerGuard(supabase)
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coupons')
    .select('*, coupon_redemptions(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json(dbError(error, 'admin/coupons'), { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/admin/coupons — create a new coupon
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const mb = await ownerGuard(supabase)
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    code?:             string
    description?:      string
    discount_type?:    'free_plan' | 'percent' | 'fixed_inr'
    discount_percent?: number
    plan_tier?:        string
    duration_months?:  number
    max_uses?:         number | null
    expires_at?:       string | null
    is_active?:        boolean
  }
  const {
    code, description, discount_type,
    discount_percent, plan_tier, duration_months,
    max_uses, expires_at, is_active = true,
  } = body

  if (!code?.trim()) return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  if (discount_type === 'free_plan' && !plan_tier)
    return NextResponse.json({ error: 'plan_tier required for free_plan coupons' }, { status: 400 })
  if (discount_type === 'percent' && !discount_percent)
    return NextResponse.json({ error: 'discount_percent required for percent coupons' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('coupons').insert({
    code:             code.trim().toUpperCase(),
    description:      description?.trim() || null,
    discount_type:    discount_type ?? 'free_plan',
    discount_percent: discount_type === 'percent' ? discount_percent : null,
    plan_tier:        discount_type === 'free_plan' ? plan_tier : null,
    duration_months:  duration_months ?? 1,
    max_uses:         max_uses ?? null,
    expires_at:       expires_at ?? null,
    is_active,
  }).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
    return NextResponse.json(dbError(error, 'admin/coupons'), { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}
