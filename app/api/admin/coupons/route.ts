import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { isSuperAdminEmail }  from '@/lib/utils/superAdmin'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest }  from 'next/server'
import { dbError } from '@/lib/api-error'

async function superAdminGuard(supabase: Awaited<ReturnType<typeof createClient>>) {
  const user = await getAuthUser(supabase)
  if (!user) return null
  if (!isSuperAdminEmail(user.email)) return null
  return user
}

// GET /api/admin/coupons — list all coupons with redemption counts
export async function GET() {
  const supabase = await createClient()
  const mb = await superAdminGuard(supabase)
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
  const mb = await superAdminGuard(supabase)
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
    one_time_use?:     boolean
    msme_only?:        boolean
  }
  const {
    code, description, discount_type,
    discount_percent, plan_tier, duration_months,
    max_uses, expires_at, is_active = true,
    one_time_use = true, msme_only = false,
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
    // plan_tier is kept for PERCENT coupons too, not just free_plan.
    //
    // The MSME payment route only ever resolves percent coupons, and it treats
    // a null plan_tier as "valid on every pack". Forcing null here meant a code
    // created on this page as "100% off Growth" would take ₹29,999 off the
    // Business pack just as happily — the coupon could not be scoped at all
    // through the admin UI, only by writing SQL by hand.
    //
    // Null stays meaningful: leave the tier blank for a discount that should
    // apply to anything.
    plan_tier:        plan_tier || null,
    duration_months:  duration_months ?? 1,
    max_uses:         max_uses ?? null,
    expires_at:       expires_at ?? null,
    is_active,
    // Defaults chosen for the common case — a code issued to one buyer.
    // one_time_use blocks the same org redeeming twice; max_uses (set by the
    // caller) is what stops a forwarded code being used by a different org.
    one_time_use,
    msme_only,
  }).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
    return NextResponse.json(dbError(error, 'admin/coupons'), { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}
