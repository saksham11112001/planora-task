/**
 * Create-or-fetch a standalone partner profile — single source of truth,
 * shared by the registration endpoint and the profile API route.
 *
 * Idempotent: if a partner already exists for this email it is returned
 * unchanged (never overwritten), so repeat calls are safe.
 */
import { generateCode }   from '@/lib/utils/codeGen'
import { attributeSignup } from './attribution'

export type PartnerProfile = { id: string; referral_code: string; exists: boolean }

export async function ensurePartnerProfile(
  admin: any,
  input: { name: string; email: string; phone?: string | null; referredBy?: string | null; userId?: string | null },
): Promise<{ profile: PartnerProfile | null; error?: string }> {
  const email = input.email.trim().toLowerCase()
  const name  = input.name.trim()

  // Already a partner? Return as-is and link user_id if we learned it.
  const { data: existing } = await admin
    .from('standalone_partners')
    .select('id, referral_code, user_id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    if (input.userId && !existing.user_id) {
      await admin.from('standalone_partners').update({ user_id: input.userId }).eq('id', existing.id)
    }
    return { profile: { id: existing.id, referral_code: existing.referral_code, exists: true } }
  }

  // Validate the referring partner's code before storing it.
  let referredByCode: string | null = null
  let referrerPartnerId: string | null = null
  if (input.referredBy?.trim()) {
    const code = input.referredBy.trim().toUpperCase()
    const { data: referrer } = await admin
      .from('standalone_partners')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()
    if (referrer) { referredByCode = code; referrerPartnerId = referrer.id }
  }

  // Unique referral code — retry to handle collisions.
  let refCode = generateCode(8)
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: clash } = await admin.from('standalone_partners').select('id').eq('referral_code', refCode).maybeSingle()
    if (!clash) break
    refCode = generateCode(8)
  }

  const { data: created, error } = await admin
    .from('standalone_partners')
    .insert({
      name,
      email,
      phone:         input.phone ?? null,
      user_id:       input.userId ?? null,
      referral_code: refCode,
      referred_by:   referredByCode,
      status:        'active',
    })
    .select('id, referral_code')
    .single()

  if (error || !created) {
    // A concurrent request may have inserted the row between our check and
    // insert — fall back to fetching it rather than reporting a failure.
    const { data: raced } = await admin
      .from('standalone_partners')
      .select('id, referral_code')
      .eq('email', email)
      .maybeSingle()
    if (raced) return { profile: { id: raced.id, referral_code: raced.referral_code, exists: true } }

    console.error('[partner/profile] insert failed:', error?.message)
    return { profile: null, error: 'Registration failed — please try again' }
  }

  // Credit exactly one inviting partner for this partner-program signup.
  await attributeSignup(admin, email, 'partner', referrerPartnerId)

  return { profile: { id: created.id, referral_code: created.referral_code, exists: false } }
}
