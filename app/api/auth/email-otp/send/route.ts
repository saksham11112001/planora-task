import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { resend, FROM }             from '@/lib/email/resend'
import { createHash, randomBytes }  from 'crypto'

const OTP_EXPIRY_MS        = 10 * 60 * 1000 // 10 minutes
const MIN_RESEND_INTERVAL  = 60 * 1000       // 60 seconds between resends

function generateOtp(): string {
  // Cryptographically random 6-digit code
  return String(100000 + (randomBytes(3).readUIntBE(0, 3) % 900000))
}

function hashOtp(otp: string, salt: string): string {
  return createHash('sha256').update(otp + salt).digest('hex')
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Already confirmed by OAuth provider or Supabase email confirmation — nothing to do
  if (user.email_confirmed_at) {
    return NextResponse.json({ already_verified: true })
  }

  const email = user.email
  if (!email) return NextResponse.json({ error: 'No email on account' }, { status: 400 })

  // Throttle resends: one code per 60 seconds (stored in metadata)
  const meta = user.user_metadata ?? {}
  if (meta.otp_expires_at) {
    const generatedAt = new Date(meta.otp_expires_at).getTime() - OTP_EXPIRY_MS
    const elapsed     = Date.now() - generatedAt
    if (elapsed < MIN_RESEND_INTERVAL) {
      const waitSec = Math.ceil((MIN_RESEND_INTERVAL - elapsed) / 1000)
      return NextResponse.json({ error: `Please wait ${waitSec}s before requesting another code` }, { status: 429 })
    }
  }

  const otp       = generateOtp()
  const salt      = randomBytes(16).toString('hex')
  const hash      = hashOtp(otp, salt)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()

  const admin = createAdminClient()
  const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      otp_hash:       hash,
      otp_salt:       salt,
      otp_expires_at: expiresAt,
      otp_attempts:   0,
    },
  })
  if (updateErr) {
    console.error('[email-otp/send] metadata update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to prepare verification — please try again' }, { status: 500 })
  }

  const { error: emailErr } = await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: 'Your upFloat verification code',
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#0d9488;padding:24px 32px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">upFloat</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:15px;color:#1e293b;font-weight:600;">Your verification code</p>
          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
            Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.
          </p>
          <div style="background:#f1f5f9;border-radius:10px;padding:24px;text-align:center;letter-spacing:0.25em;font-size:36px;font-weight:700;color:#0f172a;font-family:monospace;">
            ${otp}
          </div>
          <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">
            If you didn&apos;t request this, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
          Powered by upFloat
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  })

  if (emailErr) {
    console.error('[email-otp/send] email delivery failed:', emailErr)
    return NextResponse.json({ error: 'Failed to send verification email — please try again' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expires_at: expiresAt })
}
