// Create or fetch a standalone partner profile.
// POST: creates the partner record for an already-authenticated user.
//       (New partner signups go through /api/partner-portal/register, which
//       also creates the auth account — this route creates the profile only.)
// GET: returns the current user's partner profile.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { ensurePartnerProfile }     from '@/lib/partner/profile'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()
  const { data: partner } = await admin
    .from('standalone_partners')
    .select('*')
    .eq('user_id', user.id)
    .limit(1).maybeSingle()

  if (!partner) return NextResponse.json({ error: 'No partner profile found' }, { status: 404 })
  return NextResponse.json(partner)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, phone, referred_by } = body

  if (!name?.trim())  return NextResponse.json({ error: 'Name is required' },  { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const admin = createAdminClient()

  // Shared with /api/partner-portal/register so both paths create profiles
  // (and credit the inviting partner) identically.
  const { profile, error } = await ensurePartnerProfile(admin, {
    name,
    email,
    phone:      phone ?? null,
    referredBy: referred_by ?? null,
  })

  if (!profile) return NextResponse.json({ error: error ?? 'Registration failed' }, { status: 500 })

  return NextResponse.json({ id: profile.id, referral_code: profile.referral_code, exists: profile.exists })
}

// Called from auth callback after magic link login to link user_id to partner record
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()

  // Link user_id to the partner record with matching email
  const { error } = await admin
    .from('standalone_partners')
    .update({ user_id: user.id })
    .eq('email', user.email ?? '')
    .is('user_id', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
