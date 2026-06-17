import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend, FROM } from '@/lib/email/resend'

// Server-side magic link generation bypasses Supabase client-side email
// domain validation, which rejects some valid corporate domains.
// The admin generateLink API creates the user if they don't exist and
// returns the actual sign-in URL; we deliver it via Resend (same path
// used for all other transactional emails in the app).
export async function POST(req: NextRequest) {
  try {
    const { email, next } = await req.json()
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const admin   = createAdminClient()
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

    // Magic links use PKCE — code lands at /auth/callback (server-side exchange),
    // NOT /auth/confirm (which only handles implicit OAuth hash tokens).
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(next ?? '/dashboard')}`

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.trim(),
      options: { redirectTo },
    })

    if (error || !data?.properties?.action_link) {
      return NextResponse.json(
        { error: error?.message ?? 'Could not generate sign-in link' },
        { status: 400 },
      )
    }

    await resend.emails.send({
      from: FROM,
      to:   email.trim(),
      subject: 'Your upFloat sign-in link',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
          <div style="margin-bottom:24px">
            <span style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">upFloat</span>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Sign in to upFloat</h2>
          <p style="font-size:14px;color:#64748b;margin:0 0 24px;line-height:1.6">
            Click the button below to sign in. This link is valid for 1 hour and can only be used once.
          </p>
          <a href="${data.properties.action_link}"
            style="display:inline-block;padding:13px 28px;background:#0d9488;color:#fff;
              text-decoration:none;border-radius:10px;font-weight:600;font-size:15px">
            Sign in to upFloat →
          </a>
          <p style="font-size:12px;color:#94a3b8;margin:24px 0 0;line-height:1.5">
            If you didn't request this link you can safely ignore this email.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Something went wrong'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
