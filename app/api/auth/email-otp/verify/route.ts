import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { createHash }               from 'crypto'

const MAX_ATTEMPTS = 5

function hashOtp(otp: string, salt: string): string {
  return createHash('sha256').update(otp + salt).digest('hex')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Already confirmed via OAuth / Supabase email confirmation
  if (user.email_confirmed_at) {
    return NextResponse.json({ ok: true, already_verified: true })
  }

  const body = await req.json()
  const { otp } = body
  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return NextResponse.json({ error: 'Enter the 6-digit code from your email' }, { status: 400 })
  }

  const meta = user.user_metadata ?? {}
  const { otp_hash, otp_salt, otp_expires_at, otp_attempts = 0 } = meta

  if (!otp_hash || !otp_salt || !otp_expires_at) {
    return NextResponse.json({ error: 'No verification pending — please request a new code' }, { status: 400 })
  }
  if (new Date(otp_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code has expired — please request a new one' }, { status: 400 })
  }
  if (otp_attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many incorrect attempts — please request a new code' }, { status: 429 })
  }

  const admin = createAdminClient()
  const hash  = hashOtp(otp.trim(), otp_salt)

  if (hash !== otp_hash) {
    const newAttempts = otp_attempts + 1
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...meta, otp_attempts: newAttempts },
    })
    const remaining = MAX_ATTEMPTS - newAttempts
    return NextResponse.json({
      error: remaining > 0
        ? `Incorrect code — ${remaining} attempt${remaining === 1 ? '' : 's'} remaining`
        : 'Incorrect code — no attempts remaining, please request a new code',
    }, { status: 400 })
  }

  // Correct — mark email as verified and clear OTP fields
  const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      email_otp_verified: true,
      otp_hash:           null,
      otp_salt:           null,
      otp_expires_at:     null,
      otp_attempts:       null,
    },
  })
  if (updateErr) {
    console.error('[email-otp/verify] metadata update failed:', updateErr.message)
    return NextResponse.json({ error: 'Verification failed — please try again' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
