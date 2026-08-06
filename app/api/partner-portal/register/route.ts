// Partner-program registration — creates the auth account SERVER-SIDE.
//
// Why not client-side supabase.auth.signUp()?
//   signUp() sends a confirmation email through Supabase's built-in SMTP,
//   which is rate-limited to a handful of messages per hour per project.
//   Once that limit is hit, signUp fails outright ("email rate limit
//   exceeded") — no auth user, no partner profile — and the person is then
//   stuck: /partners/login says "Invalid login credentials" because the
//   account was never created. Partners also had to wait for an email to do
//   something that needs no email verification.
//
//   admin.createUser({ email_confirm: true }) sends NO email, so there is no
//   rate limit and the partner can sign in with their password immediately.
import { NextRequest, NextResponse }  from 'next/server'
import { createAdminClient }          from '@/lib/supabase/admin'
import { ensurePartnerProfile }       from '@/lib/partner/profile'
import { notifySuperAdminsOfSignup }  from '@/lib/email/signupAlert'

export async function POST(req: NextRequest) {
  const { name, email, phone, password, referred_by } = await req.json()

  if (!name?.trim())            return NextResponse.json({ error: 'Name is required' },  { status: 400 })
  if (!email?.trim())           return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()
  const admin      = createAdminClient()

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email:         cleanEmail,
    password,
    email_confirm: true,          // no verification email — nothing to rate-limit
  })

  // Email already registered → this is an existing upFloat/partner account.
  // SECURITY: never set or reset its password here; that would let anyone take
  // over an account just by "joining" with its email. Create the partner
  // profile so they gain partner access, then send them to sign in normally.
  const alreadyRegistered =
    !!createErr && /already|exists|registered/i.test(createErr.message ?? '')

  if (createErr && !alreadyRegistered) {
    console.error('[partner-portal/register] createUser failed:', createErr.message)
    return NextResponse.json({ error: 'Could not create your account — please try again' }, { status: 500 })
  }

  // Tag brand-new accounts as partner-only so they never receive upFloat
  // task-manager usage email. Only on creation — an existing upFloat user who
  // also becomes a partner keeps their 'app' product and all their app email.
  if (created?.user?.id) {
    await admin.from('users').upsert({
      id:             created.user.id,
      email:          cleanEmail,
      name:           name.trim().slice(0, 100),
      signup_product: 'partner',
    }, { onConflict: 'id' })

    // Partner accounts are created here via the admin API, so they never pass
    // through /auth/callback or /api/auth/provision — the two places that alert
    // super admins. Without this, partner signups were completely silent.
    // Guarded by `created`, so an existing account joining the programme (the
    // alreadyRegistered path) is not reported as a new signup.
    await notifySuperAdminsOfSignup(
      { email: cleanEmail, name: name.trim() },
      'email + password',
      'partner',
    )
  }

  const { profile, error: profileErr } = await ensurePartnerProfile(admin, {
    name,
    email:      cleanEmail,
    phone:      phone ?? null,
    referredBy: referred_by ?? null,
    userId:     created?.user?.id ?? null,
  })

  if (!profile) {
    return NextResponse.json({ error: profileErr ?? 'Registration failed' }, { status: 500 })
  }

  return NextResponse.json({
    referral_code:    profile.referral_code,
    // true → the caller must sign in with their EXISTING password
    account_existed:  alreadyRegistered,
  })
}
