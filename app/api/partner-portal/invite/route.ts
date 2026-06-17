// Send email invites from the standalone partner portal.
// Handles both 'msme' and 'partner' invite types.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { resend, FROM }             from '@/lib/email/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

function msmeInviteHtml(partnerName: string, msmeUrl: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#0d9488;padding:24px 32px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">MSME Tracker</h1>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Section 43B(h) Compliance — Automated</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">
            <strong>${partnerName}</strong> invited you to try <strong>MSME Tracker</strong> — a tool that automates Udyam declarations, vendor payment deadline tracking, and Section 43B(h) compliance.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
            You can start completely free. No setup needed.
          </p>
          <a href="${msmeUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;">
            Start free →
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
          Powered by upFloat · MSME Tracker
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function partnerInviteHtml(partnerName: string, joinUrl: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#7c3aed;padding:24px 32px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">Partner Program</h1>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Refer clients. Earn commissions.</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">
            <strong>${partnerName}</strong> invited you to join the <strong>Partner Program</strong> — refer businesses to MSME Tracker and earn a commission on every paid plan.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
            No upFloat account needed. Just sign up as a partner, get your referral link, and start sharing.
          </p>
          <a href="${joinUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;">
            Join as a Partner →
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
          Powered by upFloat Partner Program
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { emails, invite_type } = body

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'No emails provided' }, { status: 400 })
  }
  if (emails.length > 20) {
    return NextResponse.json({ error: 'Max 20 emails per batch' }, { status: 400 })
  }
  if (!['msme', 'partner'].includes(invite_type)) {
    return NextResponse.json({ error: 'Invalid invite type' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: partner } = await admin
    .from('standalone_partners')
    .select('id, name, referral_code')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!partner) return NextResponse.json({ error: 'Partner profile not found' }, { status: 404 })

  const msmeUrl   = `${APP_URL}/msme-landing?ref=${partner.referral_code}`
  const joinUrl   = `${APP_URL}/partners/join?ref=${partner.referral_code}`

  let sent = 0; let failed = 0

  for (const email of emails) {
    const normalEmail = email.trim().toLowerCase()
    if (!normalEmail.includes('@')) { failed++; continue }

    const html    = invite_type === 'msme' ? msmeInviteHtml(partner.name, msmeUrl) : partnerInviteHtml(partner.name, joinUrl)
    const subject = invite_type === 'msme'
      ? `${partner.name} invited you to try MSME Tracker`
      : `${partner.name} invited you to join the Partner Program`

    try {
      const { error: emailErr } = await resend.emails.send({ from: FROM, to: normalEmail, subject, html })
      if (emailErr) { failed++; continue }

      // Correctly track invite count: select first, then insert or increment
      const { data: existingInvite } = await admin
        .from('partner_portal_invites')
        .select('id, invite_count')
        .eq('partner_id', partner.id)
        .eq('email', normalEmail)
        .eq('invite_type', invite_type)
        .maybeSingle()

      if (existingInvite) {
        await admin.from('partner_portal_invites')
          .update({ invite_count: existingInvite.invite_count + 1, last_sent_at: new Date().toISOString() })
          .eq('id', existingInvite.id)
      } else {
        await admin.from('partner_portal_invites').insert({
          partner_id:   partner.id,
          email:        normalEmail,
          invite_type,
          invite_count: 1,
          last_sent_at: new Date().toISOString(),
        })
      }

      sent++
    } catch { failed++ }
  }

  // Refresh invite list to return to client
  const { data: invites } = await admin
    .from('partner_portal_invites')
    .select('id, email, invite_type, invite_count, last_sent_at, signed_up')
    .eq('partner_id', partner.id)
    .eq('invite_type', invite_type)
    .order('last_sent_at', { ascending: false })

  return NextResponse.json({ sent, failed, invites: invites ?? [] })
}
