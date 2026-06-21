// Create or fetch a standalone partner profile.
// POST: called from the join page — creates the partner record before sending magic link.
// GET: returns the current user's partner profile.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { generateCode }             from '@/lib/utils/codeGen'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()
  const { data: partner } = await admin
    .from('standalone_partners')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!partner) return NextResponse.json({ error: 'No partner profile found' }, { status: 404 })
  return NextResponse.json(partner)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, phone, referred_by } = body

  if (!name?.trim())  return NextResponse.json({ error: 'Name is required' },  { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const admin = createAdminClient()

  // Check if a partner with this email already exists
  const { data: existing } = await admin
    .from('standalone_partners')
    .select('id, referral_code, status')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (existing) {
    // Partner already registered — return success (magic link will be sent by client)
    return NextResponse.json({ id: existing.id, referral_code: existing.referral_code, exists: true })
  }

  // Check if referred_by is a valid referral code
  let referredByCode: string | null = null
  if (referred_by?.trim()) {
    const { data: referrer } = await admin
      .from('standalone_partners')
      .select('id')
      .eq('referral_code', referred_by.trim().toUpperCase())
      .maybeSingle()
    if (referrer) referredByCode = referred_by.trim().toUpperCase()
  }

  // Generate unique referral code
  let refCode = generateCode(8)
  // Ensure uniqueness (extremely unlikely collision but be safe)
  const { data: clash } = await admin.from('standalone_partners').select('id').eq('referral_code', refCode).maybeSingle()
  if (clash) refCode = generateCode(8)

  const { data: newPartner, error } = await admin
    .from('standalone_partners')
    .insert({
      name:          name.trim(),
      email:         email.trim().toLowerCase(),
      phone:         phone ?? null,
      referral_code: refCode,
      referred_by:   referredByCode,
      status:        'active',
    })
    .select('id, referral_code')
    .single()

  if (error) {
    console.error('[partner-portal/profile] insert failed:', error.message)
    return NextResponse.json({ error: 'Registration failed — please try again' }, { status: 500 })
  }

  // If this partner was referred by another partner, mark that invite as signed_up
  if (referredByCode) {
    const { data: referrerPartner } = await admin
      .from('standalone_partners')
      .select('id')
      .eq('referral_code', referredByCode)
      .maybeSingle()

    if (referrerPartner) {
      await admin
        .from('partner_portal_invites')
        .update({ signed_up: true, signed_up_at: new Date().toISOString() })
        .eq('partner_id', referrerPartner.id)
        .eq('email', email.trim().toLowerCase())
        .eq('invite_type', 'partner')
        .eq('signed_up', false)
    }
  }

  return NextResponse.json({ id: newPartner.id, referral_code: newPartner.referral_code, exists: false })
}

// Called from auth callback after magic link login to link user_id to partner record
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
